import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import WatchRecordingButton from '../../components/recording/WatchRecordingButton';

import {
  fetchSessions,
  createSession,
  deleteSession,
  endSession,
  markAttendance,
  selectAllSessions,
  selectSessionsStatus,
  selectSessionsError,
  selectCreateStatus,
  selectCreateError,
  selectEndStatus,
  selectEndError,
  selectMarkStatus,
  selectMarkError,
  resetCreateStatus,
} from '../../features/session/sessionsSlice';

import {
  fetchBatches,
  selectAllBatches,    // full objects [{_id, name, ...}]
  selectBatchesStatus,
} from '../../features/session/batchSlice';

import {
  fetchCourses,
  selectAllCourses,    // full course docs [{_id, code, trimesters:[...], ...}]
  selectCoursesStatus,
  selectCoursesError,
} from '../../features/admin/courseSlice';

import { fmtDateTime, todayDateInput, nowTimeInput, isPastDateTime } from '../../utils/dateTime';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const SESSION_TYPES = ['S1', 'S2', 'S3', 'S4', 'S5'];

// Google-Calendar-style colour per session type (live overrides to red)
const SESSION_COLORS = {
  S1: '#6366f1', // indigo
  S2: '#0ea5e9', // sky
  S3: '#10b981', // emerald
  S4: '#f59e0b', // amber
  S5: '#8b5cf6', // violet
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const buildCalendar = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  let start = new Date(firstDay);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);
  const weeks = [];
  let cur = new Date(start);
  while (cur <= lastDay || weeks.length < 4) {
    const week = [];
    for (let d = 0; d < 7; d++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(week);
    if (cur > lastDay && weeks.length >= 4) break;
  }
  return weeks;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

const toDateInput = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd= String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const fmtMonthYear = (d) =>
  d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

// Midnight of "today" — used everywhere to classify past vs editable days.
const startOfToday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };

// A day is editable if it is today or in the future (not before midnight today).
const isEditableDay = (day) => {
  const d = new Date(day); d.setHours(0, 0, 0, 0);
  return d >= startOfToday();
};

const isLive = (s) => s.status === 'live' || s.status === 'ongoing';

const rawDate = (s) => s.scheduledAt || s.date || s.startTime;

// Resolve the session type (S1..S5) from explicit field or the title text.
const sessTypeOf = (s) =>
  s.sessionType || (s.title && SESSION_TYPES.find(t => s.title.includes(t))) || null;

const sessColor = (s) =>
  isLive(s) ? '#dc2626' : (SESSION_COLORS[sessTypeOf(s)] || '#1e293b');

const chipLabel = (s) =>
  s.moduleId || s.lmsModuleId ||
  (s.title ? (s.title.length > 11 ? s.title.slice(0, 10) + '…' : s.title) : 'Session');

// Curriculum helpers ──────────────────────────────────────────────────────────
const courseLabel  = (c) => `${c.name || c.title || 'Course'}${c.code ? ` (${c.code})` : ''}`;
const trimLabel    = (t) => `${t.code || `T${t.trimesterNumber}`} — ${t.title || t.focus || 'Trimester'}`;
const monthLabel   = (m) => `${m.code || `M${m.monthNumber}`} — ${m.name || m.title || 'Month'}`;
const subjLabel    = (s, i) => s.name || s.title || s.code || `Subject ${s.order ?? i + 1}`;

// Build the legacy module id ("M4-LMS-03") from the real curriculum selection,
// so the saved title stays compatible with existing data.
const buildModuleId = (month, subject, subjIndex) => {
  if (!month || !subject) return '';
  const monthCode = month.code || `M${month.monthNumber}`;
  const order     = subject.order ?? subjIndex + 1;
  return `${monthCode}-LMS-${String(order).padStart(2, '0')}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #f8fafc; }
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.25} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes modalIn { from{opacity:0;transform:translateY(12px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  .ts-btn:hover { opacity: .87 !important; }

  /* Popup / modal */
  .ts-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(15,23,42,.55); backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeUp .15s ease;
  }
  .ts-modal {
    width: 100%; max-width: 540px; max-height: 86vh; overflow-y: auto;
    background: #fff; border-radius: 16px;
    box-shadow: 0 24px 60px rgba(2,6,23,.32);
    animation: modalIn .2s ease;
  }
  @media (max-width: 600px) {
    .ts-overlay { padding: 0; align-items: flex-end; }              /* bottom sheet */
    .ts-modal   { max-width: 100%; max-height: 92vh; border-radius: 18px 18px 0 0; }
  }

  /* Sessions table — real table on desktop, stacked cards on mobile */
  .ts-tbl-desktop { display: block; }
  .ts-tbl-mobile  { display: none; }
  .ts-tbl tbody tr { transition: background .12s; }
  .ts-tbl tbody tr:hover { background: #f8fafc; }
  @media (max-width: 760px) {
    .ts-tbl-desktop { display: none; }
    .ts-tbl-mobile  { display: block; }
  }

  /* Editable day (today / future) — clear it can be clicked & scheduled */
  .ts-day-edit  { cursor: pointer; }
  .ts-day-edit:hover  { background: #f5f7ff !important; border-color: #c7d2fe !important; }
  /* Past day — view only (read-only), softer hover, never "scheduling" affordance */
  .ts-day-view  { cursor: pointer; }
  .ts-day-view:hover  { background: #f8fafc !important; }

  /* Calendar chip overflow */
  .ts-chips-mobile  { display: none; }
  .ts-chips-desktop { display: block; }

  input:focus, select:focus, textarea:focus {
    outline: none !important;
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,.12) !important;
  }

  @media (max-width: 920px) {
    .ts-layout { flex-direction: column !important; }
    .ts-panel  { flex: unset !important; width: 100% !important; }
  }

  /* Curriculum dropdown grid collapses to 1 column on small screens */
  @media (max-width: 600px) {
    .ts-cascade   { grid-template-columns: 1fr !important; }
    .ts-datetime  { grid-template-columns: 1fr !important; }
    .ts-day          { min-height: 46px !important; padding: 4px 3px 3px !important; }
    .ts-day-num      { font-size: 0.72rem !important; }
    .ts-cal-weekday  { font-size: 0.6rem !important; }
    .ts-chips-desktop { display: none !important; }
    .ts-chips-mobile  { display: flex !important; }
    .ts-cal-title    { font-size: 0.9rem !important; }
  }
`;

const inputSt = {
  width: '100%', border: '1px solid #d1d5db', borderRadius: 8,
  padding: '9px 12px', fontSize: '0.85rem', color: '#111827',
  background: '#fff', fontFamily: 'inherit',
};

const selSt = {
  ...inputSt,
  appearance: 'none', WebkitAppearance: 'none',
  paddingRight: 32, cursor: 'pointer',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ATOMS
// ═══════════════════════════════════════════════════════════════════════════════

const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
    <div style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid #e2e8f0', borderTopColor: '#1e293b', animation: 'spin .7s linear infinite' }} />
  </div>
);

const FL = ({ children }) => (
  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 7 }}>
    {children}
  </label>
);

