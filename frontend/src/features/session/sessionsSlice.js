import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

// react-scripts (CRA) build → use process.env.REACT_APP_*  (import.meta.env is Vite-only
// and throws under webpack). '' falls back to the CRA dev proxy in package.json.
//const API = process.env.REACT_APP_API_BASE_URL || '';
const API = API_BASE_URL;

// ─── Auth header — reads from state.auth.token (same as adminSlice) ───────────
const authHeader = (getState) => ({
  headers: { Authorization: `Bearer ${getState().auth.token}` },
});

// ─── Payload helpers ──────────────────────────────────────────────────────────
const normArray = (payload, key) =>
  Array.isArray(payload)        ? payload :
  Array.isArray(payload?.[key]) ? payload[key] :
  Array.isArray(payload?.data)  ? payload.data : [];

const oneSession = (payload) =>
  payload?.session || payload?.data || payload;

// ═══════════════════════════════════════════════════════════════════════════════
// THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/trainer/sessions?status=
// Response: { success, sessions: [{ _id, title, moduleId, batchId:{name}, scheduledAt, status }] }
export const fetchSessions = createAsyncThunk(
  'sessions/fetchSessions',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainer/sessions`, {
        ...authHeader(getState),
        params,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to fetch sessions');
    }
  }
);

// GET /api/batches   (no limit → backend default limit=0 → returns ALL batches)
// Response: { success, data: { batches:[{ _id, name, status, trainerId }], meta:{total,page,limit,pages} } }
// Trainers are auto-scoped server-side (filter.trainerId = req.user._id)
export const fetchBatches = createAsyncThunk(
  'sessions/fetchBatches',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/batches`, {
        ...authHeader(getState),
        // No limit param — backend default is limit=0 = return all
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to fetch batches');
    }
  }
);

// POST /api/trainer/sessions
// Body:     { batch, moduleId, sessionType, scheduledAt, recordingLink?, title? }
// Response: { success: true, session: { _id, title, moduleId, status:'scheduled', scheduledAt, batchId:{name} } }
export const createSession = createAsyncThunk(
  'sessions/createSession',
  async (sessionData, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/trainer/sessions`,
        sessionData,
        authHeader(getState)
      );
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to create session');
    }
  }
);

// PUT /api/trainer/sessions/:id
// Body:     { title?, scheduledAt?, status?, recordingLink? }
// Response: { success: true, session: { ...updatedSession } }
export const updateSession = createAsyncThunk(
  'sessions/updateSession',
  async ({ id, ...sessionData }, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.put(
        `${API}/api/trainer/sessions/${id}`,
        sessionData,
        authHeader(getState)
      );
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to update session');
    }
  }
);

// POST /api/trainer/sessions/:id/start  → trainer "Go Live"
// Response: { success, token, url, roomName, role:'trainer', session }
// We stash the LiveKit connection so <TrainerLiveControls> can drop straight
// into <LiveRoom canPublish />, and we flip the session row to 'live'.
export const startSession = createAsyncThunk(
  'sessions/startSession',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/trainer/sessions/${id}/start`,
        {},
        authHeader(getState)
      );
      return {
        id,
        token:    data.token,
        url:      data.url,
        roomName: data.roomName,
        role:     data.role || 'trainer',
        session:  data.session,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to go live');
    }
  }
);

// PUT /api/trainer/sessions/:id/end
// Response: { success: true, session: { ...session, status:'completed' } }
export const endSession = createAsyncThunk(
  'sessions/endSession',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.put(
        `${API}/api/trainer/sessions/${id}/end`,
        {},
        authHeader(getState)
      );
      return { id, data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to end session');
    }
  }
);

// DELETE /api/trainer/sessions/:id
// Response: { success: true, message: 'Session deleted' }
export const deleteSession = createAsyncThunk(
  'sessions/deleteSession',
  async (id, { getState, rejectWithValue }) => {
    try {
      await axios.delete(`${API}/api/trainer/sessions/${id}`, authHeader(getState));
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to delete session');
    }
  }
);

// POST /api/sessions/:id/join  [trainee]
// Response: { success, token, url, roomName, role:'student' }
export const joinSession = createAsyncThunk(
  'sessions/joinSession',
  async (sessionId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/sessions/${sessionId}/join`,
        {},
        authHeader(getState)
      );
      return { sessionId, ...data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to join session');
    }
  }
);

// POST /api/trainee/sessions/:id/attendance/leave  [trainee]
export const leaveSession = createAsyncThunk(
  'sessions/leaveSession',
  async (sessionId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/trainee/sessions/${sessionId}/attendance/leave`,
        {},
        authHeader(getState)
      );
      return { sessionId, data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to leave session');
    }
  }
);

