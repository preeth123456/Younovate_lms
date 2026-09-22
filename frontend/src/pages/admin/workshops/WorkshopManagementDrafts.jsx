import React, { useMemo, useState } from 'react';
import { WORKSHOPS_MOCK, normalizeWorkshopStatus } from './workshopMockData';
import WorkshopPagination from './_components/WorkshopPagination';
import WorkshopSearch from './_components/WorkshopSearch';
import WorkshopFilterSelect from './_components/WorkshopFilterSelect';
import WorkshopStatusBadge from './_components/WorkshopStatusBadge';
import { btnGhost, input, tableCard, th, td, emptyCell } from './_components/workshopDesignTokens';
import AppIcon from '../../../components/shared/AppIcon';

function makeISO(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return new Date().toISOString();
  return dt.toISOString();
}

const NOW = new Date();
const mockMeta = {
  createdBy: {
    'w-1': 'Admin',
    'w-2': 'Admin',
    'w-3': 'Admin',
    'w-4': 'Admin',
  },
};

function formatDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export default function WorkshopManagementDrafts() {
  const [q, setQ] = useState('');
  const [fMode, setFMode] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return WORKSHOPS_MOCK.filter((w) => normalizeWorkshopStatus(w.status) === 'draft')
      .filter((w) => {
        const matchQ = !needle || (w.name || '').toLowerCase().includes(needle) || (w.trainer || '').toLowerCase().includes(needle);
        const matchMode = fMode === 'all' || w.mode === fMode;
        return matchQ && matchMode;
      })
      .map((w, idx) => ({
        ...w,
        createdBy: mockMeta.createdBy[w.id] || 'Admin',
        createdDate: makeISO(new Date(NOW.getTime() - (idx + 3) * 86400000)),
        updatedAt: makeISO(new Date(NOW.getTime() - (idx + 1) * 86400000)),
      }));
  }, [q, fMode]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safePage, pageSize]);

  const startIdx = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(total, safePage * pageSize);

  const onAction = async (id, action) => {
    // UI-only
    // eslint-disable-next-line no-console
    console.log(`[Workshop Draft UI] ${action} workshop`, id);
  };

  return (
    <div style={page}>
      <div style={header}>
        <div>
          <h2 style={title}>Draft Workshops</h2>
          <p style={sub}>Search, filter, publish or delete draft workshops (mock UI).</p>
        </div>
        <button
          type="button"
          style={btnGhost}
          onClick={() => {
            setQ('');
            setFMode('all');
            setPage(1);
          }}
        >
          Reset
        </button>
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
            Showing {startIdx}–{endIdx} of {total}
          </div>
        </div>
      </div>

      <div style={tableCard}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#657691' }}>
                <th style={th}>Workshop Name</th>
                <th style={th}>Created By</th>
                <th style={th}>Created Date</th>
                <th style={th}>Last Updated</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={emptyCell}>
                    No draft workshops match your filters.
                  </td>
                </tr>
              ) : (
                pageItems.map((w, idx) => (
                  <tr key={w.id} style={{ background: idx % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #dbe3ed' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 950, color: '#172033' }}>{w.name}</div>
                      <div style={{ fontSize: 12.5, color: '#94A3B8', fontWeight: 700, marginTop: 4 }}>Trainer: {w.trainer}</div>
                    </td>
                    <td style={td}>{w.createdBy}</td>
                    <td style={td}>{formatDate(w.createdDate)}</td>
                    <td style={td}>{formatDate(w.updatedAt)}</td>
                    <td style={td}>
                      <WorkshopStatusBadge status={w.status} />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button type="button" style={iconBtn()} onClick={() => onAction(w.id, 'edit')}>
                          <AppIcon name="edit" size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />Edit
                        </button>
                        <button type="button" style={iconBtn()} onClick={() => onAction(w.id, 'preview')}>
                          <AppIcon name="eye" size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />Preview
                        </button>
                        <button type="button" style={iconBtn('#ECFDF5', '#10B981', '#059669')} onClick={() => onAction(w.id, 'publish')}>
                          🚀 Publish
                        </button>
                        <button type="button" style={iconBtn('#FEF2F2', '#DC2626', '#DC2626', true)} onClick={() => onAction(w.id, 'delete')}>
                          <AppIcon name="trash" size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />Delete
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
    </div>
  );
}

function iconBtn(bg = '#F8FAFC', border = '#dbe3ed', color = '#41506a', danger = false) {
  return {
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${border}`,
    background: bg,
    color: danger ? color : color,
    cursor: 'pointer',
    fontWeight: 900,
    fontSize: 12.5,
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    opacity: 1,
  };
}

const page = { padding: '28px 24px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#f1f5f9', minHeight: '100vh' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 14 };
const title = { fontSize: 22, fontWeight: 950, margin: 0, color: '#172033' };
const sub = { margin: '6px 0 0', color: '#657691', fontWeight: 650, fontSize: 13 };
const filterRow = { display: 'grid', gridTemplateColumns: '2fr 1fr 0.9fr', gap: 10, alignItems: 'center', marginBottom: 14 };

