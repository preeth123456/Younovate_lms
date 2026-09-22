// src/controllers/authController.js
// ════════════════════════════════════════════════════════════════════════════
// AUTH FLOW:
//   POST /api/auth/register        → create account, return accessToken
//   POST /api/auth/login           → verify credentials, return accessToken + refreshToken cookie
//   POST /api/auth/refresh         → rotate accessToken using refreshToken cookie
//   POST /api/auth/logout          → rotate sessionToken (invalidates all devices)
//   GET  /api/auth/me              → return current user profile
//   PUT  /api/auth/profile         → update name/phone/bio/profilePicture/linkedIn/github
//   PUT  /api/auth/change-password → verify currentPassword, set newPassword
//   POST /api/auth/forgot-password → generate OTP, email it (5-min TTL)
//   POST /api/auth/verify-otp      → verify OTP (max 5 attempts)
//   POST /api/auth/reset-password  → re-verify OTP + set new password
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  generateSessionToken, generateAccessToken, generateRefreshToken,
  setRefreshCookie, clearAuthCookies,
} = require('../utils/tokenUtils');
const { sendEmail, otpTemplate, pwChangedTemplate } = require('../utils/emailUtils');

/* ── REGISTER ────────────────────────────────────────────────────────────────
   POST /api/auth/register
   Body: { name, email, password, role? }
   Response: { success, accessToken, user, role }
──────────────────────────────────────────────────────────────────────────── */
const register = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ success: false, message: 'name, email and password are required' });

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists)
    return res.status(409).json({ success: false, message: 'An account with this email already exists' });

  // Public registration is trainee-only. Admin creates trainer/HR/admin accounts.
  const allowedRoles = ['trainee'];
  const requestedRole = (role || 'trainee').toLowerCase();
  if (!allowedRoles.includes(requestedRole)) {
    return res.status(403).json({
      success: false,
      message: 'Public registration is available for trainees only. Contact an administrator to create other accounts.',
    });
  }

  const sessionToken = generateSessionToken();
  const user = await User.create({
    name, email: email.toLowerCase(), password,
    role: 'trainee', sessionToken, isActive: true,
  });

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  return res.status(201).json({ success: true, accessToken, user: user.toPublic(), role: user.role });
};

/* ── LOGIN ───────────────────────────────────────────────────────────────────
   POST /api/auth/login
   Body: { email, password }
   Response: { success, accessToken, user, role }
   Sets httpOnly refreshToken cookie
──────────────────────────────────────────────────────────────────────────── */
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'email and password are required' });

  const LOG_LINE = '═'.repeat(50);
  console.log(`\n${LOG_LINE}`);
  console.log(`🔐 LOGIN DEBUG`);
  console.log(`${LOG_LINE}`);
  console.log(`   Email submitted:     ${email}`);

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +sessionToken');
  if (!user) {
    console.log(`   ❌ User NOT FOUND in database for email: ${email}`);
    console.log(`${LOG_LINE}\n`);
    return res.status(401).json({ success: false, message: 'Wrong credentials' });
  }

  console.log(`   ✅ User FOUND:`);
  console.log(`      User ID:          ${user._id}`);
  console.log(`      Name:             ${user.name}`);
  console.log(`      Role:             ${user.role}`);
  console.log(`      isActive:         ${user.isActive}`);
  console.log(`      isTemporary:      ${user.isTemporaryPassword}`);
  console.log(`      Password hash:    ${user.password ? user.password.substring(0, 30) + '...' : 'MISSING!'}`);

  const pwMatch = await user.comparePassword(password);
  console.log(`   bcrypt.compare():   ${pwMatch}`);

  if (!pwMatch) {
    console.log(`   ❌ PASSWORD MISMATCH!`);
    // Try to find exact user to debug further
    console.log(`   Debug: Checking if hash is corrupted...`);
    try {
      const bcrypt = require('bcryptjs');
      console.log(`   bcrypt rehash test: ${await bcrypt.compare(password, user.password)}`);
    } catch (e) {
      console.log(`   bcrypt error: ${e.message}`);
    }
    console.log(`${LOG_LINE}\n`);
    return res.status(401).json({ success: false, message: 'Wrong credentials' });
  }

  console.log(`   ✅ Password MATCH!`);

  if (!user.isActive) {
    console.log(`   ❌ Account is DEACTIVATED`);
    console.log(`${LOG_LINE}\n`);
    return res.status(403).json({ success: false, message: 'Account has been deactivated. Contact admin.' });
  }

  user.sessionToken = generateSessionToken();
  user.lastLoginAt  = new Date();
  await user.save();

  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  setRefreshCookie(res, refreshToken);

  console.log(`   ✅ JWT GENERATED:    ${accessToken.substring(0, 40)}...`);
  console.log(`   ✅ Login SUCCESS for ${email}`);
  console.log(`${LOG_LINE}\n`);

  return res.json({ success: true, accessToken, user: user.toPublic(), role: user.role });
};

