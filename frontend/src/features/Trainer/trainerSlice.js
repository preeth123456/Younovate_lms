import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

// ─── Base URL ─────────────────────────────────────────────────────────────────
const API = API_BASE_URL;

// ─── Auth Header ──────────────────────────────────────────────────────────────
const authHeader = (getState) => ({
  headers: { Authorization: `Bearer ${getState().auth.token}` },
});

// ─── Thunks ───────────────────────────────────────────────────────────────────

// GET /api/trainer/dashboard
export const fetchTrainerDashboard = createAsyncThunk(
  'trainer/fetchTrainerDashboard',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(
        `${API}/api/trainer/dashboard`,
        authHeader(getState)
      );
      console.log(data)
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to load dashboard');
    }
  }
);


// GET /api/trainer/sessions
export const fetchTrainerSessions = createAsyncThunk(
  'trainer/fetchTrainerSessions',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(
        `${API}/api/trainer/sessions`,
        authHeader(getState)
      );
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to load sessions');
    }
  }
);

// GET /api/trainer/assignments
export const fetchTrainerAssignments = createAsyncThunk(
  'trainer/fetchTrainerAssignments',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(
        `${API}/api/trainer/assignments`,
        authHeader(getState)
      );
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to load assignments');
    }
  }
);

// GET /api/trainer/students
export const fetchTrainerStudents = createAsyncThunk(
  'trainer/fetchTrainerStudents',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(
        `${API}/api/trainer/students`,
        authHeader(getState)
      );
      console.log(data)
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to load students');
    }
  }
);

// PUT /api/trainer/assignments/:id/grade/:submissionId
export const gradeSubmission = createAsyncThunk(
  'trainer/gradeSubmission',
  async ({ assignmentId, submissionId, grade, feedback, allowResubmit = false }, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.put(
        `${API}/api/trainer/assignments/${assignmentId}/grade/${submissionId}`,
        { grade, feedback, allowResubmit },
        authHeader(getState)
      );
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to submit grade');
    }
  }
);

// GET /api/trainer/attendance/session/:sessionId
export const fetchSessionAttendance = createAsyncThunk(
  'trainer/fetchSessionAttendance',
  async (sessionId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(
        `${API}/api/trainer/attendance/session/${sessionId}`,
        authHeader(getState)
      );
      return { sessionId, data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to load attendance');
    }
  }
);

