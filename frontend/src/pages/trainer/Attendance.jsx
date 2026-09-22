// src/pages/trainer/Attendance.jsx
// upGrad-style, fully responsive attendance marking.
//   • Session selector + live session summary line
//   • Summary stat cards (Present / Absent / Late / At-risk)
//   • Trainee search
//   • Segmented P/A/L control, attendance % bar, risk flag, absence reason
//   • Mark All Present · Mark All Absent · Submit (POST /api/attendance/mark per trainee)
//   • Responsive: real table on desktop, stacked cards on mobile (no horizontal scroll)
// All data flows through trainerSlice via Redux — wiring unchanged.

import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import AppIcon from '../../components/shared/AppIcon';

import {
  fetchTrainerSessions,
  fetchTrainerStudents,
  fetchSessionAttendance,
  markAttendance,
  selectTrainerSessions,
  selectSessionsStatus,
  selectTrainerStudents,
  selectStudentsStatus,
  selectAttendance,
  selectAttendanceStatus,
  selectMarkStatus,
  selectMarkError,
} from '../../features/Trainer/trainerSlice';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS + HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const RISK_THRESHOLD = 80;

// Status palette (semantic): present=green, absent=red, late=amber.
const PAL = {
  P: { label: 'Present', short: 'P', color: '#15803d', bg: '#dcfce7', api: 'present' },
  A: { label: 'Absent',  short: 'A', color: '#b91c1c', bg: '#fee2e2', api: 'absent'  },
  L: { label: 'Late',    short: 'L', color: '#b45309', bg: '#fef3c7', api: 'late'    },
};

const fmtSession = (s) => {
  if (!s) return '';
  const d  = s.scheduledAt ? new Date(s.scheduledAt) : null;
  const dt = d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
                 ' · ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
  const mod = s.moduleId || s.lmsModuleId || s.title || 'Session';
  const bat = s.batchId?.name || '';
  return [mod, bat, dt].filter(Boolean).join(' · ');
};

const barColor = (pct) => (pct >= 85 ? '#16a34a' : pct >= RISK_THRESHOLD ? '#f59e0b' : '#dc2626');

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

// Deterministic soft avatar colour from a name.
const avatarColor = (name = '') => {
  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

// ═══════════════════════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════════════════════

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #f6f7fb; }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes barGrow { from { width: 0; } to { width: var(--w); } }

  .at-row { transition: background .12s; }
  .at-row:hover { background: #fafbff !important; }
  .at-btn:hover { opacity: .9; }
  .seg { transition: background .12s, color .12s, border-color .12s; }
  .reason-input { border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 11px; font-size: 0.78rem;
    color: #374151; width: 100%; outline: none; font-family: inherit; transition: border-color .15s, box-shadow .15s; }
  .reason-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
  select.sess-sel:focus, input.at-search:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
  .submit-btn:hover:not(:disabled) { transform: translateY(-1px); }
  .submit-btn:disabled { opacity: .5; cursor: not-allowed; }

  /* Desktop table vs mobile cards */
  .at-desktop { display: block; }
  .at-mobile  { display: none; }
  @media (max-width: 820px) {
    .at-desktop { display: none; }
    .at-mobile  { display: block; }
  }
  @media (max-width: 580px) {
    .at-actionbar { flex-direction: column-reverse !important; align-items: stretch !important; }
    .at-actionbar > * { width: 100%; }
    .at-controls { flex-direction: column !important; align-items: stretch !important; }
  }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// ATOMS
// ═══════════════════════════════════════════════════════════════════════════════

const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
    <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#6366f1', animation: 'spin .7s linear infinite' }} />
  </div>
);

const Avatar = ({ name }) => (
  <span style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(name), color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
    {initials(name)}
  </span>
);

const AttBar = ({ pct }) => {
  const color = barColor(pct);
  const w = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', minWidth: 70 }}>
        <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 4, '--w': `${w}%`, animation: 'barGrow .5s ease' }} />
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color, minWidth: 34, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
};

const RiskBadge = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef3c7', color: '#d97706',
    border: '1px solid #fde68a', fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap' }}>
    ⚠ At risk
  </span>
);

