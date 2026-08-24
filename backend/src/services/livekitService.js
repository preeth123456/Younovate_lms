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

// ── Recording (best-effort; never blocks "go live") ───────────────────
function getS3UploadConfig() {
  const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || process.env.AWS_REGION;
  if (!bucket || !accessKey || !secretKey || !region) return null;
  return { bucket, accessKey, secretKey, region };
}

function isLiveKitCloud() {
  return LIVEKIT_URL.includes('livekit.cloud');
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

  if (isLiveKitCloud()) {
    throw new Error(
      'LiveKit Cloud recording needs S3. Set S3_BUCKET (or AWS_S3_BUCKET), S3_ACCESS_KEY, S3_SECRET_KEY, and S3_REGION on the server.'
    );
  }

  return new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: '/out/{room_name}/{time}.mp4', // self-hosted egress only
  });
}

async function startRecording(roomName) {
  if (!apiKey || !apiSecret || !LIVEKIT_URL || !host) {
    throw new Error('LiveKit is not configured (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET).');
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