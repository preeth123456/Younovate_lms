// src/features/admin/adminSessionsSlice.js
//
// ADMIN session slice — the data layer behind /admin/sessions.
// Talks ONLY to admin-authorised endpoints, so it never collides with the
// trainer-side `features/session/sessionsSlice.js` (different file, different
// store key `adminSessions`, different /api/* routes).
//
//   GET    /api/sessions                       → list ALL sessions (admin = unfiltered)
//   POST   /api/sessions                       → create
//   PUT    /api/sessions/:id                   → update (reschedule / cancel / edit)
//   DELETE /api/sessions/:id                   → delete
//   GET    /api/admin/users-by-role/trainer    → trainer options
//   GET    /api/admin/users-by-role/trainee    → trainee options
//   GET    /api/admin/batches                  → batch options
//
// NOTE: uses process.env.REACT_APP_API_BASE_URL (CRA). Empty string falls back
// to the dev proxy in package.json — NEVER import.meta.env (that throws under
// react-scripts/webpack).

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

//const API = String(process.env.REACT_APP_API_BASE_URL || '').replace(/\/+$/, '');

const API = API_BASE_URL;

const authHeader = (getState) => {
  const token = getState().auth?.token || '';
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

// Tolerate the different response shapes the API returns.
const asArray = (p, key) =>
  Array.isArray(p)               ? p :
  Array.isArray(p?.[key])        ? p[key] :
  Array.isArray(p?.data)         ? p.data :
  Array.isArray(p?.data?.[key])  ? p.data[key] : [];

const oneSession = (p) => p?.session || p?.data || p;

const errMsg = (err, fallback) =>
  err.response?.data?.message || err.message || fallback;

// ═══════════════════════════════════════════════════════════════════════════════
// THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/sessions  → { success, sessions, total, page }
// Passes sessionType=LMS to ensure Workshop sessions are never returned.
export const fetchAdminSessions = createAsyncThunk(
  'adminSessions/fetchAdminSessions',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/sessions`, {
        ...authHeader(getState),
        params: { limit: 200, sessionType: 'LMS' },
      });
      return asArray(data, 'sessions');
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Failed to fetch sessions'));
    }
  }
);

// Trainers + batches + trainees for the form pickers, in one resilient call.
export const fetchPickers = createAsyncThunk(
  'adminSessions/fetchPickers',
  async (_, { getState }) => {
    const cfg = authHeader(getState);
    const [tRes, bRes, trRes] = await Promise.allSettled([
      axios.get(`${API}/api/admin/users-by-role/trainer`, cfg),
      axios.get(`${API}/api/admin/batches`, { ...cfg, params: { limit: 200 } }),
      axios.get(`${API}/api/admin/users-by-role/trainee`, cfg),
    ]);
    return {
      trainers: tRes.status  === 'fulfilled' ? asArray(tRes.value.data, 'users')    : [],
      batches:  bRes.status  === 'fulfilled' ? asArray(bRes.value.data, 'batches')  : [],
      trainees: trRes.status === 'fulfilled' ? asArray(trRes.value.data, 'users')   : [],
    };
  }
);

// POST /api/sessions  → { success, session }
export const createSession = createAsyncThunk(
  'adminSessions/createSession',
  async (payload, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/sessions`, { ...payload, sessionType: 'LMS' }, authHeader(getState));
      return oneSession(data);
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Could not create the session'));
    }
  }
);

// PUT /api/sessions/:id  → { success, session }
// Also used for "cancel" → updateSession({ id, status: 'cancelled' }).
export const updateSession = createAsyncThunk(
  'adminSessions/updateSession',
  async ({ id, ...patch }, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.put(`${API}/api/sessions/${id}`, patch, authHeader(getState));
      return oneSession(data);
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Could not update the session'));
    }
  }
);

