import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import {
  fetchMyBatches,
  fetchMyBatchById,
  selectMyBatches,
  selectMyBatchesStatus,
  selectSelectedMyBatch,
  selectSelectedMyBatchStatus,
} from '../../features/Trainer/trainerWorkshopSlice';
import {
  fetchBatches,
  fetchBatchById,
  selectAllBatches,
  selectBatchesStatus,
  selectCurrentBatch,
  selectBatchDetailStatus,
} from '../../features/session/batchSlice';

const S = {
  page:     { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:     { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  th:       { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td:       { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  btnPri:   { background: '#1E3A5F', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost: { background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnSmall: { width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

function fmtDate(d) {
  try { return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return '—'; }
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
function fmtTime(s) {
  if (!s) return '—';
  const str = String(s).trim();
  return TIME_RE.test(str) ? str : '—';
}

function StatusPill({ status }) {
  const cfg = {
    Draft:     ['#F1F5F9', '#475569'],
    Scheduled: ['#FEF9C3', '#92400E'],
    Active:    ['#DBEAFE', '#1E40AF'],
    Completed: ['#D1FAE5', '#065F46'],
    Cancelled: ['#FEE2E2', '#991B1B'],
    Archived:  ['#F3F4F6', '#6B7280'],
  };
  const [bg, fg] = cfg[status] || ['#F1F5F9', '#475569'];
  return <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{status || '—'}</span>;
}

function RegStatusPill({ status }) {
  const cfg = { Registered: ['#DBEAFE','#1E40AF'], Approved: ['#D1FAE5','#065F46'], Rejected: ['#FEE2E2','#991B1B'], Cancelled: ['#F1F5F9','#475569'] };
  const [bg, fg] = cfg[status] || ['#DBEAFE', '#1E40AF'];
  return <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{status}</span>;
}

function LmsStatusPill({ status }) {
  const cfg = {
    upcoming:  ['#FEF9C3', '#92400E'],
    active:    ['#DBEAFE', '#1E40AF'],
    completed: ['#D1FAE5', '#065F46'],
  };
  const [bg, fg] = cfg[status] || ['#F1F5F9', '#475569'];
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
  return <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>;
}

export default function TrainerBatches() {
  const dispatch = useDispatch();
  const location = useLocation();
  const isWorkshop = location.pathname.includes('workshop');

  const workshopBatches = useSelector(selectMyBatches);
  const workshopStatus = useSelector(selectMyBatchesStatus);
  const selectedWorkshopBatch = useSelector(selectSelectedMyBatch);
  const selectedWorkshopStatus = useSelector(selectSelectedMyBatchStatus);

  const lmsBatches = useSelector(selectAllBatches);
  const lmsStatus = useSelector(selectBatchesStatus);
  const selectedLmsBatch = useSelector(selectCurrentBatch);
  const selectedLmsStatus = useSelector(selectBatchDetailStatus);

  const batches = isWorkshop ? workshopBatches : lmsBatches;
  const status = isWorkshop ? workshopStatus : lmsStatus;
  const selectedBatch = isWorkshop ? selectedWorkshopBatch : selectedLmsBatch;
  const selectedStatus = isWorkshop ? selectedWorkshopStatus : selectedLmsStatus;
  const [viewId, setViewId] = useState(null);

  const refresh = () => {
    if (isWorkshop) dispatch(fetchMyBatches());
    else dispatch(fetchBatches());
  };

  useEffect(() => { refresh(); }, [dispatch, isWorkshop]);

  useEffect(() => {
    if (!viewId) return;
    if (isWorkshop) dispatch(fetchMyBatchById(viewId));
    else dispatch(fetchBatchById(viewId));
  }, [dispatch, viewId, isWorkshop]);

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
            {isWorkshop ? 'My Workshop Batches' : 'My Batches'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>Batches assigned to you by Admin.</p>
        </div>
        <button style={S.btnGhost} onClick={refresh}>↻ Refresh</button>
      </div>

      <div style={S.card}>
        {status === 'loading' ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontWeight: 700 }}>Loading batches...</div>
        ) : isWorkshop ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  {['Batch Name', 'Batch Code', 'Workshop', 'Start Date', 'End Date', 'Mode', 'Trainees', 'Status', 'Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                      No batches assigned to you yet.
                    </td>
                  </tr>
                ) : batches.map((b, idx) => (
                  <tr key={b._id} style={{ background: idx % 2 ? '#FAFAFA' : '#fff' }}>
                    <td style={S.td}><div style={{ fontWeight: 900, color: '#0F172A' }}>{b.batchName}</div></td>
                    <td style={S.td}>{b.batchCode}</td>
                    <td style={S.td}>{b.workshopId?.title || '—'}</td>
                    <td style={S.td}>{fmtDate(b.startDate)}</td>
                    <td style={S.td}>{b.endDate ? fmtDate(b.endDate) : '—'}</td>
                    <td style={S.td}>{b.mode || '—'}</td>
                    <td style={S.td}>{b.registrationIds?.length ?? b.traineeCount ?? 0}</td>
                    <td style={S.td}><StatusPill status={b.status} /></td>
                    <td style={S.td}>
                      <button style={S.btnSmall} title="View Batch" onClick={() => setViewId(b._id)}>
                        <i className="ti ti-eye" style={{ fontSize: 13 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr>
                  {['Batch Name', 'Course', 'Start Date', 'End Date', 'Max Students', 'Status', 'Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                      No batches assigned to you yet.
                    </td>
                  </tr>
                ) : batches.map((b, idx) => (
                  <tr key={b._id} style={{ background: idx % 2 ? '#FAFAFA' : '#fff' }}>
                    <td style={S.td}><div style={{ fontWeight: 900, color: '#0F172A' }}>{b.name}</div></td>
                    <td style={S.td}>{b.course || '—'}</td>
                    <td style={S.td}>{fmtDate(b.startDate)}</td>
                    <td style={S.td}>{b.endDate ? fmtDate(b.endDate) : '—'}</td>
                    <td style={S.td}>{b.maxStudents ?? '—'}</td>
                    <td style={S.td}><LmsStatusPill status={b.status} /></td>
                    <td style={S.td}>
                      <button style={S.btnSmall} title="View Batch" onClick={() => setViewId(b._id)}>
                        <i className="ti ti-eye" style={{ fontSize: 13 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Batch Modal */}
      {viewId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setViewId(null)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 980, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,23,42,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>Batch Details</h3>
                <div style={{ marginTop: 4, fontSize: 12.5, color: '#64748B', fontWeight: 700 }}>
                  {isWorkshop ? (selectedBatch?.batchName || '') : (selectedBatch?.name || '')}
                </div>
              </div>
              <button onClick={() => setViewId(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748B', flexShrink: 0 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>

            {selectedStatus === 'loading' ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading...</div>
            ) : selectedBatch && isWorkshop ? (
              <>
                <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                  {[
                    ['Batch Name',  selectedBatch.batchName],
                    ['Batch Code',  selectedBatch.batchCode],
                    ['Workshop',    selectedBatch.workshopId?.title],
                    ['Mode',        selectedBatch.mode],
                    ['Start Date',  fmtDate(selectedBatch.startDate)],
                    ['End Date',    selectedBatch.endDate ? fmtDate(selectedBatch.endDate) : '—'],
                    ['Start Time',  fmtTime(selectedBatch.startTime)],
                    ['End Time',    fmtTime(selectedBatch.endTime)],
                    ['Capacity',    selectedBatch.capacity ?? '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{value}</div>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                    <div style={{ marginTop: 6 }}><StatusPill status={selectedBatch.status} /></div>
                  </div>
                  {selectedBatch.notes && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
                      <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap' }}>{selectedBatch.notes}</div>
                    </div>
                  )}
                </div>

                <div style={{ padding: '0 20px 20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#0F172A', marginBottom: 10 }}>
                    Trainees ({selectedBatch.registrationIds?.length || 0})
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                      <thead>
                        <tr>
                          {['Full Name', 'Email', 'Phone', 'College', 'Qualification', 'City', 'Status'].map(h => (
                            <th key={h} style={S.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedBatch.registrationIds || []).length === 0 ? (
                          <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: 30, color: '#94A3B8' }}>No trainees.</td></tr>
                        ) : selectedBatch.registrationIds.map((r, i) => (
                          <tr key={r._id || i} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                            <td style={S.td}><div style={{ fontWeight: 800, color: '#0F172A' }}>{r.fullName}</div></td>
                            <td style={S.td}>{r.email}</td>
                            <td style={S.td}>{r.phone || '—'}</td>
                            <td style={S.td}>{r.college || '—'}</td>
                            <td style={S.td}>{r.qualification || '—'}</td>
                            <td style={S.td}>{r.city || '—'}</td>
                            <td style={S.td}><RegStatusPill status={r.registrationStatus} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : selectedBatch && (
              <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                {[
                  ['Batch Name', selectedBatch.name],
                  ['Course', selectedBatch.course || '—'],
                  ['Start Date', fmtDate(selectedBatch.startDate)],
                  ['End Date', selectedBatch.endDate ? fmtDate(selectedBatch.endDate) : '—'],
                  ['Max Students', selectedBatch.maxStudents ?? '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{value}</div>
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                  <div style={{ marginTop: 6 }}><LmsStatusPill status={selectedBatch.status} /></div>
                </div>
                {selectedBatch.description && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Description</div>
                    <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap' }}>{selectedBatch.description}</div>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