/* ── LOGOUT ──────────────────────────────────────────────────────────────────
   POST /api/auth/logout   [protected]
   Response: { success, message }
──────────────────────────────────────────────────────────────────────────── */
const logout = async (req, res) => {
  // Rotate sessionToken → invalidates all existing refresh tokens on all devices
  await User.findByIdAndUpdate(req.user._id, { sessionToken: generateSessionToken() });
  clearAuthCookies(res);
  return res.json({ success: true, message: 'Logged out successfully' });
};

/* ── REFRESH ─────────────────────────────────────────────────────────────────
   POST /api/auth/refresh
   Cookie: refreshToken (httpOnly)
   Response: { success, accessToken }
──────────────────────────────────────────────────────────────────────────── */
const refresh = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token)
    return res.status(401).json({ success: false, message: 'No refresh token — please log in' });

  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  const user    = await User.findById(decoded.userId).select('+sessionToken');

  if (!user || user.sessionToken !== decoded.sessionToken)
    return res.status(401).json({ success: false, message: 'Refresh token invalid or revoked' });

  const accessToken = generateAccessToken(user);
  return res.json({ success: true, accessToken });
};

/* ── GET ME ──────────────────────────────────────────────────────────────────
   GET /api/auth/me   [protected]
   Response: { success, user, role }
──────────────────────────────────────────────────────────────────────────── */
const getMe = async (req, res) => {
  return res.json({ success: true, user: req.user.toPublic(), role: req.user.role });
};

/* ── UPDATE PROFILE ──────────────────────────────────────────────────────────
   PUT /api/auth/profile   [protected]
   Body: { name?, phone?, bio?, profilePicture?, linkedIn?, github? }
   Response: { success, user }
──────────────────────────────────────────────────────────────────────────── */
const updateProfile = async (req, res) => {
  const allowed = ['name','phone','bio','profilePicture','linkedIn','github','skills',
  'gender','dateOfBirth','designation','department','address','city','state','country','pincode',  
  'expertise','designation', 'experience','specialization','certifications','currentCompany','portfolioUrl',
  'collegeName','degree','branch','graduationYear','portfolioUrl','resumeUrl',
  'designation','department','employeeId','experience','specialization'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ success: false, message: 'No valid fields provided' });

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  return res.json({ success: true, user: user.toPublic() });
};

/* ── CHANGE PASSWORD ─────────────────────────────────────────────────────────
   PUT /api/auth/change-password   [protected]
   Body: { currentPassword?, newPassword }
   Response: { success, message }
──────────────────────────────────────────────────────────────────────────── */
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword)
    return res.status(400).json({ success: false, message: 'newPassword is required' });
  if (newPassword.length < 6)
    return res.status(400).json({ success: false, message: 'newPassword must be at least 6 characters' });

  const user = await User.findById(req.user._id).select('+password +sessionToken');
  
  // If currentPassword is provided, verify it
  if (currentPassword) {
    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  const same = await user.comparePassword(newPassword);
  if (same)
    return res.status(400).json({ success: false, message: 'New password must differ from the current one' });

  user.password     = newPassword;
  user.sessionToken = generateSessionToken(); // invalidate all sessions
  user.isTemporaryPassword = false; // clear temp password flag on successful change
  await user.save();

  return res.json({ success: true, message: 'Password changed successfully.' });
};

/* ── FORGOT PASSWORD ─────────────────────────────────────────────────────────
   POST /api/auth/forgot-password
   Body: { email }
   Eligibility (backend-enforced): ONLY active Trainer OR Enrolled Trainee.
   Enrolled trainee = Registration with status `enrolled` linked to the User
   (via traineeId) OR a User with the same email in an `enrolled` Registration.
   Ineligible / unknown emails get an explicit 404 using the EXISTING
   'Invalid or expired OTP' message style — NO OTP/token/record is created
   and NO email is sent, so the flow cannot continue to reset-password.
──────────────────────────────────────────────────────────────────────────── */
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'email is required' });

  const user = await User.findOne({ email: email.toLowerCase(), isActive: true })
    .select('+passwordResetToken +passwordResetExpires +passwordResetAttempts');
  if (!user) return res.status(404).json({ success: false, message: 'No account found with this email' });

  if (!(await isForgotPasswordEligible(user)))
    return res.status(403).json({ success: false, message: 'Forgot password is available only for enrolled trainees and trainers' });

  const otp = await user.createPasswordResetOtp();
  await user.save();

  await sendEmail({ to: user.email, subject: 'Younovate — Your password reset code', html: otpTemplate(user.name, otp) });
  return res.json({ success: true, message: 'If that email is registered, an OTP has been sent' });
};

