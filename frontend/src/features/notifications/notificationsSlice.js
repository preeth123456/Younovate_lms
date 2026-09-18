// src/features/notifications/notificationsSlice.js
// Minimal inbox slice for the EXISTING SidebarLayout bell (NotifPanel).
// GET /api/notifications (own only) + PATCH read/read-all. Socket
// `notification:new` refreshes the same list (existing socket.io-client).
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;

const authHeader = (getState) => {
  const s = getState();
  const token = s.auth?.token || s.auth?.accessToken || '';
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { data } = await axios.get(`${API}/api/notifications`, { ...authHeader(getState), params: { limit: 50 } });
      return { notifications: data.notifications || [], unreadCount: data.unreadCount || 0 };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load notifications');
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id, { getState, rejectWithValue }) => {
    try {
      // Backend route is PUT /api/notifications/:id/read (not PATCH).
      await axios.put(`${API}/api/notifications/${id}/read`, {}, authHeader(getState));
      return { id };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to mark as read');
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { getState, rejectWithValue }) => {
    try {
      // Backend route is PUT /api/notifications/read-all (not PATCH).
      await axios.put(`${API}/api/notifications/read-all`, {}, authHeader(getState));
      return {};
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to mark all as read');
    }
  }
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: { items: [], unreadCount: 0, status: 'idle', error: null },
  reducers: {
    pushNotification(state, action) {
      const n = action.payload;
      if (!n || !n._id) return;
      if (!state.items.some((x) => String(x._id) === String(n._id))) {
        state.items.unshift({ ...n, read: false });
        state.unreadCount += 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (s) => { s.status = 'loading'; s.error = null; })
      .addCase(fetchNotifications.fulfilled, (s, a) => {
        s.status = 'succeeded';
        s.items = a.payload.notifications;
        s.unreadCount = a.payload.unreadCount;
      })
      .addCase(fetchNotifications.rejected, (s, a) => { s.status = 'failed'; s.error = a.payload; })
      .addCase(markNotificationRead.fulfilled, (s, a) => {
        const it = s.items.find((x) => String(x._id) === String(a.payload.id));
        if (it && !it.read) { it.read = true; s.unreadCount = Math.max(0, s.unreadCount - 1); }
      })
      .addCase(markAllNotificationsRead.fulfilled, (s) => {
        s.items.forEach((x) => { x.read = true; });
        s.unreadCount = 0;
      });
  },
});

export const { pushNotification } = notificationsSlice.actions;
export const selectNotifications = (s) => s.notifications.items;
export const selectUnreadCount = (s) => s.notifications.unreadCount;
export const selectNotificationsStatus = (s) => s.notifications.status;
export default notificationsSlice.reducer;
