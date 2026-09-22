import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import {
  fetchCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  selectAllCourses,
  selectCoursesStatus,
  selectCoursesError,
  selectCourseCreateStatus,
  selectCourseCreateError,
  selectCourseUpdateStatus,
  selectCourseUpdateError,
  selectCourseDeleteStatus,
  selectCourseDeleteError,
  clearCourseErrors,
  resetCourseCreateStatus,
} from '../../features/admin/courseSlice';
import AppIcon from '../../components/shared/AppIcon';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const LEVELS         = ['beginner', 'intermediate', 'advanced'];
const STATUSES       = ['draft', 'active', 'archived'];
const DURATION_UNITS = ['hour', 'day', 'week', 'month', 'trimester', 'year'];

const STATUS_COLORS = {
  draft:    { bg: '#F9FAFB', color: '#374151', dot: '#9CA3AF' },
  active:   { bg: '#F0FDF4', color: '#15803D', dot: '#22C55E' },
  archived: { bg: '#FEF2F2', color: '#B91C1C', dot: '#EF4444' },
};

const LEVEL_COLORS = {
  beginner:     { bg: '#EFF6FF', color: '#1D4ED8' },
  intermediate: { bg: '#FEF9C3', color: '#92400E' },
  advanced:     { bg: '#FDF2F8', color: '#86198F' },
};

const CARD_ACCENTS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316'];

const EMPTY_FORM = {
  name: '', code: '', description: '',
  duration: 12, durationUnit: 'week',
  level: 'beginner', status: 'draft', tags: '',
};

