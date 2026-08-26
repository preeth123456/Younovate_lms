import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

const authCfg = (getState) => {
  const token = getState().auth?.token || localStorage.getItem('token') || '';
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const errMsg = (err) => err.response?.data?.message || err.message || 'Request failed';

// ── LMS Thunks ────────────────────────────────────────────────────────────────

export const fetchTraineeDashboard = createAsyncThunk(
  'trainee/fetchTraineeDashboard',
  async (_, { getState, rejectWithValue }) => {
    try {
      const res = await axios.get(`${API}/api/trainee/dashboard`, authCfg(getState));
      return res.data;
    } catch (err) {
      return rejectWithValue(errMsg(err));
    }
  }
);

export const fetchMyLmsSessions = createAsyncThunk(
  'trainee/fetchMyLmsSessions',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainee/sessions`, authCfg(getState));
      return data.sessions || [];
    } catch (err) {
      return rejectWithValue(errMsg(err));
    }
  }
);

// ── Workshop Thunks ───────────────────────────────────────────────────────────

export const fetchMyWorkshopBatches = createAsyncThunk(
  'trainee/fetchMyWorkshopBatches',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainee/workshop-batches`, authCfg(getState));
      return data.batches || [];
    } catch (err) {
      return rejectWithValue(errMsg(err));
    }
  }
);

export const fetchMyWorkshopSessions = createAsyncThunk(
  'trainee/fetchMyWorkshopSessions',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainee/workshop-sessions`, { ...authCfg(getState), params });
      return data.sessions || [];
    } catch (err) {
      return rejectWithValue(errMsg(err));
    }
  }
);

export const joinWorkshopSession = createAsyncThunk(
  'trainee/joinWorkshopSession',
  async (sessionId, { getState, dispatch, rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/trainee/workshop-sessions/${sessionId}/join`, {}, authCfg(getState));
      dispatch(fetchMyWorkshopAttendance());
      return { sessionId, ...data };
    } catch (err) {
      return rejectWithValue(errMsg(err));
    }
  }
);

export const leaveWorkshopSession = createAsyncThunk(
  'trainee/leaveWorkshopSession',
  async (sessionId, { getState, dispatch, rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/trainee/workshop-sessions/${sessionId}/leave`, {}, authCfg(getState));
      dispatch(fetchMyWorkshopAttendance());
      return data;
    } catch (err) {
      return rejectWithValue(errMsg(err));
    }
  }
);

export const fetchMyWorkshopAttendance = createAsyncThunk(
  'trainee/fetchMyWorkshopAttendance',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainee/workshop-attendance`, authCfg(getState));
      return data;
    } catch (err) {
      return rejectWithValue(errMsg(err));
    }
  }
);

export const fetchMyWorkshopCertificates = createAsyncThunk(
  'trainee/fetchMyWorkshopCertificates',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainee/workshop-certificates`, authCfg(getState));
      return data.certificates || [];
    } catch (err) {
      return rejectWithValue(errMsg(err));
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const traineeSlice = createSlice({
  name: 'trainee',
  initialState: {
    dashboard: null,
    status: 'idle',
    error: null,
    // LMS
    lmsSessions: [],
    lmsStatus: 'idle',
    lmsError: null,
    // Workshop
    workshopBatches:      [],
    workshopSessions:     [],
    workshopAttendance:   { records: [], stats: {} },
    workshopCertificates: [],
    workshopStatus:       'idle',
    workshopError:        null,
    // Live connection (token + url for active workshop session)
    liveConnection: null,
    joinStatus:     'idle',
    joinError:      null,
  },
  reducers: {
    clearWorkshopLive(state) {
      state.liveConnection = null;
      state.joinStatus     = 'idle';
      state.joinError      = null;
    },
    clearJoinError(state) {
      state.joinError  = null;
      state.joinStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    // Dashboard
    builder
      .addCase(fetchTraineeDashboard.pending,   (s) => { s.status = 'loading'; s.error = null; })
      .addCase(fetchTraineeDashboard.fulfilled, (s, a) => { s.status = 'succeeded'; s.dashboard = a.payload; })
      .addCase(fetchTraineeDashboard.rejected,  (s, a) => { s.status = 'failed'; s.error = a.payload; });

    // LMS sessions
    builder
      .addCase(fetchMyLmsSessions.pending,   (s) => { s.lmsStatus = 'loading'; s.lmsError = null; })
      .addCase(fetchMyLmsSessions.fulfilled, (s, a) => { s.lmsStatus = 'succeeded'; s.lmsSessions = a.payload; })
      .addCase(fetchMyLmsSessions.rejected,  (s, a) => { s.lmsStatus = 'failed'; s.lmsError = a.payload; });

    // Workshop batches
    builder
      .addCase(fetchMyWorkshopBatches.pending,   (s) => { s.workshopStatus = 'loading'; })
      .addCase(fetchMyWorkshopBatches.fulfilled, (s, a) => { s.workshopStatus = 'succeeded'; s.workshopBatches = a.payload; })
      .addCase(fetchMyWorkshopBatches.rejected,  (s, a) => { s.workshopStatus = 'failed'; s.workshopError = a.payload; });

    // Workshop sessions
    builder
      .addCase(fetchMyWorkshopSessions.fulfilled, (s, a) => { s.workshopSessions = a.payload; });

    // Join
    builder
      .addCase(joinWorkshopSession.pending,   (s) => { s.joinStatus = 'loading'; s.joinError = null; })
      .addCase(joinWorkshopSession.fulfilled, (s, a) => {
        s.joinStatus = 'succeeded';
        s.liveConnection = { token: a.payload.token, url: a.payload.url, roomName: a.payload.roomName, sessionId: a.payload.sessionId };
      })
      .addCase(joinWorkshopSession.rejected,  (s, a) => { s.joinStatus = 'failed'; s.joinError = a.payload; });

    // Leave
    builder
      .addCase(leaveWorkshopSession.fulfilled, (s) => { s.liveConnection = null; });

    // Attendance
    builder
      .addCase(fetchMyWorkshopAttendance.fulfilled, (s, a) => {
        s.workshopAttendance = { records: a.payload.records || [], stats: a.payload.stats || {} };
      });

    // Certificates
    builder
      .addCase(fetchMyWorkshopCertificates.fulfilled, (s, a) => { s.workshopCertificates = a.payload; });
  },
});

export const { clearWorkshopLive, clearJoinError } = traineeSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectTraineeDashboard       = (s) => s.trainee.dashboard;
export const selectTraineeStatus          = (s) => s.trainee.status;
export const selectTraineeError           = (s) => s.trainee.error;
export const selectMyLmsSessions          = (s) => s.trainee.lmsSessions;
export const selectLmsStatus              = (s) => s.trainee.lmsStatus;
export const selectLmsError               = (s) => s.trainee.lmsError;
export const selectMyWorkshopBatches      = (s) => s.trainee.workshopBatches;
export const selectMyWorkshopSessions     = (s) => s.trainee.workshopSessions;
export const selectMyWorkshopAttendance   = (s) => s.trainee.workshopAttendance;
export const selectMyWorkshopCertificates = (s) => s.trainee.workshopCertificates;
export const selectWorkshopStatus         = (s) => s.trainee.workshopStatus;
export const selectWorkshopError          = (s) => s.trainee.workshopError;
export const selectTraineeLiveConnection  = (s) => s.trainee.liveConnection;
export const selectJoinStatus             = (s) => s.trainee.joinStatus;
export const selectJoinError              = (s) => s.trainee.joinError;

export default traineeSlice.reducer;
