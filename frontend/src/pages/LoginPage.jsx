// src/pages/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  login,
  selectIsAuthenticated,
  selectUserRole,
  selectCurrentUser,
  selectAuthStatus,
  selectAuthError,
  clearError,
} from '../features/auth/authSlice';
import toast from 'react-hot-toast';

const ROLE_REDIRECT = {
  admin:   '/admin/dashboard',
  trainer: '/trainer/dashboard',
  trainee: '/trainee/dashboard',
  hr:      '/hr/dashboard',
};

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const dispatch        = useAppDispatch();
  const navigate        = useNavigate();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role            = useAppSelector(selectUserRole);
  const currentUser     = useAppSelector(selectCurrentUser);
  const status          = useAppSelector(selectAuthStatus);
  const error           = useAppSelector(selectAuthError);

  const [form, setForm]         = useState({ email: '', password: '' });
  const [errors, setErrors]     = useState({});
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (isAuthenticated && role) {
      // ── If user has a temporary password, force them to change it first ──
      if (currentUser?.isTemporaryPassword) {
        navigate('/force-password-change', { replace: true });
        return;
      }
      navigate(ROLE_REDIRECT[role] || '/', { replace: true });
    }
  }, [isAuthenticated, role, currentUser, navigate]);

  // ── Auth errors: mirror the Redux error into a visible inline message near
  // the form. The slice already resets status to 'idle' on rejected, so the
  // spinner stops; this guarantees "Wrong credentials" is shown on the page.
  useEffect(() => {
    if (error) {
      setAuthError(error);
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const validate = () => {
    const e = {};
    if (!form.email)               e.email    = 'Email is required';
    else if (!emailRe.test(form.email)) e.email = 'Enter a valid email address';
    if (!form.password)            e.password = 'Password is required';
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (authError) setAuthError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Reset the previous attempt's message. The slice sets status back to
    // 'idle' on both fulfilled and rejected, so loading always stops.
    setAuthError('');

    const result = await dispatch(login({ ...form, remember }));
    if (login.fulfilled.match(result)) {
      setAuthError('');
      toast.success('Welcome back!');
    } else if (login.rejected.match(result)) {
      // Backend returns { message: 'Wrong credentials' } for both unknown
      // email and bad password — display it inline and stay on this page.
      setAuthError(result.payload || error || 'Wrong credentials');
    }
  };

  const isLoading = status === 'loading';

  return (
    <>
      <style>{CSS}</style>
      <div className="yn-page">
        <div className="yn-card" role="main" aria-label="Login">

          <div className="yn-brand">
            <h1 className="yn-title">Welcome back</h1>
            <div className="yn-subtitle">Sign in to your YouVA OS account</div>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            <div className={`yn-field${errors.email ? ' yn-field-error' : ''}`}>
              <label htmlFor="email" className="yn-label">Email address</label>
              <div className="yn-input-wrap">
                <i className="ti ti-mail yn-icon" aria-hidden="true" />
                <input
                  id="email" name="email" type="email"
                  value={form.email} onChange={handleChange}
                  placeholder="you@example.com" autoComplete="email"
                  disabled={isLoading} className="yn-input" required
                />
              </div>
              {errors.email && <p className="yn-err"><i className="ti ti-alert-circle" />{errors.email}</p>}
            </div>

            <div className={`yn-field${errors.password ? ' yn-field-error' : ''}`}>
              <label htmlFor="password" className="yn-label">Password</label>
              <div className="yn-input-wrap">
                <i className="ti ti-lock yn-icon" aria-hidden="true" />
                <input
                  id="password" name="password"
                  type={showPw ? 'text' : 'password'}
                  value={form.password} onChange={handleChange}
                  placeholder="••••••••" autoComplete="current-password"
                  disabled={isLoading} className="yn-input" required
                />
                <button type="button" className="yn-eye"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                </button>
              </div>
              {errors.password && <p className="yn-err"><i className="ti ti-alert-circle" />{errors.password}</p>}
            </div>

            <div className="yn-field">
              <div className="yn-row">
                <label className="yn-remember">
                  <input type="checkbox" checked={remember}
                    onChange={e => setRemember(e.target.checked)} />
                  Remember me
                </label>
                <button type="button" className="yn-forgot"
                  onClick={() => navigate('/forgot_password')}>
                  Forgot password?
                </button>
              </div>
            </div>

            <button type="submit" className="yn-btn-primary" disabled={isLoading}>
              {isLoading
                ? <><span className="yn-spinner" /><span>Signing in…</span></>
                : 'Sign In'
              }
            </button>

            {authError && (
              <p className="yn-err yn-auth-err" role="alert">
                <i className="ti ti-alert-circle" />{authError}
              </p>
            )}

          </form>

          <p className="yn-signup">
            Don&apos;t have an account?{' '}
            {/* // Sign Up hidden — account creation is not active right now.
            <button type="button" className="yn-signup-link"
              onClick={() => navigate('/signup')}>
              Sign up
            </button>
            */}
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
  .yn-auth-err { justify-content: center; margin: 0 0 14px; font-size: 13px; }

  .yn-eye { position: absolute; right: 13px; background: none; border: none; color: #7a8ba4; cursor: pointer; padding: 4px; font-size: 16px; line-height: 1; display: flex; align-items: center; }
  .yn-eye:hover { color: #1f3d63; }

  .yn-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .yn-remember { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #050a16; cursor: pointer; user-select: none; }
  .yn-remember input { accent-color: #e12e2a; width: 15px; height: 15px; cursor: pointer; }
  .yn-remember-help {
    font-size: 12px; color: #7a8ba4; margin-bottom: 12px;
    text-align: left; font-weight: 500;
    min-height: 16px; transition: color 0.2s;
  }
  .yn-field-error .yn-remember-help {
    color: #e12e2a;
  }
  .yn-forgot { font-size: 14px; color: #2f6f9b; background: none; border: none; cursor: pointer; font-family: inherit; padding: 0; font-weight: 500; }
  .yn-forgot:hover { color: #1f3d63; }

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
    .yn-row { align-items: flex-start; gap: 10px; flex-direction: column; }
  }

  @media (prefers-reduced-motion: reduce) {
    .yn-spinner { animation: none; border-top-color: #fff; }
    .yn-btn-primary { transition: none; }
  }
`;
