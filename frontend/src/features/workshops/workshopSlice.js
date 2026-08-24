import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

const authHeader = (getState) => ({
  headers: { Authorization: `Bearer ${getState().auth.token}` },
});

// ── Public thunks ─────────────────────────────────────────────────────────────

export const fetchPublicWorkshops = createAsyncThunk(
  'workshops/fetchPublic',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/workshops`, { params });
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch workshops');
    }
  }
);

export const fetchWorkshopById = createAsyncThunk(
  'workshops/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/workshops/${id}`);
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch workshop');
    }
  }
);

export const registerForWorkshop = createAsyncThunk(
  'workshops/register',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/workshops/register`, {
        ...formData,
        workshopId: String(formData.workshopId || '').trim(),
        email: String(formData.email || '').trim().toLowerCase(),
      });
      return {
        registration: data.data,
        message: data.message,
        alreadyRegistered: Boolean(data.alreadyRegistered),
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Registration failed');
    }
  }
);

// ── Admin thunks ──────────────────────────────────────────────────────────────

export const fetchAdminWorkshops = createAsyncThunk(
  'workshops/fetchAdminAll',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/workshops/admin/all`, {
        ...authHeader(getState),
        params,
      });
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch workshops');
    }
  }
);

export const fetchWorkshopStats = createAsyncThunk(
  'workshops/fetchStats',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/workshops/admin/stats`, authHeader(getState));
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch stats');
    }
  }
);

export const createWorkshop = createAsyncThunk(
  'workshops/create',
  async (workshopData, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/workshops`, workshopData, authHeader(getState));
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create workshop');
    }
  }
);

export const updateWorkshop = createAsyncThunk(
  'workshops/update',
  async ({ id, ...updates }, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.put(`${API}/api/workshops/${id}`, updates, authHeader(getState));
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update workshop');
    }
  }
);

export const deleteWorkshop = createAsyncThunk(
  'workshops/delete',
  async (id, { getState, rejectWithValue }) => {
    try {
      await axios.delete(`${API}/api/workshops/${id}`, authHeader(getState));
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete workshop');
    }
  }
);

export const fetchWorkshopRegistrations = createAsyncThunk(
  'workshops/fetchRegistrations',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/workshops/admin/registrations`, {
        ...authHeader(getState),
        params,
      });
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch registrations');
    }
  }
);

export const updateWorkshopRegistration = createAsyncThunk(
  'workshops/updateRegistration',
  async ({ id, ...updates }, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.put(`${API}/api/workshops/admin/registrations/${id}`, updates, authHeader(getState));
      // data may contain: { success, data, temporaryPassword }
      return data; // Return full response so we can access temporaryPassword
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update registration');
    }
  }
);

export const deleteWorkshopRegistration = createAsyncThunk(
  'workshops/deleteRegistration',
  async (id, { getState, rejectWithValue }) => {
    try {
      await axios.delete(`${API}/api/workshops/admin/registrations/${id}`, authHeader(getState));
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete registration');
    }
  }
);

export const resetWorkshopRegistrationPassword = createAsyncThunk(
  'workshops/resetRegistrationPassword',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/workshops/admin/registrations/${id}/reset-password`,
        {},
        authHeader(getState)
      );
      return data; // { success, message, temporaryPassword?, data? }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to reset password');
    }
  }
);

// ── Batch thunks ────────────────────────────────────────────────────────────────────────────────

export const createWorkshopBatch = createAsyncThunk(
  'workshops/createBatch',
  async (batchData, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/workshops/batches`, batchData, authHeader(getState));
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create batch');
    }
  }
);

export const fetchWorkshopBatches = createAsyncThunk(
  'workshops/fetchBatches',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/workshops/batches`, { ...authHeader(getState), params });
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch batches');
    }
  }
);

