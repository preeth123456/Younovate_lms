import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

// Token lives in Redux state (always set on login). localStorage only has it
// when "Remember me" was checked, so fall back to it — never send "null".
const getAuthHeader = (_, getState) => {
  const t = getState?.().auth?.token || localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${t}` } };
};

// Backend GET /api/assignments returns { success, assignments: [...] }.
// The slice must store ONLY the array so `.map()` never receives an object.
const extractList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.assignments)) return payload.assignments;
  return [];
};

const extractDoc = (payload) => payload?.assignment || payload?.data || payload;

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const fetchAssignments = createAsyncThunk(
  'assignments/fetchAssignments',
  async (_, { getState, rejectWithValue }) => {
    try {
      const res = await axios.get(`${API}/api/assignments`, getAuthHeader(_, getState));
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch assignments');
    }
  }
);

export const createAssignment = createAsyncThunk(
  'assignments/createAssignment',
  async (assignmentData, { getState, rejectWithValue }) => {
    try {
      const res = await axios.post(`${API}/api/assignments`, assignmentData, getAuthHeader(null, getState));
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create assignment');
    }
  }
);

export const submitAssignment = createAsyncThunk(
  'assignments/submitAssignment',
  async ({ id, submissionData }, { getState, rejectWithValue }) => {
    try {
      const res = await axios.post(`${API}/api/assignments/${id}/submit`, submissionData, getAuthHeader(null, getState));
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to submit assignment');
    }
  }
);

export const gradeAssignment = createAsyncThunk(
  'assignments/gradeAssignment',
  async ({ id, gradeData }, { getState, rejectWithValue }) => {
    try {
      const res = await axios.post(`${API}/api/assignments/${id}/grade`, gradeData, getAuthHeader(null, getState));
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to grade assignment');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const assignmentsSlice = createSlice({
  name: 'assignments',
  initialState: {
    assignments: [],
    status: 'idle',
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAssignments.pending,   (state)         => { state.status = 'loading'; state.error = null; })
      .addCase(fetchAssignments.fulfilled, (state, action) => { state.status = 'succeeded'; state.assignments = extractList(action.payload); })
      .addCase(fetchAssignments.rejected,  (state, action) => { state.status = 'failed'; state.error = action.payload; })

      .addCase(createAssignment.fulfilled, (state, action) => {
        const doc = extractDoc(action.payload);
        if (doc && doc._id && Array.isArray(state.assignments)) state.assignments.push(doc);
      })

      .addCase(submitAssignment.fulfilled, (state, action) => {
        const doc = extractDoc(action.payload);
        if (!doc || !doc._id || !Array.isArray(state.assignments)) return;
        const idx = state.assignments.findIndex((a) => a._id === doc._id);
        if (idx !== -1) state.assignments[idx] = doc;
      })

      .addCase(gradeAssignment.fulfilled, (state, action) => {
        const doc = extractDoc(action.payload);
        if (!doc || !doc._id || !Array.isArray(state.assignments)) return;
        const idx = state.assignments.findIndex((a) => a._id === doc._id);
        if (idx !== -1) state.assignments[idx] = doc;
      });
  },
});

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectAllAssignments    = (state) => (
  Array.isArray(state.assignments?.assignments) ? state.assignments.assignments : []
);
export const selectAssignmentsStatus = (state) => state.assignments.status;
export const selectAssignmentsError  = (state) => state.assignments.error;

export default assignmentsSlice.reducer;