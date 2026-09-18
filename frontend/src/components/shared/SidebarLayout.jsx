// src/components/shared/SidebarLayout.jsx
// Youva OS — Shared Sidebar Layout v3.0
//
// ✅ v3 ADDITIONS:
//   • Clickable Search → opens a search popover (autofocus input, clear, Enter to search)
//   • Clickable Notifications bell → dropdown with ALL / DISCUSSIONS / COURSE tabs + empty state
//   • Mobile bottom navigation bar (top-level items) with active state + badges
//   • Click-outside / Escape / route-change close all popovers; only one open at a time
// (v2 features kept: profile dropdown, submenus, mobile sidebar overlay, collapse, a11y)

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { store } from '../../app/store';
import { logout, logoutUser, selectCurrentUser, selectUserRole } from '../../features/auth/authSlice';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../features/notifications/notificationsSlice';
import { useNotificationSocket } from '../../hooks/useNotificationSocket';
import toast from 'react-hot-toast';

// ─── Role → brand colour ──────────────────────────────────────────────────────
const ROLE_COLOR = {
  admin:   '#3f7da0',
  trainer: '#3f7da0',
  trainee: '#3f7da0',
  hr:      '#3f7da0',
};

// ─── Internal context ─────────────────────────────────────────────────────────
const SidebarCtx = createContext({ collapsed: false, brandColor: '#6366F1' });

// ─── Tiny hook: run callback when user clicks outside a ref ──────────────────
function useClickOutside(ref, callback, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) callback();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [ref, callback, enabled]);
}

// ─── Icon ─────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 18, className = '', style = {} }) => (
  <i
    className={`ti ti-${name} ${className}`}
    style={{ fontSize: size, lineHeight: 1, display: 'inline-block', ...style }}
    aria-hidden="true"
  />
);

// ─── Single flat nav link ─────────────────────────────────────────────────────
const FlatLink = ({ item, closeMobile }) => {
  const { collapsed } = useContext(SidebarCtx);
  return (
    <NavLink
      to={item.to}
      onClick={closeMobile}
      title={collapsed ? item.label : undefined}
      className="yn-navlink"
      style={({ isActive }) => ({
        '--active-bg':     isActive ? 'rgba(255,255,255,0.17)' : 'transparent',
        '--active-border': isActive ? '#ffffff' : 'transparent',
        '--active-color':  isActive ? '#ffffff' : '#c5d3e4',
      })}
    >
      <span className="yn-navlink-icon">
        <Icon name={item.icon} size={17} />
      </span>
      {!collapsed && (
        <>
          <span className="yn-navlink-text">{item.label}</span>
          {item.badge > 0 && (
            <span className="yn-badge">{item.badge > 99 ? '99+' : item.badge}</span>
          )}
        </>
      )}
    </NavLink>
  );
};