// POST http://localhost:8088/api/attendance/mark
export const markAttendance = createAsyncThunk(
  'trainer/markAttendance',
  async ({ sessionId, traineeId, status }, { getState, rejectWithValue }) => {
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


// src/features/Trainer/trainerSlice.js  — ADD these thunks (near the others)

// POST /api/trainer/sessions/:id/start
export const startSession = createAsyncThunk(
  'trainer/startSession',
  async (sessionId, { getState, dispatch, rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/trainer/sessions/${sessionId}/start`, {}, authHeader(getState)
      );
      dispatch(fetchTrainerSessions());          // refresh → status becomes 'live'
      return { sessionId, data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to start session');
    }
  }
);

// POST /api/trainer/sessions/:id/end
export const endSession = createAsyncThunk(
  'trainer/endSession',
  async (sessionId, { getState, dispatch, rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/trainer/sessions/${sessionId}/end`, {}, authHeader(getState)
      );
      dispatch(fetchTrainerSessions());          // refresh → status becomes 'completed'
      return { sessionId, data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to end session');
    }
  }
);


// ─── Slice ────────────────────────────────────────────────────────────────────

const trainerSlice = createSlice({
  name: 'trainer',
  initialState: {
    dashboard:         null,
    status:            'idle',
    error:             null,

    sessions:          [],
    sessionsStatus:    'idle',
    sessionsError:     null,

    assignments:       [],
    assignmentsStatus: 'idle',
    assignmentsError:  null,

    students:          [],
    studentsStatus:    'idle',
    studentsError:     null,

    gradingStatus:     'idle',
    gradingError:      null,

    attendance:        {},
    attendanceStatus:  {},
        sessionActionStatus: {},   // { [sessionId]: 'loading' | 'succeeded' | 'failed' }
    sessionActionError:  {},

    markStatus:        'idle',
    markError:         null,

    activeTab:         'overview',
    gradingModal:      null,
  },

  reducers: {
    setActiveTab(state, { payload }) {
      state.activeTab = payload;
    },
    openGradingModal(state, { payload }) {
      state.gradingModal  = payload;
      state.gradingStatus = 'idle';
      state.gradingError  = null;
    },
    closeGradingModal(state) {
      state.gradingModal  = null;
      state.gradingStatus = 'idle';
      state.gradingError  = null;
    },
  },

  extraReducers: (builder) => {

    const norm = (payload, key) =>
      Array.isArray(payload)          ? payload :
      Array.isArray(payload?.[key])   ? payload[key] :
      Array.isArray(payload?.data)    ? payload.data : [];

    // ── Dashboard ────────────────────────────────────────────────────────────
    builder
      .addCase(fetchTrainerDashboard.pending,   (s)    => { s.status = 'loading';   s.error = null; })
      .addCase(fetchTrainerDashboard.fulfilled, (s, a) => { s.status = 'succeeded'; s.dashboard = a.payload; })
      .addCase(fetchTrainerDashboard.rejected,  (s, a) => { s.status = 'failed';    s.error = a.payload; });

    // ── Sessions ─────────────────────────────────────────────────────────────
    builder
      .addCase(fetchTrainerSessions.pending,   (s)    => { s.sessionsStatus = 'loading';   s.sessionsError = null; })
      .addCase(fetchTrainerSessions.fulfilled, (s, a) => { s.sessionsStatus = 'succeeded'; s.sessions = norm(a.payload, 'sessions'); })
      .addCase(fetchTrainerSessions.rejected,  (s, a) => { s.sessionsStatus = 'failed';    s.sessionsError = a.payload; });

    // ── Assignments ───────────────────────────────────────────────────────────
    builder
      .addCase(fetchTrainerAssignments.pending,   (s)    => { s.assignmentsStatus = 'loading';   s.assignmentsError = null; })
      .addCase(fetchTrainerAssignments.fulfilled, (s, a) => { s.assignmentsStatus = 'succeeded'; s.assignments = norm(a.payload, 'assignments'); })
      .addCase(fetchTrainerAssignments.rejected,  (s, a) => { s.assignmentsStatus = 'failed';    s.assignmentsError = a.payload; });

    // ── Students ──────────────────────────────────────────────────────────────
    builder
      .addCase(fetchTrainerStudents.pending,   (s)    => { s.studentsStatus = 'loading';   s.studentsError = null; })
      .addCase(fetchTrainerStudents.fulfilled, (s, a) => { s.studentsStatus = 'succeeded'; s.students = norm(a.payload, 'students'); })
      .addCase(fetchTrainerStudents.rejected,  (s, a) => { s.studentsStatus = 'failed';    s.studentsError = a.payload; });

    // ── Grade submission ───────────────────────────────────────────────────────
    builder
      .addCase(gradeSubmission.pending,   (s)    => { s.gradingStatus = 'loading';   s.gradingError = null; })
      .addCase(gradeSubmission.fulfilled, (s)    => { s.gradingStatus = 'succeeded'; s.gradingModal = null; })
      .addCase(gradeSubmission.rejected,  (s, a) => { s.gradingStatus = 'failed';    s.gradingError = a.payload; });

    // ── Attendance fetch ───────────────────────────────────────────────────────
    builder
      .addCase(fetchSessionAttendance.pending,   (s, a) => { s.attendanceStatus[a.meta.arg] = 'loading'; })
      .addCase(fetchSessionAttendance.fulfilled, (s, a) => {
        const { sessionId, data } = a.payload;
        s.attendance[sessionId]       = data;
        s.attendanceStatus[sessionId] = 'succeeded';
      })
      .addCase(fetchSessionAttendance.rejected,  (s, a) => { s.attendanceStatus[a.meta.arg] = 'failed'; });

    // ── Attendance mark ────────────────────────────────────────────────────────
    builder
      .addCase(markAttendance.pending,   (s)    => { s.markStatus = 'loading';   s.markError = null; })
      .addCase(markAttendance.fulfilled, (s)    => { s.markStatus = 'succeeded'; })
      .addCase(markAttendance.rejected,  (s, a) => { s.markStatus = 'failed';    s.markError = a.payload; });
  

// ── Session start / end ────────────────────────────────────────────────────
    builder
      .addCase(startSession.pending,   (s, a) => { s.sessionActionStatus[a.meta.arg] = 'loading'; s.sessionActionError[a.meta.arg] = null; })
      .addCase(startSession.fulfilled, (s, a) => { s.sessionActionStatus[a.meta.arg] = 'succeeded'; })
      .addCase(startSession.rejected,  (s, a) => { s.sessionActionStatus[a.meta.arg] = 'failed';   s.sessionActionError[a.meta.arg] = a.payload; })
      .addCase(endSession.pending,     (s, a) => { s.sessionActionStatus[a.meta.arg] = 'loading'; s.sessionActionError[a.meta.arg] = null; })
      .addCase(endSession.fulfilled,   (s, a) => { s.sessionActionStatus[a.meta.arg] = 'succeeded'; })
      .addCase(endSession.rejected,    (s, a) => { s.sessionActionStatus[a.meta.arg] = 'failed';   s.sessionActionError[a.meta.arg] = a.payload; });


},
});

// ─── Actions ──────────────────────────────────────────────────────────────────

export const { setActiveTab, openGradingModal, closeGradingModal } = trainerSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectTrainerDashboard   = (s) => s.trainer.dashboard;
export const selectTrainerStatus      = (s) => s.trainer.status;
export const selectTrainerError       = (s) => s.trainer.error;
export const selectTrainerSessions    = (s) => s.trainer.sessions;
export const selectSessionsStatus     = (s) => s.trainer.sessionsStatus;
export const selectTrainerAssignments = (s) => s.trainer.assignments;
export const selectAssignmentsStatus  = (s) => s.trainer.assignmentsStatus;
export const selectTrainerStudents    = (s) => s.trainer.students;
export const selectStudentsStatus     = (s) => s.trainer.studentsStatus;
export const selectGradingStatus      = (s) => s.trainer.gradingStatus;
export const selectGradingError       = (s) => s.trainer.gradingError;
export const selectAttendance         = (s) => s.trainer.attendance;
export const selectAttendanceStatus   = (s) => s.trainer.attendanceStatus;
export const selectActiveTab          = (s) => s.trainer.activeTab;
export const selectGradingModal       = (s) => s.trainer.gradingModal;
export const selectMarkStatus         = (s) => s.trainer.markStatus;  // ← ADDED
export const selectMarkError          = (s) => s.trainer.markError;   // ← ADDED
export const selectSessionActionStatus = (s) => s.trainer.sessionActionStatus;
export const selectSessionActionError  = (s) => s.trainer.sessionActionError;



export default trainerSlice.reducer;

// ─── Store registration ───────────────────────────────────────────────────────
// import trainerReducer from './features/Trainer/trainerSlice';
// configureStore({ reducer: { auth: authReducer, trainer: trainerReducer, admin: adminReducer } })