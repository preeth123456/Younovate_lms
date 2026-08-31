import React, { useState } from 'react';
import { openSessionRecording } from '../../utils/recordingPlayback';

export default function WatchRecordingButton({
  sessionId,
  token,
  workshop = false,
  label = '▶ Watch recording',
  style = {},
  className = '',
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    if (!sessionId || !token || loading) return;
    setLoading(true);
    setError('');
    try {
      await openSessionRecording(sessionId, token, { workshop });
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Could not open recording.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !token}
        className={className}
        style={{
          background: '#1e293b',
          color: '#fff',
          border: 'none',
          padding: '6px 14px',
          borderRadius: 7,
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: loading || !token ? 'wait' : 'pointer',
          ...style,
        }}
      >
        {loading ? 'Opening…' : label}
      </button>
      {error ? <span style={{ fontSize: '0.72rem', color: '#b91c1c' }}>{error}</span> : null}
    </span>
  );
}
