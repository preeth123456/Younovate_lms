import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;
const auth = (getState) => ({
  headers: { Authorization: `Bearer ${getState().auth.token}` },
});

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchTrainerWorkshops = createAsyncThunk(
  'trainerWorkshop/fetchAll',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const q = params.status ? `?status=${params.status}` : '';
      const { data } = await axios.get(`${API}/api/trainer/workshops${q}`, auth(getState));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchWorkshopStats = createAsyncThunk(
  'trainerWorkshop/fetchStats',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainer/workshops/stats`, auth(getState));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchWorkshopDetail = createAsyncThunk(
  'trainerWorkshop/fetchDetail',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainer/workshops/${id}`, auth(getState));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// Start a Workshop SESSION (Session model, returns LiveKit token)
export const startWorkshop = createAsyncThunk(
  'trainerWorkshop/start',
  async (sessionId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/workshop-sessions/${sessionId}/start`, {}, auth(getState));
      return data; // { success, token, url, roomName, role, session }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// Join an already-live Workshop SESSION (returns LiveKit token)
export const joinWorkshopSession = createAsyncThunk(
  'trainerWorkshop/join',
  async (sessionId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/workshop-sessions/${sessionId}/join`, {}, auth(getState));
      return { sessionId, ...data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// End a Workshop SESSION
export const endWorkshop = createAsyncThunk(
  'trainerWorkshop/end',
  async (sessionId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/workshop-sessions/${sessionId}/end`, {}, auth(getState));
      return data; // { success, session }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchParticipants = createAsyncThunk(
  'trainerWorkshop/fetchParticipants',
  async (batchId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainer/workshops/my-batches/${batchId}/participants`, auth(getState));
      return { workshopId: batchId, data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchWorkshopAttendance = createAsyncThunk(
  'trainerWorkshop/fetchAttendance',
  async (workshopId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainer/workshops/${workshopId}/attendance`, auth(getState));
      return { workshopId, data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const markWorkshopAttendance = createAsyncThunk(
  'trainerWorkshop/markAttendance',
  async ({ workshopId, studentId, attendanceStatus, joinTime, leaveTime, duration }, { getState, dispatch, rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/trainer/workshops/${workshopId}/attendance`,
        { studentId, attendanceStatus, joinTime, leaveTime, duration },
        auth(getState)
      );
      dispatch(fetchWorkshopAttendance(workshopId));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchWorkshopResources = createAsyncThunk(
  'trainerWorkshop/fetchResources',
  async (workshopId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainer/workshops/${workshopId}/resources`, auth(getState));
      return { workshopId, data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const uploadWorkshopResource = createAsyncThunk(
  'trainerWorkshop/uploadResource',
  async ({ workshopId, formData }, { getState, dispatch, rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/trainer/workshops/${workshopId}/resources`,
        formData,
        { ...auth(getState), headers: { ...auth(getState).headers, 'Content-Type': 'multipart/form-data' } }
      );
      dispatch(fetchWorkshopResources(workshopId));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const deleteWorkshopResource = createAsyncThunk(
  'trainerWorkshop/deleteResource',
  async ({ workshopId, resourceId }, { getState, dispatch, rejectWithValue }) => {
    try {
      const { data } = await axios.delete(
        `${API}/api/trainer/workshops/${workshopId}/resources/${resourceId}`,
        auth(getState)
      );
      dispatch(fetchWorkshopResources(workshopId));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchWorkshopFeedback = createAsyncThunk(
  'trainerWorkshop/fetchFeedback',
  async (workshopId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainer/workshops/${workshopId}/feedback`, auth(getState));
      return { workshopId, data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchWorkshopCertificates = createAsyncThunk(
  'trainerWorkshop/fetchCertificates',
  async (workshopId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainer/workshops/${workshopId}/certificates`, auth(getState));
      return { workshopId, data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchMyBatches = createAsyncThunk(
  'trainerWorkshop/fetchMyBatches',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainer/workshops/my-batches`, auth(getState));
      return data.batches || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchMyBatchById = createAsyncThunk(
  'trainerWorkshop/fetchMyBatchById',
  async (batchId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainer/workshops/my-batches/${batchId}`, auth(getState));
      return data.batch || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const trainerWorkshopSlice = createSlice({
  name: 'trainerWorkshop',
  initialState: {
    workshops:        [],
    workshopsStatus:  'idle',
    workshopsError:   null,

    stats:            null,
    statsStatus:      'idle',

    detail:           null,
    detailStatus:     'idle',

    participants:     {},   // { [workshopId]: [] }
    participantsStatus: {},

    attendance:       {},   // { [workshopId]: [] }
    attendanceStatus: {},

    resources:        {},   // { [workshopId]: [] }
    resourcesStatus:  {},

    feedback:         {},   // { [workshopId]: { feedback: [], stats: {} } }
    feedbackStatus:   {},

    certificates:     {},   // { [workshopId]: [] }
    certificatesStatus: {},

    actionStatus:     'idle',
    actionError:      null,

    liveConnection:   null,  // { token, url, roomName } set when session goes live

    selectedWorkshopId: null,

    myBatches:          [],
    myBatchesStatus:    'idle',
    myBatchesError:     null,
    selectedMyBatch:    null,
    selectedMyBatchStatus: 'idle',
  },

  reducers: {
    setSelectedWorkshop(state, { payload }) {
      state.selectedWorkshopId = payload;
    },
    clearActionError(state) {
      state.actionError = null;
      state.actionStatus = 'idle';
    },
    clearLiveConnection(state) {
      state.liveConnection = null;
    },
  },

  extraReducers: (builder) => {
    const norm = (payload, key) =>
      Array.isArray(payload)        ? payload :
      Array.isArray(payload?.[key]) ? payload[key] :
      Array.isArray(payload?.data)  ? payload.data : [];

    // Workshops list
    builder
      .addCase(fetchTrainerWorkshops.pending,   s => { s.workshopsStatus = 'loading'; s.workshopsError = null; })
      .addCase(fetchTrainerWorkshops.fulfilled, (s, a) => { s.workshopsStatus = 'succeeded'; s.workshops = norm(a.payload, 'workshops'); })
      .addCase(fetchTrainerWorkshops.rejected,  (s, a) => { s.workshopsStatus = 'failed'; s.workshopsError = a.payload; });

    // Stats
    builder
      .addCase(fetchWorkshopStats.pending,   s => { s.statsStatus = 'loading'; })
      .addCase(fetchWorkshopStats.fulfilled, (s, a) => { s.statsStatus = 'succeeded'; s.stats = a.payload?.stats || a.payload; })
      .addCase(fetchWorkshopStats.rejected,  s => { s.statsStatus = 'failed'; });

    // Detail
    builder
      .addCase(fetchWorkshopDetail.pending,   s => { s.detailStatus = 'loading'; })
      .addCase(fetchWorkshopDetail.fulfilled, (s, a) => { s.detailStatus = 'succeeded'; s.detail = a.payload?.workshop || a.payload; })
      .addCase(fetchWorkshopDetail.rejected,  s => { s.detailStatus = 'failed'; });

    // Start / End / Join
    builder
      .addCase(startWorkshop.pending,   s => { s.actionStatus = 'loading'; s.actionError = null; })
      .addCase(startWorkshop.fulfilled, (s, a) => {
        s.actionStatus = 'succeeded';
        if (a.payload?.token) {
          s.liveConnection = { token: a.payload.token, url: a.payload.url, roomName: a.payload.roomName };
        }
        const sess = a.payload?.session;
        if (sess?._id) {
          const i = s.workshops.findIndex(w => w._id === sess._id || w.batchId === sess.workshopBatchId);
          if (i !== -1) s.workshops[i] = { ...s.workshops[i], status: 'live' };
        }
      })
      .addCase(startWorkshop.rejected,  (s, a) => { s.actionStatus = 'failed'; s.actionError = a.payload; })
      .addCase(joinWorkshopSession.pending,   s => { s.actionStatus = 'loading'; s.actionError = null; })
      .addCase(joinWorkshopSession.fulfilled, (s, a) => {
        s.actionStatus = 'succeeded';
        if (a.payload?.token) {
          s.liveConnection = { token: a.payload.token, url: a.payload.url, roomName: a.payload.roomName, sessionId: a.payload.sessionId };
        }
      })
      .addCase(joinWorkshopSession.rejected,  (s, a) => { s.actionStatus = 'failed'; s.actionError = a.payload; })
      .addCase(endWorkshop.pending,     s => { s.actionStatus = 'loading'; s.actionError = null; })
      .addCase(endWorkshop.fulfilled,   (s, a) => {
        s.actionStatus = 'succeeded';
        s.liveConnection = null;
        const sess = a.payload?.session;
        if (sess?._id) {
          const i = s.workshops.findIndex(w => w._id === sess._id || w.batchId === sess.workshopBatchId);
          if (i !== -1) s.workshops[i] = { ...s.workshops[i], status: 'completed' };
        }
      })
      .addCase(endWorkshop.rejected,    (s, a) => { s.actionStatus = 'failed'; s.actionError = a.payload; });

    // Participants
    builder
      .addCase(fetchParticipants.pending,   (s, a) => { s.participantsStatus[a.meta.arg] = 'loading'; })
      .addCase(fetchParticipants.fulfilled, (s, a) => {
        const { workshopId, data } = a.payload;
        s.participants[workshopId]       = norm(data, 'participants');
        s.participantsStatus[workshopId] = 'succeeded';
      })
      .addCase(fetchParticipants.rejected,  (s, a) => { s.participantsStatus[a.meta.arg] = 'failed'; });

    // Attendance
    builder
      .addCase(fetchWorkshopAttendance.pending,   (s, a) => { s.attendanceStatus[a.meta.arg] = 'loading'; })
      .addCase(fetchWorkshopAttendance.fulfilled, (s, a) => {
        const { workshopId, data } = a.payload;
        s.attendance[workshopId]       = norm(data, 'records');
        s.attendanceStatus[workshopId] = 'succeeded';
      })
      .addCase(fetchWorkshopAttendance.rejected,  (s, a) => { s.attendanceStatus[a.meta.arg] = 'failed'; });

    // Resources
    builder
      .addCase(fetchWorkshopResources.pending,   (s, a) => { s.resourcesStatus[a.meta.arg] = 'loading'; })
      .addCase(fetchWorkshopResources.fulfilled, (s, a) => {
        const { workshopId, data } = a.payload;
        s.resources[workshopId]       = norm(data, 'resources');
        s.resourcesStatus[workshopId] = 'succeeded';
      })
      .addCase(fetchWorkshopResources.rejected,  (s, a) => { s.resourcesStatus[a.meta.arg] = 'failed'; });

    // Feedback
    builder
      .addCase(fetchWorkshopFeedback.pending,   (s, a) => { s.feedbackStatus[a.meta.arg] = 'loading'; })
      .addCase(fetchWorkshopFeedback.fulfilled, (s, a) => {
        const { workshopId, data } = a.payload;
        s.feedback[workshopId]       = { feedback: norm(data, 'feedback'), stats: data?.stats || {} };
        s.feedbackStatus[workshopId] = 'succeeded';
      })
      .addCase(fetchWorkshopFeedback.rejected,  (s, a) => { s.feedbackStatus[a.meta.arg] = 'failed'; });

    // Certificates
    builder
      .addCase(fetchWorkshopCertificates.pending,   (s, a) => { s.certificatesStatus[a.meta.arg] = 'loading'; })
      .addCase(fetchWorkshopCertificates.fulfilled, (s, a) => {
        const { workshopId, data } = a.payload;
        s.certificates[workshopId]       = norm(data, 'certificates');
        s.certificatesStatus[workshopId] = 'succeeded';
      })
      .addCase(fetchWorkshopCertificates.rejected,  (s, a) => { s.certificatesStatus[a.meta.arg] = 'failed'; });

    // My Batches
    builder
      .addCase(fetchMyBatches.pending,   (s) => { s.myBatchesStatus = 'loading'; s.myBatchesError = null; })
      .addCase(fetchMyBatches.fulfilled, (s, a) => { s.myBatchesStatus = 'succeeded'; s.myBatches = a.payload; })
      .addCase(fetchMyBatches.rejected,  (s, a) => { s.myBatchesStatus = 'failed'; s.myBatchesError = a.payload; })
      .addCase(fetchMyBatchById.pending,   (s) => { s.selectedMyBatchStatus = 'loading'; })
      .addCase(fetchMyBatchById.fulfilled, (s, a) => { s.selectedMyBatchStatus = 'succeeded'; s.selectedMyBatch = a.payload; })
      .addCase(fetchMyBatchById.rejected,  (s) => { s.selectedMyBatchStatus = 'failed'; });
  },
});

export const { setSelectedWorkshop, clearActionError, clearLiveConnection } = trainerWorkshopSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectTrainerWorkshops        = s => s.trainerWorkshop.workshops;
export const selectWorkshopsStatus         = s => s.trainerWorkshop.workshopsStatus;
export const selectWorkshopStats           = s => s.trainerWorkshop.stats;
export const selectWorkshopStatsStatus     = s => s.trainerWorkshop.statsStatus;
export const selectWorkshopDetail          = s => s.trainerWorkshop.detail;
export const selectWorkshopDetailStatus    = s => s.trainerWorkshop.detailStatus;
export const selectWorkshopParticipants    = (workshopId) => s => s.trainerWorkshop.participants[workshopId] || [];
export const selectWorkshopAttendance      = (workshopId) => s => s.trainerWorkshop.attendance[workshopId] || [];
export const selectWorkshopResources       = (workshopId) => s => s.trainerWorkshop.resources[workshopId] || [];
export const selectWorkshopFeedback        = (workshopId) => s => s.trainerWorkshop.feedback[workshopId] || { feedback: [], stats: {} };
export const selectWorkshopCertificates    = (workshopId) => s => s.trainerWorkshop.certificates[workshopId] || [];
export const selectWorkshopActionStatus    = s => s.trainerWorkshop.actionStatus;
export const selectWorkshopActionError     = s => s.trainerWorkshop.actionError;
export const selectSelectedWorkshopId      = s => s.trainerWorkshop.selectedWorkshopId;
export const selectLiveConnection         = s => s.trainerWorkshop.liveConnection;
export const selectMyBatches               = s => s.trainerWorkshop.myBatches;
export const selectMyBatchesStatus         = s => s.trainerWorkshop.myBatchesStatus;
export const selectMyBatchesError          = s => s.trainerWorkshop.myBatchesError;
export const selectSelectedMyBatch         = s => s.trainerWorkshop.selectedMyBatch;
export const selectSelectedMyBatchStatus   = s => s.trainerWorkshop.selectedMyBatchStatus;

export default trainerWorkshopSlice.reducer;
