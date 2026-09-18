import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  fetchAssignments,
  selectAllAssignments,
  selectAssignmentsError,
  selectAssignmentsStatus,
} from '../../features/assignment/assignmentsSlice';

// Admin Assignments — VIEW/MONITOR ONLY (no create/assign UI; backend
// POST /api/assignments is trainer-only so Admin creation is rejected).

const C = {
  brand: '#2f6f9b',
  brand2: '#1f3d63',
  text: '#172033',
  sub: '#657691',
  line: '#dbe3ed',
  ok: '#16a05f',
  warn: '#d47a00',
  err: '#e12e2a',
  bg: '#f5f8fc',
};

function Badge({ text, tone = 'default' }) {
  const cfg =
    tone === 'ok'
      ? { bg: '#ECFDF5', border: '#BBF7D0', color: C.ok }
      : tone === 'warn'
        ? { bg: '#FFFBEB', border: '#FDE68A', color: C.warn }
        : tone === 'err'
          ? { bg: '#FEF2F2', border: '#FECACA', color: C.err }
          : { bg: '#EEF3F8', border: C.line, color: C.sub };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 900,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
      }}
    >
      {text}
    </span>
  );
}

export default function AdminAssignments() {
  const dispatch = useAppDispatch();
  // Selector already guarantees an array; local guard keeps `.map()` safe.
  const assignmentsRaw = useAppSelector(selectAllAssignments);
  const assignments = Array.isArray(assignmentsRaw) ? assignmentsRaw : [];
  const status = useAppSelector(selectAssignmentsStatus);
  const error = useAppSelector(selectAssignmentsError);

  useEffect(() => {
    dispatch(fetchAssignments());
  }, [dispatch]);

  return (
    <div style={{ padding: 32, fontFamily: 'Public Sans, system-ui, sans-serif' }}>
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, color: C.text }}>Assignments</h2>
          <p style={{ margin: 0, fontSize: 13, color: C.sub }}>
            View/monitor assignment status and trainee progress. Assignments are created by Trainers only. Module theory + practical monitoring is{' '}
            <Link to="/admin/module-assessments" style={{ color: '#1d4ed8', fontWeight: 700 }}>here</Link>.
          </p>
        </div>
        <div style={{ fontSize: 13, color: C.sub, fontWeight: 800 }}>
          Total: {assignments.length}
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          border: `1px solid ${C.line}`,
          boxShadow: '0 1px 2px rgba(23,32,51,.08), 0 12px 28px rgba(31,61,99,.05)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 22 }}>
          {status === 'loading' ? (
            <div style={{ color: C.sub, fontWeight: 800 }}>Loading assignments…</div>
          ) : status === 'failed' ? (
            <div style={{ color: C.err, fontWeight: 900 }}>Error: {error || 'Failed to load assignments'}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Title', 'Type', 'Due', 'Session', 'Status'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: C.sub, fontSize: 12 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a, idx) => {
                    const due = a.dueDate ? new Date(a.dueDate).toLocaleDateString() : a.dueAt ? new Date(a.dueAt).toLocaleDateString() : '—';
                    const session = a.sessionId?.name || a.sessionId?._id || a.session?._id || a.sessionId || '—';
                    const statusTxt = a.status || (a.dueDate ? (new Date(a.dueDate) < new Date() ? 'Due' : 'Active') : 'Active');
                    const tone = statusTxt === 'Due' ? 'warn' : 'ok';

                    return (
                      <tr key={a._id || idx} style={{ background: idx % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                        <td style={{ padding: '11px 14px', color: C.text, fontWeight: 800 }}>{a.title || 'Untitled'}</td>
                        <td style={{ padding: '11px 14px', color: C.sub, fontWeight: 800, textTransform: 'capitalize' }}>{a.type || '—'}</td>
                        <td style={{ padding: '11px 14px', color: C.text, fontWeight: 700 }}>{due}</td>
                        <td style={{ padding: '11px 14px', color: C.text, fontWeight: 700 }}>{session}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <Badge text={statusTxt} tone={tone} />
                        </td>
                      </tr>
                    );
                  })}

                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: C.sub, fontWeight: 800 }}>
                        No assignments found
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

