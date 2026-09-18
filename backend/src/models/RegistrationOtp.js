// src/models/RegistrationOtp.js
// Pre-registration email OTP store for the PUBLIC LMS Registration page.
//
// WHY a separate model instead of reusing User.passwordResetToken:
//   - The existing OTP flow (authController forgot-password/verify-otp) is tied
//     to an existing User document. A public visitor has no User account yet,
//     so that flow cannot be reused directly.
//   - This model reuses the EXISTING OTP semantics + email service instead of
//     duplicating them: 6-digit crypto OTP, bcrypt-hashed at rest, 5-minute
//     expiry, max 5 attempts, sent via the existing sendEmail()/otpTemplate().
//   - The existing User OTP flow is untouched.
'use strict';
const mongoose = require('mongoose');

const registrationOtpSchema = new mongoose.Schema({
  email:    { type: String, required: true, lowercase: true, trim: true },
  otpHash:  { type: String, required: true, select: false },
  // Absolute expiry. A TTL index auto-removes stale docs; a missing doc is
  // treated as "expired — request a new OTP" by the route handlers.
  expiresAt: { type: Date, required: true, expires: 0 },
  attempts:  { type: Number, default: 0 },
  verified:  { type: Boolean, default: false },
}, { timestamps: true });

registrationOtpSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.models.RegistrationOtp
  || mongoose.model('RegistrationOtp', registrationOtpSchema);
