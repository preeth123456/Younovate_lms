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
function buildFileOutput() {
  if (process.env.S3_BUCKET) {
    return new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: '{room_name}/{time}.mp4',
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: process.env.S3_ACCESS_KEY,
          secret:    process.env.S3_SECRET_KEY,
          bucket:    process.env.S3_BUCKET,
          region:    process.env.S3_REGION,
          endpoint:  process.env.S3_ENDPOINT, // set for R2 / Backblaze / MinIO
        }),
      },
    });
  }
  return new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: '/out/{room_name}/{time}.mp4', // self-hosted egress only
  });
}

async function startRecording(roomName) {
  try {
    const info = await Promise.race([
      egressClient.startRoomCompositeEgress(roomName, { file: buildFileOutput() }),
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

module.exports = {
  LIVEKIT_URL,
  roomService,
  egressClient,
  webhookReceiver,
  roomNameFor,
  generateLiveKitToken,
  startRecording,
  stopRecording,
};