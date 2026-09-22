import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  fetchUsers,
  fetchBatches,
  createUser,
  toggleUserStatus,
  deleteUser,
  selectAdminUsers,
  selectAdminUsersStatus,
  selectAdminBatches,
} from '../../features/admin/adminSlice';
import { API_BASE_URL } from '../../config/api';
import AppIcon from '../../components/shared/AppIcon';

// ── Role / status palette (same conventions as Sessions' SC) ──────────────────
const ROLE_COLORS = {
  trainer: '#2f6f9b',
  trainee: '#7c3aed',
  hr: '#16a05f',
};
const ROLES = ['trainer', 'trainee', 'hr'];

// Toast look-up (icon glyph + colours) — identical to Sessions.
const TOAST = {
  success: { color: '#16a05f', border: '#bfe6d0', glyph: '✓' },
  error: { color: '#c0392b', border: '#f3c2bd', glyph: '✕' },
  warning: { color: '#b06f00', border: '#f0d9a8', glyph: '⚠' },
  info: { color: '#2f6f9b', border: '#bcd6ea', glyph: 'ℹ' },
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

// ── Tiny responsive hook (re-renders on resize, unlike inline innerWidth) ─────
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

const EMPTY_ERRORS = {};

export default function UserManagement() {
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile();

  const users = useAppSelector(selectAdminUsers);
  const status = useAppSelector(selectAdminUsersStatus);
  const batches = useAppSelector(selectAdminBatches);
  const authToken = useAppSelector((state) => state.auth.token);

  const [modal, setModal] = useState(null); // null | { mode: 'create'|'edit', user }
  const [busyId, setBusyId] = useState(null);

  // ── Built-in toast + confirm (no external libs) — identical pattern to Sessions ──
  const [toasts, setToasts] = useState([]);
  const pushToast = (icon, title) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, icon, title }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };
  const [confirmState, setConfirmState] = useState(null);
  const confirm = (opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve }));
  const resolveConfirm = (val) => {
    if (confirmState) confirmState.resolve(val);
    setConfirmState(null);
  };

  // ── Filters ──
  const [q, setQ] = useState('');
  const [fRole, setFRole] = useState('all');
  const [fProgram, setFProgram] = useState('all');

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loading = status === 'loading';

  useEffect(() => {
    dispatch(fetchUsers());
    dispatch(fetchBatches());
  }, [dispatch]);

  // ── Filtering ──
  const filtered = useMemo(() => {
    let list = users;
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (u) =>
          (u.name || '').toLowerCase().includes(needle) ||
          (u.email || '').toLowerCase().includes(needle)
      );
    }
    if (fRole !== 'all') list = list.filter((u) => u.role === fRole);
    // Program filter is a placeholder until program data is wired up server-side.
    if (fProgram !== 'all') list = list.filter((u) => (u.program || 'YIEP') === fProgram);
    return list;
  }, [users, q, fRole, fProgram]);

  const hasFilters = !!(q.trim() || fRole !== 'all' || fProgram !== 'all');
  const clearFilters = () => {
    setQ('');
    setFRole('all');
    setFProgram('all');
  };

  useEffect(() => {
    setPage(1);
  }, [q, fRole, fProgram]);

  // ── Derived pagination (over FILTERED) ──
  const total = filtered.length;
  const allTotal = users.length;
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

  // ── Modal helpers ──
  const openCreate = () => setModal({ mode: 'create', user: null });
  const openEdit = (u) => setModal({ mode: 'edit', user: { ...u, _id: u._id || u.id } });
  const closeModal = () => setModal(null);

  // ── Save (create / update) ──
  const handleSaveUser = async (userData) => {
    try {
      if (modal.mode === 'edit') {
        const userId = modal.user._id || modal.user.id;
        if (!userId) {
          pushToast('error', 'No user ID found for editing.');
          return;
        }
        const token = authToken || localStorage.getItem('token') || sessionStorage.getItem('token');
        const response = await fetch(
          `${API_BASE_URL}/api/admin/users/${userId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(userData),
          }
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to update user');
        dispatch(fetchUsers());
        pushToast('success', 'User updated successfully');
      } else {
        await dispatch(createUser(userData)).unwrap();
        pushToast('success', 'User created successfully');
      }
      setModal(null);
    } catch (err) {
      pushToast('error', err.message || 'Failed to save user');
      throw err;
    }
  };

  // ── Toggle enable/disable ──
  const handleToggleStatus = async (u) => {
    const userId = u._id || u.id;
    setBusyId(userId);
    try {
      await dispatch(toggleUserStatus({ userId, isActive: !u.isActive })).unwrap();
      pushToast('success', `User ${!u.isActive ? 'enabled' : 'disabled'} successfully`);
    } catch (err) {
      pushToast('error', typeof err === 'string' ? err : 'Failed to update user status');
    } finally {
      setBusyId(null);
    }
  };

  // ── Delete (built-in confirm instead of window.confirm) ──
  const handleDeleteUser = async (u) => {
    const userId = u._id || u.id;
    const ok = await confirm({
      title: 'Delete this user?',
      text: `"${u.name || 'This user'}" will be permanently removed. This cannot be undone.`,
      confirmText: 'Yes, delete it',
      danger: true,
    });
    if (!ok) return;
    setBusyId(userId);
    try {
      await dispatch(deleteUser(userId)).unwrap();
      pushToast('success', 'User deleted successfully');
    } catch (err) {
      pushToast('error', typeof err === 'string' ? err : 'Failed to delete user');
    } finally {
      setBusyId(null);
    }
  };

  // ── Row action buttons (shared by table + cards) — same shape as Sessions' RowActions ──
  const RowActions = ({ u }) => {
    const userId = u._id || u.id;
    const rowBusy = busyId === userId;

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
        <button
          onClick={() => openEdit(u)}
          disabled={rowBusy}
          style={btnStyle('#F8FAFC', '#E2E8F0', '#475569', rowBusy)}
          title="Edit user"
        >
          <AppIcon name="edit" size={14} />
        </button>

        <button
          onClick={() => handleToggleStatus(u)}
          disabled={rowBusy}
          style={btnStyle(
            u.isActive ? '#FEF3C7' : '#F0FDF4',
            u.isActive ? '#FDE68A' : '#BBF7D0',
            u.isActive ? '#B45309' : '#16A34A',
            rowBusy
          )}
          title={rowBusy ? 'Please wait…' : u.isActive ? 'Disable user' : 'Enable user'}
        >
          {rowBusy ? '…' : u.isActive ? '🛑' : '✅'}
        </button>

        <button
          onClick={() => handleDeleteUser(u)}
          disabled={rowBusy}
          style={btnStyle('#FEF2F2', '#FECACA', '#DC2626', rowBusy)}
          title="Delete user"
        >
          <AppIcon name="trash" size={14} />
        </button>
      </div>
    );
  };

  const RoleBadge = ({ role }) => (
    <span style={badge(ROLE_COLORS[role] || '#657691')}>
      {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'N/A'}
    </span>
  );

  const StatusBadge = ({ active }) => (
    <span style={badge(active ? '#16a05f' : '#b06f00')}>{active ? 'active' : 'inactive'}</span>
  );

  const Avatar = ({ u }) => (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: ROLE_COLORS[u.role] || '#657691',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {u.name?.charAt(0)?.toUpperCase() || 'U'}
    </div>
  );

  // ── Pagination bar — identical structure to Sessions' Pager ──
  const Pager = () => {
    if (loading || total === 0) return null;
    return (
      <div style={pagerWrap}>
        <span style={pagerInfo}>
          Showing {startIdx}–{endIdx} of {total}
        </span>
        <div style={pagerBtns}>
          <button
            style={pgBtn(page === 1)}
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
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
            Users ({total}
            {total !== allTotal ? ` of ${allTotal}` : ''})
          </h2>
          <p style={{ fontSize: 13, color: '#657691', margin: '4px 0 0' }}>
            Manage platform users, roles, and YBLP mentor assignments
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto' }}>
          <button
            onClick={() => {
              dispatch(fetchUsers());
              dispatch(fetchBatches());
            }}
            style={btnGhost}
          >
            ↻ Refresh
          </button>
          <button onClick={openCreate} style={btnSchedule(isMobile)}>
            ＋ Create User
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={filterBar(isMobile)}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email…"
          style={input}
        />
        <select value={fRole} onChange={(e) => setFRole(e.target.value)} style={input}>
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        <select value={fProgram} onChange={(e) => setFProgram(e.target.value)} style={input}>
          <option value="all">All programs</option>
          <option value="YIEP">YIEP</option>
          <option value="YBLP">YBLP</option>
          <option value="Both">Both</option>
        </select>
        <button onClick={clearFilters} disabled={!hasFilters} style={btnGhost}>
          Clear
        </button>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#657691' }}>
                  {['Name', 'Email', 'Role', 'Program', 'Batch', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={emptyCell}>
                      Loading users…
                    </td>
                  </tr>
                ) : total === 0 ? (
                  <tr>
                    <td colSpan={7} style={emptyCell}>
                      {hasFilters
                        ? 'No users match your filters.'
                        : 'No users found. Click “Create User” to add one.'}
                    </td>
                  </tr>
                ) : (
                  pageItems.map((u, i) => (
                    <tr
                      key={u._id || u.id || i}
                      style={{ background: i % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #dbe3ed' }}
                    >
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar u={u} />
                          <span style={{ fontWeight: 600, color: '#172033' }}>{u.name || '—'}</span>
                        </div>
                      </td>
                      <td style={td}>{u.email || '—'}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <RoleBadge role={u.role} />
                      </td>
                      <td style={td}>
                        <span style={programPill}>{u.program || 'YIEP'}</span>
                      </td>
                      <td style={td}>
                        {u.batchIds?.length > 0 ? (
                          <span style={batchPill}>{u.batchIds.map((b) => b.name).join(', ')}</span>
                        ) : (
                          <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Not assigned</span>
                        )}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <StatusBadge active={u.isActive} />
                      </td>
                      <td style={{ padding: '8px 16px' }}>
                        <RowActions u={u} />
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
          {loading ? (
            <div style={cardEmpty}>Loading users…</div>
          ) : total === 0 ? (
            <div style={cardEmpty}>
              {hasFilters ? 'No users match your filters.' : 'No users found. Tap “Create User”.'}
            </div>
          ) : (
            pageItems.map((u, i) => (
              <div key={u._id || u.id || i} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar u={u} />
                    <span style={{ fontWeight: 700, color: '#172033', fontSize: 15 }}>{u.name || '—'}</span>
                  </div>
                  <StatusBadge active={u.isActive} />
                </div>
                <div style={cardMeta}>
                  <b>Email:</b> {u.email || '—'}
                </div>
                <div style={cardMeta}>
                  <b>Role:</b> <RoleBadge role={u.role} />
                </div>
                <div style={cardMeta}>
                  <b>Program:</b> <span style={programPill}>{u.program || 'YIEP'}</span>
                </div>
                <div style={cardMeta}>
                  <b>Batch:</b>{' '}
                  {u.batchIds?.length > 0 ? (
                    <span style={batchPill}>{u.batchIds.map((b) => b.name).join(', ')}</span>
                  ) : (
                    <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Not assigned</span>
                  )}
                </div>
                <div style={{ marginTop: 10 }}>
                  <RowActions u={u} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Pager />

      {/* Create / Edit modal */}
      {modal && (
        <UserModal
          user={modal.user}
          batches={batches}
          isMobile={isMobile}
          onClose={closeModal}
          onSave={handleSaveUser}
          pushToast={pushToast}
        />
      )}

      {/* Confirm dialog (built-in, replaces window.confirm) */}
      {confirmState && (
        <div style={{ ...overlay, alignItems: 'center', zIndex: 1500 }} onMouseDown={() => resolveConfirm(false)}>
          <div style={{ ...dialog, maxWidth: 420, marginTop: 0 }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ padding: '22px 22px 8px' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#172033' }}>{confirmState.title}</h3>
              {confirmState.text && (
                <p style={{ margin: '10px 0 0', fontSize: 13.5, color: '#41506a', lineHeight: 1.5 }}>
                  {confirmState.text}
                </p>
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

// ── Modal: create / edit user ──────────────────────────────────────────────────
function UserModal({ user, batches, isMobile, onClose, onSave, pushToast }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'trainee',
    password: '',
    batchIds: user?.batchIds?.map((b) => b._id || b) || [],
  });
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [saving, setSaving] = useState(false);
  const [batchDropdownOpen, setBatchDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setBatchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const toggleBatch = (batchId) => {
    const exists = form.batchIds.includes(batchId);
    setField('batchIds', exists ? form.batchIds.filter((id) => id !== batchId) : [...form.batchIds, batchId]);
  };
  const removeBatch = (batchId) => setField('batchIds', form.batchIds.filter((id) => id !== batchId));

  const selectedBatches = batches?.filter((b) => form.batchIds.includes(b._id)) || [];

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Please enter a valid email address.';
    if (!form.role) e.role = 'Role is required.';
    if (!user && !form.password.trim()) e.password = 'Password is required.';
    else if (!user && form.password.length < 6) e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload = { ...form };
    if (user && !payload.password) delete payload.password;
    setSaving(true);
    try {
      await onSave(payload);
    } catch (err) {
      // onSave already pushes a toast on failure; keep the modal open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay} onMouseDown={() => !saving && onClose()}>
      <div style={{ ...dialog, maxWidth: isMobile ? '100%' : 600 }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={dialogHead}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#172033' }}>
            {user ? 'Edit user' : 'Create a user'}
          </h3>
          <button onClick={onClose} style={bannerClose}>
            ×
          </button>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          <Field label="Name">
            <input
              style={{ ...input, border: `1px solid ${errors.name ? '#c0392b' : '#dbe3ed'}` }}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Priya Sharma"
            />
            {errors.name && <FieldError text={errors.name} />}
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
            <Field label="Email">
              <input
                style={{ ...input, border: `1px solid ${errors.email ? '#c0392b' : '#dbe3ed'}` }}
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="name@example.com"
              />
              {errors.email && <FieldError text={errors.email} />}
            </Field>
            <Field label="Role">
              <select
                style={{ ...input, border: `1px solid ${errors.role ? '#c0392b' : '#dbe3ed'}` }}
                value={form.role}
                onChange={(e) => setField('role', e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
              {errors.role && <FieldError text={errors.role} />}
            </Field>
          </div>

          <Field label={`Batches (${selectedBatches.length} selected)`}>
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              {selectedBatches.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {selectedBatches.map((b) => (
                    <span key={b._id} style={tagPill}>
                      {b.name}
                      <span onClick={() => removeBatch(b._id)} style={tagPillClose}>
                        ×
                      </span>
                    </span>
                  ))}
                </div>
              )}

              <div
                onClick={() => setBatchDropdownOpen((v) => !v)}
                style={{
                  ...input,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: selectedBatches.length === 0 ? '#94A3B8' : '#172033',
                }}
              >
                <span>
                  {selectedBatches.length === 0
                    ? 'Select batches…'
                    : `${selectedBatches.length} batch${selectedBatches.length > 1 ? 'es' : ''} selected`}
                </span>
                <span style={{ fontSize: 10, color: '#657691' }}>{batchDropdownOpen ? '▲' : '▼'}</span>
              </div>

              {batchDropdownOpen && (
                <div style={batchDropdown}>
                  {(!batches || batches.length === 0) && (
                    <div style={{ padding: '12px 14px', color: '#94A3B8', fontSize: 13 }}>No batches available</div>
                  )}
                  {batches?.map((b) => {
                    const isSelected = form.batchIds.includes(b._id);
                    return (
                      <div key={b._id} onClick={() => toggleBatch(b._id)} style={batchOption(isSelected)}>
                        <span style={checkbox(isSelected)}>{isSelected && '✓'}</span>
                        {b.name}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Field>

          {!user && (
            <Field label="Password">
              <input
                type="password"
                style={{ ...input, border: `1px solid ${errors.password ? '#c0392b' : '#dbe3ed'}` }}
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                placeholder="Minimum 6 characters"
              />
              {errors.password && <FieldError text={errors.password} />}
            </Field>
          )}
        </div>

        <div style={dialogFoot}>
          <button onClick={onClose} disabled={saving} style={btnGhost}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={btnPrimary}>
            {saving ? 'Saving…' : user ? 'Update user' : 'Create user'}
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
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#657691', marginBottom: 6 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
function FieldError({ text }) {
  return <div style={{ color: '#c0392b', fontSize: 12, marginTop: 4 }}>{text}</div>;
}

// ── Styles (tokens lifted directly from AdminSessions.jsx) ─────────────────────
const th = { padding: '12px 16px', textAlign: 'left', fontSize: 12, letterSpacing: '.7px', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const td = { padding: '11px 16px', fontSize: 13, color: '#2b3648' };
const emptyCell = { padding: 32, textAlign: 'center', color: '#657691' };

const card = { background: '#fff', border: '1px solid #dbe3ed', borderRadius: 12, padding: 14, boxShadow: '0 1px 2px rgba(23,32,51,.06)' };
const cardEmpty = { background: '#fff', border: '1px solid #dbe3ed', borderRadius: 12, padding: 28, textAlign: 'center', color: '#657691' };
const cardMeta = { fontSize: 13, color: '#41506a', marginTop: 6 };

const badge = (bg) => ({ background: bg, color: '#fff', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' });

const programPill = { padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#EEF2FF', color: '#3730A3', border: '1px solid #C7D2FE' };
const batchPill = { padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 500, background: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD' };

const btnPrimary = { background: '#2f6f9b', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost = { background: '#fff', color: '#41506a', border: '1px solid #dbe3ed', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

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
  minWidth: mobile ? 0 : 170,
  flex: mobile ? 1 : '0 0 auto',
  whiteSpace: 'nowrap',
});

const input = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid #dbe3ed', fontSize: 13, fontFamily: 'inherit', color: '#172033', background: '#fff' };

const filterBar = (mobile) => ({
  display: 'grid',
  gridTemplateColumns: mobile ? '1fr' : 'minmax(220px,1.6fr) 1fr 1fr auto',
  gap: 10,
  marginBottom: 16,
  alignItems: 'center',
});

const tagPill = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: '#EEF2FF', color: '#3730A3', border: '1px solid #C7D2FE', borderRadius: 20, fontSize: 12, fontWeight: 500 };
const tagPillClose = { cursor: 'pointer', fontWeight: 700, fontSize: 14, lineHeight: 1, color: '#6366F1' };

const batchDropdown = { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #dbe3ed', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,.12)', zIndex: 1100, maxHeight: 200, overflowY: 'auto', marginTop: 4 };
const batchOption = (selected) => ({ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: selected ? '#eaf3fb' : '#fff', borderBottom: '1px solid #f1f5f9', fontSize: 13.5, color: selected ? '#2f6f9b' : '#172033' });
const checkbox = (selected) => ({ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `2px solid ${selected ? '#2f6f9b' : '#CBD5E1'}`, background: selected ? '#2f6f9b' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 });

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