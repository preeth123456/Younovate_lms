// Test the recording start flow directly to find the actual error.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { startRecording, roomNameFor, LIVEKIT_URL } = require('./src/services/livekitService');

(async () => {
  const roomName = 'session_test_' + Date.now();
  console.log('Testing startRecording with room:', roomName);
  console.log('LIVEKIT_URL:', LIVEKIT_URL);
  try {
    const egressId = await startRecording(roomName);
    console.log('SUCCESS — egressId:', egressId);
  } catch (err) {
    console.error('FAILED:', err.message);
    console.error('Full error:', err);
  }
  process.exit(0);
})();