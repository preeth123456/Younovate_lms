// src/features/workshops/workshopSessionsSlice.js
// Data layer for Admin Workshop Live Sessions page.
// Talks to /api/workshop-sessions — the canonical Session engine
// extended for Workshop context.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

const authCfg = (getState) => {
  const token = getState().auth?.token || '';
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const errMsg = (err, fallback) =>
  err.response?.data?.message || err.message || fallback;

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchWorkshopSessions = createAsyncThunk(
  'workshopSessions/fetch',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/workshop-sessions`, {
        ...authCfg(getState),
        params,
      });
      return data.sessions || [];
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Failed to fetch workshop sessions'));
    }
  }
);

export const fetchWorkshopBatchesForSchedule = createAsyncThunk(
  'workshopSessions/fetchBatches',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/workshops/batches`, {
        ...authCfg(getState),
        params: { limit: 200 },
      });
      return data.data?.batches || [];
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Failed to fetch workshop batches'));
    }
  }
);

export const createWorkshopSession = createAsyncThunk(
  'workshopSessions/create',
  async (payload, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/workshop-sessions`, payload, authCfg(getState));
      return data.session;
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Failed to create workshop session'));
    }
  }
);

export const updateWorkshopSession = createAsyncThunk(
  'workshopSessions/update',
  async ({ id, ...patch }, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.put(`${API}/api/workshop-sessions/${id}`, patch, authCfg(getState));
      return data.session;
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Failed to update workshop session'));
    }
  }
);

export const deleteWorkshopSession = createAsyncThunk(
  'workshopSessions/delete',
  async (id, { getState, rejectWithValue }) => {
    try {
      await axios.delete(`${API}/api/workshop-sessions/${id}`, authCfg(getState));
      return id;
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Failed to delete workshop session'));
    }
  }
);

export const fetchSessionParticipants = createAsyncThunk(
  'workshopSessions/fetchParticipants',
  async (sessionId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/workshop-sessions/${sessionId}/participants`, authCfg(getState));
      return { sessionId, participants: data.participants || [] };
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Failed to fetch participants'));
    }
  }
);

export const fetchSessionAttendanceWS = createAsyncThunk(
  'workshopSessions/fetchAttendance',
  async (sessionId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/workshop-sessions/${sessionId}/attendance`, authCfg(getState));
      return { sessionId, records: data.records || [] };
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Failed to fetch attendance'));
    }
  }
);

export const markAttendanceWS = createAsyncThunk(
  'workshopSessions/markAttendance',
  async ({ sessionId, participantId, status, attendedMinutes }, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/workshop-sessions/${sessionId}/attendance/mark`,
        { participantId, status, attendedMinutes },
        authCfg(getState)
      );
      return { sessionId, record: data.record };
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Failed to mark attendance'));
    }
  }
);

