
import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  fetchRegistrations,
  convertLead,
  createRegistration,
  updateRegistration,
  deleteRegistration,
  selectAllRegistrations,
} from '../../features/admin/adminSlice';

// Toast look-up (icon glyph + colours) — identical to other admin pages.
const TOAST = {
  success: { color: '#16a05f', border: '#bfe6d0', glyph: '✓' },
  error: { color: '#c0392b', border: '#f3c2bd', glyph: '✕' },
  warning: { color: '#b06f00', border: '#f0d9a8', glyph: '⚠' },
  info: { color: '#2f6f9b', border: '#bcd6ea', glyph: 'ℹ' },
};

// Pipeline-stage palette (same convention as Sessions' status colors).
const STAGE_COLORS = {
  new: '#7c3aed',
  contacted: '#b06f00',
  registered: '#2f6f9b',
  enrolled: '#16a05f',
};
const STAGE_LABELS = { new: 'New', contacted: 'Contacted', registered: 'Registered', enrolled: 'Enrolled' };

// Normalizes a raw status into one of the 4 pipeline stages — 'converted' and
// 'lead' both collapse into 'new', matching the original page's behaviour.
const normalizeStage = (status) => {
  const s = (status || 'new').toLowerCase();
  if (s === 'converted' || s === 'lead') return 'new';
  if (STAGE_LABELS[s]) return s;
  return 'new';
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

// ── Tiny responsive hook (re-renders on resize) ────────────────────────────────
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

const EMPTY_FORM = { fullName: '', email: '', phone: '', programInterest: 'YIEP', source: 'web' };

export default function AdminRegistrations() {
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile();

  const registrations = useAppSelector(selectAllRegistrations) ?? [];

  const [activeTab, setActiveTab] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // ── Built-in toast queue — identical pattern to other admin pages ──
  const [toasts, setToasts] = useState([]);
  const pushToast = (icon, title) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, icon, title }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };

  // ── Built-in confirm dialog (replaces window.confirm) ──
  const [confirmState, setConfirmState] = useState(null);
  const confirm = (opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve }));
  const resolveConfirm = (val) => {
    if (confirmState) confirmState.resolve(val);
    setConfirmState(null);
  };

  // ── Search ──
  const [q, setQ] = useState('');

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    dispatch(fetchRegistrations());
  }, [dispatch]);

  // ── Tab counts ──
  const getTabCount = (stage) => {
    if (stage === 'all') return registrations.length;
    return registrations.filter((r) => normalizeStage(r.status) === stage).length;
  };

  // ── Filtering (tab stage + search) ──
  const filtered = useMemo(() => {
    let list = registrations;
    if (activeTab !== 'all') list = list.filter((r) => normalizeStage(r.status) === activeTab);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((r) => {
        const name = (r.fullName || r.name || '').toLowerCase();
        const contact = (r.phone || r.email || '').toLowerCase();
        return name.includes(needle) || contact.includes(needle);
      });
    }
    return list;
  }, [registrations, activeTab, q]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, q]);

  // ── Derived pagination (over FILTERED) ──
  const total = filtered.length;
  const allTotal = registrations.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(total, page * pageSize);

  // ── Actions ──
  const handleConvert = async (id, name) => {
    const idString = typeof id === 'object' ? id._id || id.id : id;
    setBusyId(idString);
    try {
      const result = await dispatch(convertLead({ id: idString }));
      if (convertLead.fulfilled.match(result)) {
        pushToast('success', `${name || 'Lead'} converted to trainee`);
        dispatch(fetchRegistrations());
      } else {
        pushToast('error', result.payload || 'Failed to convert lead');
      }
    } catch (err) {
      pushToast('error', 'Failed to convert lead');
    } finally {
      setBusyId(null);
    }
  };

  const handleAddLead = async (formData) => {
    const result = await dispatch(createRegistration(formData));
    if (createRegistration.fulfilled.match(result)) {
      pushToast('success', 'Lead added successfully');
      setShowAddModal(false);
      dispatch(fetchRegistrations());
    } else {
      pushToast('error', result.payload || 'Failed to add lead');
      throw new Error(result.payload || 'Failed to add lead');
    }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm({
      title: 'Delete this registration?',
      text: `"${name || 'This lead'}" will be permanently removed. This cannot be undone.`,
      confirmText: 'Yes, delete it',
      danger: true,
    });
    if (!ok) return;
    const idString = typeof id === 'object' ? id._id || id.id : id;
    setBusyId(idString);
    try {
      const result = await dispatch(deleteRegistration(idString));
      if (deleteRegistration.fulfilled.match(result)) {
        pushToast('success', 'Registration deleted successfully');
        dispatch(fetchRegistrations());
      } else {
        pushToast('error', result.payload || 'Failed to delete registration');
      }
    } catch (err) {
      pushToast('error', 'Failed to delete registration');
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    const idString = typeof id === 'object' ? id._id || id.id : id;
    setBusyId(idString);
    try {
      const result = await dispatch(updateRegistration({ id: idString, status }));
      if (updateRegistration.fulfilled.match(result)) {
        const enrollment = result.payload?.enrollment || null;
        if (status === 'enrolled') {
          if (enrollment?.alreadyEnrolled) {
            pushToast('info', 'Trainee already enrolled — no duplicate email sent.');
          } else if (enrollment?.emailError) {
            pushToast('warning', `Trainee enrolled, but the credentials email failed: ${enrollment.emailError}`);
          } else if (enrollment?.emailSent) {
            pushToast('success', 'Trainee enrolled and credentials email sent.');
          } else {
            pushToast('success', 'Trainee enrolled successfully.');
          }
        } else {
          pushToast('success', 'Status updated');
        }
        dispatch(fetchRegistrations());
      } else {
        pushToast('error', result.payload || 'Failed to update status');
      }
    } catch (err) {
      pushToast('error', 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const StageBadge = ({ status }) => {
    const stage = normalizeStage(status);
    return <span style={badge(STAGE_COLORS[stage])}>{STAGE_LABELS[stage]}</span>;
  };
  const ProgramBadge = ({ program }) => {
    const isYBLP = (program || '').toLowerCase().includes('yblp');
    return <span style={programPill(isYBLP)}>{program || 'YIEP'}</span>;
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

  // ── Row actions (Convert / inline status select / Delete) ──
  const RowActions = ({ r }) => {
    const idString = r._id || r.id;
    const rowBusy = busyId === idString;
    const stage = normalizeStage(r.status);

    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {stage === 'registered' ? (
          <button onClick={() => handleConvert(idString, r.fullName || r.name)} disabled={rowBusy} style={btnConvert(rowBusy)}>
            {rowBusy ? '…' : 'Convert'}
          </button>
        ) : stage === 'enrolled' ? (
          <span style={{ color: '#16a05f', fontSize: 12, fontWeight: 700 }}>Active Trainee</span>
        ) : (
          <select
            value={stage}
            onChange={(e) => handleUpdateStatus(idString, e.target.value)}
            disabled={rowBusy}
            style={{ ...input, width: 'auto', padding: '6px 8px', fontSize: 12.5 }}
          >
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="enrolled">Enrolled</option>
          </select>
        )}
        <button
          onClick={() => handleDelete(idString, r.fullName || r.name)}
          disabled={rowBusy || stage === 'enrolled'}
          title={stage === 'enrolled' ? 'Active trainees cannot be deleted here' : 'Delete registration'}
          style={btnDelete(rowBusy || stage === 'enrolled')}
        >
          🗑️
        </button>
      </div>
    );
  };

  // ── Pagination bar — identical structure to other admin pages' Pager ──
  const Pager = () => {
    if (total === 0) return null;
    return (
      <div style={pagerWrap}>
        <span style={pagerInfo}>
          Showing {startIdx}–{endIdx} of {total}
        </span>
        <div style={pagerBtns}>
          <button style={pgBtn(page === 1)} disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ‹ Prev
          </button>
          {pageList(page, totalPages).map((n, idx) =>
            n === '…' ? (
              <span key={`e${idx}`} style={pgEllipsis}>
                …
              </span>
            ) : (
              <button key={n} onClick={() => setPage(n)} style={pgNum(n === page)}>
                {n}
              </button>
            )
          )}
          <button
            style={pgBtn(page === totalPages)}
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next ›
          </button>
        </div>
        {!isMobile && (
          <label style={pagerInfo}>
            Per page{' '}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{ ...input, width: 'auto', display: 'inline-block', padding: '4px 8px' }}
            >
              {[10, 20, 40].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    );
  };

  // ── Render ──
  return (
    <div style={{ padding: isMobile ? 16 : 32, fontFamily: 'Public Sans, system-ui, sans-serif' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 800, margin: 0, color: '#172033' }}>
            Registrations ({total}
            {total !== allTotal ? ` of ${allTotal}` : ''})
          </h2>
          <p style={{ fontSize: 13, color: '#657691', margin: '4px 0 0' }}>
            Lead capture → Registered → Enrolled → Active Trainee pipeline
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto' }}>
          <button onClick={() => dispatch(fetchRegistrations())} style={btnGhost}>
            ↻ Refresh
          </button>
          <button onClick={() => setShowAddModal(true)} style={btnSchedule(isMobile)}>
            ＋ Add Lead
          </button>
        </div>
      </div>

      {/* Stage tabs + search */}
      <div style={tabsBar(isMobile)}>
        <div style={tabsGroup}>
          {[
            { key: 'all', label: 'All Leads' },
            { key: 'new', label: 'New' },
            { key: 'contacted', label: 'Contacted' },
            { key: 'registered', label: 'Registered' },
            { key: 'enrolled', label: 'Enrolled' },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={tabBtn(activeTab === tab.key)}>
              {tab.label} ({getTabCount(tab.key)})
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔎  Search by name or contact…"
          style={{ ...input, maxWidth: isMobile ? '100%' : 240 }}
        />
      </div>

      {/* DESKTOP: table */}
      {!isMobile && (
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(23,32,51,.08), 0 12px 28px rgba(31,61,99,.05)',
            border: '1px solid #dbe3ed',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#657691' }}>
                  {['Name', 'Contact', 'Program', 'Source', 'Stage', 'Date', 'Actions'].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {total === 0 ? (
                  <tr>
                    <td colSpan={7} style={emptyCell}>
                      No {activeTab === 'all' ? 'leads' : activeTab} found.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((r, i) => (
                    <tr
                      key={r._id || i}
                      style={{ background: i % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #dbe3ed' }}
                    >
                      <td style={td}>
                        <span style={{ fontWeight: 600, color: '#172033' }}>{r.fullName || r.name || '—'}</span>
                      </td>
                      <td style={td}>{r.phone || r.email || '—'}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <ProgramBadge program={r.programInterest} />
                      </td>
                      <td style={{ ...td, textTransform: 'capitalize' }}>{r.source || 'Website'}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <StageBadge status={r.status} />
                      </td>
                      <td style={td}>{formatDate(r.createdAt)}</td>
                      <td style={{ padding: '8px 16px' }}>
                        <RowActions r={r} />
                      </td>
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
          {total === 0 ? (
            <div style={cardEmpty}>No {activeTab === 'all' ? 'leads' : activeTab} found.</div>
          ) : (
            pageItems.map((r, i) => (
              <div key={r._id || i} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontWeight: 700, color: '#172033', fontSize: 15 }}>{r.fullName || r.name || '—'}</span>
                  <StageBadge status={r.status} />
                </div>
                <div style={cardMeta}>
                  <b>Contact:</b> {r.phone || r.email || '—'}
                </div>
                <div style={{ display: 'flex', gap: 8, margin: '6px 0' }}>
                  <ProgramBadge program={r.programInterest} />
                </div>
                <div style={cardMeta}>
                  <b>Source:</b> <span style={{ textTransform: 'capitalize' }}>{r.source || 'Website'}</span>
                </div>
                <div style={cardMeta}>
                  <b>Date:</b> {formatDate(r.createdAt)}
                </div>
                <div style={{ marginTop: 10 }}>
                  <RowActions r={r} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Pager />

      {/* Add Lead modal */}
      {showAddModal && (
        <AddLeadModal isOpen={showAddModal} isMobile={isMobile} onClose={() => setShowAddModal(false)} onSubmit={handleAddLead} />
      )}

      {/* Confirm dialog (built-in, replaces window.confirm) */}
      {confirmState && (
        <div style={{ ...overlay, alignItems: 'center', zIndex: 1500 }} onMouseDown={() => resolveConfirm(false)}>
          <div style={{ ...dialog, maxWidth: 420, marginTop: 0 }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ padding: '22px 22px 8px' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#172033' }}>{confirmState.title}</h3>
              {confirmState.text && (
                <p style={{ margin: '10px 0 0', fontSize: 13.5, color: '#41506a', lineHeight: 1.5 }}>{confirmState.text}</p>
              )}
            </div>
            <div style={{ ...dialogFoot, borderTop: 'none' }}>
              <button onClick={() => resolveConfirm(false)} style={btnGhost}>
                Keep it
              </button>
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

      {/* Toasts (built-in, stacked queue) */}
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

// ── Add Lead modal ──────────────────────────────────────────────────────────────
function AddLeadModal({ isOpen, isMobile, onClose, onSubmit }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required.';
    else if (form.fullName.trim().length < 2) e.fullName = 'Full name must be at least 2 characters.';
    else if (!/^[a-zA-Z\s]+$/.test(form.fullName.trim())) e.fullName = 'Full name can only contain letters and spaces.';

    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Please enter a valid email address.';

    if (form.phone.trim()) {
      const phoneRegex = /^[+]?[1-9]?[0-9]{7,15}$/;
      if (!phoneRegex.test(form.phone.replace(/[\s()-]/g, ''))) e.phone = 'Please enter a valid phone number (7-15 digits).';
    }

    if (!form.programInterest) e.programInterest = 'Program interest is required.';
    if (!form.source) e.source = 'Source is required.';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleClose = () => {
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setSaving(false);
    onClose();
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
      });
      setForm({ ...EMPTY_FORM });
      setErrors({});
    } catch (err) {
      // onSubmit already pushes an error toast on failure; keep modal open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay} onMouseDown={() => !saving && handleClose()}>
      <div style={{ ...dialog, maxWidth: isMobile ? '100%' : 460 }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={dialogHead}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#172033' }}>Add new lead</h3>
          <button onClick={handleClose} style={bannerClose}>
            ×
          </button>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          <Field label="Full name">
            <input
              style={{ ...input, border: `1px solid ${errors.fullName ? '#c0392b' : '#dbe3ed'}` }}
              value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              placeholder="Enter full name"
            />
            {errors.fullName && <FieldError text={errors.fullName} />}
          </Field>

          <Field label="Email">
            <input
              type="email"
              style={{ ...input, border: `1px solid ${errors.email ? '#c0392b' : '#dbe3ed'}` }}
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="Enter email address"
            />
            {errors.email && <FieldError text={errors.email} />}
          </Field>

          <Field label="Phone (optional)">
            <input
              type="tel"
              style={{ ...input, border: `1px solid ${errors.phone ? '#c0392b' : '#dbe3ed'}` }}
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="Enter phone number (optional)"
            />
            {errors.phone && <FieldError text={errors.phone} />}
          </Field>

          <Field label="Program interest">
            <select
              style={{ ...input, border: `1px solid ${errors.programInterest ? '#c0392b' : '#dbe3ed'}` }}
              value={form.programInterest}
              onChange={(e) => setField('programInterest', e.target.value)}
            >
              <option value="">Select program</option>
              <option value="YIEP">YIEP — Young India Employment Program</option>
              <option value="YBLP">YBLP — Young Business Leadership Program</option>
            </select>
            {errors.programInterest && <FieldError text={errors.programInterest} />}
          </Field>

          <Field label="Source">
            <select
              style={{ ...input, border: `1px solid ${errors.source ? '#c0392b' : '#dbe3ed'}` }}
              value={form.source}
              onChange={(e) => setField('source', e.target.value)}
            >
              <option value="">Select source</option>
              <option value="web">Website</option>
              <option value="referral">Referral</option>
              <option value="social">Social Media</option>
              <option value="direct">Direct Contact</option>
              <option value="other">Other</option>
            </select>
            {errors.source && <FieldError text={errors.source} />}
          </Field>
        </div>

        <div style={dialogFoot}>
          <button onClick={handleClose} disabled={saving} style={btnGhost}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={btnPrimary}>
            {saving ? 'Adding…' : 'Add lead'}
          </button>
        </div>
      </div>
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
function FieldError({ text }) {
  return <div style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>{text}</div>;
}

// ── Styles (tokens lifted directly from AdminSessions.jsx / UserManagement.jsx / Trainees.jsx / Trainers.jsx) ─
const th = { padding: '12px 16px', textAlign: 'left', fontSize: 12, letterSpacing: '.7px', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const td = { padding: '11px 16px', fontSize: 13, color: '#2b3648' };
const emptyCell = { padding: 32, textAlign: 'center', color: '#657691' };

const card = { background: '#fff', border: '1px solid #dbe3ed', borderRadius: 12, padding: 14, boxShadow: '0 1px 2px rgba(23,32,51,.06)' };
const cardEmpty = { background: '#fff', border: '1px solid #dbe3ed', borderRadius: 12, padding: 28, textAlign: 'center', color: '#657691' };
const cardMeta = { fontSize: 13, color: '#41506a', marginTop: 6 };

const badge = (bg) => ({ background: bg, color: '#fff', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' });
const programPill = (isYBLP) => ({ padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: isYBLP ? '#eaf3fb' : '#FEF3C7', color: isYBLP ? '#2f6f9b' : '#B45309', border: `1px solid ${isYBLP ? '#bcd6ea' : '#FDE68A'}` });

const btnPrimary = { background: '#2f6f9b', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost = { background: '#fff', color: '#41506a', border: '1px solid #dbe3ed', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnConvert = (disabled) => ({ background: disabled ? '#94A3B8' : '#172033', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' });
const btnDelete = (disabled) => ({ padding: '6px 8px', background: disabled ? '#F8FAFC' : '#FEF2F2', color: disabled ? '#94A3B8' : '#DC2626', border: `1px solid ${disabled ? '#E2E8F0' : '#FECACA'}`, borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, opacity: disabled ? 0.6 : 1, fontFamily: 'inherit' });

const btnSchedule = (mobile) => ({
  background: 'linear-gradient(180deg,#3a86c0,#2f6f9b)',
  color: '#fff',
  border: 'none',
  padding: '11px 22px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: '.2px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: '0 6px 16px rgba(47,111,155,.32)',
  minWidth: mobile ? 0 : 150,
  flex: mobile ? 1 : '0 0 auto',
  whiteSpace: 'nowrap',
});

const input = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid #dbe3ed', fontSize: 13, fontFamily: 'inherit', color: '#172033', background: '#fff' };

const tabsBar = (mobile) => ({
  display: 'flex',
  flexDirection: mobile ? 'column' : 'row',
  justifyContent: 'space-between',
  alignItems: mobile ? 'stretch' : 'center',
  gap: 10,
  marginBottom: 16,
  flexWrap: 'wrap',
});
const tabsGroup = { display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 10, flexWrap: 'wrap' };
const tabBtn = (active) => ({
  background: active ? '#2f6f9b' : 'transparent',
  color: active ? '#fff' : '#41506a',
  border: 'none',
  borderRadius: 7,
  padding: '8px 12px',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
});

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', zIndex: 1000 };
const dialog = { background: '#fff', borderRadius: 14, width: '100%', boxShadow: '0 20px 60px rgba(15,23,42,.3)', marginTop: 24 };
const dialogHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #eef2f7' };
const dialogFoot = { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid #eef2f7' };

const bannerClose = { background: 'transparent', border: 'none', fontSize: 20, lineHeight: 1, cursor: 'pointer', color: 'inherit' };

const pagerWrap = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 16 };
const pagerInfo = { fontSize: 12.5, color: '#657691' };
const pagerBtns = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const pgBtn = (disabled) => ({ background: '#fff', color: disabled ? '#b6c0cf' : '#41506a', border: '1px solid #dbe3ed', padding: '6px 10px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' });
const pgNum = (active) => ({ background: active ? '#2f6f9b' : '#fff', color: active ? '#fff' : '#41506a', border: `1px solid ${active ? '#2f6f9b' : '#dbe3ed'}`, padding: '6px 11px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', minWidth: 36, fontFamily: 'inherit' });
const pgEllipsis = { color: '#9aa6b6', padding: '0 2px' };

const toastWrap = { position: 'fixed', top: 16, right: 16, display: 'grid', gap: 8, zIndex: 2000 };
const toastItem = (border) => ({ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220, maxWidth: 360, padding: '11px 14px', borderRadius: 10, background: '#fff', boxShadow: '0 10px 30px rgba(15,23,42,.18)', border: `1px solid ${border}`, fontSize: 13.5, color: '#172033' });