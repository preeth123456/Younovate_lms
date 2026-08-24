import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchWorkshopById,
  registerForWorkshop,
  selectCurrentWorkshop,
  selectCurrentStatus,
  selectSubmitStatus,
  selectSubmitError,
} from '../../features/workshops/workshopSlice';
import { INDIAN_STATES, CITIES_BY_STATE } from '../utils/indianLocations';
import {
  validateForm,
  validateFullName,
  validateEmail,
  validatePhone,
  validateWhatsApp,
  validateCollege,
  validateQualification,
  validateState,
  validateCity,
  validateExperience,
  validateLinkedIn,
  validateGitHub,
} from '../utils/registrationValidation';

// ── Styles ────────────────────────────────────────────────────────────────────

const base = {
  borderRadius: 12,
  border: '1.5px solid #E2E8F0',
  padding: '12px 14px',
  outline: 'none',
  background: '#FFFFFF',
  color: '#0F172A',
  fontWeight: 700,
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 14,
  fontFamily: 'inherit',
};

const inputStyle = (hasErr) => ({
  ...base,
  border: `1.5px solid ${hasErr ? '#EF4444' : '#E2E8F0'}`,
});

const selectStyle = (hasErr) => ({
  ...base,
  border: `1.5px solid ${hasErr ? '#EF4444' : '#E2E8F0'}`,
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748B' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 36,
  cursor: 'pointer',
});

const errText = { color: '#EF4444', fontSize: 12, marginTop: 3, fontWeight: 600 };

