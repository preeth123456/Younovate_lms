// src/features/admin/courseSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

// ─── Auth header — same pattern as adminSlice ─────────────────────────────────
const authHeader = (getState) => ({
  headers: { Authorization: `Bearer ${getState().auth.token}` },
});

// ═══════════════════════════════════════════════════════════════════════════════
// THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/courses?status=&limit=0
// Response: { success, data: { courses:[{_id,name,code,level,status,duration,modules[]}], meta } }
export const fetchCourses = createAsyncThunk(
  'courses/fetchCourses',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/courses`, {
        ...authHeader(getState),
        params,
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to fetch courses');
    }
  }
);

// GET /api/courses/:id
// Response: { success, data: { course:{...}, batches:[...] } }
export const fetchCourseById = createAsyncThunk(
  'courses/fetchCourseById',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/courses/${id}`, authHeader(getState));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to fetch course');
    }
  }
);

// POST /api/courses  [admin only]
// Body: { name, code, description, duration, level, status, tags }
// Response: { success: true, data: { _id, name, code, ... } }
export const createCourse = createAsyncThunk(
  'courses/createCourse',
  async (courseData, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/courses`, courseData, authHeader(getState));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to create course');
    }
  }
);

// PUT /api/courses/:id  [admin only]
// Response: { success: true, data: { ...updatedCourse } }
export const updateCourse = createAsyncThunk(
  'courses/updateCourse',
  async ({ id, ...courseData }, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.put(`${API}/api/courses/${id}`, courseData, authHeader(getState));
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to update course');
    }
  }
);

// DELETE /api/courses/:id  [admin only]
// Response: { success: true, message: 'Course deleted' }
export const deleteCourse = createAsyncThunk(
  'courses/deleteCourse',
  async (id, { getState, rejectWithValue }) => {
    try {
      await axios.delete(`${API}/api/courses/${id}`, authHeader(getState));
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to delete course');
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const courseSlice = createSlice({
  name: 'courses',

  initialState: {
    courses:      [],
    meta:         { total: 0, page: 1, limit: 0, pages: 1 },
    status:       'idle',   // idle | loading | succeeded | failed
    error:        null,

    currentCourse:  null,
    currentBatches: [],
    detailStatus:   'idle',
    detailError:    null,

    createStatus:   'idle',
    createError:    null,

    updateStatus:   'idle',
    updateError:    null,

    deleteStatus:   'idle',
    deleteError:    null,
  },

  reducers: {
    clearCourseErrors(state) {
      state.error       = null;
      state.detailError = null;
      state.createError = null;
      state.updateError = null;
      state.deleteError = null;
    },
    resetCourseCreateStatus(state) {
      state.createStatus = 'idle';
      state.createError  = null;
    },
  },

  extraReducers: (builder) => {

    // ── fetchCourses ───────────────────────────────────────────────────────────
    builder
      .addCase(fetchCourses.pending,   (s)    => { s.status = 'loading';   s.error = null; })
      .addCase(fetchCourses.fulfilled, (s, a) => {
        s.status  = 'succeeded';
        s.courses = a.payload?.data?.courses || [];
        s.meta    = a.payload?.data?.meta    || s.meta;
      })
      .addCase(fetchCourses.rejected,  (s, a) => { s.status = 'failed';    s.error = a.payload; });

    // ── fetchCourseById ────────────────────────────────────────────────────────
    builder
      .addCase(fetchCourseById.pending,   (s)    => { s.detailStatus = 'loading';   s.detailError = null; })
      .addCase(fetchCourseById.fulfilled, (s, a) => {
        s.detailStatus    = 'succeeded';
        s.currentCourse   = a.payload?.data?.course  || null;
        s.currentBatches  = a.payload?.data?.batches || [];
      })
      .addCase(fetchCourseById.rejected,  (s, a) => { s.detailStatus = 'failed'; s.detailError = a.payload; });

    // ── createCourse ───────────────────────────────────────────────────────────
    builder
      .addCase(createCourse.pending,   (s)    => { s.createStatus = 'loading';   s.createError = null; })
      .addCase(createCourse.fulfilled, (s, a) => {
        s.createStatus = 'succeeded';
        const nc = a.payload?.data || a.payload;
        if (nc?._id) { s.courses.unshift(nc); s.meta.total += 1; }
      })
      .addCase(createCourse.rejected,  (s, a) => { s.createStatus = 'failed'; s.createError = a.payload; });

    // ── updateCourse ───────────────────────────────────────────────────────────
    builder
      .addCase(updateCourse.pending,   (s)    => { s.updateStatus = 'loading';   s.updateError = null; })
      .addCase(updateCourse.fulfilled, (s, a) => {
        s.updateStatus = 'succeeded';
        const updated = a.payload?.data || a.payload;
        if (updated?._id) {
          const i = s.courses.findIndex(c => c._id === updated._id);
          if (i !== -1) s.courses[i] = updated;
          if (s.currentCourse?._id === updated._id) s.currentCourse = updated;
        }
      })
      .addCase(updateCourse.rejected,  (s, a) => { s.updateStatus = 'failed'; s.updateError = a.payload; });

    // ── deleteCourse ───────────────────────────────────────────────────────────
    builder
      .addCase(deleteCourse.pending,   (s)    => { s.deleteStatus = 'loading';   s.deleteError = null; })
      .addCase(deleteCourse.fulfilled, (s, a) => {
        s.deleteStatus = 'succeeded';
        s.courses      = s.courses.filter(c => c._id !== a.payload);
        s.meta.total   = Math.max(0, s.meta.total - 1);
      })
      .addCase(deleteCourse.rejected,  (s, a) => { s.deleteStatus = 'failed'; s.deleteError = a.payload; });

  },
});

// ─── Actions ──────────────────────────────────────────────────────────────────
export const { clearCourseErrors, resetCourseCreateStatus } = courseSlice.actions;

// ─── Selectors — safe fallback so missing key never throws ───────────────────
// Root key in store is 'courses' → state.courses.*
// If courseReducer is not yet registered, selectors return safe defaults.
export const selectAllCourses        = (s) => s.courses?.courses       ?? [];
export const selectCoursesMeta       = (s) => s.courses?.meta          ?? { total:0, page:1, limit:0, pages:1 };
export const selectCoursesStatus     = (s) => s.courses?.status        ?? 'idle';
export const selectCoursesError      = (s) => s.courses?.error         ?? null;

// Derived — { value: code, label: 'CODE — Name' } for batch form dropdown
export const selectCourseOptions     = (s) =>
  (s.courses?.courses ?? []).map(c => ({ value: c.code, label: `${c.code} — ${c.name}` }));

export const selectCurrentCourse     = (s) => s.courses?.currentCourse   ?? null;
export const selectCurrentBatches    = (s) => s.courses?.currentBatches  ?? [];
export const selectCourseDetailStatus= (s) => s.courses?.detailStatus    ?? 'idle';

export const selectCourseCreateStatus = (s) => s.courses?.createStatus ?? 'idle';
export const selectCourseCreateError  = (s) => s.courses?.createError  ?? null;
export const selectCourseUpdateStatus = (s) => s.courses?.updateStatus ?? 'idle';
export const selectCourseUpdateError  = (s) => s.courses?.updateError  ?? null;
export const selectCourseDeleteStatus = (s) => s.courses?.deleteStatus ?? 'idle';
export const selectCourseDeleteError  = (s) => s.courses?.deleteError  ?? null;

export const selectCourseDetailError = (s) => s.courses?.detailError ?? null;


export default courseSlice.reducer;

// ─── Store registration ───────────────────────────────────────────────────────
// REQUIRED: add to src/app/store.js combineReducers:
//
//   import courseReducer from '../features/admin/courseSlice';
//
//   const rootReducer = combineReducers({
//     ...
//     courses: courseReducer,   // ← key MUST be 'courses' to match selectors s.courses.*
//   });