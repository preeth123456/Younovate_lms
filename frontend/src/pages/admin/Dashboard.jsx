import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import AppIcon from '../../components/shared/AppIcon';
import {
  fetchDashboard,
  selectAdminDashboard,
  selectAdminStatus,
  selectAdminError,
} from '../../features/admin/adminSlice';

const Dashboard = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const dashboard = useAppSelector(selectAdminDashboard);
  const status = useAppSelector(selectAdminStatus);
  const error = useAppSelector(selectAdminError);

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  // Extract data from API response with safe fallbacks
  const totalTrainees = dashboard?.totalTrainees ?? 0;
  const totalTrainers = dashboard?.totalTrainers ?? 0;
  const totalBatches = dashboard?.totalBatches ?? 0;
  const activeBatches = dashboard?.activeBatches ?? 0;
  const attendanceRate = dashboard?.attendanceRate ?? 0;
  const placementReady = dashboard?.placementReady ?? 0;
  const offerLetters = dashboard?.offerLetters ?? 0;
  const pendingApprovals = dashboard?.pendingApprovals ?? 0;
  const activeRegistrations = dashboard?.activeRegistrations ?? 0;

  // Calculate derived metrics
  const attendanceRisk = Math.floor(totalTrainees * 0.08); // ~8% at risk
  const branchReady = Math.floor(placementReady * 0.43); // ~43% of placement ready

  // Use API data for batch attendance trends
  const batchTrends = dashboard?.batchAttendance ?? [];

  // Use API data for recent activity
  const recentActivity = dashboard?.recentActivity ?? [];

  // Navigate to BatchDetails page when a batch row is clicked
  const handleBatchClick = (batch) => {
    const batchId = batch?.batchId || batch?._id || batch?.id;
    if (batchId) {
      navigate(`/admin/batches/view/${batchId}`);
    }
  };

  if (status === 'loading' && !dashboard) {
    return (
      <div style={{ 
        padding: '32px 36px', 
        fontFamily: 'Inter, system-ui, sans-serif',
        background: '#F1F5F9',
        minHeight: '100vh'
      }}>
        <div style={{ height: 28, width: 220, marginBottom: 8, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', borderRadius: 8 }} />
        <div style={{ height: 14, width: 300, marginBottom: 28, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', borderRadius: 8 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 16, marginBottom: 32 }}>
          {[1,2,3,4,5,6,7].map(i => <div key={i} style={{ height: 120, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', borderRadius: 12 }} />)}
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div style={{ 
        padding: '32px 36px', 
        fontFamily: 'Inter, system-ui, sans-serif',
        background: '#F1F5F9',
        minHeight: '100vh'
      }}>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: 20 }}>
          <p style={{ color: '#B91C1C', fontWeight: 600, margin: '0 0 4px' }}>Failed to load dashboard</p>
          <p style={{ color: '#B91C1C', fontSize: 13, margin: '0 0 16px' }}>{error}</p>
          <button
            onClick={() => dispatch(fetchDashboard())}
            style={{
              padding: '10px 18px',
              background: '#1E3A5F',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 700,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: window.innerWidth <= 768 ? '12px 16px' : window.innerWidth <= 1024 ? '14px 24px' : '16px 36px', 
      fontFamily: 'Inter, system-ui, sans-serif',
      background: '#F1F5F9',
      minHeight: '100vh'
    }}>

      {/* ── HERO BANNER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1E3A5F 0%, #1a2f52 55%, #231a4a 100%)',
        borderRadius: window.innerWidth <= 768 ? 16 : 20,
        padding: window.innerWidth <= 768 ? '20px 20px 22px' : window.innerWidth <= 1024 ? '24px 28px' : '28px 32px',
        marginBottom: window.innerWidth <= 768 ? 14 : 18,
        border: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 260, height: 260,
          background: 'rgba(99,102,241,0.1)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '2px',
            color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
            margin: '0 0 10px',
          }}>
            Platform Overview · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
          <h1 style={{
            fontSize: window.innerWidth <= 768 ? 20 : window.innerWidth <= 1024 ? 23 : 26,
            fontWeight: 800, color: '#F8FAFC',
            margin: '0 0 8px', lineHeight: 1.2, letterSpacing: '-0.3px',
          }}>
            YouVA OS is{' '}
            <span style={{ color: '#FB923C' }}>
              {attendanceRate >= 80 ? 'healthy' : attendanceRate >= 60 ? 'moderate' : 'at risk'}
            </span>
            {' '}— all systems operational.
          </h1>
          <p style={{
            fontSize: window.innerWidth <= 768 ? 12 : 13,
            color: 'rgba(255,255,255,0.5)',
            margin: '0 0 22px', lineHeight: 1.6, maxWidth: 460,
          }}>
            {totalTrainees} active trainees across {activeBatches || totalBatches} batches.
            {pendingApprovals > 0 ? ` ${pendingApprovals} items waiting on your approval.` : ' All approvals are up to date.'}
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
              {[
                { label: 'Total Trainees',  value: totalTrainees.toLocaleString(), delta: `▲ ${Math.floor(totalTrainees * 0.04)} this month`, deltaColor: '#34D399' },
                { label: 'Active Batches',  value: activeBatches || totalBatches,  delta: `Total: ${totalBatches}`,                          deltaColor: '#60A5FA' },
                { label: 'Attendance Rate', value: `${attendanceRate}%`,            delta: '▲ 6.1%',                                         deltaColor: '#34D399' },
                { label: 'Placement Ready', value: placementReady,                  delta: '+12%',                                           deltaColor: '#FB923C' },
              ].map((m, i) => (
                <div key={i} style={{
                  display: window.innerWidth <= 480 && i > 1 ? 'none' : 'flex',
                  flexDirection: 'column', gap: 3,
                  paddingRight: i < 3 ? (window.innerWidth <= 768 ? 18 : 28) : 0,
                  paddingLeft: i > 0 ? (window.innerWidth <= 768 ? 18 : 28) : 0,
                  borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#60A5FA', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {m.label}
                  </span>
                  <span style={{ fontSize: window.innerWidth <= 768 ? 20 : 26, fontWeight: 800, color: '#F8FAFC', lineHeight: 1 }}>
                    {m.value}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: m.deltaColor }}>
                    {m.delta}
                  </span>
                </div>
              ))}
            </div>

            {window.innerWidth > 768 && (
              <div style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                padding: '14px 18px',
                minWidth: 150,
              }}>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>
                  Enrollments · 6 mo
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 38 }}>
                  {[40, 52, 48, 66, 78, 92].map((h, i) => (
                    <div key={i} style={{
                      flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0',
                      background: i === 5 ? '#60A5FA' : 'rgba(255,255,255,0.15)',
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#34D399', textAlign: 'right', margin: '6px 0 0' }}>+18%</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid - Responsive */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: window.innerWidth <= 480 ? 'repeat(1, 1fr)' : 
                           window.innerWidth <= 768 ? 'repeat(2, 1fr)' : 
                           window.innerWidth <= 1024 ? 'repeat(4, 1fr)' : 
                           'repeat(4, 1fr)', 
        gap: window.innerWidth <= 768 ? 12 : 14, 
        marginBottom: 16 
      }}>
        <KPICard
          title="TOTAL TRAINEES"
          value={totalTrainees}
          subtitle={totalTrainees > 0 ? `↑ ${Math.floor(totalTrainees * 0.04)} this month` : 'No data'}
          icon={<AppIcon name="users" size={19} style={{ color: '#3B82F6' }} />}
          color="#3B82F6"
          accentBg="#EFF6FF"
        />
        <KPICard
          title="ACTIVE BATCHES"
          value={activeBatches || totalBatches}
          subtitle={`Total: ${totalBatches}`}
          icon={<AppIcon name="layers" size={19} style={{ color: '#22C55E' }} />}
          color="#22C55E"
          accentBg="#F0FDF4"
        />
        {/* <KPICard
          title="PIPELINE ELIGIBLE"
          value={pipelineEligible}
          subtitle="Score ≥ 60"
          icon="📈"
          color="#22C55E"
          accentBg="#F0FDF4"
        /> */}
        {/* <KPICard
          title="PLACEMENT READY"
          value={placementReady}
          subtitle="Score ≥ 80"
          icon="✅"
          color="#22C55E"
          accentBg="#F0FDF4"
        /> */}
        <KPICard
          title="ATTENDANCE RISK"
          value={attendanceRisk}
          subtitle="Below 80%"
          icon={<AppIcon name="alert-triangle" size={19} style={{ color: '#F59E0B' }} />}
          color="#F59E0B"
          accentBg="#FFFBEB"
        />
        {/* <KPICard
          title="RESIDENCY ACTIVE"
          value={residencyActive}
          subtitle="YBLP Month 6"
          icon="🏢"
          color="#06B6D4"
          accentBg="#ECFEFF"
        /> */}
        <KPICard
          title="BRANCH READY"
          value={branchReady}
          subtitle="YBLP verdict"
          icon={<AppIcon name="target" size={19} style={{ color: '#06B6D4' }} />}
          color="#06B6D4"
          accentBg="#ECFEFF"
        />
      </div>

      {/* Main Content Grid - Responsive */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: window.innerWidth <= 1024 ? '1fr' : '1.4fr 1fr', 
        gap: 16,
        marginBottom: window.innerWidth <= 1024 ? 16 : 0
      }}>
        {/* Batch Attendance Trends */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #E2E8F0',
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 4px 16px rgba(30,58,95,0.06)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '20px 24px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {batchTrends.length > 0 ? 'Batch Attendance Trends' : 'Platform Activity'}
              </h3>
              <span style={{
                fontSize: 11, color: '#94A3B8',
                background: '#F8FAFC', border: '1px solid #E2E8F0',
                borderRadius: 20, padding: '3px 10px', fontWeight: 600,
              }}>Weekly trends</span>
            </div>
          </div>
          
          <div style={{ padding: '0 24px 20px' }}>
            {batchTrends.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {batchTrends.map((batch, idx) => (
                  <ProgressRow 
                    key={batch.batchId || batch._id || batch.id || idx} 
                    label={batch.name || `Batch ${idx + 1}`} 
                    pct={batch.pct || batch.attendanceRate || 0} 
                    color={batch.color || getProgressColor(batch.pct || batch.attendanceRate || 0)}
                    onClick={() => handleBatchClick(batch)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ 
                padding: 40, 
                textAlign: 'center', 
                color: '#94A3B8', 
                fontSize: 13 
              }}>
                <p style={{ margin: 0 }}>No batch attendance data available.</p>
                <p style={{ margin: '8px 0 0', fontSize: 12 }}>
                  Data will appear here once batches are created and attendance is tracked.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #E2E8F0',
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 4px 16px rgba(30,58,95,0.06)',
          height: window.innerWidth <= 1024 ? '250px' : '300px',
          display: 'flex',
          flexDirection: 'column',
          order: window.innerWidth <= 1024 ? -1 : 0
        }}>
          {/* Fixed Header */}
          <div style={{ 
            padding: '20px 24px 16px', 
            borderBottom: '1px solid #F1F5F9',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 }}>Activity Feed</h3>
              <span style={{
                fontSize: 11, color: '#94A3B8',
                background: '#F8FAFC', border: '1px solid #E2E8F0',
                borderRadius: 20, padding: '3px 10px', fontWeight: 600,
              }}>Last 24 hours</span>
            </div>
          </div>

          {/* Scrollable Content */}
          <div style={{ 
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0
          }}>
            {recentActivity.length > 0 ? (
              <div>
                {recentActivity.map((activity, idx) => (
                  <ActivityItem key={idx} activity={activity} isLast={idx === recentActivity.length - 1} />
                ))}
              </div>
            ) : (
              <div style={{ 
                padding: '40px 24px', 
                textAlign: 'center', 
                color: '#94A3B8', 
                fontSize: 13 
              }}>
                <p style={{ margin: 0 }}>No recent activity.</p>
                <p style={{ margin: '8px 0 0', fontSize: 12 }}>
                  Activity will appear here as users interact with the platform.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Stats Row - Responsive */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: window.innerWidth <= 480 ? 'repeat(1, 1fr)' : 
                           window.innerWidth <= 768 ? 'repeat(2, 1fr)' : 
                           'repeat(4, 1fr)', 
        gap: window.innerWidth <= 768 ? 12 : 14, 
        marginTop: 16 
      }}>
        <StatCard label="Total Trainers" value={totalTrainers} />
        <StatCard label="Offer Letters" value={offerLetters} />
        <StatCard label="Pending Approvals" value={pendingApprovals} />
        <StatCard label="Active Registrations" value={activeRegistrations} />
      </div>
    </div>
  );
};

// Helper function to get progress bar color based on percentage
const getProgressColor = (pct) => {
  if (pct >= 80) return '#22C55E';
  if (pct >= 60) return '#F59E0B';
  return '#EF4444';
};

// Progress Row Component for batch trends - Responsive, clickable
const ProgressRow = ({ label, pct, color, onClick }) => (
  <div 
    onClick={onClick}
    style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 12,
      cursor: onClick ? 'pointer' : 'default',
      padding: '5px 6px',
      borderRadius: 8,
      transition: 'background 0.15s ease'
    }}
    onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = '#F8FAFC'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
  >
    <span style={{ 
      fontSize: window.innerWidth <= 768 ? 12 : 13, 
      color: '#334155', 
      width: window.innerWidth <= 768 ? 120 : 200, 
      flexShrink: 0,
      fontWeight: 600,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }}>
      {label}
    </span>
    <div style={{ 
      flex: 1, 
      height: 7, 
      background: '#F1F5F9',
      borderRadius: 4, 
      overflow: 'hidden' 
    }}>
      <div style={{ 
        width: `${Math.min(pct, 100)}%`, 
        height: '100%',
        background: color, 
        borderRadius: 4,
        transition: 'width 0.6s ease' 
      }} />
    </div>
    <span style={{ 
      fontSize: window.innerWidth <= 768 ? 11 : 12, 
      fontWeight: 700, 
      color: color === '#22C55E' ? '#16A34A' : color === '#F59E0B' ? '#D97706' : '#DC2626',
      width: window.innerWidth <= 768 ? 30 : 40, 
      textAlign: 'right' 
    }}>
      {pct}%
    </span>
  </div>
);

// KPI Card Component - Responsive
const KPICard = ({ title, value, subtitle, icon, color, accentBg }) => (
  <div style={{
    background: '#ffffff',
    border: '1px solid #E2E8F0',
    borderRadius: 16,
    padding: window.innerWidth <= 768 ? 14 : 18,
    boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 4px 16px rgba(30,58,95,0.06)',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    cursor: 'default'
  }}>
    <div style={{
      width: 38, height: 38,
      borderRadius: 10,
      background: accentBg || '#F8FAFC',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 17,
      marginBottom: 14,
    }}>
      {icon}
    </div>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: window.innerWidth <= 768 ? 8 : 10 }}>
      <div style={{ 
        fontSize: window.innerWidth <= 768 ? 10 : 11, 
        fontWeight: 700, 
        color: '#94A3B8', 
        letterSpacing: '0.8px', 
        textTransform: 'uppercase',
        lineHeight: 1.2
      }}>
        {title}
      </div>
    </div>
    <div style={{ 
      fontSize: window.innerWidth <= 768 ? 24 : window.innerWidth <= 1024 ? 28 : 30, 
      fontWeight: 800, 
      color: '#0F172A', 
      lineHeight: 1, 
      marginBottom: window.innerWidth <= 768 ? 6 : 8,
      letterSpacing: '-0.5px'
    }}>
      {value}
    </div>
    <div style={{ 
      fontSize: window.innerWidth <= 768 ? 11 : 12, 
      color: '#64748B', 
      fontWeight: 500,
      lineHeight: 1.3
    }}>
      {subtitle}
    </div>
  </div>
);

// Small Stat Card Component - Responsive
const StatCard = ({ label, value }) => (
  <div style={{
    background: '#ffffff',
    border: '1px solid #E2E8F0',
    borderRadius: 14,
    padding: window.innerWidth <= 768 ? 14 : 18,
    boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 4px 16px rgba(30,58,95,0.06)',
  }}>
    <div style={{ 
      fontSize: window.innerWidth <= 768 ? 10 : 11, 
      fontWeight: 700, 
      color: '#94A3B8', 
      letterSpacing: '0.8px', 
      textTransform: 'uppercase',
      marginBottom: window.innerWidth <= 768 ? 8 : 10
    }}>
      {label}
    </div>
    <div style={{ 
      fontSize: window.innerWidth <= 768 ? 20 : 24, 
      fontWeight: 800, 
      color: '#0F172A', 
      lineHeight: 1
    }}>
      {value}
    </div>
  </div>
);

// Activity Item Component - Responsive
const ActivityItem = ({ activity, isLast }) => {
  const getActivityColor = (type) => {
    switch (type) {
      case 'success': return '#22C55E';
      case 'warning': return '#F59E0B';
      case 'info': return '#06B6D4';
      case 'primary': return '#3B82F6';
      default: return '#94A3B8';
    }
  };

  // Format activity data from API
  const user = activity.user || activity.userName || 'Unknown User';
  const action = activity.action || activity.message || activity.description || 'performed an action';
  const time = activity.time || (activity.date ? formatTimeAgo(activity.date) : 'recently');
  const batch = activity.batch || activity.batchId || '';
  const type = activity.type || 'info';

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'flex-start', 
      gap: window.innerWidth <= 768 ? 8 : 12,
      padding: window.innerWidth <= 768 ? '12px 16px' : '14px 24px',
      borderBottom: isLast ? 'none' : '1px solid #F8FAFC'
    }}>
      <div 
        style={{ 
          width: 8, 
          height: 8, 
          borderRadius: '50%', 
          background: getActivityColor(type),
          marginTop: 5,
          flexShrink: 0
        }} 
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: window.innerWidth <= 768 ? 12 : 13, color: '#0F172A', lineHeight: 1.4, marginBottom: 3 }}>
          <span style={{ fontWeight: 700 }}>{user}</span>{' '}
          <span style={{ color: '#64748B' }}>{action}</span>
        </div>
        <div style={{ fontSize: window.innerWidth <= 768 ? 10 : 11, color: '#94A3B8', fontWeight: 500 }}>
          {time}{batch && ` · ${batch}`}
        </div>
      </div>
    </div>
  );
};

// Helper function to format time ago
const formatTimeAgo = (date) => {
  const now = new Date();
  const activityDate = new Date(date);
  const diffMs = now - activityDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

export default Dashboard;