// Segmented Present / Absent / Late control (accessible radio group under the hood).
const PALControl = ({ name, value, onChange }) => (
  <div role="radiogroup" aria-label="Attendance" style={{ display: 'inline-flex', border: '1px solid #e2e8f0', borderRadius: 9, overflow: 'hidden', background: '#fff' }}>
    {Object.entries(PAL).map(([key, cfg], i) => {
      const active = value === key;
      return (
        <label key={key} className="seg"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 40, padding: '7px 12px',
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, userSelect: 'none',
            background: active ? cfg.color : '#fff', color: active ? '#fff' : '#64748b',
            borderLeft: i === 0 ? 'none' : '1px solid #e2e8f0' }}
          title={cfg.label}>
          <input type="radio" name={name} value={key} checked={active} onChange={() => onChange(key)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          {cfg.short}
        </label>
      );
    })}
  </div>
);

const StatCard = ({ label, value, color, bg }) => (
  <div style={{ background: '#fff', border: '1px solid #eef0f5', borderRadius: 12, padding: '14px 16px', flex: '1 1 120px', minWidth: 120 }}>
    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: color || '#0f172a', lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 6 }}>{label}</div>
    {bg && <div style={{ height: 3, background: bg, borderRadius: 3, marginTop: 10 }} />}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// TRAINEE ROW (desktop) + CARD (mobile)
// ═══════════════════════════════════════════════════════════════════════════════

