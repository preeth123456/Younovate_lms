// src/pages/trainer/Settings.jsx
// Trainer Settings — General, Features, Account (Change Password)

import React, { useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { updateProfile, selectCurrentUser } from '../../features/auth/authSlice';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

const API = API_BASE_URL;
const BRAND = '#3f7da0';

const TABS = [
  { id: 'general', label: 'General', icon: '👤' },
  { id: 'features', label: 'Features', icon: '🧩' },
  { id: 'account', label: 'Account', icon: '🔑' },
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800;900&display=swap');
  .ts-wrap *, .ts-wrap *::before, .ts-wrap *::after { box-sizing: border-box; }
  @keyframes ts-spin { to { transform: rotate(360deg); } }
  @keyframes ts-fade { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
  .ts-input:focus, .ts-select:focus { outline: none; border-color: ${BRAND}; box-shadow: 0 0 0 3px rgba(63,125,160,.15); }
  .ts-tab:hover { background: #f1f6fb; color: #172033; }
  .ts-btn:hover:not(:disabled) { opacity: .9; }
  .ts-btn:disabled { opacity: .55; cursor: not-allowed; }

  .ts-switch { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
  .ts-switch input { opacity: 0; width: 0; height: 0; }
  .ts-slider { position: absolute; inset: 0; cursor: pointer; background: #cbd5e1; border-radius: 99px; transition: background .18s; }
  .ts-slider::before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: transform .18s; }
  .ts-switch input:checked + .ts-slider { background: ${BRAND}; }
  .ts-switch input:checked + .ts-slider::before { transform: translateX(18px); }
  .ts-switch input:disabled + .ts-slider { opacity: .5; cursor: not-allowed; }

  @media (max-width: 820px) {
    .ts-shell  { flex-direction: column !important; }
    .ts-tabs   { flex-direction: row !important; overflow-x: auto; width: 100% !important; border-right: none !important; border-bottom: 1px solid #eef3f8; }
    .ts-tab    { white-space: nowrap; border-radius: 8px !important; }
    .ts-grid   { grid-template-columns: 1fr !important; }
    .ts-pad    { padding: 16px !important; }
  }
`;

const inputSt = {
  width: '100%', border: '1px solid #dbe3ed', borderRadius: 9, padding: '9px 12px',
  fontSize: 13.5, color: '#172033', background: '#fff', fontFamily: 'inherit',
};

const Field = ({ label, hint, children }) => (
  <div>
    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 5 }}>{hint}</div>}
  </div>
);

const TextField = ({ label, hint, value, onChange, type = 'text', placeholder, showToggle, onToggle, disabled }) => (
  <Field label={label} hint={hint}>
    <div style={{ position: 'relative' }}>
      <input className="ts-input" type={type} value={value ?? ''} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} style={inputSt} disabled={disabled} />
      {showToggle && (
        <button
          type="button"
          onClick={onToggle}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 14,
            color: '#94a3b8',
            padding: 4,
          }}
        >
          {type === 'password' ? '👁️' : '👁️🗨️'}
        </button>
      )}
    </div>
  </Field>
);

const ToggleField = ({ label, hint, checked, onChange, disabled }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, border: '1px solid #eef3f8', background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#172033' }}>{label}</div>
      {hint && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3 }}>{hint}</div>}
    </div>
    <label className="ts-switch">
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="ts-slider" />
    </label>
  </div>
);

const SectionShell = ({ title, desc, saving, onSave, dirty, children, saveLabel = 'Save changes' }) => (
  <div style={{ animation: 'ts-fade .2s ease' }}>
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#172033' }}>{title}</h3>
      <p style={{ margin: '5px 0 0', color: '#657691', fontSize: 12.5 }}>{desc}</p>
    </div>
    {children}
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid #eef3f8', paddingTop: 16 }}>
      <button className="ts-btn" type="button" onClick={onSave} disabled={saving || !dirty}
        style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: BRAND, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  </div>
);

export default function TrainerSettings() {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(selectCurrentUser);
  
  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);
  
  // General
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  
  // Features (local preferences)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [taskReminders, setTaskReminders] = useState(true);
  const [sessionAlerts, setSessionAlerts] = useState(true);
  
  // Account - Change Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({ newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);

  const generalDirty = name !== (currentUser?.name || '') || 
                       email !== (currentUser?.email || '') || 
                       phone !== (currentUser?.phone || '') || 
                       bio !== (currentUser?.bio || '');

  const saveGeneral = async () => {
    setSaving(true);
    try {
      await dispatch(updateProfile({ name, email, phone, bio })).unwrap();
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const saveFeatures = () => {
    toast.success('Preferences saved (local only)');
  };

  const changePassword = async () => {
    setPasswordErrors({ newPassword: '', confirmPassword: '' });
    
    const errors = {};
    
    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters';
    } else if (!/[A-Z]/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one uppercase letter';
    } else if (!/[0-9]/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one number';
    }
    
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm password';
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      toast.error('Please fix validation errors');
      return;
    }
    
    setPasswordSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/api/auth/change-password`,
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      toast.success('Password changed successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };

  const body = useMemo(() => {
    if (tab === 'general') {
      return (
        <SectionShell title="General" desc="Your profile information."
          saving={saving} dirty={generalDirty} onSave={saveGeneral}>
          <div className="ts-grid" style={grid}>
            <TextField label="Name" value={name} onChange={setName} placeholder="Your name" />
            <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" disabled />
            <TextField label="Phone" value={phone} onChange={setPhone} placeholder="+91 1234567890" />
            <TextField label="Bio" value={bio} onChange={setBio} placeholder="Tell us about yourself" />
          </div>
        </SectionShell>
      );
    }

    if (tab === 'features') {
      return (
        <SectionShell title="Preferences" desc="Customize your experience."
          saving={saving} dirty={true} onSave={saveFeatures}>
          <div style={{ display: 'grid', gap: 10 }}>
            <ToggleField label="Email Notifications" hint="Receive updates via email" checked={emailNotifications} onChange={setEmailNotifications} />
            <ToggleField label="Task Reminders" hint="Get reminders for pending tasks" checked={taskReminders} onChange={setTaskReminders} />
            <ToggleField label="Session Alerts" hint="Notifications for upcoming sessions" checked={sessionAlerts} onChange={setSessionAlerts} />
          </div>
        </SectionShell>
      );
    }

    // Account - Change Password
    return (
      <div style={{ animation: 'ts-fade .2s ease' }}>
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#172033' }}>Change Password</h3>
          <p style={{ margin: '5px 0 0', color: '#657691', fontSize: 12.5 }}>Update your account password.</p>
        </div>
        
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="ts-grid" style={grid}>
            <div>
              <TextField 
                label="New Password" 
                type={showNewPassword ? 'text' : 'password'} 
                value={newPassword} 
                onChange={(v) => {
                  setNewPassword(v);
                  if (passwordErrors.newPassword) setPasswordErrors(prev => ({ ...prev, newPassword: '' }));
                }}
                placeholder="Enter new password"
                hint="Min 6 chars, 1 uppercase, 1 number"
                showToggle={true}
                onToggle={() => setShowNewPassword(!showNewPassword)}
              />
              {passwordErrors.newPassword && (
                <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 5 }}>
                  ⚠️ {passwordErrors.newPassword}
                </div>
              )}
            </div>
            <div>
              <TextField 
                label="Confirm Password" 
                type={showConfirmPassword ? 'text' : 'password'} 
                value={confirmPassword} 
                onChange={(v) => {
                  setConfirmPassword(v);
                  if (passwordErrors.confirmPassword) setPasswordErrors(prev => ({ ...prev, confirmPassword: '' }));
                }}
                placeholder="Re-enter new password"
                showToggle={true}
                onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
              />
              {passwordErrors.confirmPassword && (
                <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 5 }}>
                  ⚠️ {passwordErrors.confirmPassword}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, borderTop: '1px solid #eef3f8', paddingTop: 16 }}>
          <button 
            className="ts-btn" 
            type="button" 
            onClick={changePassword} 
            disabled={passwordSaving || !newPassword || !confirmPassword}
            style={{ 
              padding: '10px 22px', 
              borderRadius: 10, 
              border: 'none', 
              background: BRAND, 
              color: '#fff', 
              fontWeight: 800, 
              fontSize: 13, 
              cursor: 'pointer', 
              fontFamily: 'inherit' 
            }}>
            {passwordSaving ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </div>
    );
  }, [tab, saving, name, email, phone, bio, emailNotifications, taskReminders, sessionAlerts, newPassword, confirmPassword, showNewPassword, showConfirmPassword, passwordErrors, passwordSaving, generalDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ts-wrap" style={{ padding: 28, fontFamily: 'Public Sans, system-ui, sans-serif' }}>
      <style>{CSS}</style>

      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6, color: '#172033' }}>Trainer Settings</h2>
        <p style={{ margin: 0, color: '#657691', fontSize: 13 }}>
          Manage your profile, preferences, and account security.
        </p>
      </div>

      <div className="ts-shell" style={{ display: 'flex', gap: 0, background: '#fff', borderRadius: 14, border: '1px solid #dbe3ed', overflow: 'hidden', boxShadow: '0 1px 2px rgba(23,32,51,.08), 0 12px 28px rgba(31,61,99,.05)' }}>
        <div className="ts-tabs" style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 210, flexShrink: 0, padding: 12, borderRight: '1px solid #eef3f8', background: '#fbfdff' }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} className="ts-tab" onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left',
                  padding: '10px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13.5, fontWeight: active ? 800 : 600,
                  background: active ? 'rgba(63,125,160,.12)' : 'transparent',
                  color: active ? BRAND : '#657691', transition: 'background .15s, color .15s',
                }}>
                <span style={{ fontSize: 15 }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="ts-pad" style={{ flex: 1, padding: 24, minWidth: 0 }}>
          {body}
        </div>
      </div>
    </div>
  );
}
