import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchWorkshopRegistrations,
  updateWorkshopRegistration,
  deleteWorkshopRegistration,
  resetWorkshopRegistrationPassword,
  createWorkshopBatch,
  fetchWorkshopBatches,
  fetchTrainerList,
  selectWsRegistrations,
  selectWsRegistrationsMeta,
  selectWsRegistrationsStatus,
  selectTrainerList,
  selectTrainerListStatus,
} from '../../../features/workshops/workshopSlice';
import toast from 'react-hot-toast';
import { isPastDateOnly, isPastDateTime } from '../../../utils/dateTime';

const S = {
  page:  { padding: '20px 28px', fontFamily: 'Public Sans, system-ui, sans-serif', background: '#F1F5F9', minHeight: '100vh' },
  card:  { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 1px 3px rgba(15,23,42,.05),0 4px 16px rgba(30,58,95,.06)' },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', color: '#0F172A', background: '#fff', outline: 'none' },
  th:    { padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#94A3B8', background: '#F8FAFC', textAlign: 'left', whiteSpace: 'nowrap' },
  td:    { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #F1F5F9' },
  btnPri:  { background: '#1E3A5F', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost:{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};

const STATUS_CFG = {
  Registered: ['#DBEAFE','#1E40AF'],
  Approved:   ['#D1FAE5','#065F46'],
  Rejected:   ['#FEE2E2','#991B1B'],
  Cancelled:  ['#F1F5F9','#475569'],
};

function StatusBadge({ status }) {
  const [bg, fg] = STATUS_CFG[status] || STATUS_CFG.Registered;
  return <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{status}</span>;
}

const fmt = (d) => {
  try { return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return '—'; }
};

export default function WorkshopRegistrationsAdmin() {
  const dispatch = useDispatch();
  const registrations = useSelector(selectWsRegistrations);
  const meta = useSelector(selectWsRegistrationsMeta);
  const status = useSelector(selectWsRegistrationsStatus);
  const trainerList = useSelector(selectTrainerList);
  const trainerListStatus = useSelector(selectTrainerListStatus);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [viewReg, setViewReg] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [tempPwModal, setTempPwModal] = useState(null); // { fullName, email, temporaryPassword }

  const [selectedIds, setSelectedIds] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [bulkBusy, setBulkBusy]     = useState(false);

  const allIds     = registrations.map(r => r._id);
  const allChecked = allIds.length > 0 && allIds.every(id => selectedIds.includes(id));
  const someChecked = selectedIds.length > 0 && !allChecked;

  const toggleAll = () => setSelectedIds(allChecked ? [] : allIds);

  const approvedSelectedCount = useMemo(() => selectedIds.length, [selectedIds]);

  // ── Export selected to CSV ────────────────────────────────────────────────
  const handleExport = () => {
    const rows = registrations.filter(r => selectedIds.includes(r._id));
    if (!rows.length) { alert('Select at least one registration to export.'); return; }
    const headers = ['Name','Email','Phone','WhatsApp','Workshop','College','Qualification','City','State','Experience','LinkedIn','GitHub','Status','Date'];
    const csv = [
      headers.join(','),
      ...rows.map(r => [
        r.fullName, r.email, r.phone, r.whatsapp,
        r.workshopName || r.workshopId?.title || '',
        r.college, r.qualification, r.city, r.state,
        r.experience, r.linkedin, r.github,
        r.registrationStatus,
        new Date(r.registrationDate || r.createdAt).toLocaleDateString(),
      ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'registrations.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Bulk approve ─────────────────────────────────────────────────────────
  const handleBulkApprove = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Approve ${selectedIds.length} registration(s)?`)) return;
    setBulkBusy(true);
    for (const id of selectedIds) {
      await dispatch(updateWorkshopRegistration({ id, registrationStatus: 'Approved' }));
      // show temp password modal for first approved if returned
    }
    setBulkBusy(false);
    setSelectedIds([]);
    load(page);
  };

  // ── Bulk reject ──────────────────────────────────────────────────────────
  const handleBulkReject = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Reject ${selectedIds.length} registration(s)?`)) return;
    setBulkBusy(true);
    for (const id of selectedIds) await dispatch(updateWorkshopRegistration({ id, registrationStatus: 'Rejected' }));
    setBulkBusy(false);
    setSelectedIds([]);
    load(page);
  };

  // ── Bulk delete ──────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Permanently delete ${selectedIds.length} registration(s)? This cannot be undone.`)) return;
    setBulkBusy(true);
    for (const id of selectedIds) await dispatch(deleteWorkshopRegistration(id));
    setBulkBusy(false);
    setSelectedIds([]);
    load(page);
  };


  const load = (p = page) => {
    dispatch(fetchWorkshopRegistrations({
      page: p,
      limit: 20,
      search: debouncedSearch || undefined,
      status: filterStatus || undefined,
    }));
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, debouncedSearch]);

  useEffect(() => {
    dispatch(fetchWorkshopRegistrations({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: filterStatus || undefined,
    }));
  }, [dispatch, page, filterStatus, debouncedSearch]);

  const handleStatusUpdate = async (id, newStatus, regName, regEmail) => {
    setBusyId(id);
    try {
      const result = await dispatch(updateWorkshopRegistration({ id, registrationStatus: newStatus }));
      if (updateWorkshopRegistration.fulfilled.match(result)) {
        if (newStatus === 'Approved') {
          if (result.payload?.emailWarning) {
            toast.error(result.payload.emailWarning);
          } else if (result.payload?.emailSent) {
            toast.success('Registration approved and email sent.');
          }
        }
        // Check if temporaryPassword was returned (dev mode)
        if (result.payload?.temporaryPassword && newStatus === 'Approved') {
          setTempPwModal({
            fullName: regName,
            email: regEmail,
            temporaryPassword: result.payload.temporaryPassword,
          });
        }
      }
    } catch (_) {}
    setBusyId(null);
    load(page);
  };

const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete registration for "${name}"?`)) return;
    setBusyId(id);
    await dispatch(deleteWorkshopRegistration(id));
    setBusyId(null);
    load(page);
  };

  const handleResetPassword = async (id, regName, regEmail) => {
    if (!window.confirm(`Reset password for "${regName}" (${regEmail})? This will send a new temporary password via email.`)) return;
    setBusyId(id);
    try {
      const result = await dispatch(resetWorkshopRegistrationPassword(id));
      if (resetWorkshopRegistrationPassword.fulfilled.match(result)) {
        const payload = result.payload;
        // Dev mode: show password in modal
        if (payload?.temporaryPassword) {
          setTempPwModal({
            fullName: regName,
            email: regEmail,
            temporaryPassword: payload.temporaryPassword,
          });
        } else {
          toast.success('Password reset email sent successfully!');
        }
      } else {
        toast.error(result.payload || 'Failed to reset password');
      }
    } catch (_) {
      toast.error('Failed to reset password');
    }
    setBusyId(null);
  };

  const counts = useMemo(() => {
    const c = { total: meta?.total ?? registrations.length };
    ['Registered','Approved','Rejected'].forEach(s => {
      c[s] = registrations.filter(r => r.registrationStatus === s).length;
    });
    return c;
  }, [registrations, meta]);

  const selectedApprovedRegs = useMemo(
    () => registrations.filter(r => selectedIds.includes(r._id)),
    [registrations, selectedIds]
  );

  const workshopIdFromSelection = selectedApprovedRegs[0]?.workshopId?._id || selectedApprovedRegs[0]?.workshopId || null;

  const [form, setForm] = useState({
    batchName: '',
    batchCode: '',
    workshopId: '',
    trainer: '',
    trainerId: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    mode: 'Online',
    capacity: '',
    batchStatus: 'Draft',
    notes: '',
  });

  const validateHHmm = (val, label) => {
    if (val === '' || val === null || val === undefined) return null; // optional
    if (typeof val !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(val.trim())) {
      return `Invalid ${label}. Use HH:mm format (e.g. 09:00, 14:30).`;
    }
    return null;
  };

  const parseHHmmMinutes = (val) => {
    const [h, m] = val.split(':').map(Number);
    return h * 60 + m;
  };

  const validateBatchPayload = () => {
    if (!form.batchName?.trim()) return 'Batch name is required.';
    if (!form.batchCode?.trim()) return 'Batch code is required.';
    if (!form.startDate) return 'Start date is required.';

    // Past-date check
    if (isPastDateOnly(form.startDate)) return 'Start date cannot be in the past.';
    if (form.startTime && isPastDateTime(form.startDate, form.startTime)) {
      return 'Start date/time cannot be in the past.';
    }
    if (!selectedApprovedRegs.length) return 'Select at least one trainee.';

    // Dates
    if (form.endDate) {
      const sd = new Date(form.startDate);
      const ed = new Date(form.endDate);
      if (!Number.isFinite(sd.getTime()) || !Number.isFinite(ed.getTime())) return 'Invalid date.';
      if (ed < sd) return 'End date cannot be before start date.';
    }

    // Times (strict HH:mm)
    const stErr = validateHHmm(form.startTime, 'start time');
    if (stErr) return stErr;
    const etErr = validateHHmm(form.endTime, 'end time');
    if (etErr) return etErr;

    if (form.startTime && form.endTime) {
      if (parseHHmmMinutes(form.endTime) <= parseHHmmMinutes(form.startTime)) {
        return 'End time must be later than start time.';
      }
    }

    // Capacity: required, positive whole number
    if (form.capacity === '' || form.capacity === null || form.capacity === undefined) {
      return 'Capacity is required.';
    }
    const cap = Number(form.capacity);
    if (!Number.isInteger(cap) || cap <= 0) {
      return 'Capacity must be a positive whole number.';
    }
    if (selectedApprovedRegs.length > cap) {
      return 'Capacity cannot be less than selected trainee count.';
    }

    // Trainer: required
    if (!form.trainerId || !form.trainerId.trim()) {
      return 'Trainer is required.';
    }

    return null;
  };




  const openCreate = () => {
    const workshopId = workshopIdFromSelection;
    if (!workshopId) {
      alert('Select trainees from a single workshop first.');
      return;
    }
    // Pre-fill workshopId + trainer from first selected registration if needed
    const trainerGuess = '';
    setForm(prev => ({
      ...prev,
      workshopId,
      trainer: trainerGuess,
      startDate: prev.startDate,
    }));
    setCreateOpen(true);
  };

  useEffect(() => {
    if (createOpen) dispatch(fetchTrainerList());
  }, [dispatch, createOpen]);

  const resetCreate = () => {
    setCreateOpen(false);
    setCreateBusy(false);
    setForm({
      batchName: '',
      batchCode: '',
      workshopId: '',
      trainer: '',
      trainerId: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      mode: 'Online',
      capacity: '',
      batchStatus: 'Draft',
      notes: '',
    });
  };

  const handleCreateBatch = async () => {
    if (createBusy) return;
    if (!selectedIds.length) return;

    const validationErr = validateBatchPayload();
    if (validationErr) {
      alert(validationErr);
      return;
    }

    const workshopId = workshopIdFromSelection;

    if (!workshopId) {
      alert('Selected trainees must belong to a workshop.');
      return;
    }

    // Ensure all selected registrations are in same workshop (UI guard; backend also validates)
    const distinctWorkshopIds = selectedApprovedRegs.map(r => (r.workshopId?._id || r.workshopId?.toString?.() || r.workshopId)).filter(Boolean);
    const uniq = Array.from(new Set(distinctWorkshopIds.map(String)));
    if (uniq.length > 1) {
      alert('Selected trainees must belong to the same workshop.');
      return;
    }

    const payload = {
      workshopId,
      batchName: form.batchName,
      batchCode: form.batchCode,
      registrationIds: selectedIds,
      trainerId: form.trainerId || undefined,
      trainer: form.trainer || '',
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      startTime: form.startTime || '',
      endTime: form.endTime || '',
      mode: form.mode || 'Online',
      // backend requires positive whole number capacity
      capacity: form.capacity === '' ? undefined : Number(form.capacity),

      status: form.batchStatus || 'Draft',
      notes: form.notes || '',
    };

    setCreateBusy(true);
    try {
      await dispatch(createWorkshopBatch(payload)).unwrap();
      dispatch(fetchWorkshopBatches({ page: 1, limit: 50 }));
      resetCreate();
      setSelectedIds([]);
      alert('Batch created successfully.');
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message || 'Failed to create batch.');
      alert(msg);
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Workshop Registrations</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
            {meta?.total ?? registrations.length} total · {counts.Registered ?? 0} registered · {counts.Approved ?? 0} approved · {counts.Rejected ?? 0} rejected
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 800 }}>
            Selected: {approvedSelectedCount}
          </div>
          {selectedIds.length > 0 && (
            <>
              <button style={{ ...S.btnPri, background: '#15803D', opacity: bulkBusy ? 0.6 : 1 }} disabled={bulkBusy} onClick={handleBulkApprove}>
                <i className="ti ti-check" style={{ fontSize: 13, marginRight: 4 }} /> Approve ({selectedIds.length})
              </button>
              <button style={{ ...S.btnPri, background: '#DC2626', opacity: bulkBusy ? 0.6 : 1 }} disabled={bulkBusy} onClick={handleBulkReject}>
                <i className="ti ti-x" style={{ fontSize: 13, marginRight: 4 }} /> Reject ({selectedIds.length})
              </button>
              <button style={{ ...S.btnPri, background: '#7C3AED', opacity: bulkBusy ? 0.6 : 1 }} disabled={bulkBusy} onClick={handleExport}>
                <i className="ti ti-download" style={{ fontSize: 13, marginRight: 4 }} /> Export
              </button>
              <button style={{ ...S.btnPri, background: '#EF4444', opacity: bulkBusy ? 0.6 : 1 }} disabled={bulkBusy} onClick={handleBulkDelete}>
                <i className="ti ti-trash" style={{ fontSize: 13, marginRight: 4 }} /> Delete ({selectedIds.length})
              </button>
            </>
          )}
          <button
            style={{ ...S.btnPri, background: '#1E3A5F', opacity: approvedSelectedCount ? 1 : 0.5 }}
            disabled={!approvedSelectedCount}
            onClick={openCreate}
          >
            <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 6 }} /> Create Batch
          </button>
          <button style={S.btnGhost} onClick={() => load(page)}>↻ Refresh</button>
        </div>
      </div>


      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 14 }} />
          <input style={{ ...S.input, paddingLeft: 32 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone, college…" />
        </div>
        <select style={{ ...S.input, flex: '0 0 180px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Registered">Registered</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div style={{ ...S.card, overflow: 'hidden' }}>
        {status === 'loading' && registrations.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Loading registrations...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {status === 'loading' && registrations.length > 0 && (
              <div style={{ padding: '8px 14px', fontSize: 12, color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                Refreshing…
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                {['Select All','Student','Email','Phone','Workshop','College','Qualification','Date','Status','Actions'].map(h => (
                    <th key={h} style={h === 'Select All' ? { ...S.th, width: 40 } : S.th}>
                      {h === 'Select All' ? (
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={el => { if (el) el.indeterminate = someChecked; }}
                          onChange={toggleAll}
                          title={allChecked ? 'Deselect All' : 'Select All'}
                          style={{ cursor: 'pointer' }}
                        />
                      ) : h}
                    </th>
                  ))}

                </tr>
              </thead>
              <tbody>
                {registrations.length === 0 ? (
                  <tr><td colSpan={10} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                    No registrations found.
                  </td></tr>
                ) : registrations.map((r, i) => (
                  <tr key={r._id} style={{ background: i % 2 ? '#FAFAFA' : '#fff' }}>
                    <td style={S.td}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r._id)}
                        onChange={(e) => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(r._id);
                            else next.delete(r._id);
                            return Array.from(next);
                          });
                        }}
                        aria-label={`Select ${r.fullName}`}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={S.td}><span style={{ fontWeight: 700, color: '#0F172A' }}>{r.fullName}</span></td>

                    <td style={S.td}>{r.email}</td>
                    <td style={S.td}>{r.phone}</td>
                    <td style={S.td}>{r.workshopName || r.workshopId?.title || '—'}</td>
                    <td style={S.td}>{r.college || '—'}</td>
                    <td style={S.td}>{r.qualification || '—'}</td>
                    <td style={S.td}>{fmt(r.registrationDate || r.createdAt)}</td>
                    <td style={S.td}><StatusBadge status={r.registrationStatus} /></td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button title="View" onClick={() => setViewReg(r)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="ti ti-eye" style={{ fontSize: 12 }} />
                        </button>
                        {r.registrationStatus !== 'Approved' && (
                          <button title="Approve" disabled={busyId === r._id} onClick={() => handleStatusUpdate(r._id, 'Approved', r.fullName, r.email)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#15803D', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="ti ti-check" style={{ fontSize: 12 }} />
                          </button>
                        )}
                        {r.registrationStatus !== 'Rejected' && (
                          <button title="Reject" disabled={busyId === r._id} onClick={() => handleStatusUpdate(r._id, 'Rejected')} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="ti ti-x" style={{ fontSize: 12 }} />
                          </button>
                        )}
{r.registrationStatus === 'Approved' && (
                          <button title="Reset Password" disabled={busyId === r._id} onClick={() => handleResetPassword(r._id, r.fullName, r.email)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #FED7AA', background: '#FFF7ED', color: '#C2410C', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="ti ti-key" style={{ fontSize: 12 }} />
                          </button>
                        )}
                        <button title="Delete" disabled={busyId === r._id} onClick={() => handleDelete(r._id, r.fullName)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="ti ti-trash" style={{ fontSize: 12 }} />
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
        {meta && meta.pages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Page {page} of {meta.pages} · {meta.total} total</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ ...S.btnGhost, padding: '6px 12px', fontSize: 12 }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <button style={{ ...S.btnPri, padding: '6px 12px', fontSize: 12 }}>{page}</button>
              <button style={{ ...S.btnGhost, padding: '6px 12px', fontSize: 12 }} disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Batch Modal */}
      {createOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => { if (!createBusy) resetCreate(); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,23,42,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>Create Workshop Batch</h3>
                <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 800, color: '#64748B' }}>Selected Trainees: {approvedSelectedCount}</div>
              </div>
              <button onClick={() => resetCreate()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748B', flexShrink: 0 }}>×</button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Batch Name *</div>
                  <input style={S.input} value={form.batchName} onChange={e => setForm(f => ({ ...f, batchName: e.target.value }))} placeholder="e.g. AI Boot-Up Batch 01" />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Batch Code *</div>
                  <input style={S.input} value={form.batchCode} onChange={e => setForm(f => ({ ...f, batchCode: e.target.value }))} placeholder="e.g. AIB-001" />
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Workshop *</div>
                  <input style={S.input} disabled value={form.workshopId || (workshopIdFromSelection || '')} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Trainer *</div>
                  <select
                    style={S.input}
                    value={form.trainerId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const t = trainerList.find((tr) => String(tr._id) === String(id));
                      setForm((f) => ({ ...f, trainerId: id, trainer: t?.name || '' }));
                    }}
                  >
                    <option value="">{trainerListStatus === 'loading' ? 'Loading trainers…' : 'Select trainer'}</option>
                    {trainerList.map((t) => (
                      <option key={t._id} value={t._id}>{t.name}{t.email ? ` (${t.email})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Start Date *</div>
                   <input style={S.input} type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} min={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>End Date</div>
                   <input style={S.input} type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} min={form.startDate || new Date().toISOString().split('T')[0]} />
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Start Time</div>
                  <input style={S.input} type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>End Time</div>
                  <input style={S.input} type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Mode</div>
                  <select style={S.input} value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Capacity *</div>
                  <input
                    style={S.input}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    type="text"
                    value={form.capacity}
                    onChange={(e) => {
                      const next = e.target.value;
                      // Allow empty; otherwise only whole positive digits
                      if (next === '') {
                        setForm(f => ({ ...f, capacity: '' }));
                        return;
                      }
                      if (!/^\d+$/.test(next)) return;
                      // prevent 0
                      if (Number(next) <= 0) return;
                      setForm(f => ({ ...f, capacity: next }));
                    }}
                    placeholder="e.g. 30"
                  />

                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                  <select style={S.input} value={form.batchStatus} onChange={e => setForm(f => ({ ...f, batchStatus: e.target.value }))}>
                    {['Draft','Scheduled','Active','Completed','Cancelled','Archived'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
                  <textarea style={{ ...S.input, minHeight: 90, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
                </div>
              </div>

              <div style={{ marginTop: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>Selected Trainees</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedApprovedRegs.map(r => (
                    <span key={r._id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 999, padding: '4px 10px', fontSize: 12.5, fontWeight: 800, color: '#334155' }}>
                      {r.fullName}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
              <button style={S.btnGhost} onClick={() => resetCreate()} disabled={createBusy}>Cancel</button>
              <button style={{ ...S.btnPri, background: '#1E3A5F', opacity: createBusy ? 0.7 : 1 }} onClick={handleCreateBatch} disabled={createBusy}>
                {createBusy ? 'Creating...' : 'Create Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Temp Password Modal (dev mode only) ── */}
      {tempPwModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }} onClick={() => setTempPwModal(null)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(15,23,42,0.3)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{
              background: 'linear-gradient(135deg,#065F46,#047857)',
              padding: '24px 24px 20px',
              textAlign: 'center',
            }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <i className="ti ti-user-check" style={{ fontSize: 22, color: '#fff' }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>Workshop Trainee Account Created</h3>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                Development Mode · Temporary Password
              </p>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Full Name</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{tempPwModal.fullName}</div>
              </div>

              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{tempPwModal.email}</div>
              </div>

              <div style={{ background: '#FFFBEB', border: '2px solid #F59E0B', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Temporary Password</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#92400E', fontFamily: 'monospace', letterSpacing: '2px', textAlign: 'center' }}>
                  {tempPwModal.temporaryPassword}
                </div>
                <p style={{ fontSize: 11, color: '#D97706', margin: '8px 0 0', textAlign: 'center' }}>
                  ⚠ Trainee must change this password on first login
                </p>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(tempPwModal.temporaryPassword);
                  toast.success('Password copied to clipboard!');
                }}
                style={{
                  width: '100%', padding: '12px', background: '#1E3A5F', color: '#fff',
                  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                }}
              >
                <i className="ti ti-copy" style={{ fontSize: 16 }} />
                Copy Password
              </button>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid #E2E8F0', textAlign: 'center' }}>
              <button
                onClick={() => setTempPwModal(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewReg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setViewReg(null)}>

          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(15,23,42,0.3)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>Registration Details</h3>
              <button onClick={() => setViewReg(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748B' }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['Full Name', viewReg.fullName],
                ['Email', viewReg.email],
                ['Phone', viewReg.phone],
                ['WhatsApp', viewReg.whatsapp],
                ['Workshop', viewReg.workshopName || viewReg.workshopId?.title],
                ['College', viewReg.college],
                ['Qualification', viewReg.qualification],
                ['City', viewReg.city],
                ['State', viewReg.state],
                ['Experience', viewReg.experience],
                ['LinkedIn', viewReg.linkedin],
                ['GitHub', viewReg.github],
                ['Status', viewReg.registrationStatus],
                ['Date', fmt(viewReg.registrationDate || viewReg.createdAt)],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', wordBreak: 'break-all' }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {viewReg.registrationStatus !== 'Approved' && (
                <button style={{ ...S.btnPri, background: '#15803D' }} onClick={() => { handleStatusUpdate(viewReg._id, 'Approved', viewReg.fullName, viewReg.email); setViewReg(null); }}>Approve</button>
              )}
              {viewReg.registrationStatus !== 'Rejected' && (
                <button style={{ ...S.btnPri, background: '#DC2626' }} onClick={() => { handleStatusUpdate(viewReg._id, 'Rejected'); setViewReg(null); }}>Reject</button>
              )}
              <button style={S.btnGhost} onClick={() => setViewReg(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