// Eligibility gate shared by forgot/verify/reset: active Trainer, or Trainee
// backed by an `enrolled` Registration. Never throws — fail closed (false).
async function isForgotPasswordEligible(user) {
  try {
    if (!user || user.isActive !== true) return false;
    if (user.role === 'trainer') return true;
    if (user.role !== 'trainee') return false;
    const Registration = require('../models/Registration');
    const email = String(user.email || '').toLowerCase();
    const enrolled = await Registration.findOne({
      $and: [
        { status: 'enrolled' },
        { $or: [{ traineeId: user._id }, ...(email ? [{ email }] : [])] },
      ],
    }).select('_id').lean();
    return Boolean(enrolled);
  } catch {
    return false;
  }
}

/* ── VERIFY OTP ──────────────────────────────────────────────────────────────
   POST /api/auth/verify-otp
   Body: { email, otp }
   Response: { success, verified }
──────────────────────────────────────────────────────────────────────────── */
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ success: false, message: 'email and otp required' });

  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+passwordResetToken +passwordResetExpires +passwordResetAttempts');
  if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  if (!(await isForgotPasswordEligible(user))) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

  const result = await user.verifyPasswordResetOtp(otp);
  await user.save();

  if (result === 'expired')      return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
  if (result === 'max_attempts') return res.status(400).json({ success: false, message: 'Too many attempts. Request a new OTP.' });
  if (result === 'invalid')      return res.status(400).json({ success: false, message: 'Incorrect OTP.' });

  return res.json({ success: true, message: 'OTP verified', verified: true });
};

/* ── RESET PASSWORD ──────────────────────────────────────────────────────────
   POST /api/auth/reset-password
   Body: { email, otp, newPassword }
   Response: { success, message }
   NOTE: Full re-verification — never trusts client-side verified state
──────────────────────────────────────────────────────────────────────────── */
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword)
    return res.status(400).json({ success: false, message: 'email, otp and newPassword required' });
  if (newPassword.length < 8)
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  if (!/[0-9]/.test(newPassword))
    return res.status(400).json({ success: false, message: 'Password must include at least one number' });

  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+password +passwordResetToken +passwordResetExpires +passwordResetAttempts +sessionToken');
  if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  if (!(await isForgotPasswordEligible(user))) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

  const result = await user.verifyPasswordResetOtp(otp);
  if (result !== 'valid') {
    await user.save();
    const msgs = { expired: 'OTP expired.', max_attempts: 'Too many attempts.', invalid: 'Incorrect OTP.' };
    return res.status(400).json({ success: false, message: msgs[result] || 'Invalid OTP' });
  }

  const same = await user.comparePassword(newPassword);
  if (same) return res.status(400).json({ success: false, message: 'New password must differ from the current one' });

  user.password = newPassword;
  user.clearPasswordResetOtp();
  user.sessionToken = generateSessionToken(); // revoke all refresh tokens
  await user.save();

  await sendEmail({ to: user.email, subject: 'Younovate — Password changed', html: pwChangedTemplate(user.name) });
  return res.json({ success: true, message: 'Password reset. Please log in with your new password.' });
};

/* ── UPDATE PROFILE PHOTO ─────────────────────────────────────────────────
   PUT /api/auth/profile-photo   [protected]
   multipart/form-data: field `profilePhoto`
   Response: { success, user }
  ────────────────────────────────────────────────────────────────────────── */
  const updateProfilePhoto = async (req, res) => {
    // multer throws / populates req.file; keep controller simple
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Profile photo is required' });
    }

    // Store a served URL (server serves /uploads)
    const relativeUrl = `/uploads/profile-pictures/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(

      req.user._id,
      { profilePicture: relativeUrl },
      { new: true, runValidators: true }
    );

    return res.json({ success: true, user: user.toPublic() });
  };

module.exports = { register, login, logout, refresh, getMe, updateProfile, updateProfilePhoto, changePassword, forgotPassword, verifyOtp, resetPassword };