// ─── Submenu parent + children ────────────────────────────────────────────────
const SubMenu = ({ item, closeMobile }) => {
  const { collapsed } = useContext(SidebarCtx);
  const location = useLocation();

  const hasActiveChild = item.children.some(c => location.pathname.startsWith(c.to));
  const [open, setOpen] = useState(hasActiveChild);

  useEffect(() => { if (hasActiveChild) setOpen(true); }, [hasActiveChild]);

  const toggle = () => setOpen(o => !o);

  if (collapsed) {
    return (
      <div className="yn-submenu-flyout-wrap">
        <button
          className="yn-navlink yn-navlink-btn"
          title={item.label}
          style={{
            '--active-bg':     hasActiveChild ? 'rgba(255,255,255,0.17)' : 'transparent',
            '--active-border': hasActiveChild ? '#ffffff' : 'transparent',
            '--active-color':  hasActiveChild ? '#f1f5f9' : '#94a3b8',
          }}
        >
          <span className="yn-navlink-icon">
            <Icon name={item.icon} size={17} />
          </span>
        </button>
        <div className="yn-flyout">
          <p className="yn-flyout-title">{item.label}</p>
          {item.children.map(c => (
            <NavLink
              key={c.to}
              to={c.to}
              onClick={closeMobile}
              className="yn-flyout-link"
              style={({ isActive }) => ({
                color:      isActive ? '#ffffff' : '#c5d3e4',
                background: isActive ? 'rgba(255,255,255,0.17)' : 'transparent',
              })}
            >
              <Icon name={c.icon} size={14} style={{ marginRight: 8 }} />
              {c.label}
              {c.badge > 0 && (
                <span className="yn-badge" style={{ marginLeft: 'auto' }}>{c.badge}</span>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="yn-submenu-wrap">
      <button
        className="yn-navlink yn-navlink-btn"
        onClick={toggle}
        aria-expanded={open}
        style={{
          '--active-bg':     hasActiveChild ? 'rgba(255,255,255,0.17)' : 'transparent',
          '--active-border': hasActiveChild ? '#ffffff' : 'transparent',
          '--active-color':  hasActiveChild ? '#ffffff' : '#c5d3e4',
        }}
      >
        <span className="yn-navlink-icon">
          <Icon name={item.icon} size={17} />
        </span>
        <span className="yn-navlink-text">{item.label}</span>
        {item.badge > 0 && <span className="yn-badge">{item.badge}</span>}
        <Icon
          name="chevron-down"
          size={14}
          style={{ marginLeft: 'auto', flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      <div className="yn-submenu-children" style={{ maxHeight: open ? `${item.children.length * 44}px` : '0px' }}>
        {item.children.map(c => (
          <NavLink
            key={c.to}
            to={c.to}
            onClick={closeMobile}
            className="yn-sub-link"
            style={({ isActive }) => ({
              color:      isActive ? '#ffffff' : '#c5d3e4',
              background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
              borderLeft: isActive ? '2px solid #ffffff' : '2px solid transparent',
            })}
          >
            <Icon name={c.icon} size={14} style={{ marginRight: 8, flexShrink: 0 }} />
            <span className="yn-sub-link-text">{c.label}</span>
            {c.badge > 0 && <span className="yn-badge" style={{ marginLeft: 'auto' }}>{c.badge}</span>}
          </NavLink>
        ))}
      </div>
    </div>
  );
};

// ─── Nav section group ────────────────────────────────────────────────────────
const NavSection = ({ group, closeMobile }) => {
  const { collapsed } = useContext(SidebarCtx);
  const items = group.items || [group];
  return (
    <div className="yn-nav-section">
      {!collapsed && group.label && <p className="yn-section-label">{group.label}</p>}
      {items.map(item =>
        item.children?.length
          ? <SubMenu key={item.label || item.to} item={item} closeMobile={closeMobile} />
          : <FlatLink key={item.to} item={item} closeMobile={closeMobile} />
      )}
    </div>
  );
};

// ─── Search popover ───────────────────────────────────────────────────────────
const SearchPanel = ({ value, onChange, onSubmit, onClear, inputRef }) => (
  <div className="yn-pop yn-search-pop" role="dialog" aria-label="Search">
    <div className="yn-search-box">
      <Icon name="search" size={15} style={{ color: '#94a3b8', flexShrink: 0 }} />
      <input
        ref={inputRef}
        className="yn-search-input"
        value={value}
        placeholder="Search…"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onSubmit(value.trim()); }}
      />
      {value && (
        <button className="yn-search-clear" onClick={onClear} aria-label="Clear search">
          <Icon name="x" size={13} />
        </button>
      )}
    </div>
    <div className="yn-pop-body">
      <p className="yn-pop-empty">
        {value.trim() ? `Press Enter to search “${value.trim()}”` : 'Type to search across the app.'}
      </p>
    </div>
  </div>
);

// ─── Notifications dropdown (existing Notification API + realtime) ────────────
// Bell inbox: GET /api/notifications (own only), unread badge, mark read /
// mark-all-read, `notification:new` socket refresh. Reuses existing tab style.
const NotifPanel = () => {
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.notifications?.items ?? []);
  const unread = useAppSelector((s) => s.notifications?.unreadCount ?? 0);
  const nStatus = useAppSelector((s) => s.notifications?.status ?? 'idle');
  const [tab, setTab] = useState('all');
  const tabs = [['all', 'All'], ['discussions', 'Discussions'], ['course', 'Course']];

  useEffect(() => { dispatch(fetchNotifications()); }, [dispatch]);

  const filtered = items.filter((n) => {
    if (tab === 'all') return true;
    const mod = String(n.module || n.metadata?.module || '').toLowerCase();
    const kind = String(n.kind || n.type || '').toLowerCase();
    if (tab === 'course') return mod.includes('lms') || mod.includes('course') || kind.includes('course') || kind.includes('lms') || kind.includes('assess') || kind.includes('assign') || kind.includes('certif');
    return mod.includes('workshop') || mod.includes('discuss') || kind.includes('session') || kind.includes('feedback') || kind.includes('record');
  });

  const openNotif = (n) => {
    if (!n.read) dispatch(markNotificationRead(n._id));
    const link = n.link || n.actionUrl;
    // Links are trusted app-relative routes only — never open external URLs.
    if (link && link.startsWith('/')) window.location.assign(link);
  };

  return (
    <div className="yn-pop yn-notif-pop" role="dialog" aria-label="Notifications">
      <div className="yn-notif-head">
        <span className="yn-notif-title">Notifications{unread > 0 ? ` (${unread})` : ''}</span>
        {unread > 0 && (
          <button className="yn-notif-markall" onClick={() => dispatch(markAllNotificationsRead())}>
            Mark all read
          </button>
        )}
      </div>
      <div className="yn-notif-tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={`yn-notif-tab ${tab === id ? 'is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="yn-notif-body">
        {nStatus === 'loading' && items.length === 0 ? (
          <p className="yn-pop-empty">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="yn-pop-empty">You have no notifications</p>
        ) : (
          filtered.slice(0, 20).map((n) => (
            <button
              key={n._id}
              className={`yn-notif-item${n.read ? '' : ' is-unread'}`}
              onClick={() => openNotif(n)}
            >
              <span className="yn-notif-item-title">{n.title}</span>
              <span className="yn-notif-item-msg">{n.message}</span>
              <span className="yn-notif-item-time">{n.createdAt ? new Date(n.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

// ─── Profile dropdown ─────────────────────────────────────────────────────────
const ProfileDropdown = ({ user, brandColor, onLogout, loggingOut, onClose }) => {
  const navigate = useNavigate();
  return (
    <div className="yn-profile-dropdown" role="menu" aria-label="User menu">
      <div className="yn-profile-header" style={{ borderBottom: `3px solid ${brandColor}` }}>
        <div className="yn-profile-avatar" style={{ background: brandColor }}>
          {user?.name?.slice(0, 2).toUpperCase() || 'YN'}
        </div>
        <div className="yn-profile-info">
          <p className="yn-profile-name">{user?.name || 'User'}</p>
          <p className="yn-profile-role">{user?.role}</p>
          <p className="yn-profile-email">{user?.email || ''}</p>
        </div>
      </div>

      <div className="yn-profile-actions">
        <button className="yn-profile-action" onClick={() => { navigate(`/${user?.role}/settings`); onClose(); }} role="menuitem">
          <Icon name="settings" size={15} />
          <span>Settings</span>
        </button>
        <button className="yn-profile-action" onClick={() => { navigate(`/${user?.role}/profile`); onClose(); }} role="menuitem">
          <Icon name="user-circle" size={15} />
          <span>My Profile</span>
        </button>
        {user?.isMentor && (
          <div className="yn-profile-mentor-badge">
            <Icon name="award" size={13} />
            <span>Mentor</span>
          </div>
        )}
      </div>

      <div className="yn-profile-divider" />

      <button className="yn-profile-logout" onClick={onLogout} disabled={loggingOut} role="menuitem">
        <Icon name="logout" size={15} />
        <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
      </button>
    </div>
  );
};

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function SidebarLayout({
  navItems,
  brandColor,
  title = 'YouVA OS',
  pageTitle,
}) {
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = useAppSelector(selectCurrentUser);
  const role      = useAppSelector(selectUserRole);
  const notifUnread = useAppSelector((s) => s.notifications?.unreadCount ?? 0);

  // Realtime inbox: backend `notification:new` → pushNotification + badge.
  // Polling fallback every 60s so the badge stays fresh if sockets drop.
  useNotificationSocket();
  useEffect(() => {
    if (!user?._id) return undefined;
    dispatch(fetchNotifications());
    const t = setInterval(() => dispatch(fetchNotifications()), 60000);
    return () => clearInterval(t);
  }, [dispatch, user?._id]);

  const resolvedColor = brandColor || ROLE_COLOR[user?.role] || '#6366F1';
  const initials      = user?.name?.slice(0, 2).toUpperCase() || 'YN';

  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [searchQ,     setSearchQ]     = useState('');
  const [loggingOut,  setLoggingOut]  = useState(false);

  const profileRef    = useRef(null);
  const sidebarRef    = useRef(null);
  const searchRef     = useRef(null);
  const notifRef      = useRef(null);
  const searchInputRef = useRef(null);

  // Close everything on route change
  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
    setSearchOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  // Escape closes all overlays
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setProfileOpen(false);
        setSearchOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Click-outside for each popover
  useClickOutside(profileRef, () => setProfileOpen(false), profileOpen);
  useClickOutside(searchRef,  () => setSearchOpen(false),  searchOpen);
  useClickOutside(notifRef,   () => setNotifOpen(false),   notifOpen);

  // Autofocus search input when the panel opens
  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [searchOpen]);

  // Only one popover open at a time
  const toggleSearch  = () => { setSearchOpen(v => !v); setNotifOpen(false);  setProfileOpen(false); };
  const toggleNotif   = () => { setNotifOpen(v => !v);  setSearchOpen(false); setProfileOpen(false); };
  const toggleProfile = () => { setProfileOpen(v => !v); setSearchOpen(false); setNotifOpen(false); };

  // Derived page title
  const currentLabel = (() => {
    if (pageTitle) return pageTitle;
    const allItems = navItems.flatMap(g => {
      const items = g.items || [g];
      return items.flatMap(i => i.children?.length ? i.children : [i]);
    });
    const match = allItems
      .filter(i => i.to)
      .sort((a, b) => b.to.length - a.to.length)
      .find(i => location.pathname.startsWith(i.to));
    return match?.label || title;
  })();

  // Top-level items for the mobile bottom nav (max 5)
  const bottomNavItems = navItems
    .flatMap(g => g.items || [g])
    .map(it => ({ to: it.to || it.children?.[0]?.to, label: it.label, icon: it.icon, badge: it.badge }))
    .filter(it => it.to && it.icon)
    .slice(0, 5);

  const handleLogout = useCallback(() => {
    if (loggingOut) return;
    setLoggingOut(true);
    setProfileOpen(false);

    const token = store.getState().auth.token;
    dispatch(logout());
    navigate('/login', { replace: true });
    toast.success('Signed out successfully');
    dispatch(logoutUser({ token }));
  }, [dispatch, navigate, loggingOut]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const runSearch = (q) => {
    const userRole = role || user?.role;
    if (!userRole) return;
    navigate(`/${userRole}/search?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  };

  return (
    <SidebarCtx.Provider value={{ collapsed, brandColor: resolvedColor }}>
      <style>{buildCSS(resolvedColor)}</style>

      <div className="yn-shell">

        {/* ── Mobile backdrop ── */}
        {mobileOpen && (
          <div className="yn-backdrop" onClick={closeMobile} role="presentation" aria-hidden="true" />
        )}

        {/* ── Sidebar ── */}
        <aside
          ref={sidebarRef}
          className={['yn-sidebar', collapsed ? 'yn-collapsed' : '', mobileOpen ? 'yn-mobile-open' : ''].join(' ')}
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="yn-brand">
            <div className="yn-brand-logo">Y</div>
            {!collapsed && (
              <div className="yn-brand-text-container">
                <div className="yn-brand-main">YouVA OS</div>
                <div className="yn-brand-sub">{user?.role ? `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Dashboard` : 'Dashboard'}</div>
              </div>
            )}
            <button className="yn-collapse-btn yn-desktop-only" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={15} />
            </button>
            <button className="yn-collapse-btn yn-mobile-only" onClick={closeMobile} aria-label="Close navigation">
              <Icon name="x" size={15} />
            </button>
          </div>

          <div className="yn-nav-scroll">
            {navItems.map((group, gi) => (
              <NavSection key={gi} group={group} closeMobile={closeMobile} />
            ))}
          </div>

          <div className="yn-sidebar-footer">
            {!collapsed ? (
              <div className="yn-footer-user">
                <div className="yn-footer-avatar" style={{ background: resolvedColor }}>{initials}</div>
                <div className="yn-footer-info">
                  <p className="yn-footer-name">{user?.name || 'User'}</p>
                  <p className="yn-footer-role">{user?.role}</p>
                </div>
                <button className="yn-footer-logout" onClick={handleLogout} disabled={loggingOut} title="Sign out" aria-label="Sign out">
                  <Icon name="logout" size={16} />
                </button>
              </div>
            ) : (
              <button className="yn-footer-logout yn-footer-logout-solo" onClick={handleLogout} disabled={loggingOut} title="Sign out" aria-label="Sign out">
                <Icon name="logout" size={16} />
              </button>
            )}
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="yn-main">

          {/* Top bar */}
          <header className="yn-topbar">
            <div className="yn-topbar-left">
              <button className="yn-hamburger" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}>
                <Icon name="menu-2" size={20} />
              </button>
              <h1 className="yn-page-title">{currentLabel}</h1>
            </div>

            <div className="yn-topbar-right">
              {/* Search */}
              <div ref={searchRef} className="yn-pop-wrap">
                <button className="yn-icon-btn" aria-label="Search" aria-expanded={searchOpen} onClick={toggleSearch}>
                  <Icon name="search" size={16} />
                </button>
                {searchOpen && (
                  <SearchPanel
                    value={searchQ}
                    onChange={setSearchQ}
                    onSubmit={runSearch}
                    onClear={() => { setSearchQ(''); searchInputRef.current?.focus(); }}
                    inputRef={searchInputRef}
                  />
                )}
              </div>

              {/* Notifications */}
              <div ref={notifRef} className="yn-pop-wrap">
                <button className="yn-icon-btn yn-notif-wrap" aria-label="Notifications" aria-expanded={notifOpen} onClick={toggleNotif}>
                  <Icon name="bell" size={16} />
                  {notifUnread > 0 && <span className="yn-notif-dot">{notifUnread > 99 ? '99+' : notifUnread}</span>}
                </button>
                {notifOpen && <NotifPanel />}
              </div>

              {/* Profile avatar + dropdown */}
              <div ref={profileRef} className="yn-profile-wrap">
                <button
                  className="yn-topbar-avatar"
                  style={{ background: resolvedColor }}
                  onClick={toggleProfile}
                  aria-label="Open user menu"
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                >
                  {initials}
                  <span className="yn-avatar-caret" style={{ transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <Icon name="chevron-down" size={10} />
                  </span>
                </button>

                {profileOpen && (
                  <ProfileDropdown
                    user={user}
                    brandColor={resolvedColor}
                    onLogout={handleLogout}
                    loggingOut={loggingOut}
                    onClose={() => setProfileOpen(false)}
                  />
                )}
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="yn-content yn-content-tight" id="main-content">
            <Outlet />
          </main>

          {/* ── Mobile bottom navigation ── */}
          {bottomNavItems.length > 0 && (
            <nav className="yn-bottomnav" aria-label="Primary">
              {bottomNavItems.map(it => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className="yn-bottomnav-link"
                  style={({ isActive }) => ({ color: isActive ? resolvedColor : '#64748b' })}
                >
                  <span className="yn-bottomnav-ic">
                    <Icon name={it.icon} size={20} />
                    {it.badge > 0 && <span className="yn-bottomnav-badge">{it.badge > 9 ? '9+' : it.badge}</span>}
                  </span>
                  <span className="yn-bottomnav-label">{it.label}</span>
                </NavLink>
              ))}
            </nav>
          )}
        </div>
      </div>
    </SidebarCtx.Provider>
  );
}

// ─── CSS factory ──────────────────────────────────────────────────────────────
function buildCSS(brandColor) {
  const rgb = brandColor.slice(1).match(/.{2}/g).map(h => parseInt(h, 16)).join(',');
  return `
@import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap');

:root {
  --yn-brand:    ${brandColor};
  --yn-sidebar:  #1f3d63;
  --yn-sidebar2: #26486f;
  --yn-sidebar-active: #48617f;
  --yn-text-1:   #ffffff;
  --yn-text-2:   #c5d3e4;
  --yn-text-3:   #9badc4;
  --yn-border:   rgba(255,255,255,0.14);
  --yn-page-bg:  #f5f8fc;
  --yn-line:     #dbe3ed;
  --yn-radius:   8px;
  --yn-font:     'Public Sans', system-ui, sans-serif;
}

*, *::before, *::after { box-sizing: border-box; }

.yn-shell { display: flex; height: 100vh; overflow: hidden; font-family: var(--yn-font); background: var(--yn-page-bg); }

/* Backdrop */
.yn-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(3px); z-index: 40; animation: yn-fade-in 0.2s ease; }
@keyframes yn-fade-in { from { opacity:0 } to { opacity:1 } }

/* Sidebar */
.yn-sidebar { width: 228px; background: var(--yn-sidebar); display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; transition: width 0.25s cubic-bezier(0.4,0,0.2,1); z-index: 50; position: relative; border-right: 1px solid #c9d7e6; }
.yn-sidebar.yn-collapsed { width: 64px; }

.yn-brand { display: flex; align-items: flex-start; gap: 10px; padding: 20px 20px 18px; border-bottom: 1px solid var(--yn-border); flex-shrink: 0; }
.yn-brand-logo { display: none; }
.yn-brand-text-container { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.yn-brand-main { color: var(--yn-text-1); font-weight: 800; font-size: 20px; letter-spacing: 0; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yn-brand-sub { color: var(--yn-text-3); font-weight: 500; font-size: 12px; letter-spacing: 0.3px; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: capitalize; }
.yn-collapse-btn { background: none; border: none; cursor: pointer; color: #d7e2ef; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; flex-shrink: 0; transition: color 0.15s, background 0.15s; }
.yn-collapse-btn:hover { color: #fff; background: rgba(255,255,255,0.10); }

.yn-nav-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 12px 0; scrollbar-width: thin; scrollbar-color: var(--yn-sidebar2) transparent; }
.yn-nav-scroll::-webkit-scrollbar { width: 4px; }
.yn-nav-scroll::-webkit-scrollbar-thumb { background: var(--yn-sidebar2); border-radius: 4px; }

.yn-nav-section { padding: 4px 0; }
.yn-section-label { font-size: 12px; font-weight: 500; letter-spacing: 1.8px; text-transform: uppercase; color: var(--yn-text-3); padding: 12px 16px 8px; white-space: nowrap; overflow: hidden; }

.yn-navlink { display: flex; align-items: center; gap: 12px; padding: 11px 16px; text-decoration: none; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; border-left: 0 solid transparent; background: var(--active-bg, transparent); color: var(--active-color, #94a3b8); transition: background 0.15s, color 0.15s, border-color 0.15s; cursor: pointer; width: 100%; font-family: var(--yn-font); }
.yn-navlink:hover { background: rgba(255,255,255,0.08); color: #ffffff; }
.yn-navlink-btn { border: none; text-align: left; }
.yn-navlink-icon { width: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #7eb8d8; }
.yn-navlink:hover .yn-navlink-icon { color: #ffffff; }
.yn-navlink[style*="rgba(255,255,255,0.17)"] .yn-navlink-icon { color: #ffffff; }
.yn-navlink-text { flex: 1; overflow: hidden; text-overflow: ellipsis; }

.yn-badge { font-size: 11px; font-weight: 800; background: #ef3b45; color: #fff; border-radius: 99px; padding: 1px 6px; flex-shrink: 0; }

.yn-submenu-wrap { position: relative; }
.yn-submenu-children { overflow: hidden; transition: max-height 0.25s cubic-bezier(0.4,0,0.2,1); }
.yn-sub-link { display: flex; align-items: center; padding: 9px 14px 9px 52px; font-size: 14px; font-weight: 650; text-decoration: none; border-left: 2px solid transparent; transition: background 0.15s, color 0.15s; white-space: nowrap; overflow: hidden; font-family: var(--yn-font); }
.yn-sub-link:hover { background: rgba(255,255,255,0.08); color: #ffffff; }
.yn-sub-link-text { overflow: hidden; text-overflow: ellipsis; flex: 1; }

.yn-submenu-flyout-wrap { position: relative; }
.yn-flyout { position: absolute; left: 100%; top: 0; background: #1f3d63; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; min-width: 180px; padding: 8px 0; z-index: 100; box-shadow: 0 16px 40px rgba(31,61,99,0.28); opacity: 0; pointer-events: none; transform: translateX(6px); transition: opacity 0.15s, transform 0.15s; }
.yn-submenu-flyout-wrap:hover .yn-flyout { opacity: 1; pointer-events: auto; transform: translateX(2px); }
.yn-flyout-title { font-size: 11px; font-weight: 700; letter-spacing: 0.7px; text-transform: uppercase; color: var(--yn-text-3); padding: 4px 14px 8px; }
.yn-flyout-link { display: flex; align-items: center; padding: 9px 14px; font-size: 13px; font-weight: 500; text-decoration: none; transition: background 0.15s; font-family: var(--yn-font); }
.yn-flyout-link:hover { background: rgba(255,255,255,0.06); }

.yn-sidebar-footer { border-top: 1px solid var(--yn-border); padding: 14px 12px; flex-shrink: 0; }
.yn-footer-user { display: flex; align-items: center; gap: 10px; min-width: 0; }
.yn-footer-avatar { width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 700; }
.yn-footer-info { flex: 1; min-width: 0; overflow: hidden; }
.yn-footer-name { margin: 0; color: var(--yn-text-1); font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yn-footer-role { margin: 0; color: var(--yn-text-3); font-size: 11px; text-transform: capitalize; margin-top: 1px; }
.yn-footer-logout { background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.16); color: #ffffff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
.yn-footer-logout:hover:not(:disabled) { background: rgba(255,255,255,0.18); }
.yn-footer-logout:disabled { opacity: 0.6; cursor: not-allowed; }
.yn-footer-logout-solo { width: 100%; border-radius: 8px; }

/* Main */
.yn-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; position: relative; }

.yn-topbar { height: 72px; background: #fff; border-bottom: 1px solid var(--yn-line); display: flex; align-items: center; justify-content: space-between; padding: 0 30px; flex-shrink: 0; z-index: 30; }
.yn-topbar-left  { display: flex; align-items: center; gap: 12px; }
.yn-topbar-right { display: flex; align-items: center; gap: 14px; }

.yn-hamburger { display: none; background: none; border: none; cursor: pointer; color: #64748B; padding: 6px; border-radius: 8px; align-items: center; justify-content: center; transition: background 0.15s; }
.yn-hamburger:hover { background: #F1F5F9; }

.yn-page-title { font-size: 18px; font-weight: 800; color: #050a16; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; }

.yn-icon-btn { width: 36px; height: 36px; background: none; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748B; transition: background 0.15s; }
.yn-icon-btn:hover { background: #edf3f9; }

.yn-notif-wrap { position: relative; }
.yn-notif-dot { position: absolute; top: 2px; right: 2px; min-width: 16px; height: 16px; padding: 0 4px; background: #EF4444; color: #fff; font-size: 10px; font-weight: 800; border-radius: 99px; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; line-height: 1; }

/* Popover wrapper (search + notifications) */
.yn-pop-wrap { position: relative; }
.yn-pop {
  position: absolute; top: calc(100% + 8px); right: 0;
  background: #fff; border: 1px solid var(--yn-line);
  border-radius: var(--yn-radius); box-shadow: 0 18px 45px rgba(31,61,99,0.18);
  z-index: 200; overflow: hidden;
  animation: yn-dropdown-in 0.18s cubic-bezier(0.34,1.3,0.64,1);
}

/* Search popover */
.yn-search-pop { width: 320px; }
.yn-search-box { display: flex; align-items: center; gap: 8px; padding: 11px 13px; border-bottom: 1px solid var(--yn-line); }
.yn-search-input { flex: 1; border: none; outline: none; background: none; font-size: 14px; font-family: var(--yn-font); color: #172033; min-width: 0; }
.yn-search-input::placeholder { color: #9badc4; }
.yn-search-clear { background: none; border: none; cursor: pointer; color: #94a3b8; display: flex; padding: 3px; border-radius: 5px; flex-shrink: 0; }
.yn-search-clear:hover { background: #f1f5f9; color: #475569; }
.yn-pop-body { padding: 16px; }
.yn-pop-empty { font-size: 13px; color: #94a3b8; text-align: center; margin: 0; }

/* Notifications popover */
.yn-notif-pop { width: 340px; }
.yn-notif-head { padding: 13px 16px 0; display: flex; align-items: center; justify-content: space-between; }
.yn-notif-title { font-size: 14px; font-weight: 700; color: #172033; }
.yn-notif-markall { border: none; background: none; cursor: pointer; font-family: var(--yn-font); font-size: 12px; font-weight: 700; color: var(--yn-brand); padding: 4px 6px; border-radius: 6px; }
.yn-notif-markall:hover { background: rgba(0,0,0,0.04); }
.yn-notif-tabs { display: flex; gap: 6px; padding: 10px 14px 12px; border-bottom: 1px solid var(--yn-line); }
.yn-notif-tab { border: none; background: none; cursor: pointer; font-family: var(--yn-font); font-size: 12px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; color: #94a3b8; padding: 5px 10px; border-radius: 6px; transition: background 0.15s, color 0.15s; }
.yn-notif-tab:hover { color: #475569; }
.yn-notif-tab.is-active { background: rgba(${rgb},0.12); color: var(--yn-brand); }
.yn-notif-body { padding: 10px 8px; max-height: 320px; overflow-y: auto; }
.yn-notif-item { width: 100%; display: block; text-align: left; border: none; background: none; cursor: pointer; padding: 10px 12px; border-radius: 8px; font-family: var(--yn-font); }
.yn-notif-item:hover { background: #f4f8fc; }
.yn-notif-item.is-unread { background: #f0f7ff; }
.yn-notif-item-title { display: block; font-size: 13px; font-weight: 700; color: #172033; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yn-notif-item-msg { display: block; font-size: 12px; color: #657691; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yn-notif-item-time { display: block; font-size: 11px; color: #94a3b8; margin-top: 3px; }

/* Profile avatar + caret */
.yn-profile-wrap { position: relative; }
.yn-topbar-avatar { display: flex; align-items: center; justify-content: center; gap: 0; width: 42px; height: 42px; padding: 0; border-radius: 99px; border: none; cursor: pointer; color: #fff; font-size: 15px; font-weight: 800; font-family: var(--yn-font); transition: opacity 0.15s; }
.yn-topbar-avatar:hover { opacity: 0.88; }
.yn-avatar-caret { display: none; }

.yn-profile-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 240px; background: #ffffff; border: 1px solid var(--yn-line); border-radius: var(--yn-radius); box-shadow: 0 18px 45px rgba(31,61,99,0.18); z-index: 200; animation: yn-dropdown-in 0.18s cubic-bezier(0.34,1.3,0.64,1); overflow: hidden; }
@keyframes yn-dropdown-in { from { opacity:0; transform: scale(0.9) translateY(-6px); } to { opacity:1; transform: scale(1) translateY(0); } }
.yn-profile-header { display: flex; align-items: center; gap: 12px; padding: 16px; }
.yn-profile-avatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; font-weight: 700; flex-shrink: 0; }
.yn-profile-info { min-width: 0; }
.yn-profile-name { margin: 0; color: #172033; font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yn-profile-role { margin: 0; color: var(--yn-brand); font-size: 12px; text-transform: capitalize; font-weight: 600; margin-top: 2px; }
.yn-profile-email { margin: 0; color: #657691; font-size: 11px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yn-profile-actions { padding: 8px 8px 0; }
.yn-profile-action { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 10px; border: none; border-radius: 8px; background: none; cursor: pointer; color: #657691; font-size: 13px; font-weight: 500; font-family: var(--yn-font); text-align: left; transition: background 0.15s, color 0.15s; }
.yn-profile-action:hover { background: #f4f8fc; color: #172033; }
.yn-profile-mentor-badge { display: inline-flex; align-items: center; gap: 5px; background: rgba(${rgb},0.18); color: var(--yn-brand); padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; margin: 6px 10px 2px; }
.yn-profile-divider { height: 1px; background: var(--yn-line); margin: 8px 0; }
.yn-profile-logout { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 18px 14px; border: none; background: none; cursor: pointer; color: #d92d28; font-size: 13px; font-weight: 700; font-family: var(--yn-font); text-align: left; transition: background 0.15s; }
.yn-profile-logout:hover:not(:disabled) { background: #fff0f0; }
.yn-profile-logout:disabled { opacity: 0.6; cursor: not-allowed; }

/* Page content */
.yn-content { flex: 1; overflow-y: auto; overflow-x: hidden; background: var(--yn-page-bg); }
.yn-content-tight > *:first-child { padding-top: 6px !important; margin-top: 0 !important; }

/* Mobile bottom navigation (hidden on desktop) */
.yn-bottomnav { display: none; }
.yn-bottomnav-link { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; text-decoration: none; padding: 4px 2px; font-family: var(--yn-font); min-width: 0; }
.yn-bottomnav-ic { position: relative; display: flex; align-items: center; justify-content: center; }
.yn-bottomnav-label { font-size: 10px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.yn-bottomnav-badge { position: absolute; top: -5px; right: -9px; background: #ef3b45; color: #fff; font-size: 9px; font-weight: 800; border-radius: 99px; padding: 0 4px; line-height: 15px; min-width: 15px; text-align: center; }

/* Visibility helpers */
.yn-desktop-only { display: flex; }
.yn-mobile-only  { display: none; }

/* Mobile */
@media (max-width: 768px) {
  .yn-sidebar { position: fixed; top: 0; left: 0; height: 100%; width: 260px !important; transform: translateX(-100%); transition: transform 0.28s cubic-bezier(0.4,0,0.2,1); }
  .yn-sidebar.yn-mobile-open { transform: translateX(0); }

  .yn-brand { padding: 16px 20px 14px; }
  .yn-brand-main { font-size: 18px; }
  .yn-brand-sub { font-size: 11px; }

  .yn-hamburger { display: flex; }
  .yn-desktop-only { display: none; }
  .yn-mobile-only  { display: flex; }
  .yn-main { width: 100%; }
  .yn-topbar { height: 62px; padding: 0 16px; }
  .yn-page-title { max-width: calc(100vw - 170px); font-size: 16px; }
  .yn-topbar-right { gap: 8px; }
  .yn-icon-btn { width: 34px; height: 34px; }
  .yn-topbar-avatar { width: 38px; height: 38px; font-size: 13px; }

  /* Popovers fit the viewport */
  .yn-profile-dropdown,
  .yn-search-pop,
  .yn-notif-pop { width: min(300px, calc(100vw - 20px)); right: 0; }

  /* Show bottom nav + clear space for it */
  .yn-bottomnav {
    display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 60;
    background: #fff; border-top: 1px solid var(--yn-line);
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
    justify-content: space-around; box-shadow: 0 -4px 18px rgba(31,61,99,0.06);
  }
  .yn-content { padding-bottom: 78px; }
}

@media (max-width: 420px) {
  .yn-topbar { padding: 0 12px; }
  .yn-page-title { max-width: calc(100vw - 150px); }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .yn-sidebar, .yn-backdrop, .yn-profile-dropdown, .yn-submenu-children, .yn-pop {
    transition: none; animation: none;
  }
}
`;
}