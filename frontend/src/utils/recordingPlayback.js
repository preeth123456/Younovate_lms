import axios from 'axios';
import { API_BASE_URL } from '../config/api';

/**
 * Fetch a temporary authorized playback URL for a session recording.
 * Uses backend presigned S3 URLs for private buckets.
 */
export async function fetchSessionRecordingPlaybackUrl(sessionId, token, { workshop = false } = {}) {
  const path = workshop
    ? `/api/workshop-sessions/${sessionId}/recording/playback`
    : `/api/trainer/sessions/${sessionId}/recording/playback`;
  const { data } = await axios.get(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!data?.success || !data?.url) {
    throw new Error(data?.message || 'Recording playback URL unavailable');
  }
  return data.url;
}

export async function openSessionRecording(sessionId, token, options) {
  const url = await fetchSessionRecordingPlaybackUrl(sessionId, token, options);
  window.open(url, '_blank', 'noopener,noreferrer');
}
