import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const OTP_RE = /^\d{6}$/;
const RESEND_SECS = 60;

const base = {
  borderRadius: 12, border: '1.5px solid #E2E8F0', padding: '12px 14px',
  outline: 'none', background: '#FFFFFF', color: '#0F172A', fontWeight: 700,
  width: '100%', boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit',
};
const inputStyle = (hasErr) => ({ ...base, border: `1.5px solid ${hasErr ? '#EF4444' : '#E2E8F0'}` });
const selectStyle = (hasErr) => ({
  ...base, border: `1.5px solid ${hasErr ? '#EF4444' : '#E2E8F0'}`,
  appearance: 'none', WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748B' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
  paddingRight: 36, cursor: 'pointer',
});
const errText = { color: '#EF4444', fontSize: 12, marginTop: 3, fontWeight: 600 };

const Field = ({ label, required, error, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 13, fontWeight: 900, color: '#475569' }}>
      {label}
      {required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
    </label>
    {children}
    {error && <span style={errText}>{error}</span>}
  </div>
);

// New public page: "LMS Registration".
// Course list is fetched live from the existing LMS course data source
// (GET /api/public-registrations/courses → active Courses), never hardcoded.
// OTP + submit reuse the public-registration backend which itself reuses the
// existing email/OTP service and the existing Registration collection
// (so records appear in the existing Admin Registration page).
export default function LmsRegistration() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '', secondName: '', phone: '', email: '',
    courseId: '', otp: '', acceptTerms: false,
  });
  const [errors, setErrors] = useState({});
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState('');
  const [otpState, setOtpState] = useState('idle');
  const [otpMsg, setOtpMsg] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/public-registrations/courses`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.success && Array.isArray(data?.data?.courses)) setCourses(data.data.courses);
        else setCoursesError('Could not load courses. Please refresh.');
      } catch {
        if (!cancelled) setCoursesError('Could not load courses. Please refresh.');
      } finally {
        if (!cancelled) setCoursesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: '' }));
    if (k === 'email' || k === 'otp') { setOtpVerified(false); setOtpMsg(''); }
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'First Name is required';
    if (!form.secondName.trim()) e.secondName = 'Second Name is required';
    if (!form.phone.trim()) e.phone = 'Phone Number is required';
    else if (!PHONE_RE.test(form.phone.trim())) e.phone = 'Enter a valid 10-digit mobile number';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address';
    if (!form.courseId) e.courseId = 'Please select a course';
    if (!form.otp.trim()) e.otp = 'Email OTP is required';
    else if (!OTP_RE.test(form.otp.trim())) e.otp = 'Enter the 6-digit OTP';
    if (!form.acceptTerms) e.acceptTerms = 'Please accept the Terms & Conditions';
    return e;
  };

  const readErr = async (res, fallback) => {
    try {
      const d = await res.json();
      return d?.message || fallback;
    } catch {
      return fallback;
    }
  };

  const sendOtp = async () => {
    const email = form.email.trim();
    if (!email || !EMAIL_RE.test(email)) {
      setErrors((p) => ({ ...p, email: 'Enter a valid email address' }));
      return;
    }
    setOtpState('sending');
    setOtpMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/public-registrations/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName: form.firstName.trim() }),
      });
      if (!res.ok) throw new Error(await readErr(res, 'Could not send OTP'));
      setOtpState('sent');
      setOtpMsg('OTP sent to your email. It expires in 5 minutes.');
      setResendIn(RESEND_SECS);
    } catch (err) {
      setOtpState('idle');
      setOtpMsg(err.message || 'Could not send OTP');
    }
  };

  const verifyOtp = async () => {
    const email = form.email.trim();
    const otp = form.otp.trim();
    if (!otp) {
      setErrors((p) => ({ ...p, otp: 'Email OTP is required' }));
      return;
    }
    setOtpState('verifying');
    setOtpMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/public-registrations/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      if (!res.ok) throw new Error(await readErr(res, 'OTP verification failed'));
      setOtpVerified(true);
      setOtpState('verified');
      setOtpMsg('Email verified successfully.');
    } catch (err) {
      setOtpVerified(false);
      setOtpState('sent');
      setOtpMsg(err.message || 'OTP verification failed');
    }
  };

  const submit = async () => {
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    if (!otpVerified) {
      setSubmitMsg({ type: 'error', text: 'Please verify your email OTP first.' });
      return;
    }
    setSubmitting(true);
    setSubmitMsg({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/public-registrations/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          secondName: form.secondName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          courseId: form.courseId,
          otp: form.otp.trim(),
          acceptTerms: form.acceptTerms,
        }),
      });
      if (!res.ok) throw new Error(await readErr(res, 'Registration failed'));
      setSubmitMsg({ type: 'success', text: 'Registration submitted successfully! Our team will contact you soon.' });
      setForm({ firstName: '', secondName: '', phone: '', email: '', courseId: '', otp: '', acceptTerms: false });
      setOtpVerified(false);
      setOtpState('idle');
      setOtpMsg('');
    } catch (err) {
      setSubmitMsg({ type: 'error', text: err.message || 'Registration failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const otpBusy = otpState === 'sending' || otpState === 'verifying';
  const otpBanner = otpVerified
    ? { bg: 'rgba(22,160,95,0.08)', bd: 'rgba(22,160,95,0.3)', fg: '#15803d' }
    : { bg: 'rgba(37,99,235,0.07)', bd: 'rgba(37,99,235,0.25)', fg: '#1E40AF' };

  return (
    <div style={{ background: '#F8FAFC', minHeight: '80vh', padding: '56px 0 90px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={eyebrow}>YouVA OS · LMS Registration</div>
          <h1 style={h1}>LMS Registration</h1>
          <p style={sub}>Register for an LMS program. Verify your email with an OTP to complete registration.</p>
        </div>
        <div style={card}>
          <div style={grid}>
            <Field label="First Name" required error={errors.firstName}>
              <input style={inputStyle(errors.firstName)} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="e.g. Aarav" maxLength={60} />
            </Field>
            <Field label="Second Name" required error={errors.secondName}>
              <input style={inputStyle(errors.secondName)} value={form.secondName} onChange={(e) => set('secondName', e.target.value)} placeholder="e.g. Sharma" maxLength={60} />
            </Field>
            <Field label="Phone Number" required error={errors.phone}>
              <input style={inputStyle(errors.phone)} value={form.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="10-digit mobile number" maxLength={10} />
            </Field>
            <Field label="Email ID" required error={errors.email}>
              <input style={inputStyle(errors.email)} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" maxLength={120} />
            </Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Course" required error={errors.courseId || coursesError}>
                <select style={selectStyle(errors.courseId || coursesError)} value={form.courseId} onChange={(e) => set('courseId', e.target.value)} disabled={coursesLoading}>
                  <option value="">{coursesLoading ? 'Loading courses…' : 'Select a course'}</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </Field>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Email OTP" required error={errors.otp}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <input style={inputStyle(errors.otp)} value={form.otp} onChange={(e) => set('otp', e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit OTP" maxLength={6} />
                  </div>
                  <button type="button" onClick={sendOtp} disabled={otpBusy || resendIn > 0} style={otpBtn(otpBusy || resendIn > 0)}>
                    {otpBusy ? 'Please wait…' : resendIn > 0 ? `Resend OTP (${resendIn}s)` : otpState === 'idle' ? 'Send OTP' : 'Resend OTP'}
                  </button>
                  <button type="button" onClick={verifyOtp} disabled={otpBusy || !form.otp.trim()} style={verifyBtn(otpVerified, otpBusy || !form.otp.trim())}>
                    {otpVerified ? 'Verified ✓' : 'Verify OTP'}
                  </button>
                </div>
              </Field>
              {otpMsg && <div style={banner(otpBanner)}>{otpMsg}</div>}
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.acceptTerms} onChange={(e) => set('acceptTerms', e.target.checked)} style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
              <span style={terms}>I agree to the Terms & Conditions and Privacy Policy</span>
            </label>
            {errors.acceptTerms && <div style={{ ...errText, marginTop: 6 }}>{errors.acceptTerms}</div>}
          </div>

          {submitMsg.text && <div style={resultBox(submitMsg.type === 'success')}>{submitMsg.text}</div>}

          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => navigate('/programs')} style={ghostBtn}>View Programs</button>
            <button type="button" onClick={submit} disabled={submitting} style={submitBtn(submitting)}>
              {submitting ? 'Submitting…' : 'Submit Registration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: '#2563EB', textTransform: 'uppercase', marginBottom: 8 };
const h1 = { fontSize: 32, fontWeight: 800, color: '#0F172A', margin: '0 0 8px' };
const sub = { color: '#64748B', fontSize: 15, margin: 0, lineHeight: 1.7 };
const card = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 20, padding: 28, boxShadow: '0 8px 32px rgba(30,58,138,0.08)' };
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
const terms = { fontWeight: 800, color: '#475569', fontSize: 13, lineHeight: 1.5 };
const banner = (b) => ({ marginTop: 8, padding: '10px 14px', borderRadius: 10, fontWeight: 700, fontSize: 13, background: b.bg, border: `1px solid ${b.bd}`, color: b.fg });
const resultBox = (ok) => ({
  marginTop: 14, padding: '12px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13,
  background: ok ? 'rgba(22,160,95,0.08)' : 'rgba(239,68,68,0.08)',
  border: `1px solid ${ok ? 'rgba(22,160,95,0.3)' : 'rgba(239,68,68,0.3)'}`,
  color: ok ? '#15803d' : '#DC2626',
});
const ghostBtn = { padding: '13px 22px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#0F172A', fontWeight: 800, cursor: 'pointer', fontSize: 14 };
const submitBtn = (busy) => ({
  padding: '13px 28px', borderRadius: 12, border: 'none',
  background: busy ? '#94A3B8' : 'linear-gradient(135deg, #1E3A8A, #2563EB)',
  color: '#fff', fontWeight: 900, cursor: busy ? 'not-allowed' : 'pointer', fontSize: 15,
  boxShadow: busy ? 'none' : '0 4px 16px rgba(37,99,235,0.35)',
});
const otpBtn = (disabled) => ({
  padding: '12px 18px', borderRadius: 12, border: '1px solid #E2E8F0',
  background: disabled ? '#F1F5F9' : '#F8FAFC', color: '#1E3A8A', fontWeight: 800,
  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, whiteSpace: 'nowrap',
});
const verifyBtn = (verified, disabled) => ({
  padding: '12px 18px', borderRadius: 12, border: 'none',
  background: verified ? '#16a05f' : '#1E3A8A', color: '#fff', fontWeight: 800,
  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13, whiteSpace: 'nowrap',
  opacity: disabled ? 0.6 : 1,
});
