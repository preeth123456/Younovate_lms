import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  fetchWorkshopBatches, fetchWorkshopBatchById,
  assignTrainerToBatch, unassignTrainerFromBatch,
  fetchTrainerList, deleteWorkshopBatch,
  selectWsBatches, selectWsBatchesMeta, selectWsBatchesStatus,
  selectSelectedBatch, selectSelectedBatchStatus,
  selectTrainerList, selectTrainerListStatus,
  selectAssignTrainerStatus, selectUnassignTrainerStatus,
} from '../../../features/workshops/workshopSlice';

const S = {
  page:     { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:     { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  input:    { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', color: '#0F172A', background: '#fff', outline: 'none' },
  th:       { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td:       { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  btnPri:   { background: '#1E3A5F', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost: { background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger:{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnSmall: { width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }); } catch { return '—'; } };
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const fmtTime = (s) => { const str = String(s || '').trim(); return TIME_RE.test(str) ? str : '—'; };

const STATUS_CFG = {
  Draft:     ['#F1F5F9','#475569'], Scheduled: ['#FEF9C3','#92400E'],
  Active:    ['#DBEAFE','#1E40AF'], Completed: ['#D1FAE5','#065F46'],
  Cancelled: ['#FEE2E2','#991B1B'], Archived:  ['#F3F4F6','#6B7280'],
};
function StatusPill({ status }) {
  const [bg, fg] = STATUS_CFG[status] || STATUS_CFG.Draft;
  return <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{status || '—'}</span>;
}

function CapacityBar({ used, total }) {
  if (!total) return <span style={{ color: '#94A3B8', fontSize: 12 }}>—</span>;
  const pct = Math.min(100, Math.round((used / total) * 100));
  const color = pct >= 90 ? '#DC2626' : pct >= 70 ? '#D97706' : '#10B981';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: '#F1F5F9', borderRadius: 3, minWidth: 50 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>{used}/{total}</span>
    </div>
  );
}

export default function WorkshopBatchesAdmin() {
  const dispatch       = useDispatch();
  const batches        = useSelector(selectWsBatches);
  const meta           = useSelector(selectWsBatchesMeta);
  const status         = useSelector(selectWsBatchesStatus);
  const selectedBatch  = useSelector(selectSelectedBatch);
  const selectedStatus = useSelector(selectSelectedBatchStatus);
  const trainerList    = useSelector(selectTrainerList);
  const trainerListStatus = useSelector(selectTrainerListStatus);
  const assignStatus   = useSelector(selectAssignTrainerStatus);
  const unassignStatus = useSelector(selectUnassignTrainerStatus);

  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewId, setViewId]       = useState(null);
  const [assignBatch, setAssignBatch] = useState(null);
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkBusy, setBulkBusy]   = useState(false);

  const load = useCallback((p = page) => {
    dispatch(fetchWorkshopBatches({ page: p, limit: 20 }));
  }, [dispatch, page]);

  useEffect(() => { load(1); setPage(1); }, [filterStatus]);
  useEffect(() => {
    const t = setTimeout(() => { load(1); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { load(page); }, [page]);
  useEffect(() => { if (viewId) dispatch(fetchWorkshopBatchById(viewId)); }, [dispatch, viewId]);

  // Keep admin view in sync when trainer changes batch status via live session start/end
  useEffect(() => {
    const interval = setInterval(() => load(page), 30000);
    return () => clearInterval(interval);
  }, [load, page]);

  // Client-side filter (search + status)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return batches.filter(b => {
      const matchStatus = !filterStatus || b.status === filterStatus;
      const matchSearch = !q || (b.batchName || '').toLowerCase().includes(q) ||
        (b.batchCode || '').toLowerCase().includes(q) ||
        (b.workshopId?.title || '').toLowerCase().includes(q) ||
        (b.trainerId?.name || '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [batches, search, filterStatus]);

  const allIds     = filtered.map(b => b._id);
  const allChecked = allIds.length > 0 && allIds.every(id => selectedIds.includes(id));
  const someChecked = selectedIds.length > 0 && !allChecked;
  const toggleAll  = () => setSelectedIds(allChecked ? [] : allIds);

  const openAssign = (b) => {
    setAssignBatch(b);
    setSelectedTrainerId(b.trainerId?._id || b.trainerId || '');
    dispatch(fetchTrainerList());
  };

  const handleAssign = async () => {
    if (!selectedTrainerId || !assignBatch) return;
    const isReassign = !!(assignBatch.trainerId?._id || assignBatch.trainerId);
    const result = await dispatch(assignTrainerToBatch({ batchId: assignBatch._id, trainerId: selectedTrainerId }));
    if (assignTrainerToBatch.fulfilled.match(result)) {
      toast.success(isReassign ? 'Trainer reassigned' : 'Trainer assigned');
      setAssignBatch(null); setSelectedTrainerId('');
      load(page);
    } else toast.error(result.payload || 'Failed to assign trainer');
  };

  const handleUnassign = async () => {
    if (!assignBatch) return;
    const result = await dispatch(unassignTrainerFromBatch(assignBatch._id));
    if (unassignTrainerFromBatch.fulfilled.match(result)) {
      toast.success('Trainer unassigned');
      setAssignBatch(null); setSelectedTrainerId('');
      load(page);
    } else toast.error(result.payload || 'Failed to unassign trainer');
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete batch "${name}"? This cannot be undone.`)) return;
    const result = await dispatch(deleteWorkshopBatch(id));
    if (deleteWorkshopBatch.fulfilled.match(result)) toast.success('Batch deleted');
    else toast.error(result.payload || 'Failed to delete batch');
    load(page);
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Permanently delete ${selectedIds.length} batch(es)? This cannot be undone.`)) return;
    setBulkBusy(true);
    for (const id of selectedIds) await dispatch(deleteWorkshopBatch(id));
    setBulkBusy(false);
    setSelectedIds([]);
    load(page);
    toast.success(`${selectedIds.length} batch(es) deleted`);
  };

  const traineeCount = (b) => b.students?.length || b.registrationIds?.length || 0;

  // Batch Detail Modal
  const renderDetail = useCallback(() => {
    if (!viewId) return null;
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setViewId(null)}>
        <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 980, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,23,42,0.3)' }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>Batch Details</h3>
              <div style={{ marginTop: 4, fontSize: 12.5, color: '#64748B', fontWeight: 700 }}>{selectedBatch?.batchName || ''}</div>
            </div>
            <button onClick={() => setViewId(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748B' }}>×</button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {[
                ['Batch Code', selectedBatch?.batchCode],
                ['Workshop',   selectedBatch?.workshopId?.title],
                ['Trainer',    selectedBatch?.trainerId?.name || selectedBatch?.trainer || '—'],
                ['Students',   traineeCount(selectedBatch || {})],
                ['Capacity',   selectedBatch?.capacity || '—'],
                ['Start Date', fmtDate(selectedBatch?.startDate)],
                ['End Date',   selectedBatch?.endDate ? fmtDate(selectedBatch?.endDate) : '—'],
                ['Start Time', fmtTime(selectedBatch?.startTime)],
                ['End Time',   fmtTime(selectedBatch?.endTime)],
                ['Mode',       selectedBatch?.mode],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{value ?? '—'}</div>
                </div>
              ))}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                <StatusPill status={selectedBatch?.status} />
              </div>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0F172A', marginBottom: 10 }}>
                Assigned Trainees ({selectedBatch?.registrationIds?.length || 0})
              </div>
              {selectedStatus === 'loading' ? (
                <div style={{ padding: 24, color: '#94A3B8' }}>Loading trainees...</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                    <thead>
                      <tr>{['Full Name','Email','Phone','College','City','State','Reg. Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {!(selectedBatch?.registrationIds?.length) ? (
                        <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: 32, color: '#94A3B8' }}>No trainees assigned.</td></tr>
                      ) : selectedBatch.registrationIds.map((r, idx) => (
                        <tr key={r._id || idx} style={{ background: idx % 2 ? '#FAFAFA' : '#fff' }}>
                          <td style={S.td}><div style={{ fontWeight: 800, color: '#0F172A' }}>{r.fullName}</div></td>
                          <td style={S.td}>{r.email}</td>
                          <td style={S.td}>{r.phone}</td>
                          <td style={S.td}>{r.college}</td>
                          <td style={S.td}>{r.city}</td>
                          <td style={S.td}>{r.state}</td>
                          <td style={S.td}><StatusPill status={r.registrationStatus} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [selectedBatch, selectedStatus, viewId]);

  return (
    <div style={S.page}>
      {renderDetail()}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Workshop Batches</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
            {meta?.total ?? batches.length} total{selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {selectedIds.length > 0 && (
            <button style={{ ...S.btnDanger, opacity: bulkBusy ? 0.6 : 1 }} disabled={bulkBusy} onClick={handleBulkDelete}>
              <i className="ti ti-trash" style={{ fontSize: 13, marginRight: 4 }} />
              Delete ({selectedIds.length})
            </button>
          )}
          <button style={S.btnGhost} onClick={() => load(page)}>↻ Refresh</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 14 }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search batch, workshop, trainer…" />
        </div>
        <select style={{ ...S.input, flex: '0 0 160px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['Draft','Scheduled','Active','Completed','Cancelled','Archived'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={S.card}>
        {status === 'loading' ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading batches...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 40 }}>
                    <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked; }} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                  </th>
                  {['Batch Name','Batch Code','Workshop','Trainer','Students','Capacity','Start Date','Mode','Status','Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>No batches found.</td></tr>
                ) : filtered.map((b, idx) => (
                  <tr key={b._id} style={{ background: idx % 2 ? '#FAFAFA' : '#fff' }}>
                    <td style={S.td}>
                      <input type="checkbox" checked={selectedIds.includes(b._id)}
                        onChange={e => setSelectedIds(prev => e.target.checked ? [...prev, b._id] : prev.filter(id => id !== b._id))}
                        style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={S.td}><div style={{ fontWeight: 900, color: '#0F172A' }}>{b.batchName}</div></td>
                    <td style={S.td}>{b.batchCode}</td>
                    <td style={S.td}>{b.workshopId?.title || '—'}</td>
                    <td style={S.td}>
                      {b.trainerId?.name
                        ? <span style={{ fontWeight: 700, color: '#1E3A5F' }}>{b.trainerId.name}</span>
                        : <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Not assigned</span>}
                    </td>
                    <td style={S.td}><span style={{ fontWeight: 700 }}>{traineeCount(b)}</span></td>
                    <td style={{ ...S.td, minWidth: 120 }}>
                      <CapacityBar used={traineeCount(b)} total={b.capacity} />
                    </td>
                    <td style={S.td}>{fmtDate(b.startDate)}</td>
                    <td style={S.td}>{b.mode || '—'}</td>
                    <td style={S.td}><StatusPill status={b.status} /></td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button style={S.btnSmall} title="View" onClick={() => setViewId(b._id)}>
                          <i className="ti ti-eye" style={{ fontSize: 13 }} />
                        </button>
                        <button style={{ ...S.btnSmall, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8' }} title="Assign Trainer" onClick={() => openAssign(b)}>
                          <i className="ti ti-user-check" style={{ fontSize: 13 }} />
                        </button>
                        <button style={{ ...S.btnSmall, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626' }} title="Delete" onClick={() => handleDelete(b._id, b.batchName)}>
                          <i className="ti ti-trash" style={{ fontSize: 13 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta?.pages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Page {page} of {meta.pages} · {meta.total} total</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ ...S.btnGhost, padding: '6px 12px', fontSize: 12 }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <button style={{ ...S.btnPri, padding: '6px 12px', fontSize: 12 }}>{page}</button>
              <button style={{ ...S.btnGhost, padding: '6px 12px', fontSize: 12 }} disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
            </div>
          </div>
        )}
      </div>

      {/* Assign Trainer Modal */}
      {assignBatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setAssignBatch(null)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(15,23,42,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>{assignBatch.trainerId ? 'Reassign Trainer' : 'Assign Trainer'}</h3>
                <div style={{ marginTop: 4, fontSize: 12.5, color: '#64748B', fontWeight: 700 }}>{assignBatch.batchName}</div>
              </div>
              <button onClick={() => setAssignBatch(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748B' }}>×</button>
            </div>
            <div style={{ padding: 20 }}>
              {assignBatch.trainerId?.name && (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#92400E' }}>
                  Currently: <strong>{assignBatch.trainerId.name}</strong>
                </div>
              )}
              {trainerListStatus === 'loading' ? (
                <div style={{ color: '#94A3B8', padding: 12 }}>Loading trainers...</div>
              ) : (
                <select style={S.input} value={selectedTrainerId} onChange={e => setSelectedTrainerId(e.target.value)}>
                  <option value="">-- Select a trainer --</option>
                  {trainerList.map(t => <option key={t._id} value={t._id}>{t.name} ({t.email})</option>)}
                </select>
              )}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div>
                {assignBatch.trainerId && (
                  <button style={{ ...S.btnDanger, opacity: unassignStatus === 'loading' ? 0.6 : 1 }} disabled={unassignStatus === 'loading'} onClick={handleUnassign}>
                    {unassignStatus === 'loading' ? 'Unassigning...' : 'Unassign'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={S.btnGhost} onClick={() => setAssignBatch(null)}>Cancel</button>
                <button style={{ ...S.btnPri, opacity: (!selectedTrainerId || assignStatus === 'loading') ? 0.6 : 1 }} disabled={!selectedTrainerId || assignStatus === 'loading'} onClick={handleAssign}>
                  {assignStatus === 'loading' ? 'Saving...' : (assignBatch.trainerId ? 'Reassign' : 'Assign')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
