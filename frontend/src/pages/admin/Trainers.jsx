import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  fetchTrainers,
  fetchBatches,
  assignTrainerToBatch,
  selectAllTrainers,
  selectAllBatches,
  selectAdminStatus,
  selectAdminError,
} from '../../features/admin/adminSlice';

// Toast look-up (icon glyph + colours) — identical to other admin pages.
const TOAST = {
  success: { color: '#16a05f', border: '#bfe6d0', glyph: '✓' },
  error: { color: '#c0392b', border: '#f3c2bd', glyph: '✕' },
  warning: { color: '#b06f00', border: '#f0d9a8', glyph: '⚠' },
  info: { color: '#2f6f9b', border: '#bcd6ea', glyph: 'ℹ' },
};

// ── Windowed page list: [1, '…', 4, 5, 6, '…', 20] ─────────────────────────────
function pageList(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, 2, total - 1, total, cur - 1, cur, cur + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const n of nums) {
    if (prev && n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

// ── Tiny responsive hook (re-renders on resize) ────────────────────────────────
function useIsMobile(bp = 720) {
  const get = () =>
    typeof window !== 'undefined' && window.matchMedia(`(max-width:${bp}px)`).matches;
  const [mobile, setMobile] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () =>
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange);
  }, [bp]);
  return mobile;
}

// Extra breakpoint hook for the column-hiding thresholds (480 / 600) the
// original Trainers page relied on, now properly reactive to resize.
function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