export const fetchWorkshopBatchById = createAsyncThunk(
  'workshops/fetchBatchById',
  async (batchId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/workshops/batches/${batchId}`, authHeader(getState));
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch batch');
    }
  }
);

export const updateWorkshopBatch = createAsyncThunk(
  'workshops/updateBatch',
  async ({ id, ...updates }, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.put(`${API}/api/workshops/batches/${id}`, updates, authHeader(getState));
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update batch');
    }
  }
);

export const assignTrainerToBatch = createAsyncThunk(
  'workshops/assignTrainer',
  async ({ batchId, trainerId }, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.patch(`${API}/api/workshops/batches/${batchId}/assign-trainer`, { trainerId }, authHeader(getState));
      return data; // return full response including isReassign flag
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to assign trainer');
    }
  }
);

export const unassignTrainerFromBatch = createAsyncThunk(
  'workshops/unassignTrainer',
  async (batchId, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.patch(`${API}/api/workshops/batches/${batchId}/unassign-trainer`, {}, authHeader(getState));
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to unassign trainer');
    }
  }
);

export const deleteWorkshopBatch = createAsyncThunk(
  'workshops/deleteBatch',
  async (batchId, { getState, rejectWithValue }) => {
    try {
      await axios.delete(`${API}/api/workshops/batches/${batchId}`, authHeader(getState));
      return batchId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete batch');
    }
  }
);

export const fetchTrainerList = createAsyncThunk(
  'workshops/fetchTrainerList',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/workshops/trainer-list`, authHeader(getState));
      return data.data || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch trainers');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const workshopSlice = createSlice({
  name: 'workshops',
  initialState: {
    // Public
    publicWorkshops:       [],
    publicWorkshopsMeta:   null,
    publicStatus:          'idle',
    publicError:           null,
    // Single workshop
    currentWorkshop:       null,
    currentStatus:         'idle',
    currentError:          null,
    // Admin list
    adminWorkshops:        [],
    adminWorkshopsMeta:    null,
    adminStatus:           'idle',
    adminError:            null,
    // Stats
    stats:                 null,
    statsStatus:           'idle',
    // Registrations
    registrations:         [],
    registrationsMeta:     null,
    registrationsStatus:   'idle',
    registrationsError:    null,
    // Temp password from approval (dev mode)
    temporaryPassword:     null,
    tempPasswordRegName:   null,
    tempPasswordRegEmail:  null,
    // Submit
    submitStatus:          'idle',
    submitError:           null,
    // Batches
    batches:               [],
    batchesMeta:           null,
    batchesStatus:         'idle',
    batchesError:          null,
    selectedBatch:         null,
    selectedBatchStatus:   'idle',
    batchSubmitStatus:     'idle',
    batchSubmitError:      null,
    // Trainer list (for assign modal)
    trainerList:           [],
    trainerListStatus:     'idle',
    assignTrainerStatus:   'idle',
    assignTrainerError:    null,
    unassignTrainerStatus: 'idle',
    unassignTrainerError:  null,
  },
  reducers: {
    clearWorkshopError(state) {
      state.publicError = null; state.adminError = null;
      state.currentError = null; state.submitError = null;
      state.batchSubmitError = null; state.batchesError = null;
    },
    clearTemporaryPassword(state) {
      state.temporaryPassword = null;
      state.tempPasswordRegName = null;
      state.tempPasswordRegEmail = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchPublicWorkshops
      .addCase(fetchPublicWorkshops.pending,   (s) => { s.publicStatus = 'loading'; s.publicError = null; })
      .addCase(fetchPublicWorkshops.fulfilled, (s, a) => { s.publicStatus = 'succeeded'; s.publicWorkshops = a.payload.workshops || []; s.publicWorkshopsMeta = a.payload.meta || null; })
      .addCase(fetchPublicWorkshops.rejected,  (s, a) => { s.publicStatus = 'failed'; s.publicError = a.payload; })
      // fetchWorkshopById
      .addCase(fetchWorkshopById.pending,   (s) => { s.currentStatus = 'loading'; s.currentError = null; })
      .addCase(fetchWorkshopById.fulfilled, (s, a) => { s.currentStatus = 'succeeded'; s.currentWorkshop = a.payload; })
      .addCase(fetchWorkshopById.rejected,  (s, a) => { s.currentStatus = 'failed'; s.currentError = a.payload; })
      // registerForWorkshop
      .addCase(registerForWorkshop.pending,   (s) => { s.submitStatus = 'loading'; s.submitError = null; })
      .addCase(registerForWorkshop.fulfilled, (s) => { s.submitStatus = 'succeeded'; })
      .addCase(registerForWorkshop.rejected,  (s, a) => { s.submitStatus = 'failed'; s.submitError = a.payload; })
      // fetchAdminWorkshops
      .addCase(fetchAdminWorkshops.pending,   (s) => { s.adminStatus = 'loading'; s.adminError = null; })
      .addCase(fetchAdminWorkshops.fulfilled, (s, a) => { s.adminStatus = 'succeeded'; s.adminWorkshops = a.payload.workshops || []; s.adminWorkshopsMeta = a.payload.meta || null; })
      .addCase(fetchAdminWorkshops.rejected,  (s, a) => { s.adminStatus = 'failed'; s.adminError = a.payload; })
      // fetchWorkshopStats
      .addCase(fetchWorkshopStats.pending,   (s) => { s.statsStatus = 'loading'; })
      .addCase(fetchWorkshopStats.fulfilled, (s, a) => { s.statsStatus = 'succeeded'; s.stats = a.payload; })
      .addCase(fetchWorkshopStats.rejected,  (s) => { s.statsStatus = 'failed'; })
      // createWorkshop
      .addCase(createWorkshop.fulfilled, (s, a) => { s.adminWorkshops.unshift(a.payload); })
      // updateWorkshop
      .addCase(updateWorkshop.fulfilled, (s, a) => {
        const idx = s.adminWorkshops.findIndex(w => w._id === a.payload._id);
        if (idx !== -1) s.adminWorkshops[idx] = a.payload;
        if (s.currentWorkshop?._id === a.payload._id) s.currentWorkshop = a.payload;
      })
      // deleteWorkshop
      .addCase(deleteWorkshop.fulfilled, (s, a) => { s.adminWorkshops = s.adminWorkshops.filter(w => w._id !== a.payload); })
      // fetchWorkshopRegistrations
      .addCase(fetchWorkshopRegistrations.pending,   (s) => { s.registrationsStatus = 'loading'; s.registrationsError = null; })
      .addCase(fetchWorkshopRegistrations.fulfilled, (s, a) => { s.registrationsStatus = 'succeeded'; s.registrations = a.payload.registrations || []; s.registrationsMeta = a.payload.meta || null; })
      .addCase(fetchWorkshopRegistrations.rejected,  (s, a) => { s.registrationsStatus = 'failed'; s.registrationsError = a.payload; })
      // updateWorkshopRegistration
      .addCase(updateWorkshopRegistration.pending, (s) => {
        s.registrationsStatus = 'loading';
        s.temporaryPassword = null;
        s.tempPasswordRegName = null;
        s.tempPasswordRegEmail = null;
      })
      .addCase(updateWorkshopRegistration.fulfilled, (s, a) => {
        s.registrationsStatus = 'succeeded';
        // Update the registration in the list
        if (a.payload?.data) {
          const idx = s.registrations.findIndex(r => r._id === a.payload.data._id);
          if (idx !== -1) s.registrations[idx] = a.payload.data;
        }
        // Capture temporaryPassword for dev mode
        if (a.payload?.temporaryPassword) {
          s.temporaryPassword = a.payload.temporaryPassword;
          s.tempPasswordRegName = a.payload.data?.fullName || '';
          s.tempPasswordRegEmail = a.payload.data?.email || '';
          console.log(`🔐 [DEV MODE] Temporary password captured in Redux: ${a.payload.temporaryPassword}`);
        }
      })
      .addCase(updateWorkshopRegistration.rejected,  (s, a) => { s.registrationsStatus = 'failed'; s.registrationsError = a.payload; })
      // deleteWorkshopRegistration
      .addCase(deleteWorkshopRegistration.fulfilled, (s, a) => { s.registrations = s.registrations.filter(r => r._id !== a.payload); })
      // createWorkshopBatch
      .addCase(createWorkshopBatch.pending,   (s) => { s.batchSubmitStatus = 'loading'; s.batchSubmitError = null; })
      .addCase(createWorkshopBatch.fulfilled, (s, a) => { s.batchSubmitStatus = 'succeeded'; s.batches.unshift(a.payload); })
      .addCase(createWorkshopBatch.rejected,  (s, a) => { s.batchSubmitStatus = 'failed'; s.batchSubmitError = a.payload; })
      // fetchWorkshopBatches
      .addCase(fetchWorkshopBatches.pending,   (s) => { s.batchesStatus = 'loading'; s.batchesError = null; })
      .addCase(fetchWorkshopBatches.fulfilled, (s, a) => { s.batchesStatus = 'succeeded'; s.batches = a.payload.batches || []; s.batchesMeta = a.payload.meta || null; })
      .addCase(fetchWorkshopBatches.rejected,  (s, a) => { s.batchesStatus = 'failed'; s.batchesError = a.payload; })
      // fetchWorkshopBatchById
      .addCase(fetchWorkshopBatchById.pending,   (s) => { s.selectedBatchStatus = 'loading'; })
      .addCase(fetchWorkshopBatchById.fulfilled, (s, a) => { s.selectedBatchStatus = 'succeeded'; s.selectedBatch = a.payload; })
      .addCase(fetchWorkshopBatchById.rejected,  (s) => { s.selectedBatchStatus = 'failed'; })
      // updateWorkshopBatch
      .addCase(updateWorkshopBatch.fulfilled, (s, a) => {
        const idx = s.batches.findIndex(b => b._id === a.payload._id);
        if (idx !== -1) s.batches[idx] = a.payload;
        if (s.selectedBatch?._id === a.payload._id) s.selectedBatch = a.payload;
      })
      // assignTrainerToBatch
      .addCase(assignTrainerToBatch.pending,   (s) => { s.assignTrainerStatus = 'loading'; s.assignTrainerError = null; })
      .addCase(assignTrainerToBatch.fulfilled, (s, a) => {
        s.assignTrainerStatus = 'succeeded';
        const batch = a.payload.data || a.payload;
        const idx = s.batches.findIndex(b => b._id === batch._id);
        if (idx !== -1) s.batches[idx] = batch;
      })
      .addCase(assignTrainerToBatch.rejected,  (s, a) => { s.assignTrainerStatus = 'failed'; s.assignTrainerError = a.payload; })
      // unassignTrainerFromBatch
      .addCase(unassignTrainerFromBatch.pending,   (s) => { s.unassignTrainerStatus = 'loading'; s.unassignTrainerError = null; })
      .addCase(unassignTrainerFromBatch.fulfilled, (s, a) => {
        s.unassignTrainerStatus = 'succeeded';
        const idx = s.batches.findIndex(b => b._id === a.payload._id);
        if (idx !== -1) s.batches[idx] = a.payload;
      })
      .addCase(unassignTrainerFromBatch.rejected,  (s, a) => { s.unassignTrainerStatus = 'failed'; s.unassignTrainerError = a.payload; })
      // deleteWorkshopBatch
      .addCase(deleteWorkshopBatch.fulfilled, (s, a) => { s.batches = s.batches.filter(b => b._id !== a.payload); })
      // fetchTrainerList
      .addCase(fetchTrainerList.pending,   (s) => { s.trainerListStatus = 'loading'; })
      .addCase(fetchTrainerList.fulfilled, (s, a) => { s.trainerListStatus = 'succeeded'; s.trainerList = Array.isArray(a.payload) ? a.payload : []; })
      .addCase(fetchTrainerList.rejected,  (s) => { s.trainerListStatus = 'failed'; });
  },
});

