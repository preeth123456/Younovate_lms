import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchTrainerWorkshops,
  fetchWorkshopStats,
  setSelectedWorkshop,
  selectTrainerWorkshops,
  selectWorkshopsStatus,
  selectWorkshopStats,
} from '../../features/Trainer/trainerWorkshopSlice';
import {
  C, S, Pill, Spinner, PageHeader, KPICard, StatusBadge, fmtDate,
} from './workshopShared';
import AppIcon from '../../components/shared/AppIcon';

const CSS = `@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} .ws-row:hover{background:#f9fafb!important} .ws-btn:hover{opacity:.85}`;

export default function MyWorkshops() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const workshops = useSelector(selectTrainerWorkshops);
  const status    = useSelector(selectWorkshopsStatus);
  const stats     = useSelector(selectWorkshopStats);

  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('all');

  useEffect(() => {
    dispatch(fetchTrainerWorkshops());
    dispatch(fetchWorkshopStats());
  }, [dispatch]);

  const filtered = workshops.filter(w => {
    const q = search.trim().toLowerCase();
    const matchQ = !q || w.title.toLowerCase().includes(q) || (w.mode || '').toLowerCase().includes(q);
    const matchS = fStatus === 'all' || w.status === fStatus;
    return matchQ && matchS;
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayWS    = workshops.filter(w => new Date(w.date).toDateString() === new Date().toDateString());
  const upcomingWS = workshops.filter(w => new Date(w.date) > today && w.status !== 'Completed');
  const liveWS     = workshops.filter(w => w.status === 'Live');

  const goToWorkshop = (w, tab) => {
    // For participants/attendance we need the batchId, not the workshopId
    const idForTab = (tab === 'participants') ? (w.batchId || w._id) : w._id;
    dispatch(setSelectedWorkshop(idForTab));
    navigate(`/trainer/workshops/${tab}`);
  };

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <PageHeader title="My Workshops" subtitle="Workshops assigned to you by Admin. View, conduct, and manage delivery.">
        <button style={S.btnPri} onClick={() => navigate('/trainer/workshops/live')}>
          <i className="ti ti-video" style={{ fontSize: 14 }} /> Start Live
        </button>
      </PageHeader>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <KPICard title="Today's Workshops"  value={stats?.todayWS ?? todayWS.length}    icon="calendar-event"  accent="#ef4444" sub="Happening today" />
        <KPICard title="Upcoming"           value={stats?.upcoming ?? upcomingWS.length} icon="clock"           accent="#6366f1" sub="Scheduled" />
        <KPICard title="Completed"          value={stats?.completed ?? 0}                icon="circle-check"    accent="#16a34a" sub="All time" />
        <KPICard title="Total Participants" value={stats?.totalParticipants ?? 0}        icon="users"           accent="#0891b2" sub="Across all workshops" />
        <KPICard title="Avg Rating"         value={stats?.avgRating ? `${stats.avgRating} ★` : '—'} icon="star" accent="#d97706" sub="Participant feedback" />
        <KPICard title="Pending Certs"      value={stats?.pendingCerts ?? 0}             icon="certificate"     accent="#7c3aed" sub="Awaiting admin issue" />
      </div>

      {/* Today's Live + Upcoming quick cards */}
      {(liveWS.length > 0 || todayWS.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[...liveWS, ...todayWS.filter(w => w.status !== 'Live')].slice(0, 4).map(w => (
            <div key={w._id} style={{ ...S.cardSm, borderLeft: `4px solid ${w.status === 'Live' ? '#ef4444' : '#6366f1'}`, cursor: 'pointer' }}
              onClick={() => goToWorkshop(w, 'live')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {w.status === 'Live' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fee2e2', color: '#dc2626', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1s infinite' }} /> LIVE
                  </span>
                )}
                <StatusBadge status={w.status} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: C.text1, marginBottom: 3 }}>{w.title}</div>
              <div style={{ fontSize: '0.76rem', color: C.text3 }}>{w.mode} · {w.time} · {fmtDate(w.date)}</div>
              <div style={{ fontSize: '0.76rem', color: C.text3, marginTop: 2 }}>{w.registrationCount || 0} registered</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <AppIcon name="search" size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.text4 }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workshops…" />
        </div>
        <select style={{ ...S.input, flex: '0 0 160px' }} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="all">All Status</option>
          {['Draft','Published','Live','Completed','Archived'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {status === 'loading' ? <Spinner /> : (
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  {['Workshop','Category','Mode','Date','Time','Duration','Participants','Attendance %','Status','Actions'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: C.text4 }}>
                    {workshops.length === 0 ? 'No workshops assigned to you yet.' : 'No workshops match your filters.'}
                  </td></tr>
                ) : filtered.map((w, i) => (
                  <tr key={w._id} className="ws-row" style={{ background: i % 2 ? '#fafafa' : C.white }}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 700, color: C.text1 }}>{w.title}</div>
                      <div style={{ fontSize: '0.72rem', color: C.text4 }}>{w.feeType === 'Paid' ? `₹${w.fee}` : 'Free'}</div>
                    </td>
                    <td style={S.td}>{w.category || 'Workshop'}</td>
                    <td style={S.td}>
                      <Pill bg={w.mode === 'Online' ? '#dbeafe' : w.mode === 'Offline' ? '#dcfce7' : '#fef9c3'}
                            color={w.mode === 'Online' ? '#1d4ed8' : w.mode === 'Offline' ? '#15803d' : '#92400e'}>
                        {w.mode}
                      </Pill>
                    </td>
                    <td style={S.td}>{fmtDate(w.date)}</td>
                    <td style={S.td}>{w.time || '—'}</td>
                    <td style={S.td}>{w.duration} min</td>
                    <td style={S.td}>{w.registrationCount || 0}</td>
                    <td style={S.td}>—</td>
                    <td style={S.td}><StatusBadge status={w.status} /></td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {[
                          { icon: 'eye',            title: 'View',         tab: 'live' },
                          { icon: 'player-play',    title: 'Start Live',   tab: 'live' },
                          { icon: 'users',          title: 'Participants', tab: 'participants' },
                          { icon: 'clipboard-check',title: 'Attendance',   tab: 'participants' },
                          { icon: 'books',          title: 'Resources',    tab: 'resources' },
                          { icon: 'star',           title: 'Feedback',     tab: 'feedback' },
                        ].map(btn => (
                          <button key={btn.title} title={btn.title} className="ws-btn"
                            onClick={() => goToWorkshop(w, btn.tab)}
                            style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.border}`, background: '#f8fafc', color: C.text3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity .15s' }}>
                            <i className={`ti ti-${btn.icon}`} style={{ fontSize: 12 }} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, fontSize: '0.75rem', color: C.text4 }}>
            Showing {filtered.length} of {workshops.length} workshops
          </div>
        </div>
      )}
    </div>
  );
}
