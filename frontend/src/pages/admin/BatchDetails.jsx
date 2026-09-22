
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import {
  fetchBatches,
  selectAllBatches,
  selectBatchesStatus,
} from '../../features/session/batchSlice';

import {
  fetchAdminTrainees,
  selectAllAdminTrainees,
  selectAdminTraineesStatus,
} from '../../features/admin/adminSlice';
import AppIcon from '../../components/shared/AppIcon';

// ── helpers ───────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  upcoming:  { bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
  active:    { bg: '#F0FDF4', color: '#15803D', dot: '#22C55E' },
  completed: { bg: '#F9FAFB', color: '#374151', dot: '#9CA3AF' },
  cancelled: { bg: '#FEF2F2', color: '#B91C1C', dot: '#EF4444' },
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const traineeInBatch = (t, batchId) => {
  const src = Array.isArray(t.batchIds) && t.batchIds.length
    ? t.batchIds
    : (t.batchId ? [t.batchId] : []);
  return src.some((b) => String(b && typeof b === 'object' ? b._id : b) === String(batchId));
};

// ── CSS — YouVA OS Theme ──────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin   { to{transform:rotate(360deg)} }

  /* YouVA hero gradient — exact match to dashboard */
  .youva-hero {
    background: linear-gradient(120deg, #141836 0%, #1a1f52 35%, #21196b 65%, #1a1545 100%);
    border-radius: 16px;
    padding: 28px 32px 26px;
    margin-bottom: 20px;
    position: relative;
    overflow: hidden;
  }
  .youva-hero::before {
    content: '';
    position: absolute;
    top: -40px; right: -40px;
    width: 320px; height: 320px;
    background: radial-gradient(ellipse, rgba(99,102,241,.28) 0%, rgba(109,40,217,.15) 40%, transparent 70%);
    pointer-events: none;
    border-radius: 50%;
  }
  .youva-hero::after {
    content: '';
    position: absolute;
    bottom: -60px; left: 30%;
    width: 260px; height: 200px;
    background: radial-gradient(ellipse, rgba(67,56,202,.2) 0%, transparent 70%);
    pointer-events: none;
  }

  .bd-tab { transition: all .15s; border: none; cursor: pointer; }
  .bd-tab.act { background: #fff!important; color: #0F172A!important; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .bd-row:hover { background: #F8FAFC!important; }
  .fi:focus { outline: none!important; border-color: #6366f1!important; box-shadow: 0 0 0 3px rgba(99,102,241,.12)!important; }
  .back-btn { transition: background .15s, border-color .15s; }
  .back-btn:hover { background: #F1F5F9!important; border-color: #CBD5E1!important; }

  @media (max-width: 640px) {
    .bd-stats { grid-template-columns: repeat(2,1fr)!important; }
    .bd-info  { grid-template-columns: 1fr!important; }
    .hero-stat-strip { flex-direction: column!important; gap: 16px!important; }
    .hero-stat-strip .stat-divider { display: none!important; }
    .youva-hero { padding: 22px 20px 20px; }
  }
`;

// ── ATOMS ─────────────────────────────────────────────────────────────────────

const StatusPill = ({ status }) => {
  const c = STATUS_COLORS[status] || STATUS_COLORS.upcoming;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c.bg, color: c.color, fontSize: '0.74rem', fontWeight: 600,
      padding: '3px 11px', borderRadius: 99,
      border: `1px solid ${c.dot}30`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
      {status}
    </span>
  );
};

const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
    <div style={{
      width: 26, height: 26, borderRadius: '50%',
      border: '3px solid #E2E8F0', borderTopColor: '#6366f1',
      animation: 'spin .7s linear infinite',
    }} />
  </div>
);

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

const BatchDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const batches       = useSelector(selectAllBatches) ?? [];
  const batchStatus   = useSelector(selectBatchesStatus);
  const trainees      = useSelector(selectAllAdminTrainees) ?? [];
  const traineeStatus = useSelector(selectAdminTraineesStatus);

  const [tab, setTab]       = useState('overview');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!batches.length) dispatch(fetchBatches());
    dispatch(fetchAdminTrainees());
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const batch = useMemo(
    () => batches.find((b) => String(b._id) === String(id)),
    [batches, id]
  );

  const students = useMemo(
    () => trainees.filter((t) => traineeInBatch(t, id)),
    [trainees, id]
  );

  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase();
    return (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
  });

  const loading = batchStatus === 'loading' && !batch;

  // Hero stat strip data (mirrors Batches.jsx layout)
  const heroStats = batch ? [
    { label: 'ENROLLED',     value: students.length,       sub: `of ${batch.maxStudents ?? '—'} capacity`, subColor: '#60A5FA' },
    { label: 'CAPACITY',     value: batch.maxStudents ?? '—', sub: 'max students',                         subColor: '#4ADE80' },
    { label: 'START DATE',   value: fmtDate(batch.startDate), sub: 'scheduled',                            subColor: '#A78BFA', small: true },
    { label: 'STATUS',       value: batch.status || 'upcoming', sub: 'current state',                      subColor: '#FB923C', small: true },
  ] : [];

  return (
    <div style={{
      minHeight: '100vh', background: '#F1F5F9',
      fontFamily: "'Inter', system-ui, sans-serif", color: '#0F172A',
    }}>
      <style>{CSS}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>

        {/* ── BACK BUTTON ── */}
        <button className="back-btn"
          onClick={() => navigate('/admin/batches')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 9,
            border: '1.5px solid #E2E8F0', background: '#fff',
            color: '#475569', fontWeight: 600, fontSize: '0.82rem',
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20,
          }}>
          ← Back to Batches
        </button>

        {loading ? (
          <Spinner />
        ) : !batch ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px', color: '#94A3B8',
            background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <span style={{ width: 56, height: 56, borderRadius: 16, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AppIcon name="search" size={24} style={{ color: '#94A3B8' }} />
                </span>
              </div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6, color: '#374151' }}>Batch not found</div>
            <div style={{ fontSize: '0.82rem' }}>It may have been deleted, or the link is invalid.</div>
          </div>
        ) : (
          <div style={{ animation: 'fadeUp .3s ease' }}>

            {/* ── YOUVA HERO BANNER ── */}
            <div className="youva-hero">

              {/* Eyebrow + batch title row */}
              <div style={{
                display: 'flex', alignItems: 'flex-start',
                justifyContent: 'space-between', gap: 16,
                marginBottom: 26, flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  {/* Batch avatar */}
                  <div style={{
                    width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                    background: 'rgba(99,102,241,0.25)',
                    border: '1px solid rgba(99,102,241,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#A5B4FC', fontWeight: 700, fontSize: '1rem',
                    fontFamily: 'DM Mono, monospace',
                  }}>
                    {(batch.name || 'B').slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <p style={{
                      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '1.3px',
                      textTransform: 'uppercase', color: '#7C85B3',
                      margin: 0, marginBottom: 6,
                    }}>
                      PLATFORM OVERVIEW · BATCH DETAILS
                    </p>
                    <h1 style={{
                      fontSize: '1.6rem', fontWeight: 800, color: '#F1F5F9',
                      margin: 0, letterSpacing: '-0.4px', lineHeight: 1.2,
                    }}>
                      {batch.name}
                    </h1>
                    <p style={{ fontSize: '0.8rem', color: '#7C85B3', marginTop: 6, marginBottom: 0 }}>
                      {batch.course || '—'} · Trainer: {batch.trainerId?.name || 'Unassigned'} · All details up to date.
                    </p>
                  </div>
                </div>

                {/* Status pill (top-right) */}
                <div style={{ flexShrink: 0, paddingTop: 4 }}>
                  <StatusPill status={batch.status || 'upcoming'} />
                </div>
              </div>

              {/* Stat strip — horizontal with dividers, matching dashboard */}
              <div className="hero-stat-strip" style={{
                display: 'flex', gap: 0,
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: 20,
              }}>
                {heroStats.map(({ label, value, sub, subColor, small }, idx) => (
                  <React.Fragment key={label}>
                    {idx > 0 && (
                      <div className="stat-divider" style={{
                        width: 1, background: 'rgba(255,255,255,0.08)',
                        margin: '0 28px', flexShrink: 0,
                      }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.63rem', fontWeight: 700, letterSpacing: '1px',
                        textTransform: 'uppercase', color: '#7C85B3', marginBottom: 6,
                      }}>
                        {label}
                      </div>
                      <div style={{
                        fontSize: small ? '1.1rem' : '2rem',
                        fontWeight: 800, color: '#F1F5F9',
                        fontFamily: small ? 'inherit' : 'DM Mono, monospace',
                        letterSpacing: small ? 'normal' : '-1.5px',
                        lineHeight: 1, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180,
                      }}>
                        {value}
                      </div>
                      <div style={{
                        fontSize: '0.72rem', fontWeight: 600, color: subColor, marginTop: 6,
                      }}>
                        ▲ {sub}
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* ── TABS ── */}
            <div style={{
              display: 'inline-flex', background: '#E2E8F0',
              borderRadius: 10, padding: 3, gap: 2, marginBottom: 16,
            }}>
              {['overview', 'students'].map((t) => (
                <button key={t} className={`bd-tab ${tab === t ? 'act' : ''}`}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '8px 20px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                    color: tab === t ? '#0F172A' : '#64748B',
                    background: 'transparent', fontFamily: 'inherit', textTransform: 'capitalize',
                  }}>
                  {t === 'students' ? `Students (${students.length})` : 'Overview'}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {tab === 'overview' && (
              <div style={{
                background: '#fff', border: '1px solid #E2E8F0',
                borderRadius: 14, padding: '22px 24px',
                boxShadow: '0 1px 4px rgba(15,23,42,.05)',
              }}>
                <h2 style={{
                  fontSize: '0.82rem', fontWeight: 700, color: '#64748B',
                  textTransform: 'uppercase', letterSpacing: '0.7px',
                  margin: '0 0 18px',
                }}>Batch Information</h2>

                <div className="bd-info" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 32px' }}>
                  {[
                    ['Course',        batch.course || '—'],
                    ['Trainer',       batch.trainerId?.name || '—'],
                    ['Trainer Email', batch.trainerId?.email || '—'],
                    ['Start Date',    fmtDate(batch.startDate)],
                    ['Max Students',  batch.maxStudents ?? '—'],
                    ['Enrolled',      `${students.length} student${students.length === 1 ? '' : 's'}`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{
                        fontSize: '0.67rem', fontWeight: 700, color: '#94A3B8',
                        textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5,
                      }}>{k}</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0F172A' }}>{v}</div>
                    </div>
                  ))}
                </div>

                {batch.description && (
                  <div style={{ marginTop: 22, borderTop: '1px solid #F1F5F9', paddingTop: 18 }}>
                    <div style={{
                      fontSize: '0.67rem', fontWeight: 700, color: '#94A3B8',
                      textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8,
                    }}>Description</div>
                    <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.7, margin: 0 }}>
                      {batch.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── STUDENTS TAB ── */}
            {tab === 'students' && (
              <div style={{
                background: '#fff', border: '1px solid #E2E8F0',
                borderRadius: 14, overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(15,23,42,.05)',
              }}>
                {/* Search bar */}
                <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 11, top: '50%',
                      transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#94A3B8', display: 'flex',
                    }}><AppIcon name="search" size={14} /></span>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="fi"
                      placeholder="Search students by name or email…"
                      style={{
                        width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 9,
                        padding: '9px 13px 9px 34px', fontSize: '0.85rem',
                        color: '#0F172A', fontFamily: 'inherit', background: '#FAFAFA',
                      }}
                    />
                  </div>
                </div>

                {traineeStatus === 'loading' ? (
                  <Spinner />
                ) : students.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94A3B8' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                      <span style={{ width: 52, height: 52, borderRadius: 14, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon name="school" size={22} style={{ color: '#3B82F6' }} />
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151', marginBottom: 4 }}>No students enrolled yet</div>
                    <div style={{ fontSize: '0.8rem' }}>Students assigned to this batch will appear here.</div>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94A3B8' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                      <span style={{ width: 52, height: 52, borderRadius: 14, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon name="search" size={22} style={{ color: '#64748B' }} />
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151' }}>No students match your search</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                      <thead>
                        <tr>
                          {['#', 'Name', 'Email', 'Status'].map((h) => (
                            <th key={h} style={{
                              textAlign: 'left', padding: '11px 16px',
                              fontSize: '0.67rem', fontWeight: 700, color: '#64748B',
                              textTransform: 'uppercase', letterSpacing: '0.7px',
                              borderBottom: '1px solid #E2E8F0', background: '#F8FAFC',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map((s, i) => (
                          <tr key={s._id || i} className="bd-row"
                            style={{ borderBottom: '1px solid #F1F5F9', transition: 'background .12s' }}>
                            <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: '#94A3B8' }}>{i + 1}</td>
                            <td style={{ padding: '12px 16px', fontSize: '0.85rem', fontWeight: 600, color: '#0F172A' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                  width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                                  background: '#EEF2FF', color: '#6366f1',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.72rem', fontWeight: 700,
                                }}>
                                  {(s.name || '?').slice(0, 2).toUpperCase()}
                                </div>
                                {s.name || '—'}
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: '0.82rem', color: '#64748B' }}>{s.email || '—'}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px', borderRadius: 99,
                                fontSize: '0.7rem', fontWeight: 700,
                                background: s.isActive ? '#DCFCE7' : '#F1F5F9',
                                color: s.isActive ? '#15803D' : '#475569',
                                border: s.isActive ? '1px solid #86EFAC30' : '1px solid #CBD5E130',
                              }}>
                                <span style={{
                                  width: 5, height: 5, borderRadius: '50%',
                                  background: s.isActive ? '#22C55E' : '#94A3B8',
                                }} />
                                {s.isActive ? 'Active' : 'In-Active'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Student count footer */}
                    <div style={{
                      padding: '11px 16px', borderTop: '1px solid #E2E8F0',
                      background: '#FAFAFA', fontSize: '0.78rem', color: '#64748B', fontWeight: 500,
                    }}>
                      Showing <strong style={{ color: '#0F172A' }}>{filteredStudents.length}</strong> of{' '}
                      <strong style={{ color: '#0F172A' }}>{students.length}</strong> enrolled students
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default BatchDetails;