// POST http://localhost:8088/api/attendance/mark
// Body:     { sessionId, traineeId?, status?: 'present'|'absent' }
// Response: { success: true }
export const markAttendance = createAsyncThunk(
  'sessions/markAttendance',
  async ({ sessionId, traineeId, status = 'present' }, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/attendance/mark`,
        { sessionId, traineeId, status },
        authHeader(getState)
      );
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to mark attendance');
    }
  }
);





// ═══════════════════════════════════════════════════════════════════════════════
// SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const sessionsSlice = createSlice({
  name: 'sessions',

  initialState: {
    // Sessions list
    sessions:      [],
    status:        'idle',   // idle | loading | succeeded | failed
    error:         null,

    // Batches list  (GET /api/batches)
    batches:       [],
    batchesStatus: 'idle',
    batchesError:  null,

    // Create session
    createStatus:  'idle',
    createError:   null,

    // Update session
    updateStatus:  'idle',
    updateError:   null,

    // End session
    endStatus:     'idle',
    endError:      null,

    // Go Live (start) + active trainer LiveKit connection
    startStatus:       'idle',   // idle | loading | succeeded | failed
    startError:        null,
    trainerConnection: null,     // { id, token, url, roomName, role }

    // Delete session
    deleteStatus:  'idle',
    deleteError:   null,

    // Mark attendance
    markStatus:    'idle',
    markError:     null,

    // Join / leave
    joinStatus:    'idle',
    joinError:     null,
    leaveStatus:   'idle',
    leaveError:    null,
  },

  reducers: {
    clearSessionErrors(state) {
      state.error       = null;
      state.createError = null;
      state.updateError = null;
      state.endError    = null;
      state.deleteError = null;
      state.markError   = null;
      state.batchesError= null;
    },
    resetCreateStatus(state) {
      state.createStatus = 'idle';
      state.createError  = null;
    },
    clearTrainerConnection(state) {
      state.trainerConnection = null;
      state.startStatus       = 'idle';
      state.startError        = null;
    },
  },

  extraReducers: (builder) => {

    // ── fetchSessions ──────────────────────────────────────────────────────────
    builder
      .addCase(fetchSessions.pending,   (s)    => { s.status = 'loading';   s.error = null; })
      .addCase(fetchSessions.fulfilled, (s, a) => {
        s.status   = 'succeeded';
        s.sessions = normArray(a.payload, 'sessions');
      })
      .addCase(fetchSessions.rejected,  (s, a) => { s.status = 'failed';    s.error = a.payload; });

    // ── fetchBatches ───────────────────────────────────────────────────────────
    // Response: { success, data: { batches:[{_id,name}], meta:{total,page,limit,pages} } }
    builder
      .addCase(fetchBatches.pending,   (s)    => { s.batchesStatus = 'loading';   s.batchesError = null; })
      .addCase(fetchBatches.fulfilled, (s, a) => {
        s.batchesStatus = 'succeeded';
        s.batches = a.payload?.data?.batches || [];
      })
      .addCase(fetchBatches.rejected,  (s, a) => { s.batchesStatus = 'failed'; s.batchesError = a.payload; });

    // ── createSession ──────────────────────────────────────────────────────────
    // Response: { success: true, session: { _id, title, ... } }
    builder
      .addCase(createSession.pending,   (s)    => { s.createStatus = 'loading';   s.createError = null; })
      .addCase(createSession.fulfilled, (s, a) => {
        s.createStatus = 'succeeded';
        const sess = oneSession(a.payload);
        if (sess?._id) s.sessions.unshift(sess);
      })
      .addCase(createSession.rejected,  (s, a) => { s.createStatus = 'failed'; s.createError = a.payload; });

    // ── updateSession ──────────────────────────────────────────────────────────
    // Response: { success: true, session: { ...updated } }
    builder
      .addCase(updateSession.pending,   (s)    => { s.updateStatus = 'loading';   s.updateError = null; })
      .addCase(updateSession.fulfilled, (s, a) => {
        s.updateStatus = 'succeeded';
        const updated = oneSession(a.payload);
        if (updated?._id) {
          const i = s.sessions.findIndex(x => x._id === updated._id);
          if (i !== -1) s.sessions[i] = updated;
        }
      })
      .addCase(updateSession.rejected,  (s, a) => { s.updateStatus = 'failed'; s.updateError = a.payload; });

    // ── startSession (Go Live) ────────────────────────────────────────────────
    builder
      .addCase(startSession.pending,   (s)    => { s.startStatus = 'loading'; s.startError = null; })
      .addCase(startSession.fulfilled, (s, a) => {
        s.startStatus = 'succeeded';
        const { id, token, url, roomName, role, session } = a.payload;
        s.trainerConnection = { id, token, url, roomName, role };
        // flip the row to live so the UI shows "Enter Room / End"
        const i = s.sessions.findIndex((x) => x._id === id);
        if (i !== -1) s.sessions[i] = session?._id ? session : { ...s.sessions[i], status: 'live' };
      })
      .addCase(startSession.rejected,  (s, a) => { s.startStatus = 'failed'; s.startError = a.payload; });

    // ── endSession ─────────────────────────────────────────────────────────────
    // Response: { success: true, session: { ...session, status:'completed' } }
    builder
      .addCase(endSession.pending,   (s)    => { s.endStatus = 'loading';   s.endError = null; })
      .addCase(endSession.fulfilled, (s, a) => {
        s.endStatus = 'succeeded';
        s.trainerConnection = null;        // leave the room on end
        const { id, data } = a.payload;
        const updated = oneSession(data);
        const i = s.sessions.findIndex(x => x._id === (updated?._id || id));
        if (i !== -1) {
          s.sessions[i] = updated?._id
            ? updated
            : { ...s.sessions[i], status: 'completed' };
        }
      })
      .addCase(endSession.rejected,  (s, a) => { s.endStatus = 'failed'; s.endError = a.payload; });

    // ── deleteSession ──────────────────────────────────────────────────────────
    builder
      .addCase(deleteSession.pending,   (s)    => { s.deleteStatus = 'loading';   s.deleteError = null; })
      .addCase(deleteSession.fulfilled, (s, a) => {
        s.deleteStatus = 'succeeded';
        s.sessions = s.sessions.filter(x => x._id !== a.payload);
      })
      .addCase(deleteSession.rejected,  (s, a) => { s.deleteStatus = 'failed'; s.deleteError = a.payload; });

    // ── markAttendance ─────────────────────────────────────────────────────────
    builder
      .addCase(markAttendance.pending,   (s)    => { s.markStatus = 'loading';   s.markError = null; })
      .addCase(markAttendance.fulfilled, (s)    => { s.markStatus = 'succeeded'; })
      .addCase(markAttendance.rejected,  (s, a) => { s.markStatus = 'failed';    s.markError = a.payload; });

    // ── joinSession ────────────────────────────────────────────────────────────
    builder
      .addCase(joinSession.pending,   (s)    => { s.joinStatus = 'loading';   s.joinError = null; })
      .addCase(joinSession.fulfilled, (s, a) => {
        s.joinStatus = 'succeeded';
        const { sessionId, token, url, roomName, role } = a.payload;
        s.trainerConnection = { id: sessionId, token, url, roomName, role };
        const i = s.sessions.findIndex(x => x._id === sessionId);
        if (i !== -1) s.sessions[i].status = 'live';
      })
      .addCase(joinSession.rejected,  (s, a) => { s.joinStatus = 'failed';    s.joinError = a.payload; });

    // ── leaveSession ───────────────────────────────────────────────────────────
    builder
      .addCase(leaveSession.pending,   (s)    => { s.leaveStatus = 'loading';   s.leaveError = null; })
      .addCase(leaveSession.fulfilled, (s)    => { s.leaveStatus = 'succeeded'; s.trainerConnection = null; })
      .addCase(leaveSession.rejected,  (s, a) => { s.leaveStatus = 'failed';    s.leaveError = a.payload; });

  },   // ← extraReducers closes here
});   // ← createSlice closes here

// ─── Actions ──────────────────────────────────────────────────────────────────
export const { clearSessionErrors, resetCreateStatus, clearTrainerConnection } = sessionsSlice.actions;

// ─── Selectors ──────────────────────────────────────────────────────────────────
export const selectAllSessions    = (s) => s.sessions.sessions;
export const selectSessionsStatus = (s) => s.sessions.status;
export const selectSessionsError  = (s) => s.sessions.error;
export const selectBatches        = (s) => s.sessions.batches;
export const selectBatchesStatus  = (s) => s.sessions.batchesStatus;
export const selectCreateStatus   = (s) => s.sessions.createStatus;
export const selectCreateError    = (s) => s.sessions.createError;
export const selectUpdateStatus   = (s) => s.sessions.updateStatus;
export const selectUpdateError    = (s) => s.sessions.updateError;
export const selectEndStatus      = (s) => s.sessions.endStatus;
export const selectEndError       = (s) => s.sessions.endError;
export const selectStartStatus        = (s) => s.sessions.startStatus;
export const selectStartError         = (s) => s.sessions.startError;
export const selectTrainerConnection  = (s) => s.sessions.trainerConnection;
export const selectDeleteStatus   = (s) => s.sessions.deleteStatus;
export const selectMarkStatus     = (s) => s.sessions.markStatus;
export const selectMarkError      = (s) => s.sessions.markError;
export const selectJoinStatus     = (s) => s.sessions.joinStatus;
export const selectJoinError      = (s) => s.sessions.joinError;
export const selectLeaveStatus    = (s) => s.sessions.leaveStatus;
export const selectLeaveError     = (s) => s.sessions.leaveError;

export default sessionsSlice.reducer;

// ─── Store setup ──────────────────────────────────────────────────────────────
// import sessionsReducer from './features/session/sessionsSlice';
// configureStore({
//   reducer: { auth: authReducer, sessions: sessionsReducer, admin: adminReducer }
// })