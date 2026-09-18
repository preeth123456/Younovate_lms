import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { pushNotification, fetchNotifications } from '../features/notifications/notificationsSlice';

// Module-level listener registry so extra UI (e.g. the dashboard bell keeps
// its own local list) can mirror `notification:new` without opening a second
// socket connection (prevents duplicate events on reconnect/refresh).
const listeners = new Set();
function emitToListeners(data) {
  listeners.forEach((fn) => {
    try { fn(data); } catch (_) {}
  });
}

let sharedSocket = null;
let sharedToken = null;
let refCount = 0;

/**
 * Global notification socket: joins own `user:<id>` room (existing backend
 * socketService rooms) and pushes `notification:new` into the bell slice.
 * No new realtime tech — same socket.io-client the app already uses.
 * The underlying socket is shared + ref-counted across hook users so two
 * mounted bells never create two connections (no duplicate notifications).
 */
export function useNotificationSocket() {
  const dispatch = useDispatch();
  const token = useSelector((s) => s.auth?.token || '');
  useEffect(() => {
    if (!token) return undefined;
    if (!sharedSocket || sharedToken !== token) {
      try { sharedSocket?.disconnect(); } catch (_) {}
      const base = (API_BASE_URL || '').replace(/\/$/, '');
      sharedSocket = io(base, { auth: { token }, transports: ['websocket', 'polling'] });
      sharedToken = token;
      sharedSocket.on('notification:new', (data) => {
        if (data?._id) dispatch(pushNotification(data));
        else dispatch(fetchNotifications());
        emitToListeners(data);
      });
    }
    refCount += 1;
    return () => {
      refCount = Math.max(0, refCount - 1);
      if (refCount === 0 && sharedSocket) {
        try { sharedSocket.disconnect(); } catch (_) {}
        sharedSocket = null;
        sharedToken = null;
      }
    };
  }, [dispatch, token]);
  return null;
}

/** Mirror `notification:new` into local component state (no new socket). */
export function useNotificationEvent(fn) {
  useEffect(() => {
    if (typeof fn !== 'function') return undefined;
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, [fn]);
  return null;
}