const fmtDuration = (value, unit = 'week') => {
  if (!value && value !== 0) return '—';
  const n = Number(value);
  if (!n) return '—';
  const u = DURATION_UNITS.includes(unit) ? unit : 'week';
  return `${n} ${u}${n === 1 ? '' : 's'}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CSS — YouVA OS Theme
// ═══════════════════════════════════════════════════════════════════════════════

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  @keyframes fadeUp    { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
  @keyframes spin      { to{transform:rotate(360deg)} }
  @keyframes shimmer   { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes overlayIn { from{opacity:0} to{opacity:1} }
  @keyframes modalIn   { from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }

  /* YouVA hero gradient — exact match to dashboard */
  .youva-hero {
    background: linear-gradient(120deg, #141836 0%, #1a1f52 35%, #21196b 65%, #1a1545 100%);
    border-radius: 16px;
    padding: 28px 32px 26px;
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

  .crs-card { transition: box-shadow .18s, transform .18s; cursor: pointer; }
  .crs-card:hover { box-shadow: 0 8px 28px rgba(15,23,42,.13) !important; transform: translateY(-2px); }
  .crs-card:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
  .icon-btn { transition: background .15s, transform .15s; border: none; cursor: pointer; }
  .icon-btn:hover { background: #E2E8F0 !important; transform: scale(1.08); }
  .view-btn:hover { background: #EEF2FF !important; }
  .del-btn:hover  { background: #FEE2E2 !important; }
  .tab-btn { transition: all .15s; }
  .tab-btn:hover  { background: #F8FAFC !important; }
  .tab-btn.active { background: #fff !important; color: #0F172A !important; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .fi { transition: border-color .15s, box-shadow .15s; }
  .fi:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
  .sbtn { transition: opacity .15s, transform .15s; }
  .sbtn:hover:not(:disabled) { opacity: .9; transform: translateY(-1px); }
  .sbtn:disabled { opacity: .55; cursor: not-allowed; }
  .shimmer-row {
    background: linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%);
    background-size: 400px 100%; animation: shimmer 1.4s infinite;
    border-radius: 10px; height: 88px;
  }

  /* Centered modal */
  .crs-overlay {
    position: fixed; inset: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
    background: rgba(15,23,42,.55);
    -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
    animation: overlayIn .18s ease;
  }
  .crs-modal {
    width: 100%;
    max-height: calc(100dvh - 48px);
    overflow-y: auto;
    background: #fff; border: 1px solid #E2E8F0; border-radius: 16px;
    padding: 24px;
    box-shadow: 0 24px 60px rgba(15,23,42,.28);
    animation: modalIn .24s cubic-bezier(.16,1,.3,1);
  }
  .crs-modal.is-form   { max-width: 460px; }
  .crs-modal.is-delete { max-width: 380px; }

  @media (max-width: 640px) {
    .hero-stat-strip { flex-direction: column !important; gap: 16px !important; }
    .hero-stat-strip .stat-divider { display: none !important; }
    .youva-hero { padding: 22px 20px 20px; }
  }
  @media (max-width: 560px) {
    .dur-grid   { grid-template-columns: 1fr !important; }
    .crs-overlay { padding: 14px; align-items: flex-end; }
    .crs-modal   { padding: 18px !important; border-radius: 16px; max-height: calc(100dvh - 28px); }
  }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// ATOMS
// ═══════════════════════════════════════════════════════════════════════════════

const Pill = ({ label, colorMap }) => {
  const c = colorMap[label] || { bg: '#F1F5F9', color: '#374151', dot: '#94A3B8' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c.bg, color: c.color, fontSize: '0.7rem', fontWeight: 600,
      padding: '2px 9px', borderRadius: 99,
      border: c.dot ? `1px solid ${c.dot}30` : undefined,
    }}>
      {c.dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot }} />}
      {label}
    </span>
  );
};

const FL = ({ children, required }) => (
  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
    {children}{required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
  </label>
);

const FInput = ({ label, required, ...p }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <FL required={required}>{label}</FL>}
    <input className="fi" required={required} {...p}
      style={{
        width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 8,
        padding: '9px 12px', fontSize: '0.85rem', color: '#0F172A',
        background: '#FAFAFA', fontFamily: 'inherit', ...p.style,
      }} />
  </div>
);

const FSelect = ({ label, required, children, ...p }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <FL required={required}>{label}</FL>}
    <div style={{ position: 'relative' }}>
      <select className="fi" required={required} {...p}
        style={{
          width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 8,
          padding: '9px 32px 9px 12px', fontSize: '0.85rem', color: '#0F172A',
          background: '#FAFAFA', appearance: 'none', WebkitAppearance: 'none',
          cursor: 'pointer', fontFamily: 'inherit', ...p.style,
        }}>
        {children}
      </select>
      <span style={{
        position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
        pointerEvents: 'none', color: '#94A3B8', fontSize: '0.7rem',
      }}>▾</span>
    </div>
  </div>
);

// Spinner removed (unused)

// ═══════════════════════════════════════════════════════════════════════════════
// COURSE CARD
// ═══════════════════════════════════════════════════════════════════════════════

const CourseCard = ({ course, idx, onView, onEdit, onDelete }) => {
  const accent   = CARD_ACCENTS[idx % CARD_ACCENTS.length];
  const initials = (course.code || course.name || 'C').slice(0, 4).toUpperCase();

  return (
    <div
      className="crs-card"
      role="button"
      tabIndex={0}
      title="View course details"
      onClick={() => onView(course)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(course); }
      }}
      style={{
        background: '#fff', border: '1px solid #E2E8F0',
        borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden',
        animation: 'fadeUp .3s ease', boxShadow: '0 1px 3px rgba(15,23,42,.05)',
      }}>

      {/* Accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: accent, borderRadius: '14px 14px 0 0',
      }} />

      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 12, marginTop: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 11, background: `${accent}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'DM Mono, monospace', fontWeight: 600, fontSize: '0.72rem',
            color: accent, flexShrink: 0, letterSpacing: '0.5px',
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: '0.92rem', color: '#0F172A', marginBottom: 4,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {course.name}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <Pill label={course.status || 'draft'}    colorMap={STATUS_COLORS} />
              <Pill label={course.level  || 'beginner'} colorMap={LEVEL_COLORS} />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button className="icon-btn view-btn"
            onClick={(e) => { e.stopPropagation(); onView(course); }}
            style={{
              width: 30, height: 30, borderRadius: 7, background: '#F8FAFC',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
            }}
            title="View"><AppIcon name="eye" size={14} /></button>
          <button className="icon-btn"
            onClick={(e) => { e.stopPropagation(); onEdit(course); }}
            style={{
              width: 30, height: 30, borderRadius: 7, background: '#F8FAFC',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
            }}
            title="Edit"><AppIcon name="edit" size={14} /></button>
          <button className="icon-btn del-btn"
            onClick={(e) => { e.stopPropagation(); onDelete(course); }}
            style={{
              width: 30, height: 30, borderRadius: 7, background: '#F8FAFC',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
            }}
            title="Delete"><AppIcon name="trash" size={14} /></button>
        </div>
      </div>

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 14px', marginTop: 14 }}>
        {[
          { icon: '🏷️', label: 'Code',     value: course.code || '—' },
          { icon: '⏱️', label: 'Duration', value: fmtDuration(course.duration, course.durationUnit) },
          { icon: '📚', label: 'Modules',  value: `${course.modules?.length || 0} modules` },
          { icon: '🔖', label: 'Tags',     value: course.tags?.join(', ') || '—' },
        ].map(({ icon, label, value }) => (
          <div key={label} style={{ minWidth: 0 }}>
            <div style={{
              fontSize: '0.63rem', fontWeight: 600, color: '#94A3B8',
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2,
            }}>
              {icon} {label}
            </div>
            <div style={{
              fontSize: '0.81rem', fontWeight: 500, color: '#374151',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Description */}
      {course.description && (
        <div style={{
          marginTop: 11, fontSize: '0.77rem', color: '#64748B', lineHeight: 1.5,
          borderTop: '1px solid #F1F5F9', paddingTop: 10,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {course.description}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COURSE FORM — Add / Edit
// ═══════════════════════════════════════════════════════════════════════════════

const CourseForm = ({ editCourse, onClose }) => {
  const dispatch     = useDispatch();
  const createStatus = useSelector(selectCourseCreateStatus);
  const createError  = useSelector(selectCourseCreateError);
  const updateStatus = useSelector(selectCourseUpdateStatus);
  const updateError  = useSelector(selectCourseUpdateError);

  const isEdit = !!editCourse;
  const [form, setForm] = useState(
    isEdit ? {
      name:         editCourse.name         || '',
      code:         editCourse.code         || '',
      description:  editCourse.description  || '',
      duration:     editCourse.duration     || 12,
      durationUnit: editCourse.durationUnit || 'week',
      level:        editCourse.level        || 'beginner',
      status:       editCourse.status       || 'draft',
      tags:         (editCourse.tags || []).join(', '),
    } : { ...EMPTY_FORM }
  );

  const saving = createStatus === 'loading' || updateStatus === 'loading';
  const err    = createError  || updateError;
  const set    = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      code:         form.code.toUpperCase().trim(),
      duration:     Number(form.duration),
      durationUnit: form.durationUnit || 'week',
      tags:         form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };
    const result = isEdit
      ? await dispatch(updateCourse({ id: editCourse._id, ...payload }))
      : await dispatch(createCourse(payload));
    const action = isEdit ? updateCourse : createCourse;
    if (action.fulfilled.match(result)) {
      toast.success(isEdit ? 'Course updated!' : 'Course created!');
      dispatch(resetCourseCreateStatus());
      onClose();
    }
  };

  return (
    <div style={{ animation: 'fadeUp .25s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: 0 }}>
          {isEdit ? '✏️ Edit Course' : '➕ Add New Course'}
        </h3>
        <button type="button" className="icon-btn" onClick={onClose}
          style={{
            width: 28, height: 28, borderRadius: 6, background: '#F1F5F9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.88rem', color: '#64748B',
          }}>✕</button>
      </div>

      <form onSubmit={handleSubmit}>
        <FInput label="Course Name" required placeholder="e.g. Fullstack Web Development"
          value={form.name} onChange={e => set('name', e.target.value)} />

        <FInput label="Course Code" required placeholder="e.g. YIEP"
          value={form.code}
          onChange={e => set('code', e.target.value.toUpperCase())}
          style={{ fontFamily: 'DM Mono, monospace', letterSpacing: '1px' }} />

        <FSelect label="Level" required value={form.level}
          onChange={e => set('level', e.target.value)}>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </FSelect>

        <div className="dur-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FInput label="Duration" required type="number" min="1"
            value={form.duration} onChange={e => set('duration', e.target.value)} />
          <FSelect label="Unit" required value={form.durationUnit}
            onChange={e => set('durationUnit', e.target.value)}>
            {DURATION_UNITS.map(u => (
              <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}s</option>
            ))}
          </FSelect>
        </div>

        <FSelect label="Status" value={form.status}
          onChange={e => set('status', e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </FSelect>

        <FInput label="Tags (comma separated)" placeholder="e.g. web, banking, fullstack"
          value={form.tags} onChange={e => set('tags', e.target.value)} />

        <div style={{ marginBottom: 18 }}>
          <FL>Description</FL>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Brief description of this course…" rows={3} className="fi"
            style={{
              width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 8,
              padding: '9px 12px', fontSize: '0.85rem', color: '#0F172A',
              resize: 'vertical', fontFamily: 'inherit', background: '#FAFAFA',
            }} />
        </div>

        {err && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
            padding: '9px 12px', fontSize: '0.77rem', color: '#B91C1C', marginBottom: 14,
          }}>
            ⚠️ {err}
          </div>
        )}

        <button type="submit" disabled={saving} className="sbtn"
          style={{
            width: '100%', padding: '11px', borderRadius: 9, border: 'none',
            background: saving ? '#94A3B8' : 'linear-gradient(135deg,#6366f1,#4F46E5)',
            color: '#fff', fontWeight: 700, fontSize: '0.88rem',
            fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer',
          }}>
          {saving
            ? (isEdit ? 'Saving…' : 'Creating…')
            : (isEdit ? 'Save Changes' : 'Create Course')}
        </button>
      </form>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE CONFIRM
// ═══════════════════════════════════════════════════════════════════════════════

const DeleteConfirm = ({ course, onConfirm, onCancel, deleting, deleteError }) => (
  <div style={{ animation: 'fadeUp .2s ease', textAlign: 'center', padding: '8px 0' }}>
    <div style={{
      width: 56, height: 56, borderRadius: 14, background: '#FEF2F2',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.6rem', margin: '0 auto 14px',
    }}>🗑️</div>
    <h3 style={{ fontWeight: 700, fontSize: '0.96rem', color: '#0F172A', marginBottom: 8 }}>
      Delete "{course.name}"?
    </h3>
    <p style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 16, lineHeight: 1.5 }}>
      This cannot be undone. Active batches using this course will block deletion.
    </p>
    {deleteError && (
      <div style={{
        background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7,
        padding: '8px 12px', fontSize: '0.76rem', color: '#B91C1C',
        marginBottom: 12, textAlign: 'left',
      }}>
        ⚠️ {deleteError}
      </div>
    )}
    <div style={{ display: 'flex', gap: 10 }}>
      <button onClick={onCancel} className="sbtn"
        style={{
          flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0',
          background: '#fff', color: '#374151', fontWeight: 600, fontSize: '0.85rem',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Cancel</button>
      <button onClick={onConfirm} disabled={deleting} className="sbtn"
        style={{
          flex: 1, padding: '10px', borderRadius: 8, border: 'none',
          background: '#DC2626', color: '#fff', fontWeight: 600, fontSize: '0.85rem',
          cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}>
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const Courses = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const courses      = useSelector(selectAllCourses);
  const status       = useSelector(selectCoursesStatus);
  const error        = useSelector(selectCoursesError);
  const deleteStatus = useSelector(selectCourseDeleteStatus);
  const deleteError  = useSelector(selectCourseDeleteError);

  const [tab,    setTab]    = useState('all');
  const [search, setSearch] = useState('');
  const [panel,  setPanel]  = useState(null);
  const [target, setTarget] = useState(null);

  useEffect(() => { dispatch(fetchCourses()); }, [dispatch]);

  const openView   = (c) => navigate(`/admin/courses/${c._id}`);
  const openAdd    = ()  => { setTarget(null); setPanel('add');    dispatch(clearCourseErrors()); };
  const openEdit   = (c) => { setTarget(c);    setPanel('edit');   dispatch(clearCourseErrors()); };
  const openDelete = (c) => { setTarget(c);    setPanel('delete'); dispatch(clearCourseErrors()); };
  const closePanel = ()  => { setPanel(null);  setTarget(null);    dispatch(clearCourseErrors()); };

  const handleDelete = async () => {
    if (!target) return;
    const result = await dispatch(deleteCourse(target._id));
    if (deleteCourse.fulfilled.match(result)) {
      toast.success(`"${target.name}" deleted`);
      closePanel();
    }
  };

  useEffect(() => {
    if (!panel) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') closePanel(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [panel]);

  const filtered = courses.filter(c => {
    const matchTab    = tab === 'all' || c.status === tab;
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.code?.toLowerCase().includes(search.toLowerCase()) ||
      c.level?.toLowerCase().includes(search.toLowerCase()) ||
      c.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchTab && matchSearch;
  });

  const stats = {
    total:    courses.length,
    active:   courses.filter(c => c.status === 'active').length,
    draft:    courses.filter(c => c.status === 'draft').length,
    archived: courses.filter(c => c.status === 'archived').length,
  };

  // Hero stat strip data
  const heroStats = [
    { label: 'TOTAL COURSES', value: stats.total,    sub: `${stats.active} active`,     subColor: '#60A5FA' },
    { label: 'ACTIVE',        value: stats.active,   sub: `▲ live programmes`,          subColor: '#4ADE80' },
    { label: 'DRAFT',         value: stats.draft,    sub: 'pending publish',            subColor: '#A78BFA' },
    { label: 'ARCHIVED',      value: stats.archived, sub: 'retired courses',            subColor: '#FB923C' },
  ];

  const TABS = ['all', 'active', 'draft', 'archived'];

  return (
    <div style={{
      minHeight: '100vh', background: '#F1F5F9',
      fontFamily: "'Inter', system-ui, sans-serif", color: '#0F172A',
    }}>
      <style>{CSS}</style>

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 24px' }}>

        {/* ── YOUVA HERO BANNER ── */}
        <div className="youva-hero">

          {/* Eyebrow + headline + CTA */}
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', gap: 20,
            marginBottom: 26, flexWrap: 'wrap',
          }}>
            <div>
              <p style={{
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '1.4px',
                textTransform: 'uppercase', color: '#7C85B3',
                margin: 0, marginBottom: 10,
              }}>
                PLATFORM OVERVIEW · COURSES
              </p>
              <h1 style={{
                fontSize: '1.75rem', fontWeight: 800, color: '#F1F5F9',
                margin: 0, letterSpacing: '-0.5px', lineHeight: 1.2,
              }}>
                {stats.active > 0
                  ? <><span>Youvaos is </span><span style={{ color: '#FB923C' }}>live</span><span> — {stats.active} course{stats.active === 1 ? '' : 's'} running.</span></>
                  : <><span>Youvaos </span><span style={{ color: '#FB923C' }}>awaits</span><span> — publish your first course.</span></>
                }
              </h1>
              <p style={{ fontSize: '0.82rem', color: '#7C85B3', marginTop: 10, marginBottom: 0 }}>
                {stats.total} total courses across {stats.active} active, {stats.draft} draft. All linked to batches.
              </p>
            </div>

            <button onClick={openAdd}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 9, border: 'none',
                background: 'rgba(99,102,241,0.85)',
                color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                boxShadow: '0 2px 12px rgba(99,102,241,.5)',
                backdropFilter: 'blur(4px)',
              }}>
              <span style={{ fontSize: '1.05rem' }}>+</span> Add Course
            </button>
          </div>

          {/* Stat strip — horizontal with dividers */}
          <div className="hero-stat-strip" style={{
            display: 'flex', gap: 0,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: 20,
          }}>
            {heroStats.map(({ label, value, sub, subColor }, idx) => (
              <React.Fragment key={label}>
                {idx > 0 && (
                  <div className="stat-divider" style={{
                    width: 1, background: 'rgba(255,255,255,0.08)',
                    margin: '0 28px', flexShrink: 0,
                  }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.63rem', fontWeight: 700, letterSpacing: '1px',
                    textTransform: 'uppercase', color: '#7C85B3', marginBottom: 6,
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: '2rem', fontWeight: 800, color: '#F1F5F9',
                    fontFamily: 'DM Mono, monospace', letterSpacing: '-1.5px', lineHeight: 1,
                  }}>
                    {value}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: subColor, marginTop: 6 }}>
                    {sub}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── SEARCH + TABS ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <span style={{
              position: 'absolute', left: 11, top: '50%',
              transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#94A3B8', display: 'flex',
            }}><AppIcon name="search" size={14} /></span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, code, level, tag…"
              className="fi"
              style={{
                width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 9,
                padding: '9px 12px 9px 34px', fontSize: '0.84rem', color: '#0F172A',
                background: '#fff', fontFamily: 'inherit',
              }} />
          </div>
          <div style={{
            display: 'flex', background: '#E2E8F0',
            borderRadius: 9, padding: 3, gap: 2,
          }}>
            {TABS.map(t => (
              <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
                style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none',
                  cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                  color: tab === t ? '#0F172A' : '#64748B',
                  background: 'transparent', fontFamily: 'inherit', textTransform: 'capitalize',
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* API error */}
        {error && status === 'failed' && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9,
            padding: '10px 14px', fontSize: '0.79rem', color: '#B91C1C', marginBottom: 16,
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Shimmer loading */}
        {status === 'loading' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {[1,2,3,4,5,6].map(i => <div key={i} className="shimmer-row" />)}
          </div>
        )}

        {/* Course grid */}
        {status !== 'loading' && filtered.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {filtered.map((c, i) => (
              <CourseCard key={c._id} course={c} idx={i}
                onView={openView} onEdit={openEdit} onDelete={openDelete} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {status !== 'loading' && filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px', color: '#94A3B8',
            background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📚</div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 6, color: '#374151' }}>
              {search ? 'No courses match your search' : 'No courses yet'}
            </div>
            <div style={{ fontSize: '0.82rem' }}>Click "Add Course" to create the first one.</div>
          </div>
        )}
      </div>

      {/* ── CENTERED MODAL (Add / Edit / Delete) ── */}
      {panel && (
        <div className="crs-overlay" onClick={closePanel} role="dialog" aria-modal="true">
          <div
            className={`crs-modal ${panel === 'delete' ? 'is-delete' : 'is-form'}`}
            onClick={e => e.stopPropagation()}
          >
            {panel === 'delete' ? (
              <DeleteConfirm
                course={target}
                deleting={deleteStatus === 'loading'}
                deleteError={deleteError}
                onConfirm={handleDelete}
                onCancel={closePanel}
              />
            ) : (
              <CourseForm
                key={panel === 'edit' ? target?._id : 'add'}
                editCourse={panel === 'edit' ? target : null}
                onClose={closePanel}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;