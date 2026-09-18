// src/features/auth/authSlice.js
// Corrected authSlice — thunks declared BEFORE the slice so extraReducers
// can reference them without hoisting issues.
//
// CHANGES vs. original:
//   [FIX 1] login thunk persisted `data.token` (undefined). The API returns
//           `accessToken`, so "Remember me" was storing the string "undefined".
//           Now persists `data.accessToken` via a single helper.
//   [FIX 2] Added readToken()/persistToken()/clearToken() helpers so a stale
//           "undefined"/"null" string in localStorage can never read as a
//           valid token on boot.
//   [FIX 3] Persisting/clearing the token is now centralized in the helpers and
//           used consistently across login, setCredentials, logout, etc.
//   [FIX 4] logoutUser.pending now sets a loading status for UI feedback.
//   [ADD]   updateProfile thunk (PUT /api/auth/profile) + reducer cases; writes
//           the returned user back into state.user (merged) on success.

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

// ─── Base API URL ─────────────────────────────────────────────────────────────
const API = API_BASE_URL;

// ─── Token storage helpers ────────────────────────────────────────────────────
// localStorage only stores strings, so a bad write (e.g. setItem('token', undefined))
// persists the literal "undefined". These helpers guard against that.
const TOKEN_KEY = 'token';

const readToken = () => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (!t || t === 'undefined' || t === 'null') return null;
  return t;
};

const persistToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// ─── Axios auth header helper ─────────────────────────────────────────────────
const authHeader = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

// =============================================================================
// THUNKS — declared BEFORE createSlice so extraReducers can reference them
// =============================================================================

// ─── Register ───────────────────────────────────────────────────────────────
export const register = createAsyncThunk(
  'auth/register',
  async ({ name, email, password, role }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/auth/register`, {
        name,
        email,
        password,
        role,
      });
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || 'Registration failed. Please try again.'
      );
    }
  }
);

// ─── Login ────────────────────────────────────────────────────────────────────
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password, remember }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(`${API}/api/auth/login`, {
        email,
        password,
      },
      // Skip the global 401→refresh retry for login: a 401 here means
      // "Wrong credentials" and must reject immediately so the page stops
      // loading and shows the inline error instead of hanging on refresh.
      { _skipRefreshRetry: true });
      // data = { success, accessToken, user, role }

      // Only persist when "remember" is set; otherwise session uses Redux + refresh cookie.
      if (remember) persistToken(data.accessToken);
      else clearToken();

      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || err.response?.data?.error || 'Wrong credentials'
      );
    }
  }
);

// ─── Fetch current user (rehydrate auth state on app boot) ───────────────────
export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const { data } = await axios.get(
        `${API}/api/auth/me`,
        authHeader(token)
      );
      return { user: data.user, role: data.role };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || 'Session expired.'
      );
    }
  }
);

// ─── Logout (calls backend to rotate sessionToken) ───────────────────────────
// Optional `{ token }` payload allows server invalidation after client state is cleared.
export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (arg, { getState, rejectWithValue }) => {
    try {
      const token =
        (arg && typeof arg === 'object' && arg.token) ||
        getState().auth.token ||
        readToken();
      if (!token) return;
      await axios.post(
        `${API}/api/auth/logout`,
        {},
        authHeader(token)
      );
    } catch (err) {
      // Always clear client state even if server call fails
      return rejectWithValue(
        err.response?.data?.message || 'Logout failed.'
      );
    }
  }
);

// ─── Forgot Password — sends OTP to email ────────────────────────────────────
export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (email, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/auth/forgot-password`,
        { email }
      );
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to send OTP. Please try again.'
      );
    }
  }
);