const TraineeRow = ({ st, mark, reason, isRisk, onMark, onReason, last }) => (
  <tr className="at-row" style={{ borderBottom: last ? 'none' : '1px solid #f4f6fa', background: mark === 'A' ? '#fefce8' : '#fff' }}>
    <td style={{ padding: '13px 16px', minWidth: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar name={st.name} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>{st.name}</div>
          <div style={{ fontSize: '0.71rem', color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{st.email}</div>
        </div>
      </div>
    </td>
    <td style={{ padding: '13px 16px', minWidth: 150 }}><AttBar pct={Number(st._pct)} /></td>
    <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}><PALControl name={`att-${st._id}`} value={mark} onChange={(v) => onMark(st._id, v)} /></td>
    <td style={{ padding: '13px 16px', minWidth: 90 }}>{isRisk && <RiskBadge />}</td>
    <td style={{ padding: '13px 16px', minWidth: 200 }}>
      {mark === 'A' && (
        <input className="reason-input" placeholder="Reason for absence…" value={reason || ''} onChange={(e) => onReason(st._id, e.target.value)} />
      )}
    </td>
  </tr>
);

const TraineeCard = ({ st, mark, reason, isRisk, onMark, onReason }) => (
  <div style={{ border: '1px solid #eef0f5', borderRadius: 12, padding: 14, marginBottom: 10, background: mark === 'A' ? '#fefce8' : '#fff' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
      <Avatar name={st.name} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>{st.name}</div>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.email}</div>
      </div>
      {isRisk && <RiskBadge />}
    </div>
    <div style={{ marginBottom: 12 }}><AttBar pct={Number(st._pct)} /></div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today</span>
      <PALControl name={`att-m-${st._id}`} value={mark} onChange={(v) => onMark(st._id, v)} />
    </div>
    {mark === 'A' && (
      <input className="reason-input" style={{ marginTop: 10 }} placeholder="Reason for absence…" value={reason || ''} onChange={(e) => onReason(st._id, e.target.value)} />
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

const TrainerAttendance = () => {
  const dispatch = useDispatch();

  const sessions      = useSelector(selectTrainerSessions);
  const sessStatus    = useSelector(selectSessionsStatus);
  const students      = useSelector(selectTrainerStudents);
  const stuStatus     = useSelector(selectStudentsStatus);
  const allAttendance = useSelector(selectAttendance);
  const attStatus     = useSelector(selectAttendanceStatus);
  const markStatus    = useSelector(selectMarkStatus);
  const markError     = useSelector(selectMarkError);

  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [marks,   setMarks]   = useState({});   // { [traineeId]: 'P'|'A'|'L' }
  const [reasons, setReasons] = useState({});   // { [traineeId]: string }
  const [query,   setQuery]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Initial load
  useEffect(() => {
    dispatch(fetchTrainerSessions());
    dispatch(fetchTrainerStudents());
  }, [dispatch]);

  // Auto-select first session once they load
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) setSelectedSessionId(sessions[0]._id);
  }, [sessions, selectedSessionId]);

  // On session change: load existing attendance + reset local marks
  useEffect(() => {
    if (!selectedSessionId) return;
    dispatch(fetchSessionAttendance(selectedSessionId));
    setMarks({});
    setReasons({});
    setQuery('');
  }, [selectedSessionId, dispatch]);

  // Pre-fill marks from existing records when attendance arrives
  useEffect(() => {
    const att = allAttendance[selectedSessionId];
    if (!att) return;
    const records = att?.records || att?.data?.records || [];
    if (records.length === 0) return;
    const pre = {};
    records.forEach(r => {
      const id = r.trainee?._id || r.traineeId;
      if (!id) return;
      pre[id] = r.status === 'present' ? 'P' : r.status === 'absent' ? 'A' : 'L';
    });
    if (Object.keys(pre).length) setMarks(pre);
  }, [allAttendance, selectedSessionId]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const selectedSession = sessions.find(s => s._id === selectedSessionId);
  const sessionBatchId  = selectedSession?.batchId?._id || selectedSession?.batchId;

  const sessionStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sessionTraineeIds = new Set(
      (selectedSession?.trainees || [])
        .map(t => String(t._id || t))
    );
    return students
      .filter(st => {
        const batchIds = (st.batchIds || []).map(b => String(b._id || b));
        const inBatch = sessionBatchId ? batchIds.includes(String(sessionBatchId)) : true;
        const inSession = sessionTraineeIds.size > 0 ? sessionTraineeIds.has(String(st._id)) : true;
        if (!inBatch && !inSession) return false;
        if (!q) return true;
        return `${st.name || ''} ${st.email || ''}`.toLowerCase().includes(q);
      })
      .map(st => ({ ...st, _pct: st.attendance ?? st.averageAttendance ?? 0 }));
  }, [students, sessionBatchId, query, selectedSession]);

  const effMark = (id) => marks[id] || 'P';

  const counts = useMemo(() => {
    const c = { P: 0, A: 0, L: 0, risk: 0 };
    sessionStudents.forEach(st => {
      c[effMark(st._id)]++;
      if (Number(st._pct) < RISK_THRESHOLD) c.risk++;
    });
    return c;
  }, [sessionStudents, marks]);

  const atRiskStudents = sessionStudents.filter(st => Number(st._pct) < RISK_THRESHOLD);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const setMark = (id, val) => {
    setMarks(m => ({ ...m, [id]: val }));
    if (val !== 'A') setReasons(r => { const n = { ...r }; delete n[id]; return n; });
  };
  const setReason = (id, val) => setReasons(r => ({ ...r, [id]: val }));

  const markAll = (val) => {
    const next = {};
    sessionStudents.forEach(st => { next[st._id] = val; });
    setMarks(next);
    if (val !== 'A') setReasons({});
  };

  const handleSubmit = async () => {
    if (!selectedSessionId || sessionStudents.length === 0) return;
    setSubmitting(true);

    const results = await Promise.all(sessionStudents.map(st =>
      dispatch(markAttendance({
        sessionId: selectedSessionId,
        traineeId: st._id,
        status:    PAL[effMark(st._id)].api,
        reason:    reasons[st._id] || '',
      }))
    ));

    setSubmitting(false);
    const errors = results.filter(r => markAttendance.rejected.match(r)).length;
    if (errors === 0) {
      toast.success('Attendance submitted successfully!');
      dispatch(fetchSessionAttendance(selectedSessionId));
    } else {
      toast.error(`${errors} record(s) failed to save`);
    }
  };

  const attLoading   = attStatus[selectedSessionId] === 'loading';
  const isSubmitting = submitting || markStatus === 'loading';
  const tableLoading = attLoading || stuStatus === 'loading';

  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: '#f6f7fb', fontFamily: "'Inter', system-ui, sans-serif", color: '#0f172a' }}>
      <style>{CSS}</style>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 24px' }}>

        {/* HEADER */}
        <div style={{ marginBottom: 22, animation: 'fadeUp .3s ease' }}>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 5 }}>Mark Attendance</h1>
          {selectedSession
            ? <p style={{ fontSize: '0.84rem', color: '#64748b' }}>Session: {fmtSession(selectedSession)}</p>
            : <p style={{ fontSize: '0.84rem', color: '#64748b' }}>Pick a session to record attendance for its batch.</p>}
        </div>

        {/* CONTROLS — session selector + search */}
        <div className="at-controls" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Session</label>
            {sessStatus === 'loading' ? <Spinner /> : (
              <div style={{ position: 'relative' }}>
                <select className="sess-sel" value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 36px 11px 13px',
                    fontSize: '0.85rem', color: '#0f172a', background: '#fff', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <option value="" disabled>— Select a session —</option>
                  {sessions.map(s => <option key={s._id} value={s._id}>{fmtSession(s)}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8', fontSize: '0.75rem' }}>▾</span>
              </div>
            )}
          </div>
          {selectedSessionId && (
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Search trainee</label>
              <div style={{ position: 'relative' }}>
                <AppIcon name="search" size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input className="at-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or email…"
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 13px 11px 34px', fontSize: '0.85rem', color: '#0f172a', background: '#fff', fontFamily: 'inherit' }} />
              </div>
            </div>
          )}
        </div>

        {/* SUMMARY STATS */}
        {selectedSessionId && !tableLoading && sessionStudents.length > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18, animation: 'fadeUp .3s ease' }}>
            <StatCard label="Trainees" value={sessionStudents.length} />
            <StatCard label="Present"  value={counts.P} color={PAL.P.color} bg={PAL.P.color} />
            <StatCard label="Absent"   value={counts.A} color={PAL.A.color} bg={PAL.A.color} />
            <StatCard label="Late"     value={counts.L} color={PAL.L.color} bg={PAL.L.color} />
            <StatCard label="At risk"  value={counts.risk} color="#d97706" bg="#f59e0b" />
          </div>
        )}

        {/* MAIN CARD */}
        {selectedSessionId && (
          <div style={{ background: '#fff', border: '1px solid #eef0f5', borderRadius: 14, boxShadow: '0 1px 8px rgba(15,23,42,.05)', overflow: 'hidden', animation: 'fadeUp .3s ease' }}>

            {/* ACTION BAR */}
            <div className="at-actionbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="at-btn" onClick={() => markAll('P')} disabled={sessionStudents.length === 0}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✓ Mark All Present
                </button>
                <button className="at-btn" onClick={() => markAll('A')} disabled={sessionStudents.length === 0}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff5f5', color: '#b91c1c', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✕ Mark All Absent
                </button>
              </div>
              <button className="submit-btn" onClick={handleSubmit} disabled={isSubmitting || sessionStudents.length === 0}
                style={{ padding: '10px 24px', borderRadius: 9, border: 'none', background: isSubmitting ? '#94a3b8' : '#1e293b', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'transform .15s, opacity .15s' }}>
                {isSubmitting ? 'Submitting…' : 'Submit Attendance'}
              </button>
            </div>

            {tableLoading ? <Spinner /> : sessionStudents.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <span style={{ width: 52, height: 52, borderRadius: 14, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AppIcon name="search" size={22} style={{ color: '#64748B' }} />
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {query ? 'No trainees match your search.' : "No students found for this session's batch."}
                </div>
              </div>
            ) : (
              <>
                {/* DESKTOP TABLE */}
                <div className="at-desktop" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #f1f5f9' }}>
                        {['Trainee', 'Attendance %', 'Today', 'Risk', 'Override reason'].map(h => (
                          <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.67rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sessionStudents.map((st, i) => (
                        <TraineeRow key={st._id} st={st} mark={effMark(st._id)} reason={reasons[st._id]}
                          isRisk={Number(st._pct) < RISK_THRESHOLD} onMark={setMark} onReason={setReason}
                          last={i === sessionStudents.length - 1} />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARDS */}
                <div className="at-mobile" style={{ padding: 14 }}>
                  {sessionStudents.map(st => (
                    <TraineeCard key={st._id} st={st} mark={effMark(st._id)} reason={reasons[st._id]}
                      isRisk={Number(st._pct) < RISK_THRESHOLD} onMark={setMark} onReason={setReason} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* EMPTY — no session selected */}
        {!selectedSessionId && sessStatus === 'succeeded' && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Select a session to mark attendance</div>
          </div>
        )}

        {/* AT-RISK BANNER */}
        {selectedSessionId && atRiskStudents.length > 0 && (
          <div style={{ marginTop: 16, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 16px', animation: 'fadeUp .3s ease' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e', marginBottom: atRiskStudents.length ? 8 : 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚠ {atRiskStudents.length} trainee{atRiskStudents.length === 1 ? '' : 's'} below {RISK_THRESHOLD}% attendance
            </div>
            {atRiskStudents.map(st => (
              <div key={st._id} style={{ fontSize: '0.81rem', color: '#92400e', lineHeight: 1.6 }}>
                <strong style={{ color: '#78350f' }}>{st.name}</strong> is at {Number(st._pct)}% — risk flag will be auto-raised on submission.
              </div>
            ))}
          </div>
        )}

        {/* MARK ERROR */}
        {markError && (
          <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: '0.79rem', color: '#b91c1c' }}>
            ⚠️ {markError}
          </div>
        )}

      </div>
    </div>
  );
};

export default TrainerAttendance;