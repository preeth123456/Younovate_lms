// Admin Recording Playback
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

const S = {
  page: { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)', padding: 24, maxWidth: 900, margin: '0 auto' },
  videoWrap: { background: '#000', borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  back: { background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 },
  title: { margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#0F172A' },
  meta: { margin: '0 0 16px', fontSize: 13, color: '#64748B' },
  error: { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '16px 20px', color: '#B91C1C', fontSize: 14 },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function AdminRecordingPlayback() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useSelector(s => s.auth?.token || '');
  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || !token) return;
    setLoading(true);
    setError('');
    axios.get(`${API}/api/admin/workshops/recordings/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setRecording(res.data?.recording || null))
      .catch(e => setError(e.response?.data?.message || 'Failed to load recording'))
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) {
    return <div style={S.page}><div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>Loading recording…</div></div>;
  }

  if (error || !recording) {
    return (
      <div style={S.page}>
        <button style={S.back} onClick={() => navigate('/admin/recordings')}>← Back to Recordings</button>
        <div style={S.card}>
          <div style={S.error}>⚠️ {error || 'Recording not found'}</div>
        </div>
      </div>
    );
  }

  const isAvailable = recording.status === 'available' || recording.status === 'completed';
  const displayStatus = recording.status === 'active' ? 'recording' : recording.status === 'completed' ? 'available' : recording.status;
  const canPlay = isAvailable && recording.playable && recording.url;

  return (
    <div style={S.page}>
      <button style={S.back} onClick={() => navigate('/admin/recordings')}>← Back to Recordings</button>
      <div style={S.card}>
        <h1 style={S.title}>Recorded Video</h1>
        <p style={S.meta}>
          Session: {recording.sessionId?.title || '—'} &nbsp;|&nbsp;
          Trainer: {recording.trainerId?.name || '—'} &nbsp;|&nbsp;
          Date: {fmtDate(recording.startedAt)} &nbsp;|&nbsp;
          Duration: {fmtDuration(recording.durationSeconds)}
        </p>

        {canPlay ? (
          <div style={S.videoWrap}>
            <video
              controls
              preload="metadata"
              style={{ width: '100%', display: 'block' }}
              src={recording.url}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        ) : (
          <div style={{ ...S.error, textAlign: 'center' }}>
            {!isAvailable
              ? `Recording is currently "${displayStatus}". It will be available once processing completes.`
              : 'Recording file is unavailable. The file may have been removed or the recording failed.'}
          </div>
        )}

        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            background: displayStatus === 'available' || displayStatus === 'completed' ? '#D1FAE5' : displayStatus === 'processing' ? '#DBEAFE' : '#FEE2E2',
            color: displayStatus === 'available' || displayStatus === 'completed' ? '#065F46' : displayStatus === 'processing' ? '#1E40AF' : '#991B1B',
            padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'capitalize'
          }}>
            {displayStatus || 'none'}
          </span>
          {recording.durationSeconds > 0 && <span style={{ fontSize: 12, color: '#64748B' }}>{fmtDuration(recording.durationSeconds)}</span>}
        </div>
      </div>
    </div>
  );
}
