// Workshop + shared recording file resolution and disk reconciliation.
'use strict';
const path = require('path');
const fs   = require('fs');
const { execSync } = require('child_process');

const RECORDINGS_DIR = path.join(__dirname, '..', '..', '..', 'lms-recordings');
const BASE_RECORDING_URL = (process.env.PUBLIC_API_URL || 'http://localhost:8080').replace(/\/+$/, '');
const EGRESS_CONTAINER = process.env.EGRESS_CONTAINER || 'lms-livekit-egress-1';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRelPath(raw) {
  if (!raw) return '';
  let p = String(raw)
    .replace(/^\/out\//, '')
    .replace(/^\/+/, '');
  // Strip accidental duplicate "recordings/" prefixes from stored URLs.
  while (p.startsWith('recordings/')) {
    p = p.slice('recordings/'.length);
  }
  return p;
}

function buildRecordingUrl(relPath) {
  if (!relPath) return '';
  return `${BASE_RECORDING_URL}/recordings/${relPath}`;
}

// ── S3 / cloud storage ───────────────────────────────────────────────────────
// LiveKit Cloud egress has no access to the local ./lms-recordings bind
// mount, so Cloud mode ALWAYS records to S3 (existing S3 configuration).
// Docker stays an optional local path: only when LIVEKIT_URL is localhost
// does USE_S3_RECORDING=false fall back to local disk.
function isCloudLiveKitUrl() {
  return String(process.env.LIVEKIT_URL || '').includes('livekit.cloud');
}

function useS3Recording() {
  if (isCloudLiveKitUrl()) return true;
  return process.env.USE_S3_RECORDING === 'true';
}

function getS3Config() {
  if (!useS3Recording()) return null;
  const bucket = process.env.S3_BUCKET || process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET;
  const region = process.env.S3_REGION || process.env.AWS_REGION;
  const endpoint = process.env.S3_ENDPOINT || '';
  const publicBase = (process.env.S3_PUBLIC_URL_BASE || process.env.AWS_S3_PUBLIC_URL_BASE || '').replace(/\/+$/, '');
  if (!bucket || !region) return null;
  return { bucket, region, endpoint, publicBase };
}

function isS3Configured() {
  if (!useS3Recording()) return false;
  const s3 = getS3Config();
  const accessKey = process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  return !!(s3 && accessKey && secretKey);
}

function defaultRecordingStorage() {
  return isS3Configured() ? 's3' : 'local';
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function isLocalRecordingUrl(url) {
  if (!url) return false;
  return url.startsWith(`${BASE_RECORDING_URL}/recordings/`);
}

function normalizeS3Key(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/^s3:\/\/[^/]+\//, '')
    .replace(/^\/+/, '');
}

let _s3Client = null;

function getS3Client() {
  if (_s3Client) return _s3Client;
  const s3 = getS3Config();
  if (!s3) return null;
  const accessKey = process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) return null;
  const { S3Client } = require('@aws-sdk/client-s3');
  const config = {
    region: s3.region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  };
  if (s3.endpoint) config.endpoint = s3.endpoint;
  _s3Client = new S3Client(config);
  return _s3Client;
}

/** Extract S3 object key from a Recording doc or session recordingUrl. */
function extractS3KeyFromRecording(recording) {
  if (!recording) return '';
  if (recording.filename) {
    const fromFilename = normalizeS3Key(recording.filename);
    if (fromFilename) return fromFilename;
  }
  if (!recording.url) return '';
  if (isLocalRecordingUrl(recording.url)) {
    return normalizeRelPath(recording.url.replace(`${BASE_RECORDING_URL}/recordings/`, ''));
  }
  if (!isHttpUrl(recording.url)) return normalizeS3Key(recording.url);
  try {
    const u = new URL(recording.url);
    let objectPath = u.pathname.replace(/^\//, '');
    const s3 = getS3Config();
    if (s3 && objectPath.startsWith(`${s3.bucket}/`)) {
      objectPath = objectPath.slice(s3.bucket.length + 1);
    }
    return normalizeS3Key(objectPath);
  } catch (_) {
    return '';
  }
}

/** Temporary signed GET URL for private S3 objects (default 1 hour). */
async function getS3PresignedGetUrl(key, expiresInSeconds = 3600) {
  const s3 = getS3Config();
  const client = getS3Client();
  const normalizedKey = normalizeS3Key(key);
  if (!s3 || !client || !normalizedKey) return '';
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const command = new GetObjectCommand({ Bucket: s3.bucket, Key: normalizedKey });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/** Public HTTPS URL for an object key (bucket policy must allow read on recordings/*). */
function buildS3PublicUrl(key) {
  const s3 = getS3Config();
  if (!s3 || !key) return '';
  const normalizedKey = normalizeS3Key(key);
  if (s3.publicBase) {
    return `${s3.publicBase}/${normalizedKey}`;
  }
  if (s3.endpoint) {
    const base = s3.endpoint.replace(/\/+$/, '');
    return `${base}/${s3.bucket}/${normalizedKey}`;
  }
  return `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${normalizedKey}`;
}

function recordingStorageKind(recording) {
  if (!recording) return 'local';
  if (recording.storage === 's3') return 's3';
  if (recording.url && isHttpUrl(recording.url) && !isLocalRecordingUrl(recording.url)) return 's3';
  if (recording.filename && isS3Configured() && !recording.filename.startsWith('/out/')) {
    const fn = recording.filename;
    if (!fn.includes('\\') && fn.includes('/') && !fileExistsForRelPath(normalizeRelPath(fn))) {
      return 's3';
    }
  }
  return 'local';
}

/** Map LiveKit egress file metadata to playback URL + storage kind. */
function resolveEgressFileUrl(file = {}) {
  const rawLocation = file.location || '';
  const rawFilename = file.filename || '';

  if (isHttpUrl(rawLocation)) {
    return {
      url: rawLocation,
      filename: normalizeS3Key(rawFilename || rawLocation),
      storage: 's3',
    };
  }
  if (isHttpUrl(rawFilename)) {
    return {
      url: rawFilename,
      filename: normalizeS3Key(rawFilename),
      storage: 's3',
    };
  }

  const key = normalizeS3Key(rawFilename || rawLocation);
  if (key && isS3Configured()) {
    return {
      url: buildS3PublicUrl(key),
      filename: key,
      storage: 's3',
    };
  }

  const relPath = normalizeRelPath(rawFilename || rawLocation);
  return {
    url: relPath ? buildRecordingUrl(relPath) : '',
    filename: relPath,
    storage: 'local',
  };
}

function isTerminalEgressStatus(status) {
  const s = String(status || '');
  return s === 'EGRESS_COMPLETE' || s === 'EGRESS_FAILED' || s === 'EGRESS_ABORTED' || s === '3' || s === '4' || s === '5';
}

async function tryReconcileFromLiveKitApi(egressId, recording) {
  if (!isS3Configured() || !egressId) return null;
  try {
    const { getEgressInfo } = require('../services/livekitService');
    const eg = await getEgressInfo(egressId);
    if (!eg) return null;

    const file = eg.fileResults?.[0] || eg.file?.fileResults?.[0] || {};
    const resolved = resolveEgressFileUrl(file);
    if (resolved.storage !== 's3' || !resolved.url) return null;

    const durationSeconds = file.duration ? Math.round(Number(file.duration) / 1e9) : 0;
    const sizeBytes = file.size ? Number(file.size) : 0;
    const isComplete = isTerminalEgressStatus(eg.status) || resolved.url;

    if (!isComplete) return null;

    return finalizeRecordingRemote(recording, {
      url: resolved.url,
      filename: resolved.filename,
      storage: 's3',
      sizeBytes,
      durationSeconds,
      endedAt: recording.endedAt || new Date(),
    });
  } catch (err) {
    console.warn('LiveKit egress reconcile:', err.message);
    return null;
  }
}

function findLatestMp4InRoom(roomName) {
  if (!roomName) return null;
  const roomDir = path.join(RECORDINGS_DIR, roomName);
  if (fs.existsSync(roomDir) && fs.statSync(roomDir).isDirectory()) {
    const mp4s = fs.readdirSync(roomDir)
      .filter((f) => f.toLowerCase().endsWith('.mp4'))
      .map((f) => {
        const full = path.join(roomDir, f);
        const stat = fs.statSync(full);
        return { name: f, full, mtime: stat.mtimeMs, size: stat.size };
      })
      .filter((f) => f.size > 0)
      .sort((a, b) => b.mtime - a.mtime);
    if (mp4s[0]) return mp4s[0];
  }

  // Dev fallback: egress may write inside Docker before the bind mount syncs on Windows.
  try {
    const listed = execSync(
      `docker exec ${EGRESS_CONTAINER} sh -c "ls -1t /out/${roomName}/*.mp4 2>/dev/null"`,
      { encoding: 'utf8', timeout: 15000, windowsHide: true }
    ).trim().split(/\r?\n/).filter(Boolean);
    const latestDocker = listed[0];
    if (!latestDocker) return null;
    const name = path.basename(latestDocker);
    const relPath = `${roomName}/${name}`;
    if (!ensureFileOnHost(relPath)) return null;
    const full = path.join(RECORDINGS_DIR, relPath);
    const stat = fs.statSync(full);
    return { name, full, mtime: stat.mtimeMs, size: stat.size };
  } catch (_) {
    return null;
  }
}

function trySyncFromEgress(relPath) {
  if (!relPath) return false;
  const hostPath = path.join(RECORDINGS_DIR, relPath);
  const hostDir = path.dirname(hostPath);
  try {
    if (!fs.existsSync(hostDir)) fs.mkdirSync(hostDir, { recursive: true });
    const dockerPath = `/out/${relPath.replace(/\\/g, '/')}`;
    execSync(`docker cp "${EGRESS_CONTAINER}:${dockerPath}" "${hostPath}"`, {
      stdio: 'ignore',
      timeout: 60000,
      windowsHide: true,
    });
  } catch (_) {
    return false;
  }
  return fs.existsSync(hostPath) && fs.statSync(hostPath).size > 0;
}

function ensureFileOnHost(relPath) {
  if (!relPath) return false;
  if (fileExistsForRelPath(relPath)) return true;
  return trySyncFromEgress(relPath);
}

function relPathFromStartedAt(roomName, startedAt) {
  if (!roomName || !startedAt) return '';
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  const relPath = `${roomName}/${stamp}.mp4`;
  return ensureFileOnHost(relPath) ? relPath : '';
}

function resolveRelPathFromEgressMeta(egressId, roomName) {
  if (!egressId || !roomName) return '';

  const hostJson = path.join(RECORDINGS_DIR, roomName, `${egressId}.json`);
  if (fs.existsSync(hostJson)) {
    try {
      const data = JSON.parse(fs.readFileSync(hostJson, 'utf8'));
      const f = data.files?.[0]?.filename || data.files?.[0]?.location || '';
      if (f) return normalizeRelPath(f);
    } catch (_) {}
  }

  try {
    const raw = execSync(
      `docker exec ${EGRESS_CONTAINER} cat /out/${roomName}/${egressId}.json`,
      { encoding: 'utf8', timeout: 10000, windowsHide: true }
    );
    const data = JSON.parse(raw);
    const f = data.files?.[0]?.filename || data.files?.[0]?.location || '';
    return normalizeRelPath(f);
  } catch (_) {
    return '';
  }
}

function resolveRelPath(recording) {
  if (recording.egressId && recording.roomName) {
    const fromEgress = resolveRelPathFromEgressMeta(recording.egressId, recording.roomName);
    if (fromEgress) return fromEgress;
  }

  if (recording.roomName && recording.startedAt) {
    const fromTime = relPathFromStartedAt(recording.roomName, recording.startedAt);
    if (fromTime) return fromTime;
  }

  let relPath = '';
  if (recording.url) {
    relPath = normalizeRelPath(recording.url.replace(/^https?:\/\/[^/]+/, ''));
  }
  if (!relPath && recording.filename) {
    relPath = normalizeRelPath(recording.filename);
  }
  return relPath;
}

function fileExistsForRelPath(relPath) {
  if (!relPath) return false;
  const filePath = path.join(RECORDINGS_DIR, relPath);
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
}

function mp4AtomPositions(filePath) {
  const buf = fs.readFileSync(filePath);
  return {
    size: buf.length,
    moov: buf.indexOf(Buffer.from('moov')),
    mdat: buf.indexOf(Buffer.from('mdat')),
  };
}

function mp4NeedsFastStart(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const { moov, mdat, size } = mp4AtomPositions(filePath);
  if (size < 1024 || moov < 0 || mdat < 0) return false;
  return moov > mdat;
}

function applyMp4FastStart(filePath) {
  const { execSync } = require('child_process');
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const temp = `_faststart_${base}`;
  const mount = dir.replace(/\\/g, '/');

  const localOut = filePath + '.faststart.mp4';
  try {
    execSync(
      `"${process.env.FFMPEG_PATH || 'ffmpeg'}" -y -i "${filePath}" -c copy -movflags +faststart "${localOut}"`,
      { stdio: 'ignore', timeout: 120000, windowsHide: true }
    );
    if (fs.existsSync(localOut) && fs.statSync(localOut).size > 0) {
      fs.renameSync(localOut, filePath);
      return true;
    }
  } catch (_) {}

  try {
    execSync(
      `docker run --rm -v "${mount}:/w" jrottenberg/ffmpeg:4-alpine -y -i /w/${base} -c copy -movflags +faststart /w/${temp}`,
      { stdio: 'ignore', timeout: 180000, windowsHide: true }
    );
    const dockerOut = path.join(dir, temp);
    if (fs.existsSync(dockerOut) && fs.statSync(dockerOut).size > 0) {
      fs.unlinkSync(filePath);
      fs.renameSync(dockerOut, filePath);
      return true;
    }
  } catch (err) {
    console.warn('MP4 faststart failed:', err.message);
  }
  return false;
}

/** LiveKit egress writes moov after mdat; browsers need faststart for duration + playback. */
function ensureMp4WebPlayable(filePathOrRel) {
  const filePath = path.isAbsolute(filePathOrRel)
    ? filePathOrRel
    : path.join(RECORDINGS_DIR, filePathOrRel);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1024) return false;
  if (!mp4NeedsFastStart(filePath)) return true;
  return applyMp4FastStart(filePath);
}

function isMp4WebPlayable(relPath) {
  if (!relPath) return false;
  const filePath = path.join(RECORDINGS_DIR, relPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 1024) return false;
  ensureMp4WebPlayable(filePath);
  const { moov, mdat } = mp4AtomPositions(filePath);
  return moov >= 0 && mdat >= 0 && moov < mdat;
}

function readEgressMediaDuration(egressId, roomName) {
  if (!egressId || !roomName) return 0;
  try {
    const hostJson = path.join(RECORDINGS_DIR, roomName, `${egressId}.json`);
    let raw = '';
    if (fs.existsSync(hostJson)) {
      raw = fs.readFileSync(hostJson, 'utf8');
    } else {
      raw = execSync(
        `docker exec ${EGRESS_CONTAINER} cat /out/${roomName}/${egressId}.json`,
        { encoding: 'utf8', timeout: 10000, windowsHide: true }
      );
    }
    const data = JSON.parse(raw);
    if (data.started_at && data.ended_at) {
      return Math.max(1, Math.round((Number(data.ended_at) - Number(data.started_at)) / 1e9));
    }
  } catch (_) {}
  return 0;
}

function localFileIsPlayable(relPath) {
  if (!relPath || !fileExistsForRelPath(relPath)) return false;
  const filePath = path.join(RECORDINGS_DIR, relPath);
  const size = fs.statSync(filePath).size;
  if (size < 1024) return false;
  try { ensureMp4WebPlayable(filePath); } catch (_) {}
  return true;
}

function isRecordingComplete(recording) {
  return recording.status === 'completed'
    || recording.status === 'available'
    || (recording.endedAt && (recording.url || recording.filename));
}

function resolveRecordingPlayback(recording) {
  const kind = recordingStorageKind(recording);

  if (kind === 's3') {
    const key = extractS3KeyFromRecording(recording);
    const s3 = getS3Config();
    const isComplete = isRecordingComplete(recording);
    // Private buckets need presigned URLs via resolveRecordingPlaybackAsync.
    if (s3?.publicBase) {
      const url = recording.url || buildS3PublicUrl(key);
      return { url, playable: isComplete && !!url, relPath: key };
    }
    return { url: '', playable: false, relPath: key };
  }

  const relPath = resolveRelPath(recording);
  if (relPath) ensureFileOnHost(relPath);
  const url = relPath ? buildRecordingUrl(relPath) : (recording.url || '');
  const playable = relPath ? localFileIsPlayable(relPath) : false;
  return { url, playable, relPath };
}

/** Authorized playback URL — presigned GET for private S3, local URL for disk storage. */
async function resolveRecordingPlaybackAsync(recording) {
  const kind = recordingStorageKind(recording);

  if (kind === 's3') {
    const key = extractS3KeyFromRecording(recording);
    const isComplete = isRecordingComplete(recording);
    if (!isComplete || !key) {
      return { url: '', playable: false, relPath: key };
    }

    const s3 = getS3Config();
    if (s3?.publicBase) {
      const url = recording.url || buildS3PublicUrl(key);
      return { url, playable: !!url, relPath: key };
    }

    try {
      const url = await getS3PresignedGetUrl(key);
      return { url, playable: !!url, relPath: key };
    } catch (err) {
      console.warn('S3 presign failed:', err.message);
      return { url: '', playable: false, relPath: key };
    }
  }

  return resolveRecordingPlayback(recording);
}

/** Build a minimal recording-like object from a Session document. */
function recordingSourceFromSession(session) {
  if (!session?.recordingUrl) return null;
  const isS3 = isS3Configured()
    && isHttpUrl(session.recordingUrl)
    && !isLocalRecordingUrl(session.recordingUrl);
  return {
    url: session.recordingUrl,
    filename: extractS3KeyFromRecording({ url: session.recordingUrl }),
    storage: isS3 ? 's3' : 'local',
    status: session.recordingStatus === 'available' ? 'completed' : session.recordingStatus,
    sessionId: session._id,
  };
}

/**
 * Finalize a cloud-stored recording (S3) — no local disk required.
 */
async function finalizeRecordingRemote(recording, { url, filename, storage, sizeBytes, durationSeconds, endedAt } = {}) {
  const Recording = require('../models/Recording');
  const Session   = require('../models/Session');

  const finalUrl = url || buildS3PublicUrl(filename);
  if (!finalUrl) return null;

  const ended = endedAt || recording.endedAt || new Date();
  let duration = durationSeconds || recording.durationSeconds || 0;
  if (!duration && recording.startedAt) {
    duration = Math.max(1, Math.round((ended.getTime() - new Date(recording.startedAt).getTime()) / 1000));
  }

  const updated = await Recording.findOneAndUpdate(
    { egressId: recording.egressId },
    {
      $set: {
        status: 'completed',
        url: finalUrl,
        filename: filename || recording.filename || '',
        storage: storage || 's3',
        sizeBytes: sizeBytes || recording.sizeBytes || 0,
        endedAt: ended,
        durationSeconds: duration,
        error: '',
      },
    },
    { new: true }
  ).lean();

  if (updated?.sessionId) {
    await Session.findByIdAndUpdate(updated.sessionId, {
      $set: { recordingStatus: 'available', recordingUrl: finalUrl, egressId: '' },
    });
  }

  return updated;
}

/**
 * When Egress finishes (or after stop), match the Recording doc to the real MP4 on disk.
 * Only marks completed when the file physically exists.
 */
async function finalizeRecordingOnDisk(recording, relPath, sizeBytes) {
  const Recording = require('../models/Recording');
  const Session   = require('../models/Session');

  const filePath = path.join(RECORDINGS_DIR, relPath);
  if (!fileExistsForRelPath(relPath)) {
    return null;
  }
  try { ensureMp4WebPlayable(filePath); } catch (_) {}

  const url     = buildRecordingUrl(relPath);
  const endedAt = recording.endedAt || new Date();
  let durationSeconds = readEgressMediaDuration(recording.egressId, recording.roomName);
  if (!durationSeconds) durationSeconds = recording.durationSeconds || 0;
  if (!durationSeconds && recording.startedAt) {
    durationSeconds = Math.max(1, Math.round((endedAt.getTime() - new Date(recording.startedAt).getTime()) / 1000));
  }
  const finalSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : (sizeBytes || 0);

  const updated = await Recording.findOneAndUpdate(
    { egressId: recording.egressId },
    {
      $set: {
        status: 'completed',
        url,
        filename: relPath,
        sizeBytes: finalSize,
        endedAt,
        durationSeconds,
        error: '',
      },
    },
    { new: true }
  ).lean();

  if (updated?.sessionId) {
    await Session.findByIdAndUpdate(updated.sessionId, {
      $set: { recordingStatus: 'available', recordingUrl: url, egressId: '' },
    });
  }

  return updated;
}

async function reconcileRecordingByEgressId(egressId, { maxAttempts = 1, delayMs = 0, markFailed = false } = {}) {
  if (!egressId) return null;

  const Recording = require('../models/Recording');
  const Session   = require('../models/Session');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0 && delayMs > 0) await sleep(delayMs);

    const recording = await Recording.findOne({ egressId }).lean();
    if (!recording) return null;

    if (recordingStorageKind(recording) === 's3') {
      if (recording.status === 'completed' && recording.url) {
        return recording;
      }
      if (recording.url) {
        const finalized = await finalizeRecordingRemote(recording, {
          url: recording.url,
          filename: recording.filename,
          storage: 's3',
        });
        if (finalized) return finalized;
      }
      const fromApi = await tryReconcileFromLiveKitApi(egressId, recording);
      if (fromApi) return fromApi;
    }

    if (recording.status === 'completed') {
      const egressPath = resolveRelPathFromEgressMeta(egressId, recording.roomName);
      if (egressPath && ensureFileOnHost(egressPath)) {
        const size = fs.statSync(path.join(RECORDINGS_DIR, egressPath)).size;
        return finalizeRecordingOnDisk(recording, egressPath, size);
      }
      const timePath = relPathFromStartedAt(recording.roomName, recording.startedAt);
      if (timePath) {
        const size = fs.statSync(path.join(RECORDINGS_DIR, timePath)).size;
        return finalizeRecordingOnDisk(recording, timePath, size);
      }
      const { playable, relPath } = resolveRecordingPlayback(recording);
      if (playable && relPath) return recording;
    }

    // Match this egress to its own MP4 via LiveKit egress metadata (never use "latest in room").
    const egressRelPath = resolveRelPathFromEgressMeta(egressId, recording.roomName);
    if (egressRelPath && ensureFileOnHost(egressRelPath)) {
      const size = fs.statSync(path.join(RECORDINGS_DIR, egressRelPath)).size;
      return finalizeRecordingOnDisk(recording, egressRelPath, size);
    }

    const timeRelPath = relPathFromStartedAt(recording.roomName, recording.startedAt);
    if (timeRelPath) {
      const size = fs.statSync(path.join(RECORDINGS_DIR, timeRelPath)).size;
      return finalizeRecordingOnDisk(recording, timeRelPath, size);
    }

    const hintedRelPath = resolveRelPath(recording);
    if (hintedRelPath && ensureFileOnHost(hintedRelPath)) {
      const size = fs.statSync(path.join(RECORDINGS_DIR, hintedRelPath)).size;
      return finalizeRecordingOnDisk(recording, hintedRelPath, size);
    }

    // Fallback: latest MP4 in the room directory (Docker egress writes timestamped files)
    const latest = findLatestMp4InRoom(recording.roomName);
    if (latest) {
      const relPath = `${recording.roomName}/${latest.name}`;
      return finalizeRecordingOnDisk(recording, relPath, latest.size);
    }

    if (isS3Configured()) {
      const fromApi = await tryReconcileFromLiveKitApi(egressId, recording);
      if (fromApi) return fromApi;
    }
  }

  const recording = await Recording.findOne({ egressId }).lean();
  if (!recording) return null;

  if (markFailed && ['processing', 'active'].includes(recording.status)) {
    if (isS3Configured()) {
      const fromApi = await tryReconcileFromLiveKitApi(egressId, recording);
      if (fromApi) return fromApi;
    }
    const error = isS3Configured()
      ? 'Recording file was not found in S3 after processing. Check bucket policy and LiveKit webhook.'
      : 'Recording file was not found after processing. Please try recording again.';
    const failed = await Recording.findOneAndUpdate(
      { egressId },
      { $set: { status: 'failed', error } },
      { new: true }
    ).lean();
    if (failed?.sessionId) {
      await Session.findByIdAndUpdate(failed.sessionId, {
        $set: { recordingStatus: 'none', egressId: '' },
      });
    }
    return failed;
  }

  return recording;
}

module.exports = {
  RECORDINGS_DIR,
  BASE_RECORDING_URL,
  normalizeRelPath,
  buildRecordingUrl,
  getS3Config,
  isS3Configured,
  defaultRecordingStorage,
  buildS3PublicUrl,
  resolveEgressFileUrl,
  recordingStorageKind,
  findLatestMp4InRoom,
  resolveRelPath,
  resolveRelPathFromEgressMeta,
  fileExistsForRelPath,
  mp4NeedsFastStart,
  applyMp4FastStart,
  ensureMp4WebPlayable,
  isMp4WebPlayable,
  readEgressMediaDuration,
  getS3Client,
  extractS3KeyFromRecording,
  getS3PresignedGetUrl,
  resolveRecordingPlayback,
  resolveRecordingPlaybackAsync,
  recordingSourceFromSession,
  finalizeRecordingRemote,
  finalizeRecordingOnDisk,
  reconcileRecordingByEgressId,
};