export const { clearWorkshopError, clearTemporaryPassword } = workshopSlice.actions;

// Selectors
export const selectPublicWorkshops     = (s) => s.workshops.publicWorkshops;
export const selectPublicStatus        = (s) => s.workshops.publicStatus;
export const selectCurrentWorkshop     = (s) => s.workshops.currentWorkshop;
export const selectCurrentStatus       = (s) => s.workshops.currentStatus;
export const selectAdminWorkshops      = (s) => s.workshops.adminWorkshops;
export const selectAdminWorkshopsMeta  = (s) => s.workshops.adminWorkshopsMeta;
export const selectAdminWorkshopStatus = (s) => s.workshops.adminStatus;
export const selectWorkshopStats       = (s) => s.workshops.stats;
export const selectWorkshopStatsStatus = (s) => s.workshops.statsStatus;
export const selectWsRegistrations     = (s) => s.workshops.registrations;
export const selectWsRegistrationsMeta = (s) => s.workshops.registrationsMeta;
export const selectWsRegistrationsStatus = (s) => s.workshops.registrationsStatus;
export const selectTemporaryPassword   = (s) => s.workshops.temporaryPassword;
export const selectTempPasswordRegName = (s) => s.workshops.tempPasswordRegName;
export const selectTempPasswordRegEmail = (s) => s.workshops.tempPasswordRegEmail;
export const selectSubmitStatus        = (s) => s.workshops.submitStatus;
export const selectSubmitError         = (s) => s.workshops.submitError;
export const selectWsBatches           = (s) => s.workshops.batches;
export const selectWsBatchesMeta       = (s) => s.workshops.batchesMeta;
export const selectWsBatchesStatus     = (s) => s.workshops.batchesStatus;
export const selectWsBatchesError      = (s) => s.workshops.batchesError;
export const selectSelectedBatch       = (s) => s.workshops.selectedBatch;
export const selectSelectedBatchStatus = (s) => s.workshops.selectedBatchStatus;
export const selectBatchSubmitStatus   = (s) => s.workshops.batchSubmitStatus;
export const selectBatchSubmitError    = (s) => s.workshops.batchSubmitError;
export const selectTrainerList         = (s) => s.workshops.trainerList;
export const selectTrainerListStatus   = (s) => s.workshops.trainerListStatus;
export const selectAssignTrainerStatus = (s) => s.workshops.assignTrainerStatus;
export const selectAssignTrainerError  = (s) => s.workshops.assignTrainerError;
export const selectUnassignTrainerStatus = (s) => s.workshops.unassignTrainerStatus;
export const selectDeleteBatchStatus     = (s) => s.workshops.batchesStatus;

export default workshopSlice.reducer;

