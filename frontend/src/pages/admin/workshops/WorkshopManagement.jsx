import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  fetchAdminWorkshops,
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  selectAdminWorkshops,
  selectAdminWorkshopsMeta,
  selectAdminWorkshopStatus,
} from '../../../features/workshops/workshopSlice';
import {
  WORKSHOP_CATEGORIES,
  WORKSHOP_MODES,
  WORKSHOP_BILLING,
  WORKSHOP_LANGUAGES,
  normalizeWorkshopStatus,
  formatDateTime,
} from './workshopMockData';
import { isPastDateTime, todayDateInput, nowTimeInput } from '../../../utils/dateTime';

const S = {
  page:    { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:    { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  input:   { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', color: '#0F172A', background: '#fff', outline: 'none' },
  label:   { display: 'block', fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 5 },
  th:      { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td:      { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  btnPri:  { background: '#1E3A5F', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  btnGhost:{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  section: { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18, marginBottom: 14 },
  secTitle:{ fontSize: 14, fontWeight: 800, color: '#0F172A', margin: '0 0 14px' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
};

const TABS = ['All', 'Draft', 'Published', 'Upcoming', 'Completed', 'Archived'];

function StatusBadge({ status }) {
  const n = normalizeWorkshopStatus(status);
  const cfg = {
    completed: ['#D1FAE5','#065F46'],
    upcoming:  ['#DBEAFE','#1E40AF'],
    draft:     ['#F1F5F9','#475569'],
    cancelled: ['#FEE2E2','#991B1B'],
    published: ['#EDE9FE','#5B21B6'],
    archived:  ['#F1F5F9','#64748B'],
  };
  const [bg, fg] = cfg[n] || cfg.draft;
  return (
    <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

function Field({ label, required, children, hint, span }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
      {label && <label style={S.label}>{label}{required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}</label>}
      {children}
      {hint && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const defaultForm = {
  title: '', subtitle: '', description: '', category: 'Workshop',
  feeType: 'Free', fee: '', mode: 'Online', date: '', time: '10:00',
  duration: 90, trainer: '', trainerName: '',
  maxSeats: '', waitingList: false, certificateEnabled: true,
  attendanceRequired: true, status: 'Draft', language: 'English',
  learningOutcomes: '', prerequisites: '',
  pdfResources: '', slidesLink: '', videosLink: '', githubLink: '', referenceLinks: '',
};

function WorkshopForm({ initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(initial || defaultForm);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const MAX_SEATS_ERR = 'Maximum seats must be a positive whole number (no zero, no decimals, no leading zeros).';

  const validateMaxSeats = (raw) => {
    if (raw === null || raw === undefined) return MAX_SEATS_ERR;

    // Trim whitespace and convert to string for strict checking
    const s = String(raw).trim();
    if (!s) return MAX_SEATS_ERR; // empty / spaces only

    // Reject negative, decimals, non-digits, and leading zeros like 045
    // Allowed: 1, 2, 50, 100, 999, ...
    if (!/^[1-9]\d*$/.test(s)) return MAX_SEATS_ERR;

    return null;
  };

  const handleSave = (status) => {
    if (!form.title.trim()) { alert('Workshop title is required'); return; }
    if (!form.date) { alert('Workshop date is required'); return; }

    if (isPastDateTime(form.date, form.time || '00:00')) {
      alert('Workshop date/time cannot be in the past.');
      return;
    }

    const seatsErr = validateMaxSeats(form.maxSeats);
    if (seatsErr) {
      alert(seatsErr);
      return;
    }

    const maxSeats = Number(String(form.maxSeats).trim());
    onSave({ ...form, maxSeats, status });

  };

  return (
    <div style={{ padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{initial ? 'Edit Workshop' : 'Create Workshop'}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Fill in the details to {initial ? 'update' : 'create'} a workshop event.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btnGhost} onClick={onClose} disabled={saving}>Cancel</button>
          <button style={{ ...S.btnPri, background: '#64748B' }} onClick={() => handleSave('Draft')} disabled={saving}>
            <i className="ti ti-device-floppy" style={{ fontSize: 14 }} /> {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button style={S.btnPri} onClick={() => handleSave('Published')} disabled={saving}>
            <i className="ti ti-rocket" style={{ fontSize: 14 }} /> {saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      <div style={S.section}>
        <h3 style={S.secTitle}>General Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Workshop Title" required>
            <input style={S.input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. AI Bootcamp" />
          </Field>
          <Field label="Subtitle">
            <input style={S.input} value={form.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="Short tagline" />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Category" required>
            <select style={S.input} value={form.category} onChange={e => set('category', e.target.value)}>
              {WORKSHOP_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Fee Type" required>
            <select style={S.input} value={form.feeType} onChange={e => set('feeType', e.target.value)}>
              {WORKSHOP_BILLING.map(b => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="Fee (₹)" hint={form.feeType === 'Free' ? 'Not applicable for free workshops' : ''}>
            <input style={S.input} type="number" min={0} value={form.fee} onChange={e => set('fee', e.target.value)} disabled={form.feeType === 'Free'} placeholder="499" />
          </Field>
        </div>
        <Field label="Description">
          <textarea style={{ ...S.input, minHeight: 90, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What will participants learn?" />
        </Field>
      </div>

      <div style={S.section}>
        <h3 style={S.secTitle}>Schedule</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Mode" required>
            <select style={S.input} value={form.mode} onChange={e => set('mode', e.target.value)}>
              {WORKSHOP_MODES.map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Date" required>
            <input style={S.input} type="date" value={form.date} onChange={e => set('date', e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </Field>
          <Field label="Time">
            <input style={S.input} type="time" value={form.time} onChange={e => set('time', e.target.value)} min={form.date === todayDateInput() ? nowTimeInput() : ''} />
          </Field>
        </div>
        <div style={S.grid2}>
          <Field label="Duration (minutes)" required>
            <input style={S.input} type="number" min={30} max={300} value={form.duration} onChange={e => set('duration', Number(e.target.value))} />
          </Field>
          <Field label="Maximum Seats" required hint={validateMaxSeats(form.maxSeats) ? validateMaxSeats(form.maxSeats) : ''}>
            <input
              style={S.input}
              inputMode="numeric"
              value={form.maxSeats}
              onChange={(e) => set('maxSeats', e.target.value)}
              placeholder="e.g. 100"
            />
          </Field>
        </div>
      </div>

      <div style={S.section}>
        <h3 style={S.secTitle}>Trainer</h3>
        <Field label="Trainer Name" required>
          <input style={S.input} value={form.trainerName || form.trainer || ''} onChange={e => set('trainerName', e.target.value)} placeholder="Trainer full name" />
        </Field>
      </div>

      <div style={S.section}>
        <h3 style={S.secTitle}>Learning Content</h3>
        <div style={S.grid2}>
          <Field label="Learning Outcomes">
            <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }} value={form.learningOutcomes} onChange={e => set('learningOutcomes', e.target.value)} placeholder="What will participants learn?" />
          </Field>
          <Field label="Prerequisites">
            <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }} value={form.prerequisites} onChange={e => set('prerequisites', e.target.value)} placeholder="What should participants know?" />
          </Field>
        </div>
      </div>

      <div style={S.section}>
        <h3 style={S.secTitle}>Workshop Resources</h3>
        <div style={S.grid2}>
          <Field label="PDF / Handout Link">
            <input style={S.input} value={form.pdfResources} onChange={e => set('pdfResources', e.target.value)} placeholder="https://drive.google.com/..." />
          </Field>
          <Field label="Slides Link">
            <input style={S.input} value={form.slidesLink} onChange={e => set('slidesLink', e.target.value)} placeholder="https://slides.google.com/..." />
          </Field>
          <Field label="Videos Link">
            <input style={S.input} value={form.videosLink} onChange={e => set('videosLink', e.target.value)} placeholder="https://youtube.com/..." />
          </Field>
          <Field label="GitHub Repository">
            <input style={S.input} value={form.githubLink} onChange={e => set('githubLink', e.target.value)} placeholder="https://github.com/..." />
          </Field>
        </div>
      </div>

      <div style={S.section}>
        <h3 style={S.secTitle}>Settings</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <Field label="Language">
            <select style={S.input} value={form.language} onChange={e => set('language', e.target.value)}>
              {WORKSHOP_LANGUAGES.map(l => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select style={S.input} value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Draft</option>
              <option>Published</option>
              <option>Archived</option>
            </select>
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { key: 'waitingList',        label: 'Enable Waiting List' },
            { key: 'certificateEnabled', label: 'Issue Certificate' },
            { key: 'attendanceRequired', label: 'Attendance Required' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#334155' }}>
              <input type="checkbox" checked={!!form[key]} onChange={e => set(key, e.target.checked)} style={{ width: 15, height: 15 }} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingBottom: 20 }}>
        <button style={S.btnGhost} onClick={onClose} disabled={saving}>Cancel</button>
        <button style={{ ...S.btnPri, background: '#64748B' }} onClick={() => handleSave('Draft')} disabled={saving}>
          <i className="ti ti-device-floppy" style={{ fontSize: 14 }} /> Save Draft
        </button>
        <button style={S.btnPri} onClick={() => handleSave('Published')} disabled={saving}>
          <i className="ti ti-rocket" style={{ fontSize: 14 }} /> Publish
        </button>
      </div>
    </div>
  );
}

export default function WorkshopManagement() {
  const location = useLocation();
  const dispatch = useDispatch();

  const workshops = useSelector(selectAdminWorkshops);
  const meta = useSelector(selectAdminWorkshopsMeta);
  const status = useSelector(selectAdminWorkshopStatus);

  const isCreate = location.pathname.endsWith('/create');
  const [showForm, setShowForm] = useState(isCreate);
  const [editWorkshop, setEditWorkshop] = useState(null);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchAdminWorkshops({ page, limit: 50, search: search || undefined, status: activeTab !== 'All' ? activeTab : undefined }));
  }, [dispatch, page, activeTab]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      dispatch(fetchAdminWorkshops({ page: 1, limit: 50, search: search || undefined, status: activeTab !== 'All' ? activeTab : undefined }));
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const tabCounts = useMemo(() => {
    const counts = { All: workshops.length };
    TABS.slice(1).forEach(t => {
      counts[t] = workshops.filter(w => {
        const n = normalizeWorkshopStatus(w.status);
        if (t === 'Draft')     return n === 'draft';
        if (t === 'Published') return w.status === 'Published';
        if (t === 'Upcoming')  return n === 'upcoming';
        if (t === 'Completed') return n === 'completed';
        if (t === 'Archived')  return n === 'archived';
        return false;
      }).length;
    });
    return counts;
  }, [workshops]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workshops.filter(w => {
      const n = normalizeWorkshopStatus(w.status);
      const tabMatch =
        activeTab === 'All'       ? true :
        activeTab === 'Draft'     ? n === 'draft' :
        activeTab === 'Published' ? w.status === 'Published' :
        activeTab === 'Upcoming'  ? n === 'upcoming' :
        activeTab === 'Completed' ? n === 'completed' :
        activeTab === 'Archived'  ? n === 'archived' : true;
      return tabMatch && (!q || (w.title || '').toLowerCase().includes(q) || (w.trainerName || '').toLowerCase().includes(q));
    });
  }, [workshops, activeTab, search]);

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editWorkshop) {
        await dispatch(updateWorkshop({ id: editWorkshop._id, ...formData, date: formData.date || new Date().toISOString() })).unwrap();
        toast.success('Workshop updated successfully');
      } else {
        await dispatch(createWorkshop({ ...formData, date: formData.date || new Date().toISOString() })).unwrap();
        toast.success('Workshop saved successfully');
      }
      setShowForm(false);
      setEditWorkshop(null);
      dispatch(fetchAdminWorkshops({ page: 1, limit: 50 }));
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to save workshop');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await dispatch(deleteWorkshop(id));
    dispatch(fetchAdminWorkshops({ page: 1, limit: 50 }));
  };

  const handlePublish = async (w) => {
    await dispatch(updateWorkshop({ id: w._id, status: 'Published', published: true, registrationOpen: true }));
    dispatch(fetchAdminWorkshops({ page: 1, limit: 50 }));
  };

  const handleArchive = async (w) => {
    await dispatch(updateWorkshop({ id: w._id, status: 'Archived', published: false, registrationOpen: false }));
    dispatch(fetchAdminWorkshops({ page: 1, limit: 50 }));
  };

  const openEdit = (w) => {
    setEditWorkshop(w);
    setShowForm(true);
  };

  if (showForm) {
    const initial = editWorkshop ? {
      ...editWorkshop,
      date: editWorkshop.date ? new Date(editWorkshop.date).toISOString().split('T')[0] : '',
      time: editWorkshop.time || '10:00',
      feeType: editWorkshop.isFree ? 'Free' : 'Paid',
      trainerName: editWorkshop.trainerName || '',
      maxSeats: editWorkshop.maxSeats != null ? String(editWorkshop.maxSeats) : '',
    } : null;

    return (
      <WorkshopForm
        initial={initial}
        onClose={() => { setShowForm(false); setEditWorkshop(null); }}
        onSave={handleSave}
        saving={saving}
      />
    );
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Workshop Management</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Create, publish, and manage all workshop events. Total: {meta?.total ?? workshops.length}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btnPri} onClick={() => { setEditWorkshop(null); setShowForm(true); }}>
            <i className="ti ti-plus" style={{ fontSize: 14 }} /> Create Workshop
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            background: activeTab === tab ? '#1E3A5F' : 'transparent',
            color: activeTab === tab ? '#fff' : '#64748B',
          }}>
            {tab}
            {tabCounts[tab] > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, background: activeTab === tab ? 'rgba(255,255,255,0.2)' : '#F1F5F9', color: activeTab === tab ? '#fff' : '#64748B', padding: '1px 6px', borderRadius: 999 }}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 14 }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workshop or trainer…" />
        </div>
      </div>

      <div style={{ ...S.card, overflow: 'hidden' }}>
        {status === 'loading' ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading workshops...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  {['Workshop Name','Category','Trainer','Date','Mode','Seats','Registrations','Status','Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                    {status === 'succeeded' ? 'No workshops found. Create your first workshop!' : 'No workshops match your filters.'}
                  </td></tr>
                ) : filtered.map((w, i) => (
                  <tr key={w._id} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{w.title}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{w.isFree ? 'Free' : `₹${w.fee || 0}`}</div>
                    </td>
                    <td style={S.td}>{w.category || '—'}</td>
                    <td style={S.td}>{w.trainerName || w.trainerId?.name || '—'}</td>
                    <td style={S.td}>{formatDateTime(w.date || w.startDate)}</td>
                    <td style={S.td}>
                      <span style={{ background: w.mode === 'Online' ? '#EFF6FF' : w.mode === 'Offline' ? '#F0FDF4' : '#FFF7ED', color: w.mode === 'Online' ? '#1D4ED8' : w.mode === 'Offline' ? '#15803D' : '#C2410C', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                        {w.mode || 'Online'}
                      </span>
                    </td>
                    <td style={S.td}>{w.registrationCount || 0}/{w.maxSeats || 0}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ flex: 1, height: 5, background: '#F1F5F9', borderRadius: 3, minWidth: 50 }}>
                          <div style={{ width: `${w.maxSeats > 0 ? Math.round(((w.registrationCount || 0) / w.maxSeats) * 100) : 0}%`, height: '100%', background: '#3B82F6', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#64748B' }}>{w.maxSeats > 0 ? Math.round(((w.registrationCount || 0) / w.maxSeats) * 100) : 0}%</span>
                      </div>
                    </td>
                    <td style={S.td}><StatusBadge status={w.status} /></td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button title="Edit" onClick={() => openEdit(w)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="ti ti-pencil" style={{ fontSize: 12 }} />
                        </button>
                        {w.status !== 'Published' && (
                          <button title="Publish" onClick={() => handlePublish(w)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="ti ti-rocket" style={{ fontSize: 12 }} />
                          </button>
                        )}
                        {w.status !== 'Archived' && (
                          <button title="Archive" onClick={() => handleArchive(w)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="ti ti-archive" style={{ fontSize: 12 }} />
                          </button>
                        )}
                        <button title="Delete" onClick={() => handleDelete(w._id, w.title)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="ti ti-trash" style={{ fontSize: 12 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Showing {filtered.length} of {meta?.total ?? workshops.length} workshops</span>
          {meta && meta.pages > 1 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ ...S.btnGhost, padding: '6px 12px', fontSize: 12 }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <button style={{ ...S.btnPri, padding: '6px 12px', fontSize: 12 }}>{page}</button>
              <button style={{ ...S.btnGhost, padding: '6px 12px', fontSize: 12 }} disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
