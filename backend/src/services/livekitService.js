// src/services/livekitService.js  — CORRECTED
'use strict';
const {
  AccessToken,
  RoomServiceClient,
  EgressClient,
  WebhookReceiver,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} = require('livekit-server-sdk');

const apiKey    = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

// The browser connects to the ws/wss URL; the server API clients need http(s).
const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const host = (process.env.LIVEKIT_HOST || LIVEKIT_URL)
  .replace(/^wss:/, 'https:')
  .replace(/^ws:/,  'http:');

const roomService     = new RoomServiceClient(host, apiKey, apiSecret);
const egressClient    = new EgressClient(host, apiKey, apiSecret);
const webhookReceiver = new WebhookReceiver(apiKey, apiSecret);

function isLiveKitCloud() {
  return LIVEKIT_URL.includes('livekit.cloud');
}

function isLocalDockerLiveKit() {
  return /^wss?:\/\/(localhost|127\.0\.0\.1)/i.test(LIVEKIT_URL);
}

if (LIVEKIT_URL) {
  const s3On = process.env.USE_S3_RECORDING === 'true';
  if (isLiveKitCloud()) {
    if (!getS3UploadConfig()) {
      console.warn('⚠️  LIVEKIT_URL points to LiveKit Cloud but S3 output is not configured.');
      console.warn('   Cloud egress requires S3 (S3_BUCKET + AWS credentials + AWS_REGION).');
      console.warn('   See backend/.env.cloud.example. Docker stays optional for local recording.');
    } else {
      console.log('✅ LiveKit: Cloud mode (rooms + egress via Cloud, recordings → S3, no Docker needed)');
    }
  } else if (isLocalDockerLiveKit()) {
    if (!s3On) console.log('✅ LiveKit: local Docker mode (egress → ./lms-recordings)');
    else console.log('✅ LiveKit: local Docker mode with S3 recording output');
  }
}

// ── ONE canonical room name, used by BOTH trainer and trainee ─────────
// trainer + trainees MUST derive the EXACT same room string from the session
// id, or they end up in different rooms and can neither see/hear each other
// nor share chat.
const roomNameFor = (sessionId) => `session_${sessionId}`;

// ── Access-token factory ──────────────────────────────────────────────
// canPublish=true  → may send camera + mic + screen share
// canPublish=false → viewer (watch/listen + chat only)
//
// roomAdmin / roomRecord default to canPublish so EXISTING callers behave
// exactly as before (the trainer go-live still gets admin + record rights).
// The trainee join now passes canPublish:true but roomAdmin:false / roomRecord:false,
// so trainees get camera/mic/screen/chat WITHOUT the power to record or moderate.
//
// canPublishData is granted to EVERYONE, so even a viewer can use chat.
async function generateLiveKitToken(
  user,
  roomName,
  { canPublish = false, roomAdmin = canPublish, roomRecord = canPublish } = {}
) {
  if (!apiKey || !apiSecret) throw new Error('LiveKit API key/secret not configured');

  const identity = String(user._id);                 // stable + trustworthy (from JWT)
  const role     = user.role || (canPublish ? 'trainer' : 'student');

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: user.name || (canPublish ? 'Trainer' : 'Trainee'),
    metadata: JSON.stringify({ role }),
    ttl: '3h',
  });

  at.addGrant({
    roomJoin:       true,
    room:           roomName,
    canPublish,                 // trainer: true · trainee: true (viewer-by-choice)
    canSubscribe:   true,       // everyone can see/hear the room
    canPublishData: true,       // everyone can chat (data channel)
    roomRecord,                 // only the trainer triggers egress
    roomAdmin,                  // only the trainer moderates
  });

  return at.toJwt();            // server-sdk v2 → async
}

// ── Recording: Docker/local egress by default; S3 only when USE_S3_RECORDING=true ──
// LiveKit Cloud has no access to the local ./lms-recordings bind mount, so
// Cloud egress ALWAYS uses the S3 file output (existing S3 configuration).
// Docker remains an optional local path: when LIVEKIT_URL is localhost the
// previous local-disk output is used.
function useS3Recording() {
  if (isLiveKitCloud()) return true;
  return process.env.USE_S3_RECORDING === 'true';
}

function getS3UploadConfig() {
  if (!useS3Recording()) return null;
  const bucket = process.env.S3_BUCKET || process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || process.env.AWS_REGION;
  if (!bucket || !accessKey || !secretKey || !region) return null;
  return { bucket, accessKey, secretKey, region };
}

function buildFileOutput() {
  const s3 = getS3UploadConfig();
  if (s3) {
    return new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: 'recordings/{room_name}/{time}.mp4',
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: s3.accessKey,
          secret:    s3.secretKey,
          bucket:    s3.bucket,
          region:    s3.region,
          endpoint:  process.env.S3_ENDPOINT,
        }),
      },
    });
  }

  // Default: self-hosted LiveKit egress → ./lms-recordings bind mount (/out in container)
  return new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: '/out/{room_name}/{time}.mp4',
  });
}

async function startRecording(roomName) {
  if (!apiKey || !apiSecret || !LIVEKIT_URL || !host) {
    throw new Error('LiveKit is not configured (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET).');
  }

// Cloud egress requires S3 — fail fast with a clear message instead of
  // starting an egress whose file can never be retrieved.
  if (isLiveKitCloud() && !getS3UploadConfig()) {
    throw new Error(
      'LiveKit Cloud recording requires S3 output (S3_BUCKET + AWS credentials + AWS_REGION). ' +
      'Set them in backend/.env — see backend/.env.cloud.example.'
    );
  }

  try {
    const output = buildFileOutput();
    const info = await Promise.race([
      egressClient.startRoomCompositeEgress(roomName, output),
      new Promise((_, reject) => setTimeout(() => reject(new Error('LiveKit egress start timed out')), 15000)),
    ]);
    return info?.egressId || null;
  } catch (err) {
    console.error('startRecording failed:', err.message);
    throw err;
  }
}

async function stopRecording(egressId) {
  if (!egressId) return;
  try {
    await Promise.race([
      egressClient.stopEgress(egressId),
      new Promise((_, reject) => setTimeout(() => reject(new Error('LiveKit egress stop timed out')), 15000)),
    ]);
  } catch (err) { throw err; }
}

async function getEgressInfo(egressId) {
  if (!egressId) return null;
  try {
    let infos = await egressClient.listEgress({ egressId });
    if (!Array.isArray(infos)) infos = infos?.items || [];
    if (infos.length) return infos[0];
  } catch (_) {
    try {
      const infos = await egressClient.listEgress(undefined, undefined, egressId);
      if (Array.isArray(infos) && infos.length) return infos[0];
    } catch (err) {
      console.warn('getEgressInfo failed:', err.message);
    }
  }
  return null;
}

module.exports = {
  LIVEKIT_URL,
  roomService,
  egressClient,
  webhookReceiver,
  roomNameFor,
  generateLiveKitToken,
  startRecording,
  stopRecording,
  getEgressInfo,
};