// src/features/sessions/sessionsSlice.js   (TRAINEE-side slice -> store key "traineeSessions")
//
// API integration for the trainee /trainee/sessions page.
//   GET  /api/trainee/sessions                       -> list sessions
//   POST /api/trainee/sessions/:id/join              -> LiveKit token + url + room (+ canPublish)
//   POST /api/trainee/sessions/:id/attendance/leave  -> finalise attendance on leave
//
// Base URL is read from CRA's REACT_APP_API_BASE_URL (Vite's import.meta.env does
// NOT exist here). '' falls back to the CRA dev proxy.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

// ── Defensive base-URL resolver ──────────────────────────────────────────────
const API = API_BASE_URL;

const authHeader = (getState) => ({
  headers: { Authorization: `Bearer ${getState().auth?.token || ''}` },
});

function describeError(err, fallback) {
  if (err.response) {
    const msg = err.response.data?.message || err.response.statusText;
    return `${fallback} (${err.response.status}${msg ? `: ${msg}` : ''})`;
  }
  if (err.request) {
    return `${fallback}: cannot reach the API. Check the backend is running and REACT_APP_API_BASE_URL / proxy is correct.`;
  }
  return `${fallback}: ${err.message}`;
}

// GET /api/trainee/sessions
export const fetchSessions = createAsyncThunk(
  'traineeSessions/fetchSessions',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/trainee/sessions`, {
        ...authHeader(getState),
        params,
      });
      const list = Array.isArray(data) ? data : data?.sessions || data?.data || [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return rejectWithValue(describeError(err, 'Failed to fetch sessions'));
    }
  }
);

// POST /api/trainee/sessions/:id/join -> LiveKit connection for the room
export const joinSession = createAsyncThunk(
  'traineeSessions/joinSession',
  async ({ id, passcode } = {}, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/trainee/sessions/${id}/join`,
        { passcode },
        authHeader(getState)
      );
      if (!data?.token || !data?.url) {
        return rejectWithValue(data?.message || 'No valid join token returned.');
      }
      // data = { success, token, url, roomName, role:'student', canPublish:true }
      return {
        id,
        token:      data.token,
        url:        data.url,
        roomName:   data.roomName,
        role:       data.role || 'student',
        canPublish: data.canPublish !== false,   // trainees may now publish cam/mic/screen
        joinedAt:   Date.now(),                  // used to compute attendedSeconds on leave
      };
    } catch (err) {
      return rejectWithValue(describeError(err, 'Could not join session'));
    }
  }
);

// POST /api/trainee/sessions/:id/attendance/leave -> finalise attendance status.
// Best-effort: a failure here must never block leaving the room.
export const leaveSession = createAsyncThunk(
  'traineeSessions/leaveSession',
  async ({ id, attendedSeconds } = {}, { getState }) => {
    try {
      await axios.post(
        `${API}/api/trainee/sessions/${id}/attendance/leave`,
        attendedSeconds != null ? { attendedSeconds } : {},
        authHeader(getState)
      );
    } catch (_) { /* swallow — leaving must always succeed */ }
    return { id };
  }
);

const traineeSessionsSlice = createSlice({
  name: 'traineeSessions',
  initialState: {
    items: [],
    status: 'idle',
    error: null,

    connection: null,     // { id, token, url, roomName, role, canPublish, joinedAt }
    joinStatus: 'idle',
    joinError: null,
  },
  reducers: {
    clearConnection(state) {
      state.connection = null;
      state.joinStatus = 'idle';
      state.joinError = null;
    },
    clearSessionError(state) {
      state.error = null;
      state.joinError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSessions.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchSessions.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || action.error?.message || 'Failed to fetch sessions';
      })

      .addCase(joinSession.pending, (state) => {
        state.joinStatus = 'loading';
        state.joinError = null;
      })
      .addCase(joinSession.fulfilled, (state, action) => {
        state.joinStatus = 'succeeded';
        state.connection = action.payload;
      })
      .addCase(joinSession.rejected, (state, action) => {
        state.joinStatus = 'failed';
        state.joinError = action.payload || action.error?.message || 'Could not join session';
      })

      .addCase(leaveSession.fulfilled, (state) => {
        state.connection = null;
        state.joinStatus = 'idle';
      });
  },
});

export const { clearConnection, clearSessionError } = traineeSessionsSlice.actions;

// ── Selectors ────────────────────────────────────────────────────────────────
export const selectSessions       = (s) => s.traineeSessions?.items ?? [];
export const selectSessionsStatus = (s) => s.traineeSessions?.status ?? 'idle';
export const selectSessionsError  = (s) => s.traineeSessions?.error ?? null;
export const selectConnection     = (s) => s.traineeSessions?.connection ?? null;
export const selectJoinStatus     = (s) => s.traineeSessions?.joinStatus ?? 'idle';
export const selectJoinError      = (s) => s.traineeSessions?.joinError ?? null;

export default traineeSessionsSlice.reducer;