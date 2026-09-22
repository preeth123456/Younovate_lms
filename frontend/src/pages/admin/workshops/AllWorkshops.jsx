import React, { useMemo, useState } from 'react';
import {
  WORKSHOPS_MOCK,
  normalizeWorkshopStatus,
  formatDateTime,
  WORKSHOP_MODES,
  WORKSHOP_CATEGORIES,
  WORKSHOP_BILLING,
} from './workshopMockData';
import AppIcon from '../../../components/shared/AppIcon';

function IconBtn({ title, children, onClick, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: '1px solid #dbe3ed',
        background: danger ? '#FEF2F2' : '#F8FAFC',
        color: danger ? '#DC2626' : '#2f6f9b',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        fontWeight: 900,
        fontSize: 13,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const norm = normalizeWorkshopStatus(status);
  const cfg =
    norm === 'completed'
      ? { bg: '#16a05f', fg: '#fff' }
      : norm === 'upcoming'
        ? { bg: '#2f6f9b', fg: '#fff' }
        : norm === 'cancelled'
          ? { bg: '#c0392b', fg: '#fff' }
          : { bg: '#657691', fg: '#fff' };

  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.fg,
        padding: '4px 10px',
        borderRadius: 999,
        fontWeight: 900,
        fontSize: 11,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
      }}
    >
      {norm}
    </span>
  );
}