export default function Trainers() {
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile();
  const vw = useViewportWidth();
  const hideEmailCol = vw <= 480;
  const hideSpecBatchCols = vw <= 600;

  const trainers = useAppSelector(selectAllTrainers) ?? [];
  const batches = useAppSelector(selectAllBatches) ?? [];
  const status = useAppSelector(selectAdminStatus);
  const error = useAppSelector(selectAdminError);

  // Per-trainer batch modal
  const [batchModalTrainer, setBatchModalTrainer] = useState(null);
  const [chosenBatchIds, setChosenBatchIds] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const pickerRef = useRef(null);

  // ── Built-in toast queue — identical pattern to other admin pages ──
  const [toasts, setToasts] = useState([]);
  const pushToast = (icon, title) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, icon, title }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  };

  // ── Filters ──
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('all');

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loading = status === 'loading';

  // ── Helpers ──
  const currentBatchIdSet = (trainer) => {
    const raw = trainer?.batchIds || [];
    return new Set(raw.map((b) => String(b?._id || b)));
  };
  const getTrainerBatches = (trainer) => {
    const set = currentBatchIdSet(trainer);
    return batches.filter((b) => set.has(String(b._id))).map((b) => ({ id: String(b._id), name: b.name }));
  };

  const openBatchModal = (trainer) => {
    setBatchModalTrainer(trainer);
    setChosenBatchIds([]);
    setPickerOpen(false);
  };
  const closeBatchModal = () => {
    if (assigning) return;
    setBatchModalTrainer(null);
    setChosenBatchIds([]);
    setPickerOpen(false);
  };
  const toggleChosen = (id) => {
    const key = String(id);
    setChosenBatchIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };

  // ── Filtering (search + status) — new, matches the other admin pages' filter bar ──
  const filtered = useMemo(() => {
    let list = trainers;
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (t) =>
          (t.name || '').toLowerCase().includes(needle) ||
          (t.email || '').toLowerCase().includes(needle) ||
          (t.specialization || '').toLowerCase().includes(needle)
      );
    }
    if (fStatus !== 'all') list = list.filter((t) => (fStatus === 'active' ? t.isActive : !t.isActive));
    return list;
  }, [trainers, q, fStatus]);

  const hasFilters = !!(q.trim() || fStatus !== 'all');
  const clearFilters = () => {
    setQ('');
    setFStatus('all');
  };

  useEffect(() => {
    setPage(1);
  }, [q, fStatus]);

  // ── Hooks ──
  useEffect(() => {
    dispatch(fetchTrainers());
    dispatch(fetchBatches());
  }, [dispatch]);

  // ── Derived pagination (over FILTERED) ──
  const total = filtered.length;
  const allTotal = trainers.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(total, page * pageSize);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const onDocClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [pickerOpen]);

  const handleSaveBatches = async () => {
    if (!batchModalTrainer || chosenBatchIds.length === 0) return;
    setAssigning(true);
    try {
      // Backend assigns ONE batch per call; call multiple times for multi-select.
      await Promise.all(
        chosenBatchIds.map((batchId) =>
          dispatch(assignTrainerToBatch({ trainerId: batchModalTrainer._id, batchId })).unwrap()
        )
      );
      await dispatch(fetchTrainers());
      pushToast(
        'success',
        `${batchModalTrainer.name} added to ${chosenBatchIds.length} batch${chosenBatchIds.length > 1 ? 'es' : ''}`
      );
      closeBatchModal();
    } catch (err) {
      pushToast('error', typeof err === 'string' ? err : 'Failed to assign batches');
    } finally {
      setAssigning(false);
    }
  };

  // ── Pagination bar — identical structure to other admin pages' Pager ──
  const Pager = () => {
    if (loading || total === 0) return null;
    return (
      <div style={pagerWrap}>
        <span style={pagerInfo}>
          Showing {startIdx}–{endIdx} of {total}
        </span>
        <div style={pagerBtns}>
          <button style={pgBtn(page === 1)} disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ‹ Prev
          </button>
          {pageList(page, totalPages).map((n, idx) =>
            n === '…' ? (
              <span key={`e${idx}`} style={pgEllipsis}>
                …
              </span>
            ) : (
              <button key={n} onClick={() => setPage(n)} style={pgNum(n === page)}>
                {n}
              </button>
            )
          )}
          <button
            style={pgBtn(page === totalPages)}
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next ›
          </button>
        </div>
        {!isMobile && (
          <label style={pagerInfo}>
            Per page{' '}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{ ...input, width: 'auto', display: 'inline-block', padding: '4px 8px' }}
            >
              {[10, 20, 40].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    );
  };

  // ── Failed state ──
  if (status === 'failed') {
    return (
      <div style={{ padding: isMobile ? 16 : 32, fontFamily: 'Public Sans, system-ui, sans-serif' }}>
        <div style={banner('#fef2f2', '#fecaca', '#b91c1c')}>⚠️ {error || 'Error loading trainers'}</div>
      </div>
    );
  }

  const StatusBadge = ({ active }) => (
    <span style={badge(active ? '#16a05f' : '#657691')}>{active ? 'active' : 'inactive'}</span>
  );

  // For the open modal: which batches are still addable (not already assigned).
  const currentBatches = batchModalTrainer ? getTrainerBatches(batchModalTrainer) : [];
  const addableBatches = batchModalTrainer
    ? batches.filter((b) => !currentBatchIdSet(batchModalTrainer).has(String(b._id)))
    : [];

  // ── Render ──
  return (
    <div style={{ padding: isMobile ? 16 : 32, fontFamily: 'Public Sans, system-ui, sans-serif' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 800, margin: 0, color: '#172033' }}>
            Trainers ({total}
            {total !== allTotal ? ` of ${allTotal}` : ''})
          </h2>
          <p style={{ fontSize: 13, color: '#657691', margin: '4px 0 0' }}>
            Manage trainer profiles and assign them to one or more batches.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto' }}>
          <button
            onClick={() => {
              dispatch(fetchTrainers());
              dispatch(fetchBatches());
            }}
            style={btnGhost}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={filterBar(isMobile)}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email or specialization…"
          style={input}
        />
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={input}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button onClick={clearFilters} disabled={!hasFilters} style={btnGhost}>
          Clear
        </button>
      </div>

      {/* DESKTOP: table */}
      {!isMobile && (
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(23,32,51,.08), 0 12px 28px rgba(31,61,99,.05)',
            border: '1px solid #dbe3ed',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#657691' }}>
                  <th style={{ ...th, width: 52 }}>#</th>
                  <th style={th}>Name</th>
                  {!hideEmailCol && <th style={th}>Email</th>}
                  {!hideSpecBatchCols && <th style={th}>Specialization</th>}
                  {!hideSpecBatchCols && <th style={th}>Batches</th>}
                  <th style={th}>Status</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={emptyCell}>
                      Loading trainers…
                    </td>
                  </tr>
                ) : total === 0 ? (
                  <tr>
                    <td colSpan={7} style={emptyCell}>
                      {hasFilters ? 'No trainers match your filters.' : 'No trainers found.'}
                    </td>
                  </tr>
                ) : (
                  pageItems.map((t, i) => {
                    const tBatches = getTrainerBatches(t);
                    return (
                      <tr
                        key={t._id || i}
                        style={{ background: i % 2 ? '#f8fafc' : '#fff', borderBottom: '1px solid #dbe3ed' }}
                      >
                        <td style={{ ...td, color: '#64748B', fontWeight: 700 }}>{startIdx + i}</td>
                        <td style={td}>
                          <span style={{ fontWeight: 600, color: '#172033' }}>{t.name || '—'}</span>
                        </td>
                        {!hideEmailCol && <td style={td}>{t.email || '—'}</td>}
                        {!hideSpecBatchCols && <td style={td}>{t.specialization || '—'}</td>}
                        {!hideSpecBatchCols && (
                          <td style={td}>
                            {tBatches.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 260 }}>
                                {tBatches.map((b) => (
                                  <span key={b.id} style={batchPill}>
                                    {b.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Not assigned</span>
                            )}
                          </td>
                        )}
                        <td style={{ padding: '11px 16px' }}>
                          <StatusBadge active={t.isActive} />
                        </td>
                        <td style={{ padding: '8px 16px' }}>
                          <button onClick={() => openBatchModal(t)} style={btnManage}>
                            Manage Batches
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MOBILE: cards */}
      {isMobile && (
        <div style={{ display: 'grid', gap: 12 }}>
          {loading ? (
            <div style={cardEmpty}>Loading trainers…</div>
          ) : total === 0 ? (
            <div style={cardEmpty}>{hasFilters ? 'No trainers match your filters.' : 'No trainers found.'}</div>
          ) : (
            pageItems.map((t, i) => {
              const tBatches = getTrainerBatches(t);
              return (
                <div key={t._id || i} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontWeight: 700, color: '#172033', fontSize: 15 }}>{t.name || '—'}</span>
                    <StatusBadge active={t.isActive} />
                  </div>
                  <div style={cardMeta}>
                    <b>Email:</b> {t.email || '—'}
                  </div>
                  <div style={cardMeta}>
                    <b>Specialization:</b> {t.specialization || '—'}
                  </div>
                  <div style={cardMeta}>
                    <b>Batches:</b>{' '}
                    {tBatches.length > 0 ? (
                      <span>{tBatches.map((b) => b.name).join(', ')}</span>
                    ) : (
                      <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Not assigned</span>
                    )}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button onClick={() => openBatchModal(t)} style={btnManage}>
                      Manage Batches
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <Pager />

      {/* ── PER-TRAINER BATCH MODAL ── */}
      {batchModalTrainer && (
        <div style={overlay} onMouseDown={closeBatchModal}>
          <div style={{ ...dialog, maxWidth: isMobile ? '100%' : 560 }} onMouseDown={(e) => e.stopPropagation()}>
            <div style={dialogHead}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#172033' }}>Manage batches</h3>
              <button onClick={closeBatchModal} style={bannerClose}>
                ×
              </button>
            </div>

            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13.5, color: '#41506a' }}>
                <b style={{ color: '#172033' }}>{batchModalTrainer.name}</b>
                {batchModalTrainer.email ? ` — ${batchModalTrainer.email}` : ''}
              </p>

              <Field label="Currently in">
                {currentBatches.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {currentBatches.map((b) => (
                      <span key={b.id} style={batchPill}>
                        {b.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: '#94A3B8', fontSize: 13 }}>Not assigned to any batch yet.</span>
                )}
              </Field>

              <Field label="Add to batches">
                {addableBatches.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>This trainer is already in every batch.</p>
                ) : (
                  <div ref={pickerRef} style={{ position: 'relative' }}>
                    <div
                      onClick={() => setPickerOpen((o) => !o)}
                      style={{
                        ...input,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: chosenBatchIds.length ? '#172033' : '#94A3B8',
                      }}
                    >
                      <span>
                        {chosenBatchIds.length === 0
                          ? 'Select batches…'
                          : `${chosenBatchIds.length} batch${chosenBatchIds.length > 1 ? 'es' : ''} selected`}
                      </span>
                      <span style={{ fontSize: 10, color: '#657691' }}>{pickerOpen ? '▲' : '▼'}</span>
                    </div>

                    {pickerOpen && (
                      <div style={batchDropdown}>
                        {addableBatches.map((b) => {
                          const checked = chosenBatchIds.includes(String(b._id));
                          return (
                            <div key={b._id} onClick={() => toggleChosen(String(b._id))} style={batchOption(checked)}>
                              <span style={checkbox(checked)}>{checked && '✓'}</span>
                              {b.name}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {chosenBatchIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    {chosenBatchIds.map((id) => {
                      const b = batches.find((x) => String(x._id) === String(id));
                      return (
                        <span key={id} style={tagPillGreen}>
                          {b ? b.name : id}
                          <span onClick={() => toggleChosen(id)} style={tagPillCloseGreen}>
                            ×
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </Field>
            </div>

            <div style={dialogFoot}>
              <button onClick={closeBatchModal} disabled={assigning} style={btnGhost}>
                Cancel
              </button>
              <button onClick={handleSaveBatches} disabled={assigning || chosenBatchIds.length === 0} style={btnPrimary}>
                {assigning
                  ? 'Saving…'
                  : `Add to ${chosenBatchIds.length || ''} batch${chosenBatchIds.length === 1 ? '' : 'es'}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts (built-in, stacked queue) */}
      {toasts.length > 0 && (
        <div style={toastWrap}>
          {toasts.map((t) => {
            const cfg = TOAST[t.icon] || TOAST.info;
            return (
              <div key={t.id} style={toastItem(cfg.border)}>
                <span style={{ color: cfg.color, fontWeight: 800, fontSize: 15 }}>{cfg.glyph}</span>
                <span>{t.title}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Small presentational bits ──────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#657691', marginBottom: 6 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

// ── Styles (tokens lifted directly from AdminSessions.jsx / UserManagement.jsx / Trainees.jsx) ─
const th = { padding: '12px 16px', textAlign: 'left', fontSize: 12, letterSpacing: '.7px', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const td = { padding: '11px 16px', fontSize: 13, color: '#2b3648' };
const emptyCell = { padding: 32, textAlign: 'center', color: '#657691' };

const card = { background: '#fff', border: '1px solid #dbe3ed', borderRadius: 12, padding: 14, boxShadow: '0 1px 2px rgba(23,32,51,.06)' };
const cardEmpty = { background: '#fff', border: '1px solid #dbe3ed', borderRadius: 12, padding: 28, textAlign: 'center', color: '#657691' };
const cardMeta = { fontSize: 13, color: '#41506a', marginTop: 6 };

const badge = (bg) => ({ background: bg, color: '#fff', padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' });
const batchPill = { display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#DBEAFE', color: '#1E40AF', whiteSpace: 'nowrap' };

const btnPrimary = { background: '#2f6f9b', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost = { background: '#fff', color: '#41506a', border: '1px solid #dbe3ed', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnManage = { padding: '7px 14px', borderRadius: 8, border: '1px solid #2f6f9b', background: '#eaf3fb', color: '#2f6f9b', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };

const input = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid #dbe3ed', fontSize: 13, fontFamily: 'inherit', color: '#172033', background: '#fff' };

const filterBar = (mobile) => ({
  display: 'grid',
  gridTemplateColumns: mobile ? '1fr' : 'minmax(220px,1.6fr) 1fr auto',
  gap: 10,
  marginBottom: 16,
  alignItems: 'center',
});

const tagPillGreen = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#e3f7ec', color: '#16a05f' };
const tagPillCloseGreen = { cursor: 'pointer', color: '#16a05f', fontSize: 13, lineHeight: 1, fontWeight: 700 };

const batchDropdown = { position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1px solid #dbe3ed', borderRadius: 10, boxShadow: '0 12px 28px rgba(15,23,42,.12)', maxHeight: 240, overflowY: 'auto', zIndex: 20, padding: 6 };
const batchOption = (selected) => ({ padding: '9px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: selected ? '#eaf3fb' : 'transparent', borderRadius: 8, fontSize: 14, color: selected ? '#2f6f9b' : '#172033' });
const checkbox = (selected) => ({ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `2px solid ${selected ? '#2f6f9b' : '#CBD5E1'}`, background: selected ? '#2f6f9b' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 });

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto', zIndex: 1000 };
const dialog = { background: '#fff', borderRadius: 14, width: '100%', boxShadow: '0 20px 60px rgba(15,23,42,.3)', marginTop: 24 };
const dialogHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #eef2f7' };
const dialogFoot = { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid #eef2f7' };

const banner = (bg, border, color) => ({ background: bg, border: `1px solid ${border}`, color, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
const bannerClose = { background: 'transparent', border: 'none', fontSize: 20, lineHeight: 1, cursor: 'pointer', color: 'inherit' };

const pagerWrap = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 16 };
const pagerInfo = { fontSize: 12.5, color: '#657691' };
const pagerBtns = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const pgBtn = (disabled) => ({ background: '#fff', color: disabled ? '#b6c0cf' : '#41506a', border: '1px solid #dbe3ed', padding: '6px 10px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' });
const pgNum = (active) => ({ background: active ? '#2f6f9b' : '#fff', color: active ? '#fff' : '#41506a', border: `1px solid ${active ? '#2f6f9b' : '#dbe3ed'}`, padding: '6px 11px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer', minWidth: 36, fontFamily: 'inherit' });
const pgEllipsis = { color: '#9aa6b6', padding: '0 2px' };

const toastWrap = { position: 'fixed', top: 16, right: 16, display: 'grid', gap: 8, zIndex: 2000 };
const toastItem = (border) => ({ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220, maxWidth: 360, padding: '11px 14px', borderRadius: 10, background: '#fff', boxShadow: '0 10px 30px rgba(15,23,42,.18)', border: `1px solid ${border}`, fontSize: 13.5, color: '#172033' });