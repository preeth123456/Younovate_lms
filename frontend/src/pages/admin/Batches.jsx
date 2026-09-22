import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import {
  fetchBatches, createBatch, updateBatch, deleteBatch,
  selectAllBatches, selectBatchesStatus, selectBatchesError,
  selectBatchCreateStatus, selectBatchCreateError,
  selectBatchUpdateStatus, selectBatchUpdateError,
  selectBatchDeleteStatus, selectBatchDeleteError,
  resetBatchCreateStatus, clearBatchErrors,
  assignTraineesToBatch,
  selectAssignStatus,
} from '../../features/session/batchSlice';

import {
  fetchCourses,
  selectAllCourses,
} from '../../features/admin/courseSlice';

import {
  fetchTrainers,
  fetchAdminTrainees,
  selectAdminTrainers,
  selectAllAdminTrainees,
} from '../../features/admin/adminSlice';

import { selectUserRole } from '../../features/auth/authSlice';
import { isPastDateOnly } from '../../utils/dateTime';
import AppIcon from '../../components/shared/AppIcon';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const BATCH_STATUSES = ['upcoming', 'active', 'completed', 'cancelled'];

// Status colors — restyled to the shared Sessions/admin-suite palette
// (was light-bg pills; now the same solid-color badge() pattern used on
// Sessions / Users / Trainees / Trainers / Registrations).
const STATUS_COLORS = {
  upcoming: '#2f6f9b',
  active: '#16a05f',
  completed: '#657691',
  cancelled: '#c0392b',
};

// Toast look-up (icon glyph + colours) — identical to the other 5 admin pages.
const TOAST = {
  success: { color: '#16a05f', border: '#bfe6d0', glyph: '✓' },
  error: { color: '#c0392b', border: '#f3c2bd', glyph: '✕' },
  warning: { color: '#b06f00', border: '#f0d9a8', glyph: '⚠' },
  info: { color: '#2f6f9b', border: '#bcd6ea', glyph: 'ℹ' },
};

const CARD_ACCENTS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

const EMPTY_FORM = {
  name: '', description: '', trainerId: '',
  startDate: '', maxStudents: 25, course: '', status: 'upcoming',
  traineeIds: [],
};

const ROWS_OPTIONS = [5, 10, 20, 50];

