// src/routes/publicRegistrationRoutes.js
// Public LMS Registration API — mounted at /api/public-registrations.
// Reuses existing building blocks:
//   - sendEmail()/otpTemplate() from utils/emailUtils (existing email service)
//   - OTP semantics mirrored from User.createPasswordResetOtp/verifyPasswordResetOtp
//     (6-digit crypto OTP, bcrypt hash, 5-min TTL, max 5 attempts)
//   - Registration model (existing Admin Registration data source)
//   - Course model (existing LMS course data source)
'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Course = require('../models/Course');
const Registration = require('../models/Registration');
const RegistrationOtp = require('../models/RegistrationOtp');
const { sendEmail, otpTemplate } = require('../utils/emailUtils');
const { authLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const DISPLAY_NAME = (firstName, secondName) =>
  `${String(firstName || '').trim()} ${String(secondName || '').trim()}`.trim();

async function findActiveCourseOrNull(courseId) {
  try {
    const course = await Course.findById(courseId).lean();
    if (!course || course.status !== 'active') return null;
    return course;
  } catch {
    return null;
  }
}

// GET /api/public-registrations/courses — public list of active LMS courses.
// Shape: { success, data: { courses: [{ _id, name, code }] } }
// No auth: public page needs it before a user account exists.
// Only active courses are exposed; admin list endpoint is untouched.
router.get('/courses', async (req, res) => {
  const courses = await Course.find({ status: 'active' })
    .select('name code')
    .sort({ name: 1 })
    .lean();
  return res.json({ success: true, data: { courses } });
});

// POST /api/public-registrations/send-otp — { email, firstName? }
// Generates a 6-digit OTP (same crypto scheme as User password-reset OTP),
// stores only its bcrypt hash, emails the plain OTP via the existing service.
// Rate-limited with the existing authLimiter (credential/OTP endpoints).
router.post('/send-otp', authLimiter, async (req, res) => {
  const rawEmail = String(req.body?.email || '').trim().toLowerCase();
  const firstName = String(req.body?.firstName || '').trim();
  if (!rawEmail || !EMAIL_RE.test(rawEmail))
    return res.status(400).json({ success: false, message: 'Enter a valid email address' });

  const duplicate = await Registration.findOne({ email: rawEmail });
  if (duplicate)
    return res.status(409).json({ success: false, message: 'This email has already been registered' });

  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const otpHash = await bcrypt.hash(otp, 10);
  await RegistrationOtp.findOneAndUpdate(
    { email: rawEmail },
    { email: rawEmail, otpHash, expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0, verified: false },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  try {
    await sendEmail({
      to: rawEmail,
      subject: 'Younovate — Your LMS registration code',
      html: otpTemplate(firstName || rawEmail, otp),
    });
  } catch (err) {
    // OTP row is already stored above; report the email failure explicitly so
    // the UI never shows "OTP sent" when the mail was not accepted.
    // Same logging style as the existing sendEmail() failure logs.
    console.error(`❌ LMS REGISTRATION OTP EMAIL FAILED to ${rawEmail}`);
    console.error(`   Error: ${err?.message || err}`);
    return res.status(502).json({ success: false, message: 'Could not send OTP email. Please check the email address and try again.' });
  }
  return res.json({ success: true, message: 'OTP sent to your email. It expires in 5 minutes.' });
});

// POST /api/public-registrations/verify-otp — { email, otp }
// Mirrors User.verifyPasswordResetOtp outcomes: invalid / expired / attempts.
router.post('/verify-otp', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '').trim();
  if (!email || !otp)
    return res.status(400).json({ success: false, message: 'Email and OTP are required' });

  const record = await RegistrationOtp.findOne({ email }).select('+otpHash');
  if (!record)
    return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
    await RegistrationOtp.deleteOne({ _id: record._id });
    return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
  }
  if ((record.attempts || 0) >= MAX_ATTEMPTS) {
    await RegistrationOtp.deleteOne({ _id: record._id });
    return res.status(400).json({ success: false, message: 'Too many attempts. Request a new OTP.' });
  }
  const match = await bcrypt.compare(otp, record.otpHash);
  if (!match) {
    record.attempts = (record.attempts || 0) + 1;
    await record.save();
    return res.status(400).json({ success: false, message: 'Incorrect OTP.' });
  }
  record.verified = true;
  await record.save();
  return res.json({ success: true, message: 'OTP verified', verified: true });
});

// POST /api/public-registrations/submit
// Body: { firstName, secondName, phone, email, courseId, otp, acceptTerms }
// Requires a verified, unexpired OTP row for the email (server re-checks —
// never trusts client-side verified state). Writes to the EXISTING
// Registration collection so the record appears in the Admin page unchanged.
router.post('/submit', authLimiter, async (req, res) => {
  const firstName = String(req.body?.firstName || '').trim();
  const secondName = String(req.body?.secondName || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const { courseId, otp, acceptTerms } = req.body || {};

  if (!firstName) return res.status(400).json({ success: false, message: 'First Name is required' });
  if (!secondName) return res.status(400).json({ success: false, message: 'Second Name is required' });
  if (!phone) return res.status(400).json({ success: false, message: 'Phone Number is required' });
  if (!PHONE_RE.test(phone))
    return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
  if (!email || !EMAIL_RE.test(email))
    return res.status(400).json({ success: false, message: 'Enter a valid email address' });
  if (!courseId)
    return res.status(400).json({ success: false, message: 'Please select a course' });
  if (!otp || !String(otp).trim())
    return res.status(400).json({ success: false, message: 'Email OTP is required' });
  if (acceptTerms !== true)
    return res.status(400).json({ success: false, message: 'Please accept the Terms & Conditions' });

  const User = require('../models/User');
  const duplicate = (await Registration.findOne({ email })) || (await User.findOne({ email }));
  if (duplicate)
    return res.status(409).json({ success: false, message: 'This email has already been registered' });

  const course = await findActiveCourseOrNull(courseId);
  if (!course)
    return res.status(400).json({ success: false, message: 'Selected course is not available' });

  const record = await RegistrationOtp.findOne({ email }).select('+otpHash');
  if (!record || !record.verified)
    return res.status(400).json({ success: false, message: 'Please verify your email OTP first' });
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
    await RegistrationOtp.deleteOne({ _id: record._id });
    return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
  }
  const match = await bcrypt.compare(String(otp).trim(), record.otpHash);
  if (!match)
    return res.status(400).json({ success: false, message: 'Incorrect OTP.' });

  const reg = await Registration.create({
    firstName,
    secondName,
    fullName: DISPLAY_NAME(firstName, secondName),
    email,
    phone,
    programInterest: course.code,
    courseId: course._id,
    courseName: course.name,
    source: 'web',
    status: 'registered',
  });
  await RegistrationOtp.deleteOne({ _id: record._id });

  // Admin notification — new LMS trainee registration (best-effort, never blocks submit).
  try {
    const { notifyAdmins, idOf } = require('../utils/notificationService');
    const User = require('../models/User');
    await notifyAdmins({
      User, module: 'LMS', kind: 'registration_new',
      title: 'New LMS Registration',
      message: `${reg.fullName} registered for ${reg.courseName || reg.programInterest || 'an LMS course'}.`,
      dedupeKey: `lms:registration:${idOf(reg._id || reg.id)}`,
      link: '/admin/registrations',
      meta: { registrationId: idOf(reg._id || reg.id), email: reg.email, courseName: reg.courseName, programInterest: reg.programInterest },
    });
  } catch (_) {}

  return res.status(201).json({ success: true, message: 'LMS Registration submitted', data: reg });
});
module.exports = router;