// DELETE /api/sessions/:id  → { success, message }
export const deleteSession = createAsyncThunk(
  'adminSessions/deleteSession',
  async (id, { getState, rejectWithValue }) => {
    try {
      await axios.delete(`${API}/api/sessions/${id}`, authHeader(getState));
      return id;
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Could not delete the session'));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  sessions: [],
  status: 'idle',          // idle | loading | succeeded | failed
  error: null,

  trainers: [],
  batches: [],
  trainees: [],
  pickersStatus: 'idle',

  saveStatus: 'idle',      // shared by create + update
  saveError: null,

  deleteStatus: 'idle',
  deleteError: null,
};

const adminSessionsSlice = createSlice({
  name: 'adminSessions',
  initialState,
  reducers: {
    clearAdminSessionErrors(state) {
      state.error = null;
      state.saveError = null;
      state.deleteError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── list ──
      .addCase(fetchAdminSessions.pending,   (s) => { s.status = 'loading'; s.error = null; })
      .addCase(fetchAdminSessions.fulfilled, (s, a) => { s.status = 'succeeded'; s.sessions = a.payload; })
      .addCase(fetchAdminSessions.rejected,  (s, a) => { s.status = 'failed'; s.error = a.payload; })

      // ── pickers ──
      .addCase(fetchPickers.pending,   (s) => { s.pickersStatus = 'loading'; })
      .addCase(fetchPickers.fulfilled, (s, a) => {
        s.pickersStatus = 'succeeded';
        s.trainers = a.payload.trainers;
        s.batches  = a.payload.batches;
        s.trainees = a.payload.trainees;
      })
      .addCase(fetchPickers.rejected,  (s) => { s.pickersStatus = 'failed'; })

      // ── create ──
      .addCase(createSession.pending,   (s) => { s.saveStatus = 'loading'; s.saveError = null; })
      .addCase(createSession.fulfilled, (s, a) => {
        s.saveStatus = 'succeeded';
        if (a.payload?._id) s.sessions.unshift(a.payload);
      })
      .addCase(createSession.rejected,  (s, a) => { s.saveStatus = 'failed'; s.saveError = a.payload; })

      // ── update / cancel ──
      .addCase(updateSession.pending,   (s) => { s.saveStatus = 'loading'; s.saveError = null; })
      .addCase(updateSession.fulfilled, (s, a) => {
        s.saveStatus = 'succeeded';
        const u = a.payload;
        if (u?._id) {
          const i = s.sessions.findIndex((x) => x._id === u._id);
          if (i !== -1) s.sessions[i] = { ...s.sessions[i], ...u };
        }
      })
      .addCase(updateSession.rejected,  (s, a) => { s.saveStatus = 'failed'; s.saveError = a.payload; })

      // ── delete ──
      .addCase(deleteSession.pending,   (s) => { s.deleteStatus = 'loading'; s.deleteError = null; })
      .addCase(deleteSession.fulfilled, (s, a) => {
        s.deleteStatus = 'succeeded';
        s.sessions = s.sessions.filter((x) => x._id !== a.payload);
      })
      .addCase(deleteSession.rejected,  (s, a) => { s.deleteStatus = 'failed'; s.deleteError = a.payload; });
  },
});

export const { clearAdminSessionErrors } = adminSessionsSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectAdminSessions       = (s) => s.adminSessions.sessions;
export const selectAdminSessionsStatus = (s) => s.adminSessions.status;
export const selectAdminSessionsError  = (s) => s.adminSessions.error;
export const selectTrainerOptions      = (s) => s.adminSessions.trainers;
export const selectBatchOptions        = (s) => s.adminSessions.batches;
export const selectTraineeOptions      = (s) => s.adminSessions.trainees;
export const selectSaveStatus          = (s) => s.adminSessions.saveStatus;
export const selectSaveError           = (s) => s.adminSessions.saveError;
export const selectDeleteStatus        = (s) => s.adminSessions.deleteStatus;
export const selectDeleteError         = (s) => s.adminSessions.deleteError;

export default adminSessionsSlice.reducer;