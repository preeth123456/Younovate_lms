import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchTrainerWorkshops,
  fetchParticipants,
  setSelectedWorkshop,
  selectTrainerWorkshops,
  selectWorkshopParticipants,
  selectSelectedWorkshopId,
} from '../../features/Trainer/trainerWorkshopSlice';
import { S, Empty, KPICard } from './workshopShared';
import AppIcon from '../../components/shared/AppIcon';

const CSS = `
  @keyframes spin{to{transform:rotate(360deg)}}
  .ws-row:hover{background:#f9fafb!important}
  @media(max-width:700px){
    .part-table-wrap{overflow-x:auto}
    .part-kpi-grid{grid-template-columns:1fr 1fr!important}
    .part-header{flex-direction:column!important;align-items:flex-start!important}
    .part-search{max-width:100%!important;width:100%!important}
    .part-selector{max-width:100%!important;width:100%!important}
  }
`;

function RegStatusPill({ status }) {
  const cfg = {
    Registered: ['#DBEAFE', '#1E40AF'],
    Approved:   ['#D1FAE5', '#065F46'],
    Rejected:   ['#FEE2E2', '#991B1B'],
    Cancelled:  ['#F1F5F9', '#475569'],
  };
  const [bg, fg] = cfg[status] || ['#DBEAFE', '#1E40AF'];
  return (
    <span style={{ background: bg, color: fg, padding: '2px 9px', borderRadius: 99, fontSize: '0.71rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {status || 'Registered'}
    </span>
  );
}

export default function WorkshopParticipants() {
  const dispatch   = useDispatch();
  const workshops  = useSelector(selectTrainerWorkshops);
  const selectedId = useSelector(selectSelectedWorkshopId);

  // selectedId may be a batchId (when coming from Participants button) or workshopId
  // Find the matching workshop — prefer batchId match, fall back to _id match
  const selected = workshops.find(w => w.batchId === selectedId || w._id === selectedId) || workshops[0] || null;
  const activeBatchId = selected?.batchId || selected?._id || null;

  const participants = useSelector(selectWorkshopParticipants(activeBatchId));
  const [search, setSearch] = useState('');

  useEffect(() => { dispatch(fetchTrainerWorkshops()); }, [dispatch]);

  useEffect(() => {
    if (activeBatchId) {
      dispatch(fetchParticipants(activeBatchId));
    }
  }, [activeBatchId, dispatch]);

  const handleSelect = (workshopId) => {
    dispatch(setSelectedWorkshop(workshopId));
    const w = workshops.find(ws => ws._id === workshopId);
    const bid = w?.batchId || workshopId;
    dispatch(fetchParticipants(bid));
  };

  const filtered = participants.filter(p => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name  = (p.studentId?.name  || '').toLowerCase();
    const email = (p.studentId?.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const approved   = participants.filter(p => p.registrationStatus === 'Approved').length;
  const registered = participants.filter(p => !p.registrationStatus || p.registrationStatus === 'Registered').length;

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <div className="part-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>Participants</h1>
          <p style={{ fontSize: '0.84rem', color: '#6b7280', margin: '4px 0 0' }}>
            Trainees assigned to your workshop batch.
          </p>
        </div>
        {/* Workshop selector */}
        <select
          className="part-selector"
          value={selected?._id || ''}
          onChange={e => handleSelect(e.target.value)}
          style={{ boxSizing: 'border-box', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: '0.85rem', fontFamily: 'inherit', color: '#111827', background: '#fff', outline: 'none', maxWidth: 320 }}
        >
          <option value="">Select workshop…</option>
          {workshops.map(w => (
            <option key={w._id} value={w._id}>{w.title}{w.batchName ? ` — ${w.batchName}` : ''}</option>
          ))}
        </select>
      </div>

      {/* KPI row */}
      <div className="part-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 24 }}>
        <KPICard title="Total Assigned"  value={participants.length} icon="users"        accent="#6366f1" />
        <KPICard title="Approved"        value={approved}            icon="circle-check"  accent="#16a34a" />
        <KPICard title="Registered"      value={registered}          icon="user-plus"     accent="#0891b2" />
        <KPICard title="Workshop"        value={selected?.title || '—'} icon="writing"   accent="#d97706" />
      </div>

      {/* Search */}
      <div className="part-search" style={{ position: 'relative', maxWidth: 320, marginBottom: 16 }}>
        <AppIcon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          style={{ ...S.input, paddingLeft: 32 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
        />
      </div>

      {!selected ? (
        <Empty icon="👥" msg="Select a workshop to view participants." />
      ) : (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div className="part-table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>
                  {['#', 'Full Name', 'Email', 'Phone', 'College', 'Registration Status', 'Batch'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                      {participants.length === 0
                        ? 'No participants assigned to this batch.'
                        : 'No participants match your search.'}
                    </td>
                  </tr>
                ) : filtered.map((p, i) => {
                  const st = p.studentId || {};
                  return (
                    <tr key={p._id || i} className="ws-row" style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                      <td style={{ ...S.td, color: '#9ca3af', fontWeight: 600 }}>{i + 1}</td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
                            {(st.name || '?')[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, color: '#111827' }}>{st.name || '—'}</span>
                        </div>
                      </td>
                      <td style={S.td}>{st.email || '—'}</td>
                      <td style={S.td}>{st.phone || '—'}</td>
                      <td style={S.td}>{st.collegeName || '—'}</td>
                      <td style={S.td}><RegStatusPill status={p.registrationStatus} /></td>
                      <td style={{ ...S.td, fontSize: '0.78rem', color: '#6b7280' }}>{p.batchName || selected?.batchName || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', fontSize: '0.75rem', color: '#9ca3af' }}>
            {filtered.length} of {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
