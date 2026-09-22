// src/pages/admin/Sessions.jsx
//
// ADMIN session console — schedule, assign (trainer + batch + trainees),
// reschedule, cancel and delete the sessions that connect trainers and trainees.
//
// Data layer: features/admin/adminSessionsSlice.js (store key `adminSessions`).
//
// Features:
//   • Multi-field filter bar: text search (title / trainer / batch) + status +
//     trainer + batch dropdowns, with a Clear button.
//   • Prominent, wider "Schedule Session" button (full-width on mobile).
//   • Built-in toast + confirm dialogs for every API response (NO external deps).
//   • status === 'completed'  → Edit + Delete DISABLED (locked); Cancel hidden.
//   • status === 'cancelled'  → Cancel hidden; Edit/Delete still allowed.
//   • Pagination over the FILTERED list (client-side).
//   • Responsive: table on desktop, cards on mobile; modal grids collapse.

import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  fetchAdminSessions,
  fetchPickers,
  createSession,
  updateSession,
  deleteSession,
  clearAdminSessionErrors,
  selectAdminSessions,
  selectAdminSessionsStatus,
  selectAdminSessionsError,
  selectTrainerOptions,
  selectBatchOptions,
  selectTraineeOptions,
  selectSaveStatus,
  selectSaveError,
} from '../../features/admin/adminSessionsSlice';
import { toLocalInput, fromLocalInput, minDateTime, isPastDateTime } from '../../utils/dateTime';
import AppIcon from '../../components/shared/AppIcon';

const SC = { scheduled: '#2f6f9b', live: '#e12e2a', completed: '#16a05f', cancelled: '#657691' };
const STATUSES = ['scheduled', 'live', 'completed', 'cancelled'];

const formatSessionStatus = (st) => {
  return st;
};

// Toast look-up (icon glyph + colours).
const TOAST = {
  success: { color: '#16a05f', border: '#bfe6d0', glyph: '✓' },
  error:   { color: '#c0392b', border: '#f3c2bd', glyph: '✕' },
  warning: { color: '#b06f00', border: '#f0d9a8', glyph: '⚠' },
  info:    { color: '#2f6f9b', border: '#bcd6ea', glyph: 'ℹ' },
};

// ── Windowed page list: [1, '…', 4, 5, 6, '…', 20] ─────────────────────────────
function pageList(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, 2, total - 1, total, cur - 1, cur, cur + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const n of nums) {
    if (prev && n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

// ── Tiny responsive hook ───────────────────────────────────────────────────────
function useIsMobile(bp = 720) {
  const get = () =>
    typeof window !== 'undefined' && window.matchMedia(`(max-width:${bp}px)`).matches;
  const [mobile, setMobile] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () =>
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange);
  }, [bp]);
  return mobile;
}

const EMPTY_FORM = {
  _id: null, title: '', trainerId: '', batchId: '', trainees: [],
  scheduledAt: '', durationMinutes: 60, passcode: '', description: '', status: 'scheduled',
};

