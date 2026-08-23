// src/pages/ForcePasswordChangePage.jsx
// Shown to users who logged in with a temporary password (e.g. auto-created
// workshop trainee accounts). They must set a new password before accessing
// the dashboard.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  selectCurrentUser,
  selectIsAuthenticated,
  selectUserRole,
  selectAuthError,
  clearError,
  logout,
} from '../features/auth/authSlice';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config/api';

const API = API_BASE_URL;

const ROLE_REDIRECT = {
  admin:   '/admin/dashboard',
  trainer: '/trainer/dashboard',
  trainee: '/trainee/dashboard',
  hr:      '/hr/dashboard',
};

export default function ForcePasswordChangePage() {
  const dispatch        = useAppDispatch();
  const navigate        = useNavigate();
  const currentUser     = useAppSelector(selectCurrentUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role            = useAppSelector(selectUserRole);
  const error           = useAppSelector(selectAuthError);

  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors]                   = useState({});
  const [saving, setSaving]                   = useState(false);
  const [showPw, setShowPw]                   = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);

  // If user is not authenticated or doesn't have temp password, redirect
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (currentUser && !currentUser.isTemporaryPassword) {
      // Not a temp password user — go to dashboard
      navigate(ROLE_REDIRECT[role] || '/', { replace: true });
    }
  }, [isAuthenticated, currentUser, role, navigate]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const validate = () => {
    const e = {};
    if (!newPassword) {
      e.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      e.newPassword = 'Password must be at least 8 characters';
    } else if (!/[0-9]/.test(newPassword)) {
      e.newPassword = 'Password must include at least one number';
    }
    if (!confirmPassword) {
      e.confirmPassword = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      e.confirmPassword = 'Passwords do not match';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      console.log('🔑 [DEBUG] ForcePasswordChange: Sending change-password request...');
      const { data } = await axios.put(
        `${API}/api/auth/change-password`,
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        console.log('✅ [DEBUG] ForcePasswordChange: Password changed successfully!');
        toast.success('Password changed successfully! Please log in again.');
        // Backend rotated sessionToken — old token is now invalid
        // Log user out and redirect to login
        dispatch(logout());
        navigate('/login', { replace: true, state: { passwordChanged: true } });
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to change password. Please try again.';
      console.error('❌ [DEBUG] ForcePasswordChange error:', msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="yn-page">
        <div className="yn-card" role="main" aria-label="Set new password">

          <div className="yn-brand">
            <h1 className="yn-title">Set Your Password</h1>
            <div className="yn-subtitle">
              This is your first login. Please set a new password to continue.
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            <div className={`yn-field${errors.newPassword ? ' yn-field-error' : ''}`}>
              <label htmlFor="newPassword" className="yn-label">New Password</label>
              <div className="yn-input-wrap">
                <i className="ti ti-lock yn-icon" aria-hidden="true" />
                <input
                  id="newPassword" name="newPassword"
                  type={showPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errors.newPassword) setErrors((p) => ({ ...p, newPassword: '' }));
                  }}
                  placeholder="At least 8 characters with a number"
                  autoComplete="new-password"
                  disabled={saving}
                  className="yn-input"
                  required
                />
                <button type="button" className="yn-eye"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                </button>
              </div>
              {errors.newPassword && <p className="yn-err"><i className="ti ti-alert-circle" />{errors.newPassword}</p>}
            </div>

            <div className={`yn-field${errors.confirmPassword ? ' yn-field-error' : ''}`}>
              <label htmlFor="confirmPassword" className="yn-label">Confirm Password</label>
              <div className="yn-input-wrap">
                <i className="ti ti-lock yn-icon" aria-hidden="true" />
                <input
                  id="confirmPassword" name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: '' }));
                  }}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  disabled={saving}
                  className="yn-input"
                  required
                />
                <button type="button" className="yn-eye"
                  onClick={() => setShowConfirm(v => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                  <i className={`ti ${showConfirm ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                </button>
              </div>
              {errors.confirmPassword && <p className="yn-err"><i className="ti ti-alert-circle" />{errors.confirmPassword}</p>}
            </div>

            <button type="submit" className="yn-btn-primary" disabled={saving}>
              {saving
                ? <><span className="yn-spinner" /><span>Saving…</span></>
                : 'Set Password & Continue'
              }
            </button>

          </form>

          <p className="yn-signup">
            Want to use a different account?{' '}
            <button type="button" className="yn-signup-link"
              onClick={handleLogout}>
              Log out
            </button>
          </p>

        </div>
      </div>
    </>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .yn-page {
    min-height: 100vh;
    background: linear-gradient(115deg, #1f3d63 0%, #315f83 58%, #4b8eaa 100%);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Public Sans', system-ui, -apple-system, sans-serif;
    padding: 24px 16px;
  }

  .yn-card {
    width: 100%; max-width: 400px;
    background: #ffffff;
    border: 1px solid rgba(255,255,255,0.72);
    border-radius: 18px;
    padding: 38px 36px 34px;
    box-shadow: 0 24px 62px rgba(20,46,75,0.25);
  }

  .yn-brand { text-align: center; margin-bottom: 26px; }
  .yn-title { font-size: 31px; font-weight: 800; color: #1f3d63; letter-spacing: 0; margin-bottom: 10px; text-transform: uppercase; line-height: 1.05; }
  .yn-subtitle { font-size: 14px; color: #536987; line-height: 1.45; }

  .yn-field { margin-bottom: 14px; }

  .yn-label { display: block; font-size: 14px; font-weight: 600; color: #536987; margin-bottom: 8px; }

  .yn-input-wrap { position: relative; display: flex; align-items: center; }

  .yn-icon { position: absolute; left: 14px; color: #7a8ba4; font-size: 16px; pointer-events: none; line-height: 1; }

  .yn-input {
    width: 100%; padding: 12px 44px 12px 42px;
    background: #ffffff; border: 1px solid #d7e0eb;
    border-radius: 8px; font-size: 15px; color: #050a16;
    font-family: inherit; outline: none;
    transition: border-color 0.2s; -webkit-appearance: none;
  }
  .yn-input::placeholder { color: #9aa9bb; }
  .yn-input:focus { border-color: #7ba8d6; box-shadow: 0 0 0 3px rgba(63,125,160,0.16); }
  .yn-input:disabled { opacity: 0.5; }
  .yn-field-error .yn-input { border-color: #e12e2a; }
  .yn-field-error .yn-input:focus { box-shadow: 0 0 0 3px rgba(225,46,42,0.14); }

  .yn-err {
    display: flex; align-items: center; gap: 5px;
    margin-top: 5px; font-size: 12px; color: #e12e2a; font-weight: 500;
  }
  .yn-err .ti { font-size: 13px; }

  .yn-eye { position: absolute; right: 13px; background: none; border: none; color: #7a8ba4; cursor: pointer; padding: 4px; font-size: 16px; line-height: 1; display: flex; align-items: center; }
  .yn-eye:hover { color: #1f3d63; }

  .yn-btn-primary {
    width: 100%; padding: 13px 14px;
    background: #1f3d63; color: #fff;
    border: none; border-radius: 8px;
    font-size: 15px; font-weight: 600;
    cursor: pointer; font-family: inherit;
    margin-bottom: 16px;
    transition: background 0.2s, opacity 0.2s;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 46px;
  }
  .yn-btn-primary:hover:not(:disabled) { background: #294c76; }
  .yn-btn-primary:active:not(:disabled) { background: #173254; }
  .yn-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

  .yn-spinner { width: 17px; height: 17px; border: 2.5px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: yn-spin 0.65s linear infinite; flex-shrink: 0; }
  @keyframes yn-spin { to { transform: rotate(360deg); } }

  .yn-signup { text-align: center; font-size: 13px; color: #657691; }
  .yn-signup-link { color: #2f6f9b; background: none; border: none; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; padding: 0; }
  .yn-signup-link:hover { color: #1f3d63; }

  @media (max-width: 520px) {
    .yn-page { padding: 14px; }
    .yn-card { max-width: 100%; border-radius: 16px; padding: 32px 24px 28px; }
    .yn-title { font-size: 27px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .yn-spinner { animation: none; border-top-color: #fff; }
    .yn-btn-primary { transition: none; }
  }
`;

