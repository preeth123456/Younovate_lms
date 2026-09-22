import React, { useMemo, useState } from 'react';
import { WORKSHOPS_MOCK, normalizeWorkshopStatus } from './workshopMockData';
import WorkshopPagination from './_components/WorkshopPagination';
import WorkshopSearch from './_components/WorkshopSearch';
import WorkshopFilterSelect from './_components/WorkshopFilterSelect';
import WorkshopStatusBadge from './_components/WorkshopStatusBadge';
import { btnGhost, tableCard, th, td, emptyCell, input } from './_components/workshopDesignTokens';
import AppIcon from '../../../components/shared/AppIcon';

function formatDateTime(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatTime(t) {
  if (!t) return '—';
  const [h, m] = String(t).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return String(t);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function WorkshopManagementUpcoming() {
  const [q, setQ] = useState('');
  const [fMode, setFMode] = useState('all');
  const [calendar, setCalendar] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const upcoming = WORKSHOPS_MOCK.filter((w) => normalizeWorkshopStatus(w.status) === 'upcoming');

    return upcoming
      .filter((w) => {
        const matchQ = !needle || (w.name || '').toLowerCase().includes(needle) || (w.trainer || '').toLowerCase().includes(needle);
        const matchMode = fMode === 'all' || w.mode === fMode;
        return matchQ && matchMode;
      })
      .map((w, idx) => ({
        ...w,
        registrationStatus: idx % 2 === 0 ? 'Open' : 'Closing soon',
      }));
  }, [q, fMode]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safePage, pageSize]);

  const onAction = async (id, action) => {
    // eslint-disable-next-line no-console
    console.log(`[Workshop Upcoming UI] ${action} workshop`, id);
  };

  return (
    <div style={pageWrap}>
      <div style={header}>
        <div>
          <h2 style={title}>Upcoming Workshops</h2>
          <p style={sub}>View scheduled events, manage registrations and publishing (mock UI).</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" style={btnGhost} onClick={() => setCalendar((c) => !c)}>
            {calendar ? 'Switch to Table' : 'Calendar View'}
          </button>
          <button
            type="button"
            style={btnGhost}
            onClick={() => {
              setQ('');
              setFMode('all');
              setCalendar(false);
              setPage(1);
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div style={filterRow}>
        <div style={{ gridColumn: 'span 2' }}>
          <WorkshopSearch value={q} onChange={setQ} placeholder="🔎 Search workshop name or trainer…" />
        </div>
        <div>
          <WorkshopFilterSelect value={fMode} onChange={setFMode}>
            <option value="all">Mode: All</option>
            <option value="Online">Online</option>
            <option value="Offline">Offline</option>
            <option value="Hybrid">Hybrid</option>
          </WorkshopFilterSelect>
        </div>
        <div>
          <div style={{ ...btnGhost, textAlign: 'center', padding: '10px 14px', borderRadius: 10, cursor: 'default' }}>
            Found: {total}
          </div>
        </div>
      </div>

      {calendar ? (
        <div style={tableCard}>
          <div style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, color: '#172033', marginBottom: 8 }}>Calendar (mock)</div>
            <div style={{ color: '#657691', fontWeight: 700, fontSize: 13 }}>Grid placeholder — switch back to Table for full actions.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 14 }}>
              {pageItems.map((w, idx) => (
                <div key={w.id} style={{ border: '1px solid #dbe3ed', borderRadius: 12, background: '#fff', padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ fontWeight: 950, color: '#172033' }}>{w.name}</div>
                    <WorkshopStatusBadge status={w.status} />
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 800, color: '#64748B', fontSize: 13 }}>Date: {formatDateTime(w.date)}</div>
                  <div style={{ marginTop: 4, fontWeight: 800, color: '#64748B', fontSize: 13 }}>Time: {formatTime(w.time)}</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" style={actBtn('#E2E8F0', '#0F172A')} onClick={() => onAction(w.id, 'view')}>
                      <AppIcon name="eye" size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />View
                    </button>
                    <button type="button" style={actBtn('#FEF3C7', '#B45309')} onClick={() => onAction(w.id, 'edit')}>
                      <AppIcon name="edit" size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />Edit
                    </button>
                    <button type="button" style={actBtn('#FEE2E2', '#DC2626', true)} onClick={() => onAction(w.id, 'cancel')}>
                      🛑 Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={tableCard}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#657691' }}>
                  <th style={th}>Workshop Name</th>
                  <th style={th}>Workshop Date</th>
                  <th style={th}>Time</th>
                  <th style={th}>Trainer</th>
                  <th style={th}>Seats</th>
                  <th style={th}>Registered Students</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={emptyCell}>
                      No upcoming workshops match your filters.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((w, idx) => (
                    <tr key={w.id} style={{ background: idx % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #dbe3ed' }}>
                      <td style={td}>
                        <div style={{ fontWeight: 950, color: '#172033' }}>{w.name}</div>
                        <div style={{ fontSize: 12.5, color: '#94A3B8', fontWeight: 750, marginTop: 4 }}>Registration: {w.registrationStatus}</div>
                      </td>
                      <td style={td}>{formatDateTime(w.date)}</td>
                      <td style={td}>{w.time}</td>
                      <td style={td}>{w.trainer}</td>
                      <td style={td}>{w.seats}</td>
                      <td style={td}>{w.registeredStudents}</td>
                      <td style={td}>
                        <WorkshopStatusBadge status={w.status} />
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button type="button" style={actBtn('#E2E8F0', '#0F172A')} onClick={() => onAction(w.id, 'view')}>
                            <AppIcon name="eye" size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />View
                          </button>
                          <button type="button" style={actBtn('#EEF2FF', '#6366F1')} onClick={() => onAction(w.id, 'edit')}>
                            <AppIcon name="edit" size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />Edit
                          </button>
                          <button type="button" style={actBtn('#FEF3C7', '#B45309')} onClick={() => onAction(w.id, 'cancel')}>
                            🛑 Cancel
                          </button>
                          <button type="button" style={actBtn('#F8FAFC', '#41506a')} onClick={() => onAction(w.id, 'duplicate')}>
                            ⧉ Duplicate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!calendar && (
        <WorkshopPagination
          total={total}
          page={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}

function actBtn(bg = '#E2E8F0', color = '#0F172A', danger = false) {
  return {
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${bg}`,
    background: bg,
    color: danger ? '#DC2626' : color,
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 12.5,
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  };
}

const pageWrap = { padding: '28px 24px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#f1f5f9', minHeight: '100vh' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 14 };
const title = { fontSize: 22, fontWeight: 950, margin: 0, color: '#172033' };
const sub = { margin: '6px 0 0', color: '#657691', fontWeight: 650, fontSize: 13 };
const filterRow = { display: 'grid', gridTemplateColumns: '2fr 1fr 0.9fr', gap: 10, alignItems: 'center', marginBottom: 14 };