export default function AdminSessions() {
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile();

  const sessions   = useAppSelector(selectAdminSessions);
  const status     = useAppSelector(selectAdminSessionsStatus);
  const loadError  = useAppSelector(selectAdminSessionsError);
  const trainers   = useAppSelector(selectTrainerOptions);
  const batches    = useAppSelector(selectBatchOptions);
  const trainees   = useAppSelector(selectTraineeOptions);
  const saveStatus = useAppSelector(selectSaveStatus);
  const saveError  = useAppSelector(selectSaveError);

  const [modal, setModal] = useState(null);     // null | { mode:'create'|'edit', form }
  const [formError, setFormError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // ── Built-in toast + confirm (no external libs) ──
  const [toasts, setToasts] = useState([]);
  const pushToast = (icon, title) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, icon, title }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };
  const [confirmState, setConfirmState] = useState(null);  // { title, text, confirmText, danger, resolve }
  const confirm = (opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve }));
  const resolveConfirm = (val) => { if (confirmState) confirmState.resolve(val); setConfirmState(null); };

  // ── Filters ──
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [fTrainer, setFTrainer] = useState('');
  const [fBatch, setFBatch] = useState('');
  const [traineeSearch, setTraineeSearch] = useState('');

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const saving = saveStatus === 'loading';
  const loading = status === 'loading' || status === 'idle';

  // ── Load on mount ─────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.allSettled([dispatch(fetchAdminSessions()), dispatch(fetchPickers())]);
  }, [dispatch]);

  // ── Display lookups (resolve ids → names even if not populated) ────────────────
  const trainerName = (s) =>
    s.trainerId?.name ||
    trainers.find((t) => String(t._id) === String(s.trainerId))?.name || '—';
  const batchNameOf = (s) =>
    s.batchId?.name ||
    batches.find((b) => String(b._id) === String(s.batchId))?.name || '—';

  // ── Filtering ──
  const filtered = useMemo(() => {
    let list = sessions;
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((s) => {
        const tName = s.trainerId?.name || trainers.find((t) => String(t._id) === String(s.trainerId))?.name || '';
        const bName = s.batchId?.name || batches.find((b) => String(b._id) === String(s.batchId))?.name || '';
        return (
          (s.title || '').toLowerCase().includes(needle) ||
          tName.toLowerCase().includes(needle) ||
          bName.toLowerCase().includes(needle)
        );
      });
    }
    if (fStatus !== 'all') list = list.filter((s) => s.status === fStatus);
    if (fTrainer) list = list.filter((s) => String(s.trainerId?._id || s.trainerId) === String(fTrainer));
    if (fBatch)   list = list.filter((s) => String(s.batchId?._id || s.batchId) === String(fBatch));
    return list;
  }, [sessions, q, fStatus, fTrainer, fBatch, trainers, batches]);

  const hasFilters = !!(q.trim() || fStatus !== 'all' || fTrainer || fBatch);
  const clearFilters = () => { setQ(''); setFStatus('all'); setFTrainer(''); setFBatch(''); };

  // Reset to page 1 whenever a filter changes.
  useEffect(() => { setPage(1); }, [q, fStatus, fTrainer, fBatch]);

  // ── Derived pagination (over FILTERED) ──
  const total = filtered.length;
  const allTotal = sessions.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(total, page * pageSize);

  // ── Modal helpers ──────────────────────────────────────────────────────────────
  const openCreate = () => { setFormError(null); setTraineeSearch(''); setModal({ mode: 'create', form: { ...EMPTY_FORM } }); };
  const openEdit = (s) => {
    if (s.status === 'completed') return;   // guard: completed is locked
    setFormError(null);
    setTraineeSearch('');
    setModal({
      mode: 'edit',
      form: {
        _id: s._id,
        title: s.title || '',
        trainerId: s.trainerId?._id || s.trainerId || '',
        batchId: s.batchId?._id || s.batchId || '',
        trainees: (s.trainees || []).map((t) => (t?._id ? String(t._id) : String(t))),
        scheduledAt: toLocalInput(s.scheduledAt),
        durationMinutes: s.durationMinutes ?? 60,
        passcode: s.passcode || '',
        description: s.description || '',
        status: s.status || 'scheduled',
      },
    });
  };
  const closeModal = () => { if (!saving) { setModal(null); dispatch(clearAdminSessionErrors()); } };
  const setField = (k, v) => setModal((m) => (m ? { ...m, form: { ...m.form, [k]: v } } : m));
  const toggleTrainee = (id) =>
    setModal((m) => {
      if (!m) return m;
      const has = m.form.trainees.includes(id);
      const next = has ? m.form.trainees.filter((x) => x !== id) : [...m.form.trainees, id];
      return { ...m, form: { ...m.form, trainees: next } };
    });

  // ── Save ────────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!modal) return;
    const f = modal.form;
    if (!f.title.trim()) return setFormError('Title is required.');
    if (!f.trainerId)    return setFormError('Please assign a trainer.');
    if (!f.batchId)      return setFormError('Please choose a batch.');
    if (!f.scheduledAt)  return setFormError('Please pick a date & time.');
    if (!f.trainees || f.trainees.length === 0) return setFormError('At least 1 trainee should be selected');

    if (isPastDateTime(f.scheduledAt)) return setFormError('Session date and time cannot be in the past.');

    const payload = {
      title: f.title.trim(),
      trainerId: f.trainerId,
      batchId: f.batchId,
      trainees: f.trainees,
      scheduledAt: fromLocalInput(f.scheduledAt),
      durationMinutes: Number(f.durationMinutes) || 60,
      passcode: f.passcode.trim(),
      description: f.description.trim(),
    };
    setFormError(null);
    try {
      if (modal.mode === 'create') {
        await dispatch(createSession(payload)).unwrap();
        setPage(1);
        pushToast('success', 'Session scheduled');
      } else {
        await dispatch(updateSession({ id: f._id, ...payload, status: f.status })).unwrap();
        pushToast('success', 'Session updated');
      }
      setModal(null);
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Could not save the session.';
      setFormError(msg);
      pushToast('error', msg);
    }
  };

  // ── Cancel (soft) / Delete (hard) ─────────────────────────────────────────────
  const cancelSession = async (s) => {
    if (s.status === 'completed' || s.status === 'cancelled') return;
    const ok = await confirm({
      title: 'Cancel this session?',
      text: `"${s.title}" — trainees will no longer be able to join.`,
      confirmText: 'Yes, cancel it',
      danger: true,
    });
    if (!ok) return;
    setBusyId(s._id);
    try {
      await dispatch(updateSession({ id: s._id, status: 'cancelled' })).unwrap();
      pushToast('success', 'Session cancelled');
    } catch (err) {
      pushToast('error', typeof err === 'string' ? err : 'Could not cancel the session.');
    } finally { setBusyId(null); }
  };

  const removeSession = async (s) => {
    if (s.status === 'completed') return;
    const ok = await confirm({
      title: 'Delete this session?',
      text: `"${s.title}" will be permanently removed. This cannot be undone.`,
      confirmText: 'Yes, delete it',
      danger: true,
    });
    if (!ok) return;
    setBusyId(s._id);
    try {
      await dispatch(deleteSession(s._id)).unwrap();
      pushToast('success', 'Session deleted');
    } catch (err) {
      pushToast('error', typeof err === 'string' ? err : 'Could not delete the session.');
    } finally { setBusyId(null); }
  };

  // ── Trainees filtered to the chosen batch (convenience) + trainee search ──────
  const formTrainees = useMemo(() => {
    if (!modal) return [];
    const bId = modal.form.batchId;
    const base = !bId ? trainees : (() => {
      const inBatch = trainees.filter((t) => (t.batchIds || []).map(String).includes(String(bId)));
      return inBatch.length ? inBatch : trainees;
    })();
    const needle = traineeSearch.trim().toLowerCase();
    if (!needle) return base;
    return base.filter((t) =>
      (t.name || '').toLowerCase().includes(needle) ||
      (t.email || '').toLowerCase().includes(needle)
    );
  }, [modal, trainees, traineeSearch]);

  // ── Row action buttons (shared by table + cards) ──────────────────────────────
  const RowActions = ({ s }) => {
    const rowBusy = busyId === s._id;
    const isCompleted = s.status === 'completed';
    const isCancelled = s.status === 'cancelled';

    const editDisabled = rowBusy || isCompleted;
    const deleteDisabled = rowBusy || isCompleted;

    const btnStyle = (bg, border, text, disabled) => ({
      padding: '6px 10px',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      fontFamily: 'inherit',
      border: `1px solid ${border}`,
      background: bg,
      color: text,
      transition: 'all 0.15s ease',
      whiteSpace: 'nowrap',
    });

    return (
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        {/* Edit */}
        <button
          onClick={() => openEdit(s)}
          disabled={editDisabled}
          style={btnStyle('#F8FAFC', '#E2E8F0', '#475569', editDisabled)}
          title={isCompleted ? 'Completed sessions are locked' : 'Edit session'}
        >
          <AppIcon name="edit" size={14} /> {rowBusy && editDisabled ? '…' : ''}
        </button>

        {/* Cancel */}
        {!isCompleted && !isCancelled && (
          <button
            onClick={() => cancelSession(s)}
            disabled={rowBusy}
            style={btnStyle('#FEF3C7', '#FDE68A', '#B45309', rowBusy)}
            title={rowBusy ? 'Please wait…' : 'Cancel session'}
          >
            🛑 {rowBusy ? '…' : ''}
          </button>
        )}

        {/* Delete */}
        <button
          onClick={() => removeSession(s)}
          disabled={deleteDisabled}
          style={btnStyle('#FEF2F2', '#FECACA', '#DC2626', deleteDisabled)}
          title={isCompleted ? 'Completed sessions are locked' : 'Delete session'}
        >
          <AppIcon name="trash" size={14} /> {rowBusy && deleteDisabled ? '…' : ''}
        </button>
      </div>
    );
  };

  const StatusBadge = ({ st }) => (
    <span style={badge(SC[st] || '#ccc')}>{st === 'live' && <span style={livedot} />}{formatSessionStatus(st)}</span>
  );

  // ── Pagination bar ──
  const Pager = () => {
    if (loading || total === 0) return null;
    return (
      <div style={pagerWrap}>
        <span style={pagerInfo}>Showing {startIdx}–{endIdx} of {total}</span>
        <div style={pagerBtns}>
          <button style={pgBtn(page === 1)} disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
          {pageList(page, totalPages).map((n, idx) =>
            n === '…'
              ? <span key={`e${idx}`} style={pgEllipsis}>…</span>
              : <button key={n} onClick={() => setPage(n)} style={pgNum(n === page)}>{n}</button>
          )}
          <button style={pgBtn(page === totalPages)} disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
        </div>
        {!isMobile && (
          <label style={pagerInfo}>
            Per page{' '}
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    style={{ ...input, width: 'auto', display: 'inline-block', padding: '4px 8px' }}>
              {[8, 16, 32].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? 16 : 32, fontFamily: 'Public Sans, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 800, margin: 0, color: '#172033' }}>
          Sessions ({total}{total !== allTotal ? ` of ${allTotal}` : ''})
        </h2>
        <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto' }}>
          <button onClick={() => { Promise.allSettled([dispatch(fetchAdminSessions()), dispatch(fetchPickers())]); }} style={btnGhost}>↻ Refresh</button>
          <button onClick={openCreate} style={btnSchedule(isMobile)}>＋ Schedule Session</button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={filterBar(isMobile)}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, trainer or batch…" style={input} />
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={input}>
          <option value="all">All statuses</option>
          {STATUSES.map((st) => <option key={st} value={st}>{formatSessionStatus(st)}</option>)}
        </select>
        <select value={fTrainer} onChange={(e) => setFTrainer(e.target.value)} style={input}>
          <option value="">All trainers</option>
          {trainers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
        <select value={fBatch} onChange={(e) => setFBatch(e.target.value)} style={input}>
          <option value="">All batches</option>
          {batches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <button onClick={clearFilters} disabled={!hasFilters} style={btnGhost}>Clear</button>
      </div>

      {loadError && (
        <div style={banner('#fef2f2', '#fecaca', '#b91c1c')}>
          ⚠️ {loadError}
          <button onClick={() => dispatch(clearAdminSessionErrors())} style={bannerClose}>×</button>
        </div>
      )}

      {/* DESKTOP: table */}
      {!isMobile && (
        <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 2px rgba(23,32,51,.08), 0 12px 28px rgba(31,61,99,.05)', border: '1px solid #dbe3ed' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#657691' }}>
                  {['#', 'Title', 'Batch', 'Trainer', 'Trainees', 'Scheduled', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={h === '#' ? { ...th, width: 52 } : th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={emptyCell}>Loading sessions…</td></tr>
                ) : total === 0 ? (
                  <tr><td colSpan={7} style={emptyCell}>{hasFilters ? 'No sessions match your filters.' : 'No sessions found. Click “Schedule Session” to create one.'}</td></tr>
                ) : (
                  pageItems.map((s, i) => (
                    <tr key={s._id} style={{ background: i % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #dbe3ed' }}>
                      <td style={{ ...td, color: '#64748B', fontWeight: 700, width: 52, whiteSpace: 'nowrap' }}>
                        {total === 0 ? '—' : startIdx + i}
                      </td>
                      <td style={td}>
                        <span style={{ fontWeight: 600, color: '#172033' }}>{s.title || 'Untitled'}</span>
                        {s.recordingUrl && (
                          <a href={s.recordingUrl} target="_blank" rel="noreferrer" style={{ marginLeft: 8, fontSize: 12, color: '#2f6f9b' }}>▶ rec</a>
                        )}
                      </td>
                      <td style={td}>{batchNameOf(s)}</td>
                      <td style={td}>{trainerName(s)}</td>
                      <td style={td}>{(s.trainees || []).length || '—'}</td>
                      <td style={td}>{s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : '—'}</td>
                      <td style={{ padding: '11px 16px' }}><StatusBadge st={s.status} /></td>
                      <td style={{ padding: '8px 16px' }}><RowActions s={s} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MOBILE: cards */}
      {isMobile && (
        <div style={{ display: 'grid', gap: 12 }}>
          {loading ? (
            <div style={cardEmpty}>Loading sessions…</div>
          ) : total === 0 ? (
            <div style={cardEmpty}>{hasFilters ? 'No sessions match your filters.' : 'No sessions found. Tap “Schedule Session”.'}</div>
          ) : (
            pageItems.map((s) => (
              <div key={s._id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontWeight: 700, color: '#172033', fontSize: 15 }}>{s.title || 'Untitled'}</span>
                  <StatusBadge st={s.status} />
                </div>
                <div style={cardMeta}><b>Batch:</b> {batchNameOf(s)}</div>
                <div style={cardMeta}><b>Trainer:</b> {trainerName(s)}</div>
                <div style={cardMeta}><b>Trainees:</b> {(s.trainees || []).length || '—'}</div>
                <div style={cardMeta}><b>When:</b> {s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : '—'}</div>
                {s.recordingUrl && (
                  <a href={s.recordingUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2f6f9b' }}>▶ Watch recording</a>
                )}
                <div style={{ marginTop: 10 }}><RowActions s={s} /></div>
              </div>
            ))
          )}
        </div>
      )}

      <Pager />

      {/* Create / Edit modal */}
      {modal && (
        <div style={overlay} onMouseDown={closeModal}>
          <div style={{ ...dialog, maxWidth: isMobile ? '100%' : 600 }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={dialogHead}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#172033' }}>
                {modal.mode === 'create' ? 'Schedule a session' : 'Edit session'}
              </h3>
              <button onClick={closeModal} style={bannerClose}>×</button>
            </div>

            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
              <Field label="Title">
                <input style={input} value={modal.form.title}
                       onChange={(e) => setField('title', e.target.value)}
                       placeholder="e.g. React Fundamentals — Live Q&A" />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                <Field label="Trainer">
                  <select style={input} value={modal.form.trainerId} onChange={(e) => setField('trainerId', e.target.value)}>
                    <option value="">Select trainer…</option>
                    {trainers.map((t) => <option key={t._id} value={t._id}>{t.name}{t.email ? ` · ${t.email}` : ''}</option>)}
                  </select>
                </Field>
                <Field label="Batch">
                  <select style={input} value={modal.form.batchId} onChange={(e) => setField('batchId', e.target.value)}>
                    <option value="">Select batch…</option>
                    {batches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 140px', gap: 14 }}>
                <Field label="Date & time">
                   <input type="datetime-local" style={input} value={modal.form.scheduledAt}
                          min={minDateTime()}
                          onChange={(e) => setField('scheduledAt', e.target.value)} />
                </Field>
                <Field label="Duration (min)">
                  <input type="number" min={5} max={600} style={input} value={modal.form.durationMinutes}
                         onChange={(e) => setField('durationMinutes', e.target.value)} />
                </Field>
              </div>

               <Field label={`Trainees (${modal.form.trainees.length} selected — optional, batch members can also join)`}>
                 <div style={traineeBox}>
                    <input
                      style={{ ...input, marginBottom: 8 }}
                      value={traineeSearch}
                      onChange={(e) => setTraineeSearch(e.target.value)}
                      placeholder="Search trainees by name…"
                    />
                   {formTrainees.length > 0 && (
                     <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, padding: '4px 6px' }}>
                       <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                         <input
                           type="checkbox"
                           ref={(el) => {
                             if (el) {
                               const allSelected = formTrainees.length > 0 && formTrainees.every(t => modal.form.trainees.includes(String(t._id)));
                               const someSelected = formTrainees.some(t => modal.form.trainees.includes(String(t._id)));
                               el.checked = allSelected;
                               el.indeterminate = someSelected && !allSelected;
                             }
                           }}
                           onChange={() => {
                             const allSelected = formTrainees.every(t => modal.form.trainees.includes(String(t._id)));
                             if (allSelected) {
                               const idsToRemove = new Set(formTrainees.map(t => String(t._id)));
                               setModal(m => ({ ...m, form: { ...m.form, trainees: m.form.trainees.filter(id => !idsToRemove.has(id)) } }));
                             } else {
                               const merged = [...new Set([...modal.form.trainees, ...formTrainees.map(t => String(t._id))])];
                               setModal(m => ({ ...m, form: { ...m.form, trainees: merged } }));
                             }
                           }}
                         />
                         Select All
                       </label>
                       {modal.form.trainees.length > 0 && (
                         <button
                           type="button"
                           onClick={() => setModal(m => ({ ...m, form: { ...m.form, trainees: [] } }))}
                           style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                         >
                           Deselect All
                         </button>
                       )}
                     </div>
                   )}
                   {formTrainees.length === 0 ? (
                     <span style={{ fontSize: 13, color: '#657691' }}>No trainees available.</span>
                   ) : (
                     formTrainees.map((t) => {
                       const id = String(t._id);
                       const on = modal.form.trainees.includes(id);
                       return (
                         <label key={id} style={traineeRow(on)}>
                           <input type="checkbox" checked={on} onChange={() => toggleTrainee(id)} />
                           <span>{t.name}{t.email ? <span style={{ color: '#657691' }}> · {t.email}</span> : null}</span>
                         </label>
                       );
                     })
                   )}
                 </div>
               </Field>

              <div style={{ display: 'grid', gridTemplateColumns: modal.mode === 'edit' && !isMobile ? '1fr 1fr' : '1fr', gap: 14 }}>
                <Field label="Passcode (optional)">
                  <input style={input} value={modal.form.passcode}
                         onChange={(e) => setField('passcode', e.target.value)}
                         placeholder="Leave blank for open join" />
                </Field>
                {modal.mode === 'edit' && (
                  <Field label="Status">
                    <select style={input} value={modal.form.status} onChange={(e) => setField('status', e.target.value)}>
                      {STATUSES.map((st) => <option key={st} value={st}>{formatSessionStatus(st)}</option>)}
                    </select>
                  </Field>
                )}
              </div>

              <Field label="Description (optional)">
                <textarea style={{ ...input, minHeight: 70, resize: 'vertical' }} value={modal.form.description}
                          onChange={(e) => setField('description', e.target.value)}
                          placeholder="What will this session cover?" />
              </Field>

              {(formError || saveError) && (
                <div style={banner('#fef2f2', '#fecaca', '#b91c1c')}>⚠️ {formError || saveError}</div>
              )}
            </div>

            <div style={dialogFoot}>
              <button onClick={closeModal} disabled={saving} style={btnGhost}>Cancel</button>
              <button onClick={save} disabled={saving} style={btnPrimary}>
                {saving ? 'Saving…' : modal.mode === 'create' ? 'Schedule session' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog (built-in, replaces SweetAlert) */}
      {confirmState && (
        <div style={{ ...overlay, alignItems: 'center', zIndex: 1500 }} onMouseDown={() => resolveConfirm(false)}>
          <div style={{ ...dialog, maxWidth: 420, marginTop: 0 }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ padding: '22px 22px 8px' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#172033' }}>{confirmState.title}</h3>
              {confirmState.text && <p style={{ margin: '10px 0 0', fontSize: 13.5, color: '#41506a', lineHeight: 1.5 }}>{confirmState.text}</p>}
            </div>
            <div style={{ ...dialogFoot, borderTop: 'none' }}>
              <button onClick={() => resolveConfirm(false)} style={btnGhost}>Keep it</button>
              <button
                onClick={() => resolveConfirm(true)}
                style={{ ...btnPrimary, background: confirmState.danger ? '#c0392b' : '#2f6f9b' }}
              >
                {confirmState.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts (built-in, replaces SweetAlert toasts) */}
      {toasts.length > 0 && (
        <div style={toastWrap}>
          {toasts.map((t) => {
            const cfg = TOAST[t.icon] || TOAST.info;
            return (
              <div key={t.id} style={toastItem(cfg.border)}>
                <span style={{ color: cfg.color, fontWeight: 800, fontSize: 15 }}>{cfg.glyph}</span>
                <span>{t.title}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Small presentational bits ──────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#657691', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const th = { padding: '12px 16px', textAlign: 'left', fontSize: 12, letterSpacing: '.7px', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const td = { padding: '11px 16px', fontSize: 13, color: '#2b3648' };
const emptyCell = { padding: 32, textAlign: 'center', color: '#657691' };

const card = { background: '#fff', border: '1px solid #dbe3ed', borderRadius: 12, padding: 14, boxShadow: '0 1px 2px rgba(23,32,51,.06)' };
const cardEmpty = { background: '#fff', border: '1px solid #dbe3ed', borderRadius: 12, padding: 28, textAlign: 'center', color: '#657691' };
const cardMeta = { fontSize: 13, color: '#41506a', marginTop: 4 };

const badge = (bg) => ({ background: bg, color: '#fff', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' });
const livedot = { width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' };

const btnPrimary = { background: '#2f6f9b', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost   = { background: '#fff', color: '#41506a', border: '1px solid #dbe3ed', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

// Prominent, wider "Schedule Session" CTA. Full-width (flex:1) on mobile.
const btnSchedule = (mobile) => ({
  background: 'linear-gradient(180deg,#3a86c0,#2f6f9b)',
  color: '#fff', border: 'none',
  padding: '11px 22px', borderRadius: 10,
  fontSize: 14, fontWeight: 800, letterSpacing: '.2px',
  cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 6px 16px rgba(47,111,155,.32)',
  minWidth: mobile ? 0 : 190,
  flex: mobile ? 1 : '0 0 auto',
  whiteSpace: 'nowrap',
});

const input = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid #dbe3ed', fontSize: 13, fontFamily: 'inherit', color: '#172033', background: '#fff' };

// Filter bar: a single column on mobile, a responsive row on desktop.
const filterBar = (mobile) => ({
  display: 'grid',
  gridTemplateColumns: mobile ? '1fr' : 'minmax(220px,1.6fr) 1fr 1fr 1fr auto',
  gap: 10,
  marginBottom: 16,
  alignItems: 'center',
});

const traineeBox = { maxHeight: 150, overflowY: 'auto', border: '1px solid #dbe3ed', borderRadius: 8, padding: 8, display: 'grid', gap: 4, background: '#fbfcfe' };
const traineeRow = (on) => ({ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 6px', borderRadius: 6, cursor: 'pointer', background: on ? '#eaf3fb' : 'transparent' });

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', zIndex: 1000 };
const dialog = { background: '#fff', borderRadius: 14, width: '100%', boxShadow: '0 20px 60px rgba(15,23,42,.3)', marginTop: 24 };
const dialogHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #eef2f7' };
const dialogFoot = { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid #eef2f7' };

const banner = (bg, border, color) => ({ background: bg, border: `1px solid ${border}`, color, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
const bannerClose = { background: 'transparent', border: 'none', fontSize: 20, lineHeight: 1, cursor: 'pointer', color: 'inherit' };

const pagerWrap = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 16 };
const pagerInfo = { fontSize: 12.5, color: '#657691' };
const pagerBtns = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const pgBtn = (disabled) => ({ background: '#fff', color: disabled ? '#b6c0cf' : '#41506a', border: '1px solid #dbe3ed', padding: '6px 10px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' });
const pgNum = (active) => ({ background: active ? '#2f6f9b' : '#fff', color: active ? '#fff' : '#41506a', border: `1px solid ${active ? '#2f6f9b' : '#dbe3ed'}`, padding: '6px 11px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', minWidth: 36, fontFamily: 'inherit' });
const pgEllipsis = { color: '#9aa6b6', padding: '0 2px' };

const toastWrap = { position: 'fixed', top: 16, right: 16, display: 'grid', gap: 8, zIndex: 2000 };
const toastItem = (border) => ({ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220, maxWidth: 360, padding: '11px 14px', borderRadius: 10, background: '#fff', boxShadow: '0 10px 30px rgba(15,23,42,.18)', border: `1px solid ${border}`, fontSize: 13.5, color: '#172033' });