export default function AllWorkshops() {
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [fMode, setFMode] = useState('all');
  const [fBilling, setFBilling] = useState('all');
  const [fCategory, setFCategory] = useState('all');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [busyId, setBusyId] = useState(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return WORKSHOPS_MOCK.filter((w) => {
      const matchQ =
        !needle ||
        (w.name || '').toLowerCase().includes(needle) ||
        (w.trainer || '').toLowerCase().includes(needle);

      const matchStatus = fStatus === 'all' || normalizeWorkshopStatus(w.status) === fStatus;
      const matchMode = fMode === 'all' || w.mode === fMode;
      const matchBilling = fBilling === 'all' || w.billing === fBilling;
      const matchCategory = fCategory === 'all' || w.category === fCategory;

      return matchQ && matchStatus && matchMode && matchBilling && matchCategory;
    });
  }, [q, fStatus, fMode, fBilling, fCategory]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const startIdx = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(total, safePage * pageSize);

  React.useEffect(() => {
    setPage(1);
  }, [q, fStatus, fMode, fBilling, fCategory, pageSize]);

  const onAction = async (id, action) => {
    setBusyId(id);
    await new Promise((r) => setTimeout(r, 350));
    // UI-only
    // eslint-disable-next-line no-console
    console.log(`[Workshop UI] ${action} workshop`, id);
    setBusyId(null);
  };

  return (
    <div style={page}>
      <div style={header}>
        <div>
          <h2 style={title}>All Workshops</h2>
          <p style={sub}>Search, filter, paginate and manage workshop status (UI mock).</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" style={btnGhost} onClick={() => {
            setQ('');
            setFStatus('all');
            setFMode('all');
            setFBilling('all');
            setFCategory('all');
          }}>
            Clear filters
          </button>
        </div>
      </div>

      <div style={filterRow}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search workshop name or trainer…"
          style={input}
        />
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={input}>
          <option value="all">Status: All</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="draft">Draft</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={fCategory} onChange={(e) => setFCategory(e.target.value)} style={input}>
          <option value="all">Category: All</option>
          {WORKSHOP_CATEGORIES.map((c) => (
            <option value={c} key={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={fMode} onChange={(e) => setFMode(e.target.value)} style={input}>
          <option value="all">Mode: All</option>
          {WORKSHOP_MODES.map((m) => (
            <option value={m} key={m}>
              {m}
            </option>
          ))}
        </select>
        <select value={fBilling} onChange={(e) => setFBilling(e.target.value)} style={input}>
          <option value="all">Paid/Free: All</option>
          {WORKSHOP_BILLING.map((b) => (
            <option value={b} key={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div style={tableCard}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#657691' }}>
                <th style={th}>Workshop Name</th>
                <th style={th}>Category</th>
                <th style={th}>Mode</th>
                <th style={th}>Date</th>
                <th style={th}>Time</th>
                <th style={th}>Duration</th>
                <th style={th}>Seats</th>
                <th style={th}>Registered Students</th>
                <th style={th}>Trainer</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={11} style={emptyCell}>
                    No workshops match your filters.
                  </td>
                </tr>
              ) : (
                pageItems.map((w, idx) => (
                  <tr key={w.id} style={{ background: idx % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #dbe3ed' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 900, color: '#172033' }}>{w.name}</div>
                    </td>
                    <td style={td}>{w.category}</td>
                    <td style={td}>{w.mode}</td>
                    <td style={td}>{formatDateTime(w.date)}</td>
                    <td style={td}>{w.time}</td>
                    <td style={td}>{w.durationMinutes} min</td>
                    <td style={td}>{w.seats}</td>
                    <td style={td}>{w.registeredStudents}</td>
                    <td style={td}>{w.trainer}</td>
                    <td style={td}>
                      <StatusBadge status={w.status} />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                        <IconBtn title="View" onClick={() => onAction(w.id, 'view')} disabled={busyId === w.id}><AppIcon name="eye" size={14} /></IconBtn>
                        <IconBtn title="Edit" onClick={() => onAction(w.id, 'edit')} disabled={busyId === w.id}><AppIcon name="edit" size={14} /></IconBtn>
                        <IconBtn title="Delete" onClick={() => onAction(w.id, 'delete')} disabled={busyId === w.id} danger><AppIcon name="trash" size={14} /></IconBtn>
                        <IconBtn title="Clone" onClick={() => onAction(w.id, 'clone')} disabled={busyId === w.id}>⧉</IconBtn>
                        <IconBtn title="Publish" onClick={() => onAction(w.id, 'publish')} disabled={busyId === w.id}>🚀</IconBtn>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={pager}>
        <div style={pagerInfo}>
          Showing {startIdx}–{endIdx} of {total}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={pgBtn(safePage <= 1)} disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ‹ Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
            .map((p, i, arr) => (
              <React.Fragment key={p}>
                {i > 0 && arr[i] - arr[i - 1] > 1 && <span style={pgEllipsis}>…</span>}
                <button style={pgNum(p === safePage)} onClick={() => setPage(p)}>
                  {p}
                </button>
              </React.Fragment>
            ))}
          <button style={pgBtn(safePage >= totalPages)} disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next ›
          </button>
        </div>
        <label style={pagerInfo}>
          Per page{' '}
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ ...input, width: 'auto', padding: '6px 10px' }}>
            {[6, 8, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

const page = { padding: '28px 24px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#f1f5f9', minHeight: '100vh' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 14 };
const title = { fontSize: 22, fontWeight: 900, margin: 0, color: '#172033' };
const sub = { margin: '6px 0 0', color: '#657691', fontWeight: 650, fontSize: 13 };
const btnGhost = { background: '#fff', color: '#41506a', border: '1px solid #dbe3ed', padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13 };
const filterRow = { display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 0.9fr', gap: 10, alignItems: 'center', marginBottom: 14 };

const input = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 10, border: '1px solid #dbe3ed', fontSize: 13, fontFamily: 'inherit', color: '#172033', background: '#fff' };

const tableCard = { background: '#fff', border: '1px solid #dbe3ed', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(23,32,51,.08), 0 12px 28px rgba(31,61,99,.05)' };
const th = { padding: '12px 16px', textAlign: 'left', fontSize: 12, letterSpacing: '.7px', textTransform: 'uppercase', whiteSpace: 'nowrap', color: '#657691' };
const td = { padding: '11px 16px', fontSize: 13, color: '#2b3648' };
const emptyCell = { padding: 34, textAlign: 'center', color: '#657691', fontWeight: 700 };

const pager = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 14, padding: '12px 16px', background: '#fafafa', borderTop: '1px solid #dbe3ed' };
const pagerInfo = { fontSize: 12.5, color: '#657691', fontWeight: 700 };
const pgBtn = (disabled) => ({ background: '#fff', color: disabled ? '#b6c0cf' : '#41506a', border: '1px solid #dbe3ed', padding: '6px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.6 : 1 });
const pgNum = (active) => ({ background: active ? '#2f6f9b' : '#fff', color: active ? '#fff' : '#41506a', border: `1px solid ${active ? '#2f6f9b' : '#dbe3ed'}`, padding: '6px 11px', borderRadius: 8, fontSize: 13, fontWeight: 900, cursor: 'pointer', minWidth: 36, fontFamily: 'inherit' });
const pgEllipsis = { color: '#9aa6b6', padding: '0 2px', fontWeight: 900 };