// ═══════════════════════════════════════════════════════════════════════════════
// CSS — YouVA OS hero kept as-is; everything else now shares the admin-suite
// tokens (colors, radii, shadows) used by Sessions/Users/Trainees/Trainers/Registrations.
// ═══════════════════════════════════════════════════════════════════════════════

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  @keyframes fadeUp    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes modalIn   { from{opacity:0;transform:translateY(-16px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes shimmer   { 0%{background-position:-400px 0} 100%{background-position:400px 0} }

  .icon-btn { transition:background .15s,transform .15s; border:none; cursor:pointer; }
  .icon-btn:hover { background:#eaf3fb!important; transform:scale(1.08); }
  .del-btn:hover  { background:#fdeceb!important; }
  .view-btn:hover { background:#eaf3fb!important; }
  .fi { transition:border-color .15s,box-shadow .15s; }
  .fi:focus { outline:none!important; border-color:#2f6f9b!important; box-shadow:0 0 0 3px rgba(47,111,155,.14)!important; }
  .sbtn { transition:opacity .15s,transform .15s; }
  .sbtn:hover:not(:disabled) { opacity:.88; transform:translateY(-1px); }
  .sbtn:disabled { opacity:.5; cursor:not-allowed; }
  .tr-row:hover { background:#f8fafc!important; }
  .pg-btn { transition:all .15s; cursor:pointer; }
  .pg-btn:hover:not(:disabled) { background:#f1f5f9!important; }
  .pg-btn:disabled { opacity:.4; cursor:not-allowed; }

  /* YouVA hero gradient — kept exactly as-is */
  .youva-hero {
    background: linear-gradient(120deg, #141836 0%, #1a1f52 35%, #21196b 65%, #1a1545 100%);
    border-radius: 16px;
    padding: 28px 32px 24px;
    margin-bottom: 20px;
    position: relative;
    overflow: hidden;
  }
  .youva-hero::before {
    content: '';
    position: absolute;
    top: -40px; right: -40px;
    width: 320px; height: 320px;
    background: radial-gradient(ellipse, rgba(99,102,241,.28) 0%, rgba(109,40,217,.15) 40%, transparent 70%);
    pointer-events: none;
    border-radius: 50%;
  }
  .youva-hero::after {
    content: '';
    position: absolute;
    bottom: -60px; left: 30%;
    width: 260px; height: 200px;
    background: radial-gradient(ellipse, rgba(67,56,202,.2) 0%, transparent 70%);
    pointer-events: none;
  }

  .modal-overlay {
    position:fixed; inset:0; background:rgba(15,23,42,.45);
    backdrop-filter:blur(4px); display:flex; align-items:flex-start;
    justify-content:center; z-index:1000; padding:16px; overflow-y:auto; animation:fadeUp .2s ease;
  }
  .modal-box {
    background:#fff; border-radius:14px; width:100%; max-width:480px;
    max-height:90vh; overflow-y:auto; margin-top:24px;
    box-shadow:0 20px 60px rgba(15,23,42,.3);
    animation:modalIn .25s cubic-bezier(.34,1.3,.64,1);
  }

  /* table responsiveness */
  @media (max-width: 900px) { .col-cap     { display:none!important; } }
  @media (max-width: 760px) { .col-trainer { display:none!important; } }
  @media (max-width: 600px) { .col-course  { display:none!important; } }
  @media (max-width: 480px) { .col-start   { display:none!important; } }

  @media (max-width:520px) {
    .stats-grid { grid-template-columns:repeat(2,1fr)!important; }
    .hero-row   { flex-direction:column!important; align-items:flex-start!important; gap:14px!important; }
    .filter-row { flex-direction:column!important; align-items:stretch!important; }
    .filter-row > * { width:100%!important; }
    .youva-hero { padding:22px 20px; }
  }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// ATOMS — restyled with the shared admin-suite tokens
// ═══════════════════════════════════════════════════════════════════════════════

const StatusPill = ({ status }) => (
  <span style={badge(STATUS_COLORS[status] || STATUS_COLORS.upcoming)}>{status}</span>
);

const FL = ({ children, req }) => (
  <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#657691', marginBottom: 6 }}>
    {children}
    {req && <span style={{ color: '#c0392b', marginLeft: 3 }}>*</span>}
  </span>
);

const FInput = ({ label, req, ...p }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <FL req={req}>{label}</FL>}
    <input className="fi" required={req} {...p} style={{ ...input, ...p.style }} />
  </div>
);

const FSelect = ({ label, req, children, ...p }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <FL req={req}>{label}</FL>}
    <select className="fi" required={req} {...p} style={{ ...input, ...p.style }}>
      {children}
    </select>
  </div>
);

const FilterSelect = ({ value, onChange, children }) => (
  <select value={value} onChange={onChange} className="fi" style={{ ...input, minWidth: 150, width: 'auto' }}>
    {children}
  </select>
);

const Modal = ({ onClose, children }) => {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-box" onMouseDown={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH FORM MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const BatchFormModal = ({ editBatch, trainers, courses, trainees, onClose, pushToast }) => {
  const dispatch = useDispatch();
  const createStatus = useSelector(selectBatchCreateStatus);
  const createError = useSelector(selectBatchCreateError);
  const updateStatus = useSelector(selectBatchUpdateStatus);
  const updateError = useSelector(selectBatchUpdateError);
  const assignStatus = useSelector(selectAssignStatus);

  const isEdit = !!editBatch;
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState(
    isEdit
      ? {
          name: editBatch.name || '',
          description: editBatch.description || '',
          trainerId: editBatch.trainerId?._id || editBatch.trainerId || '',
          startDate: editBatch.startDate ? editBatch.startDate.slice(0, 10) : '',
          maxStudents: editBatch.maxStudents || 25,
          course: editBatch.course || '',
          status: editBatch.status || 'upcoming',
          traineeIds: editBatch.traineeIds?.map(String) || [],
        }
      : { ...EMPTY_FORM }
  );

  useEffect(() => {
    if (!form.course && courses.length > 0) {
      setForm((f) => ({ ...f, course: courses[0].code || courses[0].name || '' }));
    }
  }, [courses]);

  const saving = createStatus === 'loading' || updateStatus === 'loading' || assignStatus === 'loading';
  const err = createError || updateError;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleTraineeChange = (newTraineeIds) => {
    set('traineeIds', newTraineeIds);
    if (newTraineeIds.length > 0) {
      setFormError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous error when user starts fixing
    setFormError(null);

    // Validate required fields for new batch
    if (!isEdit) {
      if (!form.name || !form.name.trim()) {
        return setFormError('⚠️ Batch Name is required.');
      }
      if (!form.trainerId) {
        return setFormError('⚠️ Assign Trainer is required.');
      }
      if (!form.startDate) {
        return setFormError('⚠️ Start Date is required.');
      }
      if (!form.traineeIds || form.traineeIds.length === 0) {
        return setFormError('⚠️ At least 1 trainee should be selected.');
      }
    }

    if (form.startDate) {
      if (isPastDateOnly(form.startDate)) return setFormError('Batch start date cannot be in the past.');
    }
    const payload = {
      ...form,
      maxStudents: Number(form.maxStudents),
      startDate: form.startDate || undefined,
      trainerId: form.trainerId || undefined,
    };
    const { traineeIds, ...batchPayload } = payload;

    const result = isEdit
      ? await dispatch(updateBatch({ id: editBatch._id, ...batchPayload }))
      : await dispatch(createBatch(batchPayload));
    const action = isEdit ? updateBatch : createBatch;
    if (action.fulfilled.match(result)) {
      const createdBatch = result.payload?.data || result.payload;
      const batchId = createdBatch?._id;

      // If creating new batch and trainees selected, assign them
      if (!isEdit && batchId && traineeIds && traineeIds.length > 0) {
        const assignResult = await dispatch(assignTraineesToBatch({ batchId, traineeIds }));
        if (!assignTraineesToBatch.fulfilled.match(assignResult)) {
          pushToast('warning', 'Batch created but failed to assign trainees');
        }
      }

      pushToast('success', isEdit ? 'Batch updated!' : 'Batch created!');
      dispatch(resetBatchCreateStatus());
      dispatch(fetchBatches());
      onClose();
    }
  };

  return (
    <Modal onClose={onClose}>
      <div style={dialogHead}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: 18, color: '#172033', margin: 0 }}>
            {isEdit ? '✏️ Edit Batch' : '➕ Add New Batch'}
          </h2>
          <p style={{ fontSize: 12.5, color: '#657691', marginTop: 4, marginBottom: 0 }}>
            {isEdit ? 'Update batch details below.' : 'Fill in the details to create a new batch.'}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} style={bannerClose}>✕</button>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '18px 20px 20px' }}>
        <FInput label="Batch Name" req placeholder="e.g. Batch 2026-A" value={form.name} onChange={(e) => set('name', e.target.value)} />

        <FSelect label="Course" req value={form.course} onChange={(e) => set('course', e.target.value)}>
          <option value="" disabled>
            {courses.length === 0 ? 'Loading courses…' : 'Select course…'}
          </option>
          {courses.map((c) => (
            <option key={c._id} value={c.code || c.name}>
              {c.code ? `${c.code} — ${c.name}` : c.name}
            </option>
          ))}
        </FSelect>

        <FSelect label="Assign Trainer" value={form.trainerId} onChange={(e) => set('trainerId', e.target.value)}>
          <option value="">— No trainer yet —</option>
          {trainers.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name} ({t.email})
            </option>
          ))}
        </FSelect>

        {/* Trainee Selection (required for new batch) */}
        {!isEdit && trainees.length > 0 && (
          <Field label={`Select Trainees (${form.traineeIds.length} selected) — required`}>
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #dbe3ed', borderRadius: 8, padding: 8, background: '#fbfcfe' }}>
              {form.traineeIds.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, padding: '4px 6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.traineeIds.length === trainees.length}
                      onChange={() => {
                        if (form.traineeIds.length === trainees.length) {
                          handleTraineeChange([]);
                        } else {
                          handleTraineeChange(trainees.map((t) => String(t._id)));
                        }
                      }}
                    />
                    {form.traineeIds.length === trainees.length ? 'Deselect All' : 'Select All'}
                  </label>
                </div>
              )}
              {trainees.map((t) => {
                const id = String(t._id);
                const checked = form.traineeIds.includes(id);
                return (
                  <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 6px', borderRadius: 6, cursor: 'pointer', background: checked ? '#eaf3fb' : 'transparent' }}>
                    <input type="checkbox" checked={checked} onChange={() => handleTraineeChange(checked ? form.traineeIds.filter((x) => x !== id) : [...form.traineeIds, id])} />
                    <span>{t.name}{t.email ? <span style={{ color: '#657691', marginLeft: 6 }}>({t.email})</span> : null}</span>
                  </label>
                );
              })}
            </div>
          </Field>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
           <FInput label="Start Date" type="date" value={form.startDate} onChange={(e) => { setFormError(null); set('startDate', e.target.value); }} min={new Date().toISOString().split('T')[0]} />
          <FInput label="Max Students" req type="number" min="1" max="500" value={form.maxStudents} onChange={(e) => set('maxStudents', e.target.value)} />
        </div>

        <FSelect label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
          {BATCH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </FSelect>

        <div style={{ marginBottom: 4 }}>
          <FL>Description</FL>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Brief description…"
            rows={3}
            className="fi"
            style={{ ...input, resize: 'vertical' }}
          />
        </div>

        {(formError || err) && <div style={{ ...banner('#fef2f2', '#fecaca', '#b91c1c'), marginTop: 14 }}>⚠️ {formError || err}</div>}

        <div style={dialogFoot}>
          <button type="button" onClick={onClose} className="sbtn" style={btnGhost}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="sbtn" style={btnPrimary}>
            {saving ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save Changes' : 'Create Batch'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE CONFIRM MODAL — same confirm-dialog pattern as the rest of the suite
// ═══════════════════════════════════════════════════════════════════════════════

const DeleteModal = ({ batch, onConfirm, onClose, deleting }) => (
  <Modal onClose={onClose}>
    <div style={{ padding: '22px 22px 8px' }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#172033' }}>Delete this batch?</h3>
      <p style={{ margin: '10px 0 0', fontSize: 13.5, color: '#41506a', lineHeight: 1.5 }}>
        "{batch.name}" will be permanently removed. This cannot be undone.
      </p>
    </div>
    <div style={{ ...dialogFoot, borderTop: 'none' }}>
      <button onClick={onClose} className="sbtn" style={btnGhost}>
        Keep it
      </button>
      <button onClick={onConfirm} disabled={deleting} className="sbtn" style={{ ...btnPrimary, background: '#c0392b' }}>
        {deleting ? 'Deleting…' : 'Yes, delete it'}
      </button>
    </div>
  </Modal>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

const Batches = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const role = useSelector(selectUserRole);
  const isAdmin = role === 'admin';

  const batches = useSelector(selectAllBatches) ?? [];
  const batchStatus = useSelector(selectBatchesStatus);
  const batchError = useSelector(selectBatchesError);
  const deleteStatus = useSelector(selectBatchDeleteStatus);
  const deleteError = useSelector(selectBatchDeleteError);

  const courses = useSelector(selectAllCourses) ?? [];
  const trainers = useSelector(selectAdminTrainers) ?? [];
  const trainees = useSelector(selectAllAdminTrainees) ?? [];

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [trainerFilter, setTrainerFilter] = useState('all');

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // ── Modals ──
  const [modal, setModal] = useState(null);
  const [target, setTarget] = useState(null);

  // ── Built-in toast queue — identical pattern to the other 5 admin pages ──
  const [toasts, setToasts] = useState([]);
  const pushToast = (icon, title) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, icon, title }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };

  useEffect(() => {
    dispatch(fetchBatches());
    dispatch(fetchCourses());
    dispatch(fetchAdminTrainees());
    if (isAdmin) dispatch(fetchTrainers());
  }, [dispatch, isAdmin]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, courseFilter, trainerFilter, rowsPerPage]);

  const courseOptions = useMemo(() => Array.from(new Set(batches.map((b) => b.course).filter(Boolean))).sort(), [batches]);
  const trainerOptions = useMemo(
    () => Array.from(new Set(batches.map((b) => b.trainerId?.name).filter(Boolean))).sort(),
    [batches]
  );

  const filtered = useMemo(
    () =>
      batches.filter((b) => {
        const q = search.toLowerCase();
        const matchSearch =
          !search || b.name?.toLowerCase().includes(q) || b.course?.toLowerCase().includes(q) || b.trainerId?.name?.toLowerCase().includes(q);
        const matchStatus = statusFilter === 'all' || b.status === statusFilter;
        const matchCourse = courseFilter === 'all' || b.course === courseFilter;
        const matchTrainer = trainerFilter === 'all' || b.trainerId?.name === trainerFilter;
        return matchSearch && matchStatus && matchCourse && matchTrainer;
      }),
    [batches, search, statusFilter, courseFilter, trainerFilter]
  );

  const stats = {
    total: batches.length,
    active: batches.filter((b) => b.status === 'active').length,
    upcoming: batches.filter((b) => b.status === 'upcoming').length,
    completed: batches.filter((b) => b.status === 'completed').length,
  };

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pageRows = filtered.slice(startIdx, startIdx + rowsPerPage);

  const activeFilters = (statusFilter !== 'all') + (courseFilter !== 'all') + (trainerFilter !== 'all') + (search ? 1 : 0);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCourseFilter('all');
    setTrainerFilter('all');
  };

  const openAdd = () => {
    if (!isAdmin) return;
    dispatch(clearBatchErrors());
    setTarget(null);
    setModal('add');
  };
  const openEdit = (b) => {
    if (!isAdmin) return;
    dispatch(clearBatchErrors());
    setTarget(b);
    setModal('edit');
  };
  const openDelete = (b) => {
    if (!isAdmin) return;
    setTarget(b);
    setModal('delete');
  };
  const openView = (b) => navigate(`/admin/batches/view/${b._id}`);
  const closeModal = () => {
    setModal(null);
    setTarget(null);
    dispatch(clearBatchErrors());
  };

  const handleDelete = async () => {
    if (!target) return;
    const result = await dispatch(deleteBatch(target._id));
    if (deleteBatch.fulfilled.match(result)) {
      pushToast('success', `"${target.name}" deleted`);
      closeModal();
    } else {
      pushToast('error', deleteError || 'Failed to delete batch');
    }
  };

  // ── YouVA OS hero stats ──
  const heroStats = [
    { label: 'TOTAL BATCHES', value: stats.total, sub: `▲ 0 this month`, subColor: '#4ADE80' },
    { label: 'ACTIVE BATCHES', value: stats.active, sub: `Total: ${batches.length}`, subColor: '#60A5FA' },
    { label: 'UPCOMING', value: stats.upcoming, sub: `▲ scheduled`, subColor: '#4ADE80' },
    { label: 'COMPLETED', value: stats.completed, sub: `+${stats.completed} done`, subColor: '#FB923C' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'Public Sans, system-ui, sans-serif', color: '#172033' }}>
      <style>{CSS}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px' }}>
        {/* ── YOUVA HERO BANNER (kept as-is) ── */}
        <div className="youva-hero">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 28, flexWrap: 'wrap' }}>
            <div>
              <p
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '1.4px',
                  textTransform: 'uppercase',
                  color: '#7C85B3',
                  marginBottom: 10,
                  marginTop: 0,
                }}
              >
                PLATFORM OVERVIEW · BATCHES
              </p>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#F1F5F9', margin: 0, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                {isAdmin ? (
                  stats.active > 0 ? (
                    <>
                      <span>Youvaos is </span>
                      <span style={{ color: '#FB923C' }}>running</span>
                      <span> — batches on track.</span>
                    </>
                  ) : (
                    <>
                      <span>Youvaos </span>
                      <span style={{ color: '#FB923C' }}>awaits</span>
                      <span> — create your first batch.</span>
                    </>
                  )
                ) : (
                  'My Batches'
                )}
              </h1>
              <p style={{ fontSize: '0.82rem', color: '#7C85B3', marginTop: 10, marginBottom: 0 }}>
                {isAdmin
                  ? `${stats.active} active ${stats.active === 1 ? 'batch' : 'batches'} across ${batches.length} total. All approvals are up to date.`
                  : 'Your assigned training batches.'}
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={openAdd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  borderRadius: 9,
                  border: 'none',
                  background: 'rgba(99,102,241,0.85)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                  boxShadow: '0 2px 12px rgba(99,102,241,.5)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                + Add Batch
              </button>
            )}
          </div>

          <div
            className="stats-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, gap: 0 }}
          >
            {heroStats.map(({ label, value, sub, subColor }, idx) => (
              <div key={label} style={{ paddingLeft: idx === 0 ? 0 : 24, borderLeft: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.63rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#7C85B3', marginBottom: 6 }}>
                  {label}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#F1F5F9', fontFamily: 'DM Mono, monospace', letterSpacing: '-1.5px', lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: subColor, marginTop: 6 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FILTER BAR — restyled with shared admin-suite tokens ── */}
        <div className="filter-row" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, course, trainer…"
            className="fi"
            style={{ ...input, flex: 1, minWidth: 200 }}
          />

          <FilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {BATCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="all">All courses</option>
            {courseOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect value={trainerFilter} onChange={(e) => setTrainerFilter(e.target.value)}>
            <option value="all">All trainers</option>
            {trainerOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </FilterSelect>

          {activeFilters > 0 && (
            <button onClick={resetFilters} className="sbtn" style={btnGhost}>
              ✕ Clear ({activeFilters})
            </button>
          )}
        </div>

        {/* ── ERROR ── */}
        {batchError && batchStatus === 'failed' && <div style={banner('#fef2f2', '#fecaca', '#b91c1c')}>⚠️ {batchError}</div>}

        {/* ── TABLE CARD — restyled with shared admin-suite tokens ── */}
        <div style={{ background: '#fff', border: '1px solid #dbe3ed', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 2px rgba(23,32,51,.08), 0 12px 28px rgba(31,61,99,.05)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#657691' }}>
                  <th style={{ ...th, width: 40 }}>#</th>
                  <th style={th}>Batch</th>
                  <th style={th} className="col-course">
                    Course
                  </th>
                  <th style={th} className="col-trainer">
                    Trainer
                  </th>
                  <th style={th} className="col-start">
                    Starts
                  </th>
                  <th style={th} className="col-cap">
                    Capacity
                  </th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batchStatus === 'loading' ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <div
                        style={{
                          height: 240,
                          background: 'linear-gradient(90deg,#F8FAFC 25%,#EEF2F7 50%,#F8FAFC 75%)',
                          backgroundSize: '400px 100%',
                          animation: 'shimmer 1.4s infinite',
                        }}
                      />
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={emptyCell}>
                      {activeFilters > 0 ? 'No batches match your filters.' : isAdmin ? 'No batches found. Click "+ Add Batch" to create one.' : 'No batches found.'}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((b, i) => {
                    const accent = CARD_ACCENTS[(startIdx + i) % CARD_ACCENTS.length];
                    return (
                      <tr key={b._id} className="tr-row" style={{ borderBottom: '1px solid #dbe3ed' }}>
                        <td style={{ ...td, color: '#94A3B8' }}>{startIdx + i + 1}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 8,
                                flexShrink: 0,
                                background: `${accent}18`,
                                color: accent,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: 12,
                                fontFamily: 'DM Mono, monospace',
                              }}
                            >
                              {(b.name || 'B').slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: '#172033', fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                                {b.name}
                              </div>
                              {b.description && (
                                <div style={{ fontSize: 11.5, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                                  {b.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={td} className="col-course">
                          {b.course || '—'}
                        </td>
                        <td style={td} className="col-trainer">
                          {b.trainerId?.name || '—'}
                        </td>
                        <td style={td} className="col-start">
                          {fmtDate(b.startDate)}
                        </td>
                        <td style={td} className="col-cap">
                          {b.maxStudents ? `${b.maxStudents}` : '—'}
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <StatusPill status={b.status || 'upcoming'} />
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                            <button className="icon-btn view-btn" title="View" onClick={() => openView(b)} style={iconBtn}>
                              <AppIcon name="eye" size={14} />
                            </button>
                            {isAdmin && (
                              <>
                                <button className="icon-btn" title="Edit" onClick={() => openEdit(b)} style={iconBtn}>
                                  <AppIcon name="edit" size={14} />
                                </button>
                                <button className="icon-btn del-btn" title="Delete" onClick={() => openDelete(b)} style={iconBtn}>
                                  <AppIcon name="trash" size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── PAGINATOR — same windowed pattern as the other 5 admin pages ── */}
          {batchStatus !== 'loading' && totalRows > 0 && (
            <div style={pagerWrap}>
              <span style={pagerInfo}>
                Showing {startIdx + 1}–{Math.min(startIdx + rowsPerPage, totalRows)} of {totalRows}
              </span>
              <div style={pagerBtns}>
                <button className="pg-btn" style={pgBtn(safePage <= 1)} disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  ‹ Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .map((p, idx, arr) => {
                    const gap = idx > 0 && p - arr[idx - 1] > 1;
                    return (
                      <React.Fragment key={p}>
                        {gap && <span style={pgEllipsis}>…</span>}
                        <button onClick={() => setPage(p)} style={pgNum(p === safePage)}>
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
                <button className="pg-btn" style={pgBtn(safePage >= totalPages)} disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next ›
                </button>
              </div>
              <label style={pagerInfo}>
                Per page{' '}
                <select
                  value={rowsPerPage}
                  onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  className="fi"
                  style={{ ...input, width: 'auto', display: 'inline-block', padding: '4px 8px' }}
                >
                  {ROWS_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}
      {(modal === 'add' || modal === 'edit') && (
        <BatchFormModal editBatch={modal === 'edit' ? target : null} trainers={trainers} courses={courses} trainees={trainees} onClose={closeModal} pushToast={pushToast} />
      )}

      {modal === 'delete' && target && <DeleteModal batch={target} deleting={deleteStatus === 'loading'} onConfirm={handleDelete} onClose={closeModal} />}

      {/* Toasts (built-in, stacked queue — replaces react-hot-toast) */}
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
};

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#657691', marginBottom: 6 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

export default Batches;

// ── Styles (tokens shared with AdminSessions.jsx / UserManagement.jsx / Trainees.jsx / Trainers.jsx / Registrations.jsx) ─
const th = { padding: '12px 16px', textAlign: 'left', fontSize: 12, letterSpacing: '.7px', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const td = { padding: '11px 16px', fontSize: 13, color: '#2b3648' };
const emptyCell = { padding: 32, textAlign: 'center', color: '#657691' };

const badge = (bg) => ({ background: bg, color: '#fff', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' });

const btnPrimary = { background: '#2f6f9b', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost = { background: '#fff', color: '#41506a', border: '1px solid #dbe3ed', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };

const iconBtn = { width: 30, height: 30, borderRadius: 7, background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 };

const input = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1.5px solid #dbe3ed', fontSize: 13, fontFamily: 'inherit', color: '#172033', background: '#fff' };

const bannerClose = { width: 30, height: 30, borderRadius: 7, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#64748B', flexShrink: 0 };

const pagerWrap = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderTop: '1px solid #dbe3ed', background: '#fafafa' };
const pagerInfo = { fontSize: 12.5, color: '#657691' };
const pagerBtns = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const pgBtn = (disabled) => ({ background: '#fff', color: disabled ? '#b6c0cf' : '#41506a', border: '1px solid #dbe3ed', padding: '6px 10px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' });
const pgNum = (active) => ({ background: active ? '#2f6f9b' : '#fff', color: active ? '#fff' : '#41506a', border: `1px solid ${active ? '#2f6f9b' : '#dbe3ed'}`, padding: '6px 11px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', minWidth: 36, fontFamily: 'inherit' });
const pgEllipsis = { color: '#9aa6b6', padding: '0 2px' };

const toastWrap = { position: 'fixed', top: 16, right: 16, display: 'grid', gap: 8, zIndex: 2000 };
const toastItem = (border) => ({ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220, maxWidth: 360, padding: '11px 14px', borderRadius: 10, background: '#fff', boxShadow: '0 10px 30px rgba(15,23,42,.18)', border: `1px solid ${border}`, fontSize: 13.5, color: '#172033' });

const dialogHead = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '22px 20px 6px', borderBottom: '1px solid #dbe3ed' };
const dialogFoot = { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '14px 20px 18px', borderTop: '1px solid #dbe3ed' };

const banner = (bg, bd, cl) => ({ background: bg, border: `1px solid ${bd}`, color: cl, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 });