const ErrBox = ({ msg }) => msg ? (
  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '9px 12px', fontSize: '0.78rem', color: '#b91c1c', marginBottom: 12 }}>
    ⚠️ {msg}
  </div>
) : null;

const OkBox = ({ msg }) => msg ? (
  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '9px 12px', fontSize: '0.78rem', color: '#15803d', marginBottom: 12 }}>
    ✓ {msg}
  </div>
) : null;

// Small pill used in the agenda header
const Badge = ({ text, color, bg }) => (
  <span style={{ background: bg, color, fontSize: '0.66rem', fontWeight: 700, padding: '3px 9px', borderRadius: 999, letterSpacing: '0.3px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
    {text}
  </span>
);

// Reusable styled <select> with chevron — used by the curriculum cascade.
const Dropdown = ({ value, onChange, disabled, placeholder, children }) => (
  <div style={{ position: 'relative' }}>
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      required
      style={{ ...selSt, opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer', background: disabled ? '#f9fafb' : '#fff' }}
    >
      <option value="" disabled>{placeholder}</option>
      {children}
    </select>
    <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: '0.7rem', pointerEvents: 'none' }}>▾</span>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION DAY MODAL  (popup on day click — shows each session's description + details)
//
// Data source is the sessions already loaded by GET /api/trainer/sessions
// (fetchSessions). No extra request needed — every field (description, topics,
// resources, recordingUrl, durationMinutes, status) is already on each session.
// If you add a dedicated detail endpoint later (GET /api/trainer/sessions/:id),
// dispatch it from here and merge the richer payload in.
// ═══════════════════════════════════════════════════════════════════════════════

const SessionDayModal = ({ day, sessions, onClose, onScheduleHere }) => {
  const authToken = useSelector(s => s.auth?.token || '');
  const dayKey   = toDateInput(day);
  const editable = isEditableDay(day);

  // That day's sessions, time-sorted.
  const list = useMemo(() =>
    sessions
      .filter(s => {
        const r = rawDate(s);
        if (!r) return false;
        const d = new Date(r);
        return !isNaN(d) && toDateInput(d) === dayKey;
      })
      .sort((a, b) => new Date(rawDate(a)) - new Date(rawDate(b))),
    [sessions, dayKey]
  );

  // Close on Escape + lock background scroll while open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="ts-overlay" onClick={onClose}>
      <div className="ts-modal" onClick={e => e.stopPropagation()}>

        {/* Header (sticky) */}
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #eef2f7', padding: '18px 22px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, zIndex: 1 }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {day.toLocaleDateString('en-GB', { weekday: 'long' })}
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#111827' }}>
              {day.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 9 }}>
              {editable
                ? <Badge text="Schedulable" color="#4338ca" bg="#eef2ff" />
                : <Badge text="🔒 Read only" color="#6b7280" bg="#f1f5f9" />}
              <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600 }}>
                {list.length} session{list.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="ts-btn" aria-label="Close"
            style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: '1.2rem', color: '#64748b', lineHeight: 1, flexShrink: 0 }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px 22px' }}>
          {list.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: '#9ca3af', background: '#f8fafc', border: '1px dashed #e5e7eb', borderRadius: 10, padding: '24px 16px', textAlign: 'center' }}>
              {editable
                ? 'No sessions scheduled yet. Use the form to add one to this day.'
                : 'No sessions were scheduled on this day.'}
            </div>
          ) : list.map((s, i) => {
            const live      = isLive(s);
            const color     = sessColor(s);
            const type      = sessTypeOf(s);
            const title     = s.moduleId || s.lmsModuleId || s.title || 'Session';
            const batch     = s.batchId?.name || s.batchName || s.batch || '—';
            const topics    = Array.isArray(s.topics) ? s.topics : [];
            const resources = Array.isArray(s.resources) ? s.resources : [];
            const hasExtra  = topics.length > 0 || resources.length > 0 || s.recordingUrl;

            return (
              <div key={s._id || i} style={{ border: '1px solid #eef2f7', borderRadius: 12, padding: '14px 16px 14px 18px', marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />

                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111827' }}>{title}</span>
                    {type && <span style={{ fontSize: '0.62rem', fontWeight: 700, color, background: color + '1A', padding: '2px 7px', borderRadius: 6 }}>{type}</span>}
                  </div>
                  {live
                    ? <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#fff', background: '#dc2626', padding: '3px 9px', borderRadius: 999 }}>● LIVE</span>
                    : <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '3px 9px', borderRadius: 999, textTransform: 'capitalize' }}>{s.status || 'scheduled'}</span>}
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.76rem', color: '#475569', marginBottom: 10 }}>
                  <span>🕒 {fmtDateTime(rawDate(s)) || '—'}{s.durationMinutes ? ` · ${s.durationMinutes} min` : ''}</span>
                  <span>👥 {batch}</span>
                  {s.roomName ? <span>📍 {s.roomName}</span> : null}
                </div>

                {/* Description — the requested detail */}
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: '0.84rem', color: s.description?.trim() ? '#1f2937' : '#9ca3af', lineHeight: 1.55, marginBottom: hasExtra ? 12 : 0 }}>
                  {s.description?.trim() ? s.description : 'No description added for this session.'}
                </div>

                {/* Topics */}
                {topics.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Topics</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {topics.map((t, ti) => (
                        <span key={ti} style={{ fontSize: '0.72rem', color: '#3730a3', background: '#eef2ff', padding: '3px 9px', borderRadius: 999 }}>
                          {typeof t === 'string' ? t : (t.name || t.title || '')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resources + recording */}
                {(resources.length > 0 || s.recordingUrl) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {resources.map((r, ri) => {
                      const url   = typeof r === 'string' ? r : (r.url || r.link);
                      const label = typeof r === 'string' ? r : (r.title || r.name || r.url || 'Resource');
                      return url ? (
                        <a key={ri} href={url} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: '#4338ca', textDecoration: 'none', fontWeight: 600 }}>📎 {label}</a>
                      ) : null;
                    })}
                    {s.recordingUrl && (
                      <WatchRecordingButton
                        sessionId={s._id}
                        token={authToken}
                        workshop={s.sessionType === 'WORKSHOP'}
                        label="▶ Recording"
                        style={{ background: 'transparent', color: '#dc2626', padding: 0, fontSize: '0.78rem' }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer — quick "schedule here" for editable days */}
        {editable && (
          <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #eef2f7', padding: '14px 22px' }}>
            <button onClick={() => { onScheduleHere && onScheduleHere(); onClose(); }} className="ts-btn"
              style={{ width: '100%', padding: '11px', borderRadius: 9, border: 'none', background: '#1e293b', color: '#fff', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Schedule a session on this day
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION CALENDAR  (read-only past · editable future · Google-style chips · mobile)
// ═══════════════════════════════════════════════════════════════════════════════

const SessionCalendar = ({ sessions, calDate, onPrev, onNext, selectedDate, onSelectDate }) => {
  const today = new Date();
  const weeks = buildCalendar(calDate.getFullYear(), calDate.getMonth());
  const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Group sessions by day key (sorted by time so chips read top-to-bottom).
  const byDay = {};
  sessions.forEach(s => {
    const raw = rawDate(s);
    if (!raw) return;
    const d = new Date(raw);
    if (isNaN(d)) return;
    const k = toDateInput(d);
    (byDay[k] = byDay[k] || []).push(s);
  });
  Object.values(byDay).forEach(list =>
    list.sort((a, b) => new Date(rawDate(a)) - new Date(rawDate(b)))
  );

  const MAX_CHIPS = 3;

  return (
    <div>
      {/* Header / month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 className="ts-cal-title" style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
          Session Calendar — {fmtMonthYear(calDate)}
        </h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {['‹', '›'].map((ch, i) => (
            <button key={i} onClick={i === 0 ? onPrev : onNext} className="ts-btn"
              style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: '0.95rem', color: '#6b7280', lineHeight: 1 }}>
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} className="ts-cal-weekday" style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 3 }}>
          {week.map((day, di) => {
            const inMonth    = day.getMonth() === calDate.getMonth();
            const isToday    = isSameDay(day, today);
            const isSelected = isSameDay(day, selectedDate);
            const editable   = isEditableDay(day);          // today + future
            const isPast     = inMonth && !editable;        // before today
            const key        = toDateInput(day);
            const daySess    = inMonth ? (byDay[key] || []) : [];
            const overflow   = Math.max(0, daySess.length - MAX_CHIPS);

            // Visual state
            let bg = '#fff', bd = '1px solid #e5e7eb', numColor = '#374151';
            if (!inMonth)      { numColor = '#cbd5e1'; }
            else if (isPast)   { bg = '#fafafa'; numColor = '#9ca3af'; }
            if (isToday)       { bd = '1.5px solid #6366f1'; numColor = '#6366f1'; }
            if (isSelected && inMonth) { bg = '#eef2ff'; bd = '1.5px solid #6366f1'; }

            // Interaction class: editable → scheduling affordance; past → view only
            const cls = !inMonth ? '' : (editable ? 'ts-day-edit' : 'ts-day-view');

            return (
              <div
                key={di}
                className={`ts-day ${cls}`}
                onClick={() => { if (inMonth) onSelectDate(day); }}
                title={
                  !inMonth ? undefined
                  : editable ? 'Click to schedule on this day'
                  : 'Past date — read only'
                }
                style={{
                  minHeight: 66, borderRadius: 8, padding: '6px 6px 4px',
                  border: bd, background: bg,
                  opacity: inMonth ? 1 : 0.45,
                  pointerEvents: inMonth ? 'auto' : 'none',
                  transition: 'background .12s, border-color .12s',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                <div className="ts-day-num" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.77rem', fontWeight: isToday ? 700 : 500, color: numColor, marginBottom: 4 }}>
                  <span>{day.getDate()}</span>
                  {isPast && daySess.length > 0 && (
                    <span style={{ fontSize: '0.5rem', color: '#cbd5e1', fontWeight: 700, letterSpacing: '0.4px' }}>🔒</span>
                  )}
                </div>

                {/* Desktop / tablet — text chips like Google Calendar */}
                <div className="ts-chips-desktop">
                  {daySess.slice(0, MAX_CHIPS).map((s, si) => {
                    const live = isLive(s);
                    const c    = sessColor(s);
                    return (
                      <div key={si} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: live ? '#dc2626' : c + '1A',  // 10% tint for scheduled
                        color: live ? '#fff' : '#1f2937',
                        fontSize: '0.58rem', fontWeight: 700,
                        padding: '2px 5px', borderRadius: 4, marginBottom: 2,
                        opacity: isPast ? 0.6 : 1,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {!live && <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {live ? 'LIVE NOW' : `${fmtDateTime(rawDate(s))} ${chipLabel(s)}`.trim()}
                        </span>
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#6b7280', paddingLeft: 2 }}>
                      +{overflow} more
                    </div>
                  )}
                </div>

                {/* Mobile — coloured dots (tap day to see the agenda below) */}
                <div className="ts-chips-mobile" style={{ gap: 3, flexWrap: 'wrap', alignContent: 'flex-start' }}>
                  {daySess.slice(0, 4).map((s, si) => (
                    <span key={si} style={{ width: 6, height: 6, borderRadius: '50%', background: sessColor(s), opacity: isPast ? 0.6 : 1 }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Detail now opens in a popup on day click — see SessionDayModal */}
      <div style={{ marginTop: 14, borderTop: '1px solid #eef2f7', paddingTop: 12, fontSize: '0.74rem', color: '#9ca3af', textAlign: 'center' }}>
        Tap any day to view its sessions and descriptions
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE SESSION FORM
//
// Curriculum now comes from the live course document:
//   Course → Trimester → Month → Subject  (cascading selects)
// The legacy moduleId ("M4-LMS-03") is rebuilt from month.code + subject.order so
// saved titles stay compatible with existing data.
//
// Dispatched payload:
//   { batch, courseCode, trimesterCode, monthCode, subjectId, moduleId,
//     sessionType, scheduledAt, durationMinutes, recordingLink?, title }
//
// `presetDate` (YYYY-MM-DD) flows in when an editable calendar day is clicked.
// ═══════════════════════════════════════════════════════════════════════════════

const CreateSessionForm = ({ batches, courses, onCreated, presetDate }) => {
  const dispatch     = useDispatch();
  const createStatus = useSelector(selectCreateStatus);
  const createError  = useSelector(selectCreateError);

  const minDate = todayDateInput();     // cannot schedule before today

  // ── Form state ─────────────────────────────────────────────────────────────
  const [batchObj,   setBatchObj]   = useState(null);
  const [courseId,   setCourseId]   = useState('');
  const [trimCode,   setTrimCode]   = useState('');
  const [monthIdSel, setMonthIdSel] = useState('');   // month _id
  const [subjectId,  setSubjectId]  = useState('');   // subject _id
  const [sessType,   setSessType]   = useState('S1');
  const [date,       setDate]       = useState(presetDate || minDate);
  const [time,       setTime]       = useState('10:00');
  const [duration,   setDuration]   = useState(60);
  const [recLink,    setRecLink]    = useState('');
  const [desc,       setDesc]       = useState('');

  const minTime = useMemo(() => date === minDate ? nowTimeInput() : '', [date, minDate]);
  const [showOk,     setShowOk]     = useState(false);

  // ── Derived curriculum slices (memoised) ─────────────────────────────────────
  const course     = useMemo(() => courses.find(c => c._id === courseId) || null, [courses, courseId]);
  const trimesters = course?.trimesters || [];
  const trimester  = useMemo(() => trimesters.find(t => (t.code || `T${t.trimesterNumber}`) === trimCode) || null, [trimesters, trimCode]);
  const months     = trimester?.months || [];
  const month      = useMemo(() => months.find(m => m._id === monthIdSel) || null, [months, monthIdSel]);
  const subjects   = month?.subjects || [];
  const subjIndex  = subjects.findIndex(s => s._id === subjectId);
  const subject    = subjIndex >= 0 ? subjects[subjIndex] : null;

  const moduleId = buildModuleId(month, subject, subjIndex);
  const title    = moduleId ? `${moduleId} — ${sessType}` : '';

  // Keep the form date in sync when a day is picked on the calendar.
  useEffect(() => { if (presetDate) setDate(presetDate); }, [presetDate]);

  // Default batch once batches load from API.
  useEffect(() => {
    if (batches.length > 0 && !batchObj) setBatchObj(batches[0]);
  }, [batches, batchObj]);

  // Default course once courses load (and try to match the batch's course).
  useEffect(() => {
    if (courses.length === 0) return;
    const wanted = batchObj?.course || batchObj?.courseCode || batchObj?.courseId;
    const matched =
      courses.find(c => c._id === wanted || c.code === wanted || c.name === wanted);
    if (matched) { setCourseId(matched._id); return; }
    if (!courseId) setCourseId(courses[0]._id);
  }, [courses, batchObj]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cascade resets — clear children whenever a parent is no longer valid.
  useEffect(() => { setTrimCode(''); }, [courseId]);
  useEffect(() => { setMonthIdSel(''); }, [trimCode]);
  useEffect(() => { setSubjectId(''); }, [monthIdSel]);

  // Auto-select the only child when a level has exactly one option (nice UX).
  useEffect(() => { if (trimesters.length === 1) setTrimCode(trimesters[0].code || `T${trimesters[0].trimesterNumber}`); }, [trimesters]);
  useEffect(() => { if (months.length === 1) setMonthIdSel(months[0]._id); }, [months]);

  const isPast = isPastDateTime(date, time);
  const ready = batchObj && course && trimester && month && subject && !isPast;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ready) return;

    if (isPastDateTime(date, time)) return;

    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

    const result = await dispatch(createSession({
      batch:          batchObj.name,                 // backend resolves name → _id
      courseCode:     course.code,
      trimesterCode:  trimester.code || `T${trimester.trimesterNumber}`,
      monthCode:      month.code || `M${month.monthNumber}`,
      subjectId:      subject._id,
      moduleId,                                       // e.g. "M4-LMS-03"
      sessionType:    sessType,
      scheduledAt,
      durationMinutes: Number(duration) || 60,
      recordingLink:  recLink || undefined,
      description:    desc || undefined,
      title,                                          // e.g. "M4-LMS-03 — S2"
    }));

    if (createSession.fulfilled.match(result)) {
      setShowOk(true);
      setRecLink('');
      setDesc('');
      dispatch(resetCreateStatus());
      onCreated();                                    // re-fetch sessions → calendar updates
      setTimeout(() => setShowOk(false), 3000);
    }
  };

  const saving   = createStatus === 'loading';
  const disabled = saving || !ready;

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', marginBottom: 20 }}>
        Create Session
      </h2>

      {/* ── Batch ── */}
      <div style={{ marginBottom: 16 }}>
        <FL>Batch</FL>
        <Dropdown
          value={batchObj?._id || ''}
          onChange={e => setBatchObj(batches.find(b => b._id === e.target.value) || null)}
          placeholder={batches.length === 0 ? 'Loading batches…' : 'Select batch…'}
        >
          {batches.map(b => (
            <option key={b._id} value={b._id}>
              {b.name}
              {b.course ? ` — ${b.course}` : ''}
              {b.status === 'upcoming' ? ' (Upcoming)' : b.status === 'active' ? ' ✓' : ''}
            </option>
          ))}
        </Dropdown>
      </div>

      {/* ── Curriculum cascade: Course → Trimester → Month → Subject ── */}
      <div className="ts-cascade" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <FL>Course</FL>
          <Dropdown
            value={courseId}
            onChange={e => setCourseId(e.target.value)}
            placeholder={courses.length === 0 ? 'Loading courses…' : 'Select course…'}
          >
            {courses.map(c => <option key={c._id} value={c._id}>{courseLabel(c)}</option>)}
          </Dropdown>
        </div>

        <div>
          <FL>LMS Trimester</FL>
          <Dropdown
            value={trimCode}
            onChange={e => setTrimCode(e.target.value)}
            disabled={!course}
            placeholder={!course ? 'Pick a course first' : 'Select trimester…'}
          >
            {trimesters.map(t => {
              const code = t.code || `T${t.trimesterNumber}`;
              return <option key={code} value={code}>{trimLabel(t)}</option>;
            })}
          </Dropdown>
        </div>

        <div>
          <FL>Month</FL>
          <Dropdown
            value={monthIdSel}
            onChange={e => setMonthIdSel(e.target.value)}
            disabled={!trimester}
            placeholder={!trimester ? 'Pick a trimester first' : 'Select month…'}
          >
            {months.map(m => <option key={m._id} value={m._id}>{monthLabel(m)}</option>)}
          </Dropdown>
        </div>

        <div>
          <FL>Subject</FL>
          <Dropdown
            value={subjectId}
            onChange={e => setSubjectId(e.target.value)}
            disabled={!month}
            placeholder={!month ? 'Pick a month first' : 'Select subject…'}
          >
            {subjects.map((s, i) => <option key={s._id} value={s._id}>{subjLabel(s, i)}</option>)}
          </Dropdown>
        </div>
      </div>

      {/* Derived module id preview — confirms what will be saved */}
      {moduleId && (
        <div style={{ marginBottom: 16, fontSize: '0.74rem', color: '#6b7280' }}>
          Module ID:&nbsp;
          <span style={{ fontWeight: 700, color: '#4338ca', background: '#eef2ff', padding: '2px 8px', borderRadius: 6 }}>{moduleId}</span>
          &nbsp;→ title <strong style={{ color: '#374151' }}>{title}</strong>
        </div>
      )}

      {/* ── Session Type S1–S5 ── */}
      <div style={{ marginBottom: 16 }}>
        <FL>Session Type</FL>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {SESSION_TYPES.map(t => (
            <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.84rem', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="radio" name="sessType" value={t}
                checked={sessType === t}
                onChange={() => setSessType(t)}
                style={{ accentColor: '#6366f1', width: 15, height: 15, cursor: 'pointer' }}
              />
              {t}
            </label>
          ))}
        </div>
      </div>

      {/* ── Date + Time + Duration ── */}
      <div className="ts-datetime" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <FL>Date</FL>
          <input type="date" value={date} min={minDate} onChange={e => setDate(e.target.value)} style={inputSt} required />
        </div>
        <div>
          <FL>Time</FL>
          <input type="time" value={time} min={minTime} onChange={e => setTime(e.target.value)} style={inputSt} required />
        </div>
        <div>
          <FL>Duration (min)</FL>
          <input type="number" min={15} step={5} value={duration} onChange={e => setDuration(e.target.value)} style={inputSt} required />
        </div>
      </div>

      {/* ── Description ── */}
      <div style={{ marginBottom: 16 }}>
        <FL>Description (optional)</FL>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          rows={3}
          placeholder="What will this session cover?"
          style={{ ...inputSt, resize: 'vertical' }}
        />
      </div>

      {/* ── Recording Link ── */}
      <div style={{ marginBottom: 20 }}>
        <FL>Recording Link (optional)</FL>
        <input
          type="url" value={recLink}
          onChange={e => setRecLink(e.target.value)}
          placeholder="https://meet.google.com/…"
          style={inputSt}
        />
      </div>

      {isPast && (
        <ErrBox msg="You can only schedule sessions for today or a future date and time." />
      )}
      <ErrBox msg={createError} />
      <OkBox  msg={showOk ? 'Session scheduled successfully!' : null} />

      <button
        type="submit"
        disabled={disabled}
        className="ts-btn"
        style={{
          width: '100%', padding: '12px', borderRadius: 9, border: 'none',
          background: disabled ? '#94a3b8' : '#1e293b',
          color: '#fff', fontWeight: 700, fontSize: '0.9rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'opacity .15s',
        }}
      >
        {saving ? 'Scheduling…' : 'Schedule Session'}
      </button>
    </form>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE SESSION PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const LiveSessionPanel = ({ session, onEnded }) => {
  const dispatch   = useDispatch();
  const endStatus  = useSelector(selectEndStatus);
  const endError   = useSelector(selectEndError);
  const markStatus = useSelector(selectMarkStatus);
  const markError  = useSelector(selectMarkError);
  const [markOk,   setMarkOk] = useState(false);

  const moduleLabel =
    session.lmsModuleId || session.moduleId ||
    (session.title ? session.title.split('—')[0].trim() : '—');
  const batchLabel =
    session.batchId?.name || session.batchName || session.batch || '—';

  // PUT /api/trainer/sessions/:id/end
  const handleEnd = async () => {
    if (!window.confirm('End this live session?')) return;
    const result = await dispatch(endSession(session._id));
    if (endSession.fulfilled.match(result)) onEnded();
  };

  // POST /api/attendance/mark
  const handleMark = async () => {
    const result = await dispatch(markAttendance({ sessionId: session._id }));
    if (markAttendance.fulfilled.match(result)) {
      setMarkOk(true);
      setTimeout(() => setMarkOk(false), 3000);
    }
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px 24px', background: '#fff', marginTop: 20, animation: 'fadeUp .3s ease' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: 18 }}>
        Today's Session — <span style={{ color: '#dc2626' }}>LIVE</span>
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          {[
            { label: 'Module', value: moduleLabel },
            { label: 'Batch',  value: batchLabel  },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#111827' }}>{value}</div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#dc2626' }}>Live</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {markOk && <span style={{ fontSize: '0.74rem', color: '#15803d', fontWeight: 500 }}>✓ Marked</span>}
          <button onClick={handleMark} disabled={markStatus === 'loading'} className="ts-btn"
            style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db', padding: '8px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity .15s' }}>
            {markStatus === 'loading' ? 'Marking…' : 'Mark Attendance'}
          </button>
          <button onClick={handleEnd} disabled={endStatus === 'loading'} className="ts-btn"
            style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: endStatus === 'loading' ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'opacity .15s' }}>
            {endStatus === 'loading' ? 'Ending…' : 'End Session'}
          </button>
        </div>
      </div>

      <ErrBox msg={endError || markError} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED — status pill · confirm dialog · pagination
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_STYLES = {
  scheduled: { color: '#475569', bg: '#f1f5f9' },
  live:      { color: '#fff',    bg: '#dc2626' },
  ongoing:   { color: '#fff',    bg: '#dc2626' },
  completed: { color: '#15803d', bg: '#dcfce7' },
  cancelled: { color: '#b91c1c', bg: '#fee2e2' },
};

const StatusPill = ({ status }) => {
  const st   = STATUS_STYLES[status] || STATUS_STYLES.scheduled;
  const live = status === 'live' || status === 'ongoing';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', fontWeight: 700, color: st.color, background: st.bg, padding: '3px 9px', borderRadius: 999, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {live && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse 1.2s infinite' }} />}
      {status || 'scheduled'}
    </span>
  );
};

const ConfirmDialog = ({ title, message, confirmLabel = 'Delete', danger = true, busy, onConfirm, onCancel }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="ts-overlay" onClick={onCancel}>
      <div className="ts-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div style={{ padding: '24px 24px 22px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#111827', marginBottom: 8 }}>{title}</h3>
          <p style={{ fontSize: '0.86rem', color: '#6b7280', lineHeight: 1.55 }}>{message}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button onClick={onCancel} disabled={busy} className="ts-btn"
              style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={busy} className="ts-btn"
              style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', background: danger ? '#dc2626' : '#1e293b', color: '#fff', fontWeight: 700, fontSize: '0.86rem', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Pagination = ({ page, pageCount, onChange }) => {
  if (pageCount <= 1) return null;
  const pages = [];
  const around = 1;
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || (p >= page - around && p <= page + around)) pages.push(p);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  const btn = (label, p, opts = {}) => (
    <button key={`${label}-${p}`} disabled={opts.disabled} onClick={() => p && onChange(p)} className="ts-btn"
      style={{ minWidth: 32, height: 32, padding: '0 8px', borderRadius: 8, border: '1px solid ' + (opts.active ? '#6366f1' : '#e5e7eb'), background: opts.active ? '#6366f1' : '#fff', color: opts.active ? '#fff' : (opts.disabled ? '#cbd5e1' : '#374151'), fontWeight: 700, fontSize: '0.78rem', cursor: opts.disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
      {btn('‹', page - 1, { disabled: page <= 1 })}
      {pages.map((p, i) => p === '…'
        ? <span key={`e${i}`} style={{ color: '#9ca3af', padding: '0 4px' }}>…</span>
        : btn(p, p, { active: p === page }))}
      {btn('›', page + 1, { disabled: page >= pageCount })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SESSIONS TABLE  (search · status filter · pagination · edit/delete · responsive)
// ═══════════════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 8;

const RowActions = ({ s, onView, onEdit, onDelete, deleting }) => {
  // A completed session is locked: View stays, but Edit + Delete are disabled.
  const locked = (s.status || '').toLowerCase() === 'completed';

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      <button onClick={() => onView(s)} className="ts-btn" title="View"
        style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        👁 View
      </button>
      <button onClick={() => !locked && onEdit(s)} disabled={locked} className="ts-btn"
        title={locked ? 'Completed sessions can’t be edited' : 'Edit'}
        style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #e5e7eb', background: locked ? '#f8fafc' : '#fff', color: locked ? '#cbd5e1' : '#374151', fontSize: '0.74rem', fontWeight: 600, cursor: locked ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: locked ? 0.7 : 1 }}>
        ✏️ Edit
      </button>
      <button onClick={() => !locked && onDelete(s)} disabled={deleting || locked} className="ts-btn"
        title={locked ? 'Completed sessions can’t be deleted' : 'Delete'}
        style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid ' + (locked ? '#e5e7eb' : '#fecaca'), background: locked ? '#f8fafc' : '#fff', color: (deleting || locked) ? '#cbd5e1' : '#dc2626', fontSize: '0.74rem', fontWeight: 600, cursor: (deleting || locked) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: locked ? 0.7 : 1 }}>
        {deleting ? '…' : '🗑 Delete'}
      </button>
    </div>
  );
};

const SessionTable = ({ sessions, onView, onEdit, onCreate, onDelete, deletingId }) => {
  const [query, setQuery]     = useState('');
  const [statusF, setStatusF] = useState('all');
  const [page, setPage]       = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions
      .filter(s => {
        if (statusF !== 'all') {
          if (statusF === 'live') { if (!isLive(s)) return false; }
          else if ((s.status || 'scheduled') !== statusF) return false;
        }
        if (!q) return true;
        const hay = [s.title, s.moduleId, s.description, s.batchId?.name, s.batchName, s.batch]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(rawDate(b) || 0) - new Date(rawDate(a) || 0)); // newest first
  }, [sessions, query, statusF]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => { if (page > pageCount) setPage(1); }, [pageCount, page]);
  const start = (page - 1) * PAGE_SIZE;
  const rows  = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div style={{ marginTop: 24, border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', padding: '20px 22px' }}>
      {/* Header + controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#111827' }}>
          All Sessions <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af' }}>({filtered.length})</span>
        </h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Search title, batch…"
            style={{ ...inputSt, width: 200, maxWidth: '100%', padding: '8px 12px' }} />
          <div style={{ position: 'relative' }}>
            <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1); }}
              style={{ ...selSt, width: 160, padding: '8px 30px 8px 12px' }}>
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: '0.7rem', pointerEvents: 'none' }}>▾</span>
          </div>
          <button onClick={onCreate} className="ts-btn" title="Create a new session"
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#1e293b', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            + New Session
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ fontSize: '0.85rem', color: '#9ca3af', background: '#f8fafc', border: '1px dashed #e5e7eb', borderRadius: 10, padding: '28px 16px', textAlign: 'center' }}>
          No sessions match your filters.
        </div>
      ) : (
        <>
          {/* DESKTOP — table */}
          <div className="ts-tbl-desktop" style={{ overflowX: 'auto' }}>
            <table className="ts-tbl" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>
                  {['Session', 'Batch', 'Scheduled', 'Status', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: i === 4 ? 'right' : 'left', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 12px 10px', borderBottom: '1px solid #eef2f7', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const type  = sessTypeOf(s);
                  const color = sessColor(s);
                  return (
                    <tr key={s._id || i} style={{ borderBottom: '1px solid #f5f7fa' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#111827' }}>
                              {s.moduleId || s.title || 'Session'}{type ? ` · ${type}` : ''}
                            </div>
                            {s.description ? (
                              <div style={{ fontSize: '0.72rem', color: '#9ca3af', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap' }}>{s.batchId?.name || s.batchName || s.batch || '—'}</td>
                      <td style={{ padding: '12px', fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDateTime(rawDate(s))}</td>
                      <td style={{ padding: '12px' }}><StatusPill status={s.status} /></td>
                      <td style={{ padding: '12px' }}><RowActions s={s} onView={onView} onEdit={onEdit} onDelete={onDelete} deleting={deletingId === s._id} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE — cards */}
          <div className="ts-tbl-mobile">
            {rows.map((s, i) => {
              const type  = sessTypeOf(s);
              const color = sessColor(s);
              return (
                <div key={s._id || i} style={{ border: '1px solid #eef2f7', borderRadius: 12, padding: '12px 14px 12px 16px', marginBottom: 10, position: 'relative', overflow: 'hidden' }}>
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#111827' }}>
                      {s.moduleId || s.title || 'Session'}{type ? ` · ${type}` : ''}
                    </div>
                    <StatusPill status={s.status} />
                  </div>
                  {s.description ? (
                    <div style={{ fontSize: '0.76rem', color: '#6b7280', marginBottom: 8, lineHeight: 1.45 }}>{s.description}</div>
                  ) : null}
                  <div style={{ fontSize: '0.74rem', color: '#475569', marginBottom: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>👥 {s.batchId?.name || s.batchName || s.batch || '—'}</span>
                    <span>📅 {fmtDateTime(rawDate(s))}</span>
                  </div>
                  <RowActions s={s} onView={onView} onEdit={onEdit} onDelete={onDelete} deleting={deletingId === s._id} />
                </div>
              );
            })}
          </div>

          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const TrainerSessions = () => {
  const dispatch = useDispatch();

  // ── Sessions (sessionsSlice) ───────────────────────────────────────────────
  const sessions = useSelector(selectAllSessions);
  const status   = useSelector(selectSessionsStatus);
  const error    = useSelector(selectSessionsError);

  // ── Batches (batchSlice) — full objects from GET /api/batches ─────────────
  const batches       = useSelector(selectAllBatches);
  const batchesStatus = useSelector(selectBatchesStatus);

  // ── Courses (curriculum) — courseSlice ────────────────────────────────────
  const courses        = useSelector(selectAllCourses);
  const coursesStatus  = useSelector(selectCoursesStatus);
  const coursesError   = useSelector(selectCoursesError);
  const coursesLoading = coursesStatus === 'loading';

  // ── Local UI ──────────────────────────────────────────────────────────────
  const [calDate,      setCalDate]      = useState(new Date()); // visible month
  const [selectedDate, setSelectedDate] = useState(new Date()); // agenda focus
  const [formDate,     setFormDate]     = useState(toDateInput(new Date())); // synced into form
  const [modalDay,     setModalDay]     = useState(null);       // open popup for this day
  const [confirmDelete,setConfirmDelete]= useState(null);       // session pending delete
  const [deletingId,   setDeletingId]   = useState(null);

  const navigate = useNavigate();

  useEffect(() => { dispatch(fetchSessions()); }, [dispatch]);
  useEffect(() => { dispatch(fetchBatches());  }, [dispatch]);
  useEffect(() => { dispatch(fetchCourses());  }, [dispatch]);

  const reload = useCallback(() => { dispatch(fetchSessions()); }, [dispatch]);

  // Selecting a day: focus it, open the popup, and (if editable) feed the form.
  const handleSelectDate = useCallback((day) => {
    setSelectedDate(day);
    setModalDay(day);
    if (isEditableDay(day)) setFormDate(toDateInput(day));
  }, []);

  // Update — PUT, then refresh the list (avoids assuming slice state shape).
  // Delete — DELETE, then refresh.
  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete) return;
    const id = confirmDelete._id;
    setDeletingId(id);
    const result = await dispatch(deleteSession(id));
    setDeletingId(null);
    if (deleteSession.fulfilled.match(result)) { setConfirmDelete(null); reload(); }
  }, [confirmDelete, dispatch, reload]);

  const today    = new Date();
  const liveSess = sessions.filter(s =>
    isLive(s) && isSameDay(new Date(rawDate(s) || 0), today)
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif", color: '#111827' }}>
      <style>{CSS}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* PAGE HEADER */}
        <div style={{ marginBottom: 28, animation: 'fadeUp .3s ease' }}>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.4px', marginBottom: 5 }}>
            Live Session Management
          </h1>
          <p style={{ fontSize: '0.84rem', color: '#6b7280' }}>
            Schedule, start, and end training sessions linked to the LMS curriculum
          </p>
        </div>

        <ErrBox msg={error && status === 'failed' ? error : null} />
        <ErrBox msg={coursesError ? `Couldn't load curriculum: ${coursesError}` : null} />

        {/* 2-COL LAYOUT */}
        <div className="ts-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* LEFT — Calendar */}
          <div className="ts-panel" style={{ flex: '0 0 48%', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 20px', background: '#fff' }}>
            {status === 'loading' ? <Spinner /> : (
              <SessionCalendar
                sessions={sessions}
                calDate={calDate}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                onPrev={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                onNext={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              />
            )}
          </div>

          {/* RIGHT — Create Session Form */}
          <div className="ts-panel" style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 24px', background: '#fff' }}>
            {(batchesStatus === 'loading' && batches.length === 0) || (coursesLoading && courses.length === 0)
              ? <Spinner />
              : (
                <CreateSessionForm
                  batches={batches}
                  courses={courses}
                  onCreated={reload}
                  presetDate={formDate}
                />
              )
            }
          </div>
        </div>

        {/* LIVE SESSION PANEL */}
        {liveSess.map(s => (
          <LiveSessionPanel key={s._id} session={s} onEnded={reload} />
        ))}

        {status === 'succeeded' && liveSess.length === 0 && (
          <div style={{ marginTop: 20, border: '1px dashed #e5e7eb', borderRadius: 12, padding: '16px 20px', background: '#fff', fontSize: '0.84rem', color: '#9ca3af' }}>
            No live session running today.
          </div>
        )}

        {/* ALL SESSIONS — searchable, paginated; View/Edit/New open a routed page */}
        <SessionTable
          sessions={sessions}
          onView={(s) => navigate(`${s._id}`)}
          onEdit={(s) => navigate(`${s._id}/edit`)}
          onCreate={() => navigate('new')}
          onDelete={setConfirmDelete}
          deletingId={deletingId}
        />
      </div>

      {/* DAY DETAIL POPUP */}
      {modalDay && (
        <SessionDayModal
          day={modalDay}
          sessions={sessions}
          onClose={() => setModalDay(null)}
          onScheduleHere={() => setFormDate(toDateInput(modalDay))}
        />
      )}

      {/* DELETE CONFIRM */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete session?"
          message={`This permanently removes "${confirmDelete.moduleId || confirmDelete.title || 'this session'}". This action cannot be undone.`}
          busy={deletingId === confirmDelete._id}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
};

export default TrainerSessions;