// ── Field wrapper ─────────────────────────────────────────────────────────────

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

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_FORM = {
  fullName: '', email: '', phone: '', whatsapp: '',
  college: '', qualification: '', state: '', city: '',
  experience: '', linkedin: '', github: '',
  acceptTerms: false,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkshopRegister() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const dispatch   = useDispatch();
  const workshopId = params.get('workshopId');

  const workshop      = useSelector(selectCurrentWorkshop);
  const workshopStatus = useSelector(selectCurrentStatus);
  const submitStatus  = useSelector(selectSubmitStatus);
  const submitError   = useSelector(selectSubmitError);

  const [form, setForm]       = useState(INITIAL_FORM);
  const [errors, setErrors]   = useState({});
  const [touched, setTouched] = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const firstErrRef = useRef(null);

  useEffect(() => {
    if (workshopId) dispatch(fetchWorkshopById(workshopId));
  }, [workshopId, dispatch]);

  // Available cities depend on selected state
  const cities = form.state ? (CITIES_BY_STATE[form.state] || []) : [];

  // ── Field setters ───────────────────────────────────────────────────────────

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (touched[k]) {
      const err = getFieldError(k, v, k === 'state' ? v : form.state);
      setErrors((e) => ({ ...e, [k]: err }));
    }
  };

  const setPhone = (raw) => {
    // Strip all non-digits, limit to 10
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    set('phone', digits);
  };

  const setWhatsApp = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    set('whatsapp', digits);
  };

  const setState = (v) => {
    setForm((p) => ({ ...p, state: v, city: '' }));
    if (touched.state)  setErrors((e) => ({ ...e, state: validateState(v) }));
    if (touched.city)   setErrors((e) => ({ ...e, city: '' }));
  };

  const blur = (k) => {
    setTouched((t) => ({ ...t, [k]: true }));
    const err = getFieldError(k, form[k], form.state);
    setErrors((e) => ({ ...e, [k]: err }));
  };

  // ── Per-field error resolver ────────────────────────────────────────────────

  function getFieldError(k, v, state) {
    switch (k) {
      case 'fullName':     return validateFullName(v);
      case 'email':        return validateEmail(v);
      case 'phone':        return validatePhone(v);
      case 'whatsapp':     return validateWhatsApp(v);
      case 'college':      return validateCollege(v);
      case 'qualification': return validateQualification(v);
      case 'state':        return validateState(v);
      case 'city':         return validateCity(v);
      case 'experience':   return validateExperience(v);
      case 'linkedin':     return validateLinkedIn(v);
      case 'github':       return validateGitHub(v);
      case 'acceptTerms':  return v ? '' : 'You must agree to the Terms and Privacy Policy.';
      default:             return '';
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const submit = async () => {
    // Mark all fields touched
    const allTouched = Object.keys(INITIAL_FORM).reduce((a, k) => ({ ...a, [k]: true }), {});
    setTouched(allTouched);

    const errs = validateForm(form);
    setErrors(errs);

    const hasError = Object.values(errs).some(Boolean);
    if (hasError) {
      // Scroll to first error
      setTimeout(() => {
        if (firstErrRef.current) {
          firstErrRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstErrRef.current.focus?.();
        }
      }, 50);
      return;
    }

    const phone    = form.phone.replace(/\D/g, '');
    const whatsapp = form.whatsapp.replace(/\D/g, '') || phone;

    const result = await dispatch(registerForWorkshop({
      workshopId,
      fullName:      form.fullName.trim().replace(/\s+/g, ' '),
      email:         form.email.trim().toLowerCase(),
      phone,
      whatsapp,
      college:       form.college.trim(),
      qualification: form.qualification.trim(),
      city:          form.city,
      state:         form.state,
      experience:    form.experience.trim().replace(/\s+/g, ' '),
      linkedin:      form.linkedin.trim(),
      github:        form.github.trim(),
    }));

    if (registerForWorkshop.fulfilled.match(result)) {
      if (result.payload?.alreadyRegistered) {
        setSuccessMsg('You are already registered for this workshop.');
      } else {
        setSuccessMsg('Registration successful! You will receive a confirmation shortly.');
      }
      setTimeout(() => navigate('/workshops'), 3000);
    }
  };

  // ── Attach firstErrRef to first errored field ───────────────────────────────

  const fieldRef = (k) => Object.values(errors).some(Boolean) && errors[k] ? firstErrRef : null;

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (!workshopId) {
    return (
      <div style={{ maxWidth: 800, margin: '80px auto', padding: '0 24px', textAlign: 'center', color: '#475569' }}>
        No workshop selected.{' '}
        <button onClick={() => navigate('/workshops')} style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontWeight: 700 }}>
          Browse Workshops
        </button>
      </div>
    );
  }

  if (workshopStatus === 'loading') {
    return <div style={{ maxWidth: 800, margin: '80px auto', padding: '0 24px', textAlign: 'center', color: '#475569' }}>Loading workshop...</div>;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh' }}>
      <style>{`
        @media (max-width: 640px) {
          .reg-grid { grid-template-columns: 1fr !important; }
          .reg-wrap { padding: 16px !important; }
          .reg-header { flex-direction: column !important; align-items: flex-start !important; }
          .reg-title { font-size: 26px !important; }
        }
        @media (max-width: 425px) {
          .reg-outer { padding: 40px 12px 60px !important; }
        }
        select option { font-weight: 600; }
      `}</style>

      <div className="reg-outer" style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px 80px' }}>

        {/* Header */}
        <div className="reg-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 className="reg-title" style={{ fontSize: 36, fontWeight: 900, color: '#0F172A', lineHeight: 1.05, margin: 0 }}>
              Workshop Registration
            </h1>
            {workshop && (
              <p style={{ marginTop: 8, color: '#475569', fontWeight: 700, lineHeight: 1.8 }}>
                {workshop.title}
                {(workshop.date || workshop.startDate) && ` • ${new Date(workshop.date || workshop.startDate).toLocaleDateString()}`}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/workshops')}
            style={{ padding: '10px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', background: 'transparent', color: '#475569', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Back
          </button>
        </div>

        {/* Success */}
        {successMsg ? (
          <div style={{ padding: 24, borderRadius: 18, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981', fontWeight: 700, fontSize: 16, textAlign: 'center' }}>
            ✓ {successMsg}
          </div>
        ) : (
          <div className="reg-wrap" style={{ borderRadius: 20, background: '#FFFFFF', border: '1px solid #E2E8F0', padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', marginBottom: 20 }}>Personal Details</div>

            <div className="reg-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 16 }}>

              {/* Full Name */}
              <Field label="Full Name" required error={errors.fullName}>
                <input
                  ref={fieldRef('fullName')}
                  style={inputStyle(errors.fullName)}
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  onBlur={() => blur('fullName')}
                  placeholder="e.g. Prithika Naik"
                  maxLength={100}
                />
              </Field>

              {/* Email */}
              <Field label="Email" required error={errors.email}>
                <input
                  ref={fieldRef('email')}
                  style={inputStyle(errors.email)}
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  onBlur={() => blur('email')}
                  placeholder="e.g. prithika@gmail.com"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                />
              </Field>

              {/* Phone */}
              <Field label="Phone" required error={errors.phone}>
                <input
                  ref={fieldRef('phone')}
                  style={inputStyle(errors.phone)}
                  value={form.phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => blur('phone')}
                  placeholder="e.g. 9876543210"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                />
              </Field>

              {/* WhatsApp */}
              <Field label="WhatsApp Number" error={errors.whatsapp}>
                <input
                  style={inputStyle(errors.whatsapp)}
                  value={form.whatsapp}
                  onChange={(e) => setWhatsApp(e.target.value)}
                  onBlur={() => blur('whatsapp')}
                  placeholder="Leave blank to use phone number"
                  inputMode="numeric"
                  maxLength={10}
                />
              </Field>

              {/* College */}
              <Field label="College / Institution" error={errors.college}>
                <input
                  style={inputStyle(errors.college)}
                  value={form.college}
                  onChange={(e) => set('college', e.target.value)}
                  onBlur={() => blur('college')}
                  placeholder="e.g. NITK Surathkal"
                  maxLength={150}
                />
              </Field>

              {/* Qualification */}
              <Field label="Qualification" error={errors.qualification}>
                <input
                  style={inputStyle(errors.qualification)}
                  value={form.qualification}
                  onChange={(e) => set('qualification', e.target.value)}
                  onBlur={() => blur('qualification')}
                  placeholder="e.g. B.Tech, MCA"
                  maxLength={100}
                />
              </Field>

              {/* State */}
              <Field label="State" required error={errors.state}>
                <select
                  ref={fieldRef('state')}
                  style={selectStyle(errors.state)}
                  value={form.state}
                  onChange={(e) => setState(e.target.value)}
                  onBlur={() => blur('state')}
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>

              {/* City */}
              <Field label="City" required error={errors.city}>
                <select
                  ref={fieldRef('city')}
                  style={selectStyle(errors.city)}
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  onBlur={() => blur('city')}
                  disabled={!form.state}
                >
                  <option value="">{form.state ? 'Select City' : 'Select State first'}</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              {/* Experience */}
              <Field label="Experience (Optional)" error={errors.experience}>
                <input
                  style={inputStyle(errors.experience)}
                  value={form.experience}
                  onChange={(e) => set('experience', e.target.value)}
                  onBlur={() => blur('experience')}
                  placeholder="e.g. 2 years in software development"
                  maxLength={150}
                />
              </Field>

              {/* LinkedIn */}
              <Field label="LinkedIn (Optional)" error={errors.linkedin}>
                <input
                  style={inputStyle(errors.linkedin)}
                  value={form.linkedin}
                  onChange={(e) => set('linkedin', e.target.value)}
                  onBlur={() => blur('linkedin')}
                  placeholder="https://linkedin.com/in/..."
                  maxLength={300}
                />
              </Field>

              {/* GitHub — full width */}
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="GitHub (Optional)" error={errors.github}>
                  <input
                    style={inputStyle(errors.github)}
                    value={form.github}
                    onChange={(e) => set('github', e.target.value)}
                    onBlur={() => blur('github')}
                    placeholder="https://github.com/..."
                    maxLength={300}
                  />
                </Field>
              </div>

            </div>

            {/* Terms */}
            <div style={{ marginTop: 20 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.acceptTerms}
                  onChange={(e) => {
                    set('acceptTerms', e.target.checked);
                    setTouched((t) => ({ ...t, acceptTerms: true }));
                  }}
                  style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
                />
                <span style={{ fontWeight: 800, color: '#475569', fontSize: 13, lineHeight: 1.5 }}>
                  I agree to the Terms and Privacy Policy
                </span>
              </label>
              {errors.acceptTerms && (
                <div style={{ ...errText, marginTop: 6 }}>{errors.acceptTerms}</div>
              )}
            </div>

            {/* API error (e.g. duplicate registration) */}
            {submitError && (
              <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#DC2626', fontWeight: 700, fontSize: 13 }}>
                {submitError}
              </div>
            )}

            {/* Submit */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={submit}
                disabled={submitStatus === 'loading'}
                style={{
                  padding: '13px 28px', borderRadius: 12, border: 'none',
                  background: submitStatus === 'loading' ? '#94A3B8' : 'linear-gradient(135deg, #1E3A8A, #2563EB)',
                  color: '#fff', fontWeight: 900, cursor: submitStatus === 'loading' ? 'not-allowed' : 'pointer',
                  fontSize: 15, boxShadow: submitStatus === 'loading' ? 'none' : '0 4px 16px rgba(37,99,235,0.35)',
                  width: '100%', maxWidth: 260,
                }}
              >
                {submitStatus === 'loading' ? 'Submitting...' : 'Submit Registration'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
