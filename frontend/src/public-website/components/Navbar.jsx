import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../app/hooks';
import { store } from '../../app/store';
import { selectIsAuthenticated, selectUserRole, selectCurrentUser, logout, logoutUser } from '../../features/auth/authSlice';
import GetStartedModal from './GetStartedModal';

const ROLE_REDIRECT = {
  admin: '/admin/dashboard',
  trainer: '/trainer/dashboard',
  trainee: '/trainee/dashboard',
  hr: '/hr/dashboard',
};

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectUserRole);
  const user = useAppSelector(selectCurrentUser);

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [getStartedOpen, setGetStartedOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    const token = store.getState().auth.token;
    dispatch(logout());
    navigate('/');
    dispatch(logoutUser({ token }));
  };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/programs', label: 'AI Programs' },
    { to: '/workshops', label: 'Workshops' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <style>{CSS}</style>
      <nav className={`ynav${scrolled ? ' ynav--scrolled' : ''}`}>
        <div className="ynav-inner">
          <Link to="/" className="ynav-logo">
            <div className="ynav-logo-icon">
              <span>Y</span>
              <div className="ynav-logo-glow" />
            </div>
            <span className="ynav-logo-text">YouVA <span>OS</span></span>
          </Link>

          <div className="ynav-links">
            {navLinks.map(l => (
              <Link key={l.to} to={l.to} className={`ynav-link${isActive(l.to) ? ' active' : ''}`}>
                {l.label}
                {isActive(l.to) && <span className="ynav-link-dot" />}
              </Link>
            ))}
          </div>

          <div className="ynav-actions">
            {isAuthenticated ? (
              <div className="ynav-user" ref={userMenuRef}>
                <button className="ynav-avatar-btn" onClick={() => setUserMenuOpen(v => !v)}>
                  <div className="ynav-avatar">
                    {user?.profilePicture
                      ? <img src={user.profilePicture} alt="avatar" />
                      : <span>{(user?.name || 'U')[0].toUpperCase()}</span>}
                  </div>
                  <span className="ynav-avatar-name">{user?.name?.split(' ')[0]}</span>
                  <i className="ti ti-chevron-down" />
                </button>
                {userMenuOpen && (
                  <div className="ynav-dropdown">
                    <div className="ynav-dropdown-header">
                      <div className="ynav-dropdown-name">{user?.name}</div>
                      <div className="ynav-dropdown-role">{role}</div>
                    </div>
                    <button className="ynav-dropdown-item" onClick={() => { navigate(ROLE_REDIRECT[role] || '/'); setUserMenuOpen(false); }}>
                      <i className="ti ti-layout-dashboard" /> Dashboard
                    </button>
                    <button className="ynav-dropdown-item ynav-dropdown-item--danger" onClick={handleLogout}>
                      <i className="ti ti-logout" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="ynav-btn-ghost">Login</Link>
                {/* // Sign Up hidden — account creation is not active right now.
                <Link to="/signup" className="ynav-btn-outline">Sign Up</Link>
                */}
                <button className="ynav-btn-primary" onClick={() => setGetStartedOpen(true)}>
                  Get Started <i className="ti ti-arrow-right" />
                </button>
              </>
            )}
          </div>

          <button className="ynav-hamburger" onClick={() => setMobileOpen(v => !v)} aria-label="Toggle menu">
            <i className={`ti ${mobileOpen ? 'ti-x' : 'ti-menu-2'}`} />
          </button>
        </div>

        {mobileOpen && (
          <div className="ynav-mobile">
            {navLinks.map(l => (
              <Link key={l.to} to={l.to} className={`ynav-mobile-link${isActive(l.to) ? ' active' : ''}`}>
                {l.label}
              </Link>
            ))}
            <div className="ynav-mobile-actions">
              {isAuthenticated ? (
                <>
                  <button className="ynav-btn-outline w-full" onClick={() => navigate(ROLE_REDIRECT[role] || '/')}>Dashboard</button>
                  <button className="ynav-btn-ghost w-full" onClick={handleLogout}>Logout</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="ynav-btn-ghost w-full">Login</Link>
                  {/* // Sign Up hidden — account creation is not active right now.
                  <Link to="/signup" className="ynav-btn-outline w-full">Sign Up</Link>
                  */}
                  <button className="ynav-btn-primary w-full" onClick={() => setGetStartedOpen(true)}>Get Started</button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      <GetStartedModal open={getStartedOpen} onClose={() => setGetStartedOpen(false)} />
    </>
  );
}

const CSS = `
  .ynav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(12px) saturate(180%);
    -webkit-backdrop-filter: blur(12px) saturate(180%);
    border-bottom: 1px solid #E2E8F0;
    transition: all 0.3s ease;
  }
  .ynav--scrolled {
    background: rgba(255,255,255,0.98);
    border-bottom-color: #E2E8F0;
    box-shadow: 0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(30,58,138,0.08);
  }
  .ynav-inner {
    max-width: 1200px; margin: 0 auto;
    padding: 0 24px; height: 68px;
    display: flex; align-items: center; gap: 32px;
  }
  .ynav-logo {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; flex-shrink: 0;
  }
  .ynav-logo-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #1E3A8A, #2563EB);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 800; font-size: 18px;
    position: relative; overflow: hidden;
    box-shadow: 0 4px 12px rgba(30,58,138,0.25);
  }
  .ynav-logo-icon span { position: relative; z-index: 1; }
  .ynav-logo-glow {
    position: absolute; inset: -4px;
    background: radial-gradient(circle, rgba(37,99,235,0.3), transparent 70%);
    animation: logo-pulse 2s ease-in-out infinite;
  }
  @keyframes logo-pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
  .ynav-logo-text {
    font-size: 18px; font-weight: 800; color: #0F172A; letter-spacing: -0.3px;
  }
  .ynav-logo-text span { color: #2563EB; }
  .ynav-links {
    display: flex; align-items: center; gap: 2px; flex: 1;
  }
  .ynav-link {
    padding: 8px 14px; border-radius: 8px;
    font-size: 14px; font-weight: 600; color: #475569;
    text-decoration: none; transition: all 0.2s;
    position: relative;
  }
  .ynav-link:hover { color: #0F172A; background: #F1F5F9; }
  .ynav-link.active { color: #1E3A8A; }
  .ynav-link-dot {
    position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
    width: 4px; height: 4px; border-radius: 50%;
    background: #2563EB;
  }
  .ynav-actions {
    display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  }
  .ynav-btn-ghost {
    padding: 8px 16px; border-radius: 8px;
    font-size: 14px; font-weight: 600; color: #475569;
    background: none; border: none; cursor: pointer;
    text-decoration: none; display: inline-flex; align-items: center;
    transition: all 0.2s;
  }
  .ynav-btn-ghost:hover { color: #0F172A; background: #F1F5F9; }
  .ynav-btn-outline {
    padding: 8px 18px; border-radius: 8px;
    font-size: 14px; font-weight: 600; color: #1E3A8A;
    background: #EEF4FF; border: 1px solid #BFDBFE; cursor: pointer;
    text-decoration: none; display: inline-flex; align-items: center;
    transition: all 0.2s;
  }
  .ynav-btn-outline:hover { background: #DBEAFE; border-color: #93C5FD; }
  .ynav-btn-primary {
    padding: 9px 20px; border-radius: 8px;
    font-size: 14px; font-weight: 700; color: #fff;
    background: linear-gradient(135deg, #1E3A8A, #2563EB);
    border: none; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    box-shadow: 0 4px 12px rgba(30,58,138,0.25);
    transition: all 0.2s; text-decoration: none;
  }
  .ynav-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(30,58,138,0.35); }
  .ynav-btn-primary .ti { font-size: 13px; }
  .ynav-avatar-btn {
    display: flex; align-items: center; gap: 8px;
    background: #F8FAFC; border: 1px solid #E2E8F0; cursor: pointer;
    padding: 6px 12px; border-radius: 10px; transition: all 0.2s;
  }
  .ynav-avatar-btn:hover { background: #F1F5F9; border-color: #CBD5E1; }
  .ynav-avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: linear-gradient(135deg, #1E3A8A, #2563EB);
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; flex-shrink: 0;
  }
  .ynav-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .ynav-avatar span { color: #fff; font-weight: 700; font-size: 13px; }
  .ynav-avatar-name { font-size: 14px; font-weight: 600; color: #0F172A; }
  .ynav-avatar-btn .ti { font-size: 12px; color: #94A3B8; }
  .ynav-user { position: relative; }
  .ynav-dropdown {
    position: absolute; top: calc(100% + 10px); right: 0;
    background: #FFFFFF; border: 1px solid #E2E8F0;
    border-radius: 14px; box-shadow: 0 4px 12px rgba(15,23,42,0.10), 0 16px 40px rgba(30,58,138,0.12);
    min-width: 200px; overflow: hidden; z-index: 100;
    animation: dropdown-in 0.15s ease;
  }
  @keyframes dropdown-in { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  .ynav-dropdown-header {
    padding: 14px 16px 10px; border-bottom: 1px solid #F1F5F9;
  }
  .ynav-dropdown-name { font-size: 14px; font-weight: 700; color: #0F172A; }
  .ynav-dropdown-role { font-size: 12px; color: #64748B; text-transform: capitalize; margin-top: 2px; }
  .ynav-dropdown-item {
    width: 100%; padding: 11px 16px;
    display: flex; align-items: center; gap: 10px;
    font-size: 14px; font-weight: 500; color: #334155;
    background: none; border: none; cursor: pointer;
    transition: background 0.15s; text-align: left;
  }
  .ynav-dropdown-item:hover { background: #F8FAFC; color: #0F172A; }
  .ynav-dropdown-item .ti { font-size: 16px; color: #94A3B8; }
  .ynav-dropdown-item--danger { color: #EF4444; }
  .ynav-dropdown-item--danger .ti { color: #EF4444; }
  .ynav-hamburger {
    display: none; background: none; border: none; cursor: pointer;
    font-size: 22px; color: #475569; padding: 6px; margin-left: auto;
  }
  .ynav-mobile {
    display: none; flex-direction: column;
    padding: 12px 24px 20px; border-top: 1px solid #E2E8F0;
    background: #FFFFFF;
  }
  .ynav-mobile-link {
    padding: 12px 4px; font-size: 15px; font-weight: 600; color: #475569;
    text-decoration: none; border-bottom: 1px solid #F1F5F9;
    transition: color 0.2s;
  }
  .ynav-mobile-link:hover, .ynav-mobile-link.active { color: #1E3A8A; }
  .ynav-mobile-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
  .w-full { width: 100%; justify-content: center; }
  @media (max-width: 900px) {
    .ynav-links { display: none; }
    .ynav-actions { display: none; }
    .ynav-hamburger { display: flex; }
    .ynav-mobile { display: flex; }
  }
`;