// ─── Verify OTP ───────────────────────────────────────────────────────────────
export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/auth/verify-otp`,
        { email, otp }
      );
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || 'Invalid or expired OTP.'
      );
    }
  }
);

// ─── Reset Password ───────────────────────────────────────────────────────────
export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async ({ email, otp, newPassword }, { rejectWithValue }) => {
    try {
      const { data } = await axios.post(
        `${API}/api/auth/reset-password`,
        { email, otp, newPassword }
      );
      return data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || 'Password reset failed. Please try again.'
      );
    }
  }
);

// ─── Update Profile ───────────────────────────────────────────────────────────
// PUT /api/auth/profile — only the whitelisted fields are sent. The server
// returns { success, user } (already run through toPublic), and we replace
// state.user with it so the UI reflects the change immediately.
export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (updates, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const { data } = await axios.put(
        `${API}/api/auth/profile`,
        updates, // { name?, phone?, bio?, profilePicture?, linkedIn?, github?, skills?, expertise? }
        authHeader(token)
      );
      return data.user;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to update profile. Please try again.'
      );
    }
  }
);

// PUT /api/auth/profile-photo (multipart)
export const uploadProfilePhoto = createAsyncThunk(
  'auth/uploadProfilePhoto',
  async (file, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token;
      const formData = new FormData();
      formData.append('profilePhoto', file);

      const { data } = await axios.put(`${API}/api/auth/profile-photo`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      return data.user;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || 'Failed to upload profile photo.'
      );
    }
  }
);


// =============================================================================
// INITIAL STATE
// =============================================================================
const bootToken = readToken(); // [FIX 2] sanitized read — never "undefined"/"null"

const initialState = {
  user:            null,
  role:            null,
  token:           bootToken,
  isAuthenticated: !!bootToken,
  status:          'idle',  // 'idle' | 'loading'
  error:           null,
};

// =============================================================================
// SLICE
// =============================================================================
const authSlice = createSlice({
  name: 'auth',
  initialState,

  reducers: {
    // Clear Redux error state (called after showing toast)
    clearError(state) {
      state.error = null;
    },

    // Synchronous logout — wipes state + localStorage immediately
    // Use this for instant UI response; pair with logoutUser thunk for backend call
    logout(state) {
      state.user            = null;
      state.token           = null;
      state.isAuthenticated = false;
      clearToken();
    },

    // Called on Google OAuth callback — token arrives via URL query param
    setCredentials(state, action) {
      const { user, token } = action.payload;
      state.user            = user;
      state.token           = token;
      state.isAuthenticated = true;
      persistToken(token);
    },

    // Called by axios interceptor after silent token refresh — updates token
    // without clearing the user object so the UI stays on the current page.
    setToken(state, action) {
      state.token           = action.payload;
      state.isAuthenticated = !!action.payload;
      if (action.payload) persistToken(action.payload);
      else clearToken();
    },
  },

  extraReducers: (builder) => {
    builder

      // ── register ───────────────────────────────────────────────────────────
      .addCase(register.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.status = 'idle';
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'idle';
        state.error  = action.payload;
      })

      // ── login ──────────────────────────────────────────────────────────────
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status          = 'idle';
        state.user            = action.payload.user;
        state.role            = action.payload.role;
        state.token           = action.payload.accessToken;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'idle';
        state.error  = action.payload;
      })

      // ── fetchCurrentUser ───────────────────────────────────────────────────
      .addCase(fetchCurrentUser.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.status          = 'idle';
        state.user            = action.payload.user;
        state.role            = action.payload.role;
        state.isAuthenticated = true;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        // Token is invalid or expired — clear everything
        state.status          = 'idle';
        state.user            = null;
        state.token           = null;
        state.isAuthenticated = false;
        clearToken();
      })

      // ── logoutUser (async — calls backend to rotate sessionToken) ──────────
      .addCase(logoutUser.pending, (state) => {
        state.status = 'loading';      // [FIX 4]
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.status          = 'idle';
        state.user            = null;
        state.token           = null;
        state.isAuthenticated = false;
        clearToken();
      })
      .addCase(logoutUser.rejected, (state) => {
        // Clear client state even when server call fails
        state.status          = 'idle';
        state.user            = null;
        state.token           = null;
        state.isAuthenticated = false;
        clearToken();
      })

      // ── forgotPassword ─────────────────────────────────────────────────────
      .addCase(forgotPassword.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.status = 'idle';
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.status = 'idle';
        state.error  = action.payload;
      })

      // ── verifyOtp ──────────────────────────────────────────────────────────
      .addCase(verifyOtp.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(verifyOtp.fulfilled, (state) => {
        state.status = 'idle';
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.status = 'idle';
        state.error  = action.payload;
      })

      // ── resetPassword ──────────────────────────────────────────────────────
      .addCase(resetPassword.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.status = 'idle';
        // User must sign in fresh after reset — no auto-login
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.status = 'idle';
        state.error  = action.payload;
      })

      // ── updateProfile ──────────────────────────────────────────────────────
      .addCase(updateProfile.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.status = 'idle';
        // Merge so any fields the server didn't return stay intact
        state.user   = { ...state.user, ...action.payload };
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.status = 'idle';
        state.error  = action.payload;
      })
      // ── uploadProfilePhoto ────────────────────────────────────────────────
      .addCase(uploadProfilePhoto.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(uploadProfilePhoto.fulfilled, (state, action) => {
        state.status = 'idle';
        // state.user   = { ...state.user, ...action.payload };
        state.user   = action.payload; // ← not spread, full replace
      })
      .addCase(uploadProfilePhoto.rejected, (state, action) => {
        state.status = 'idle';
        state.error  = action.payload;
      });
  },
});


// =============================================================================
// SELECTORS
// =============================================================================
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectUserRole        = (state) => state.auth.user?.role ?? state.auth.role ?? null;
export const selectCurrentUser     = (state) => state.auth.user;
export const selectAuthStatus      = (state) => state.auth.status;
export const selectAuthError       = (state) => state.auth.error;
export const selectToken           = (state) => state.auth.token;

// =============================================================================
// NAMED ACTIONS + DEFAULT EXPORT
// =============================================================================
export const { clearError, logout, setCredentials, setToken } = authSlice.actions;

export default authSlice.reducer;