export const startWorkshopSession = createAsyncThunk(
  'workshopSessions/start',
  async (sessionId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/workshop-sessions/${sessionId}/start`, {}, authCfg(getState));
      return data.session;
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Failed to start session'));
    }
  }
);

export const endWorkshopSession = createAsyncThunk(
  'workshopSessions/end',
  async (sessionId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/workshop-sessions/${sessionId}/end`, {}, authCfg(getState));
      return data.session;
    } catch (err) {
      return rejectWithValue(errMsg(err, 'Failed to end session'));
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const slice = createSlice({
  name: 'workshopSessions',
  initialState: {
    sessions:     [],
    batches:      [],
    participants: {},   // { [sessionId]: [] }
    attendance:   {},   // { [sessionId]: [] }
    status:       'idle',
    batchStatus:  'idle',
    saveStatus:   'idle',
    error:        null,
    saveError:    null,
  },
  reducers: {
    clearWSSessionErrors(state) {
      state.error = null;
      state.saveError = null;
    },
  },
  extraReducers: (b) => {
    b
      .addCase(fetchWorkshopSessions.pending,   (s) => { s.status = 'loading'; s.error = null; })
      .addCase(fetchWorkshopSessions.fulfilled, (s, a) => { s.status = 'succeeded'; s.sessions = a.payload; })
      .addCase(fetchWorkshopSessions.rejected,  (s, a) => { s.status = 'failed'; s.error = a.payload; })

      .addCase(fetchWorkshopBatchesForSchedule.pending,   (s) => { s.batchStatus = 'loading'; })
      .addCase(fetchWorkshopBatchesForSchedule.fulfilled, (s, a) => { s.batchStatus = 'succeeded'; s.batches = a.payload; })
      .addCase(fetchWorkshopBatchesForSchedule.rejected,  (s) => { s.batchStatus = 'failed'; })

      .addCase(createWorkshopSession.pending,   (s) => { s.saveStatus = 'loading'; s.saveError = null; })
      .addCase(createWorkshopSession.fulfilled, (s, a) => {
        s.saveStatus = 'succeeded';
        if (a.payload?._id) s.sessions.unshift(a.payload);
      })
      .addCase(createWorkshopSession.rejected,  (s, a) => { s.saveStatus = 'failed'; s.saveError = a.payload; })

      .addCase(updateWorkshopSession.pending,   (s) => { s.saveStatus = 'loading'; s.saveError = null; })
      .addCase(updateWorkshopSession.fulfilled, (s, a) => {
        s.saveStatus = 'succeeded';
        const u = a.payload;
        if (u?._id) {
          const i = s.sessions.findIndex(x => x._id === u._id);
          if (i !== -1) s.sessions[i] = { ...s.sessions[i], ...u };
        }
      })
      .addCase(updateWorkshopSession.rejected,  (s, a) => { s.saveStatus = 'failed'; s.saveError = a.payload; })

      .addCase(deleteWorkshopSession.fulfilled, (s, a) => {
        s.sessions = s.sessions.filter(x => x._id !== a.payload);
      })

      .addCase(fetchSessionParticipants.fulfilled, (s, a) => {
        s.participants[a.payload.sessionId] = a.payload.participants;
      })

      .addCase(fetchSessionAttendanceWS.fulfilled, (s, a) => {
        s.attendance[a.payload.sessionId] = a.payload.records;
      })

      .addCase(markAttendanceWS.fulfilled, (s, a) => {
        const { sessionId, record } = a.payload;
        const list = s.attendance[sessionId] || [];
        const idx  = list.findIndex(r => r.studentId?.toString() === record.studentId?.toString());
        if (idx !== -1) list[idx] = record; else list.push(record);
        s.attendance[sessionId] = list;
      })

      .addCase(startWorkshopSession.fulfilled, (s, a) => {
        const u = a.payload;
        if (u?._id) {
          const i = s.sessions.findIndex(x => x._id === u._id);
          if (i !== -1) s.sessions[i] = { ...s.sessions[i], ...u };
        }
      })

      .addCase(endWorkshopSession.fulfilled, (s, a) => {
        const u = a.payload;
        if (u?._id) {
          const i = s.sessions.findIndex(x => x._id === u._id);
          if (i !== -1) s.sessions[i] = { ...s.sessions[i], ...u };
        }
      });
  },
});

export const { clearWSSessionErrors } = slice.actions;

// Selectors
export const selectWorkshopSessions    = (s) => s.workshopSessions.sessions;
export const selectWSSessionStatus     = (s) => s.workshopSessions.status;
export const selectWSSessionError      = (s) => s.workshopSessions.error;
export const selectWSBatches           = (s) => s.workshopSessions.batches;
export const selectWSBatchStatus       = (s) => s.workshopSessions.batchStatus;
export const selectWSSaveStatus        = (s) => s.workshopSessions.saveStatus;
export const selectWSSaveError         = (s) => s.workshopSessions.saveError;
export const selectWSParticipants      = (sessionId) => (s) => s.workshopSessions.participants[sessionId] || [];
export const selectWSAttendance        = (sessionId) => (s) => s.workshopSessions.attendance[sessionId] || [];

export default slice.reducer;
