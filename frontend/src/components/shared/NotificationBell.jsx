import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';

const DEFAULT_DEV_API_BASE = 'http://localhost:8080';
const PRODUCTION_API_BASE = 'https://younovate-lms.onrender.com';

const isBrowserLocalhost = () => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
};

const API_BASE_URL = (
  process.env.REACT_APP_API_BASE_URL ||
  (isBrowserLocalhost()
    ? DEFAULT_DEV_API_BASE
    : (process.env.NODE_ENV === 'production' ? PRODUCTION_API_BASE : DEFAULT_DEV_API_BASE))
).replace(/\/+$/, '');

const API = API_BASE_URL;

const S = {
  wrapper:     { position: 'relative', display: 'inline-flex' },
  bellBtn:     { background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', transition: 'background-color 0.2s' },
  bellBtnHover:{ backgroundColor: '#F1F5F9' },
  badge:       { position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, background: '#DC2626', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid #fff' },
  dropdown:    { position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, maxHeight: 420, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 10px 40px rgba(15,23,42,0.15)', overflow: 'hidden', zIndex: 1000, display: 'flex', flexDirection: 'column' },
  dropdownHd:  { padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  dropdownList:{ overflowY: 'auto', flex: 1, padding: 8 },
  dropdownFt:  { padding: '10px 16px', borderTop: '1px solid #E2E8F0', textAlign: 'center' },
  item:        { padding: '10px 12px', borderRadius: 8, cursor: 'pointer', transition: 'background-color 0.15s', margin: '2px 8px' },
  itemUnread:  { background: '#F0F9FF' },
  itemRead:    { background: 'transparent' },
  itemHover:   { backgroundColor: '#F8FAFC' },
  itemIcon:    { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 10 },
  itemContent: { flex: 1, minWidth: 0 },
  itemTitle:   { fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemMsg:     { fontSize: 12, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemTime:    { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  markAllBtn:  { background: 'none', border: 'none', color: '#3B82F6', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 4 },
  empty:       { padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 },
  overlay:     { position: 'fixed', inset: 0, zIndex: 999 },
};

const ICON_MAP = {
  certificate_assigned:  { bg: '#DBEAFE', color: '#1D4ED8', icon: 'ti ti-certificate' },
  certificate_sent:      { bg: '#D1FAE5', color: '#065F46', icon: 'ti ti-mail' },
  certificate_received:  { bg: '#D1FAE5', color: '#065F46', icon: 'ti ti-certificate' },
  session_scheduled:     { bg: '#FEF3C7', color: '#92400E', icon: 'ti ti-calendar' },
  session_cancelled:     { bg: '#FEE2E2', color: '#B91C1C', icon: 'ti ti-calendar-x' },
  session_rescheduled:   { bg: '#FEF3C7', color: '#92400E', icon: 'ti ti-calendar-clock' },
  workshop_assigned:     { bg: '#E0E7FF', color: '#3730A3', icon: 'ti ti-graduation-cap' },
  feedback_available:    { bg: '#FCE7F3', color: '#BE185D', icon: 'ti ti-star' },
  assignment_due:        { bg: '#FEF3C7', color: '#92400E', icon: 'ti ti-file-text' },
  default:               { bg: '#F1F5F9', color: '#475569', icon: 'ti ti-bell' },
};

function fmtTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function NotificationBell() {
  const token = useSelector(s => s.auth?.token || '');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${API}/api/notifications/unread-count`, { headers });
      setUnreadCount(data.count || 0);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }, [token]);

  const fetchNotifications = useCallback(async () => {
    if (!token || loading) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/notifications?limit=20`, { headers });
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [token, loading]);

  const handleRead = async (notificationId) => {
    try {
      await axios.put(`${API}/api/notifications/${notificationId}/read`, {}, { headers });
      setNotifications(prev => prev.map(n => n._id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleReadAll = async () => {
    try {
      await axios.put(`${API}/api/notifications/read-all`, {}, { headers });
      setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleItemClick = (notification) => {
    if (!notification.read) handleRead(notification._id);
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
    setOpen(false);
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!token) return null;

  return (
    <div style={S.wrapper} ref={dropdownRef}>
      <button
        style={S.bellBtn}
        onClick={() => setOpen(!open)}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <i className={`ti ti-bell ${open ? 'text-primary' : ''}`} style={{ fontSize: 20 }} />
        {unreadCount > 0 && <span style={S.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <>
          <div style={S.overlay} onClick={() => setOpen(false)} />
          <div style={S.dropdown}>
            <div style={S.dropdownHd}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Notifications</h4>
              {unreadCount > 0 && (
                <button style={S.markAllBtn} onClick={handleReadAll}>Mark all as read</button>
              )}
            </div>
            <div style={S.dropdownList}>
              {loading ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>Loading...</div>
              ) : notifications.length === 0 ? (
                <div style={S.empty}>No notifications yet.</div>
              ) : (
                notifications.map(n => {
                  const iconConfig = ICON_MAP[n.type] || ICON_MAP.default;
                  return (
                    <div
                      key={n._id}
                      style={{
                        ...S.item,
                        ...(n.read ? S.itemRead : S.itemUnread),
                      }}
                      onClick={() => handleItemClick(n)}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = n.read ? 'transparent' : '#F0F9FF'; }}
                    >
                      <div style={{ ...S.itemIcon, background: iconConfig.bg, color: iconConfig.color }}>
                        <i className={iconConfig.icon} style={{ fontSize: 14 }} />
                      </div>
                      <div style={S.itemContent}>
                        <div style={S.itemTitle}>{n.title}</div>
                        <div style={S.itemMsg}>{n.message}</div>
                        <div style={S.itemTime}>{fmtTime(n.createdAt)}</div>
                      </div>
                      {!n.read && <div style={{ width: 8, height: 8, background: '#3B82F6', borderRadius: '50%', flexShrink: 0, marginLeft: 8 }} />}
                    </div>
                  );
                })
              )}
            </div>
            {notifications.length > 0 && (
              <div style={S.dropdownFt}>
                <button style={S.markAllBtn} onClick={handleReadAll}>Mark all as read</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}