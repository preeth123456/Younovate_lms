import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchTrainerWorkshops,
  fetchWorkshopCertificates,
  setSelectedWorkshop,
  selectTrainerWorkshops,
  selectWorkshopCertificates,
  selectSelectedWorkshopId,
} from '../../features/Trainer/trainerWorkshopSlice';
import { S, Pill, Empty, PageHeader, KPICard, fmtDate, WorkshopSelector } from './workshopShared';
import axios from 'axios';
import { API_BASE_URL } from 'utils/apiConfig';
import toast from 'react-hot-toast';
import AppIcon from '../../components/shared/AppIcon';

const CSS = `@keyframes spin{to{transform:rotate(360deg)}} .ws-row:hover{background:#f9fafb!important}`;

export default function WorkshopCertificates() {
  const dispatch      = useDispatch();
  const workshops     = useSelector(selectTrainerWorkshops);
  const selectedId    = useSelector(selectSelectedWorkshopId);
  const selected      = workshops.find(w => w._id === selectedId) || workshops[0] || null;
  const certificates  = useSelector(selectWorkshopCertificates(selected?._id));

  const [search,  setSearch]  = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [busyId, setBusyId] = useState('');

  const API = API_BASE_URL;
  const token = useSelector(s => s.auth?.token || '');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { dispatch(fetchTrainerWorkshops()); }, [dispatch]);

  useEffect(() => {
    if (selected?._id) {
      dispatch(fetchWorkshopCertificates(selected._id));
      if (!selectedId) dispatch(setSelectedWorkshop(selected._id));
    }
  }, [selected?._id, dispatch]);

  const handleSelect = (id) => {
    dispatch(setSelectedWorkshop(id));
    dispatch(fetchWorkshopCertificates(id));
  };

  const filtered = certificates.filter(c => {
    const q = search.trim().toLowerCase();
    const matchQ = !q || (c.studentId?.name || '').toLowerCase().includes(q) || (c.studentId?.email || '').toLowerCase().includes(q);
    const matchS = fStatus === 'all' || c.status === fStatus;
    return matchQ && matchS;
  });

  const eligible = certificates.filter(c => c.status === 'Eligible').length;
  const issued   = certificates.filter(c => c.status === 'Issued').length;
  const pending  = certificates.filter(c => c.status === 'Pending').length;
  const rejected = certificates.filter(c => c.status === 'Rejected').length;

  const statusCfg = {
    Eligible: ['#dbeafe', '#1d4ed8'],
    Issued:   ['#dcfce7', '#15803d'],
    Pending:  ['#fef9c3', '#92400e'],
    Rejected: ['#fee2e2', '#b91c1c'],
  };

  const sendToTrainee = async (cert) => {
    setBusyId(cert._id);
    try {
      const { data: _data } = await axios.post(
        `${API}/api/trainer/workshops/${selected._id}/certificates/${cert._id}/send-to-trainee`,
        {},
        { headers }
      );
      toast.success('Certificate sent to trainee');
      dispatch(fetchWorkshopCertificates(selected._id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send certificate');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <PageHeader title="Certificates" subtitle="Review certificate eligibility. Admin issues the final certificate.">
        <WorkshopSelector workshops={workshops} selectedId={selected?._id} onSelect={handleSelect} />
      </PageHeader>

      {/* Info banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: '0.82rem', color: '#1d4ed8' }}>
        <i className="ti ti-info-circle" style={{ fontSize: 16, flexShrink: 0 }} />
        <span><strong>Note:</strong> You can review eligibility here. Only Admin can generate and issue the final certificate.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14, marginBottom: 24 }}>
        <KPICard title="Eligible" value={eligible} icon="circle-check"  accent="#1d4ed8" sub="Ready for issue" />
        <KPICard title="Issued"   value={issued}   icon="certificate"   accent="#16a34a" sub="Admin issued" />
        <KPICard title="Pending"  value={pending}  icon="clock"         accent="#d97706" sub="Not yet eligible" />
        <KPICard title="Rejected" value={rejected} icon="circle-x"      accent="#dc2626" sub="Not eligible" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <AppIcon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student&hellip;" />
        </div>
        <select style={{ ...S.input, flex: '0 0 160px' }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="all">All Status</option>
          {['Eligible','Issued','Pending','Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {!selected ? <Empty icon="🏅" msg="Select a workshop to view certificates." /> : (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr>{['Student','Attendance %','Certificate ID','Status','Issue Date','Action'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                    {certificates.length === 0 ? 'No certificate records yet.' : 'No records match your filters.'}
                  </td></tr>
                ) : filtered.map((c, i) => {
                  const att = c.attendance;
                  const pct = att?.attendancePct ?? 0;
                  const [bg, color] = statusCfg[c.status] || ['#e5e7eb', '#6b7280'];
                  return (
                    <tr key={c._id} className="ws-row" style={{ background: i % 2 ? '#fafafa' : '#fff' }}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{c.studentId?.name || '&mdash;'}</div>
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{c.studentId?.email}</div>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 50, height: 5, background: '#e5e7eb', borderRadius: 3 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: pct >= 60 ? '#16a34a' : '#d97706', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={S.td}>
                        {c.certificateNo
                          ? <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', background: '#f1f5f9', padding: '2px 7px', borderRadius: 5 }}>{c.certificateNo}</span>
                          : <span style={{ color: '#9ca3af' }}>&mdash;</span>}
                      </td>
                      <td style={S.td}><Pill bg={bg} color={color}>{c.status}</Pill></td>
                      <td style={S.td}>{c.issuedDate ? fmtDate(c.issuedDate) : '&mdash;'}</td>
                      <td style={S.td}>
                        {c.status === 'Eligible'
                          ? <span style={{ fontSize: '0.75rem', color: '#1d4ed8' }}>Awaiting admin issue</span>
                          : c.status === 'Pending'
                          ? <span style={{ fontSize: '0.75rem', color: '#d97706' }}>Attendance &lt; 60%</span>
                          : c.status === 'Issued' && c.assignedTrainerId && c.assignedTrainerId._id === token && c.deliveryStatus === 'assigned_to_trainer'
                          ? <button
                              onClick={() => sendToTrainee(c)}
                              disabled={busyId === c._id}
                              style={{
                                fontSize: '0.75rem', color: '#fff', background: '#16a34a', border: 'none',
                                padding: '4px 10px', borderRadius: 6, cursor: busyId === c._id ? 'not-allowed' : 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 4, opacity: busyId === c._id ? 0.6 : 1
                              }}
                            >
                              <i className="ti ti-send" style={{ fontSize: 10 }} /> Send to Trainee
                            </button>
                          : c.status === 'Issued' && c.deliveryStatus === 'sent_to_trainee'
                          ? <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>Sent to trainee</span>
                          : c.status === 'Issued' && c.deliveryStatus === 'delivered'
                          ? <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>Delivered</span>
                          : c.status === 'Issued' && c.downloadUrl
                          ? <a href={c.downloadUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#16a34a', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <i className="ti ti-download" style={{ fontSize: 12 }} /> Download
                            </a>
                          : '&mdash;'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', fontSize: '0.75rem', color: '#9ca3af' }}>
            {filtered.length} of {certificates.length} records
          </div>
        </div>
      )}
    </div>
  );
}



