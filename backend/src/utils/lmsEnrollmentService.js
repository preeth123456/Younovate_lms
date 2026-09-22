// src/utils/lmsEnrollmentService.js
// Admin Registration → Enrolled flow for PUBLIC LMS registrations.
// NOTE: The public landing page (frontend/src/public-website/pages/Home.jsx,
// Signup.jsx, Navbar.jsx, CtaBar.jsx) already exposes "Sign Up" / "Create
// Account" options — DO NOT modify the landing page. This service only
// handles the Admin-side status → Enrolled transition.
'use strict';
const crypto = require('crypto');
const User = require('../models/User');
const Course = require('../models/Course');
const CourseSubscription = require('../models/CourseSubscription');
const { sendEmail, lmsEnrollmentTemplate, workshopApprovedTemplate } = require('./emailUtils');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getLoginUrl() {
  const raw = process.env.FRONTEND_URL || process.env.PUBLIC_FRONTEND_URL || 'https://younovate-lms.vercel.app';
  const url = String(raw).trim().replace(/\/+$/, '');
  const base = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return `${base}/login`;
}

function generateTempPassword() {
  return `Lms@${crypto.randomBytes(18).toString('hex')}`;
}

// Enrolls an LMS Registration as a trainee + active course subscription.
// Idempotent: if reg.traineeId already points at a User (or a User with the
// same email already exists), no new account/subscription/email is created.
// Returns { user, createdUser, subscription, createdSubscription, email ... }.
// Throws (no email sent) when enrollment itself cannot succeed.
async function enrollLmsRegistration(reg, adminId) {
  if (!reg) throw Object.assign(new Error('Registration not found'), { statusCode: 404 });
  const email = String(reg.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    throw Object.assign(new Error('Registration has no valid email — cannot enroll'), { statusCode: 400 });
  }

  const emailFlagsSet =
    reg.credentialEmailSent === true && reg.enrollmentEmailSent === true;

  // Already-enrolled guard (prevents duplicates on refresh/repeat/retry).
  if (reg.traineeId) {
    const linked = await User.findById(reg.traineeId).select('_id name email role');
    if (linked) {
      return {
        user: linked, createdUser: false, subscription: null,
        createdSubscription: false, email, emailSent: emailFlagsSet,
        emailError: null, skippedAsDuplicate: true,
      };
    }
  }
  if (emailFlagsSet) {
    const linkedByFlag = await User.findOne({ email }).select('_id name email role');
    if (linkedByFlag) {
      return {
        user: linkedByFlag, createdUser: false, subscription: null,
        createdSubscription: false, email, emailSent: true,
        emailError: null, skippedAsDuplicate: true,
      };
    }
  }
  const existingUser = await User.findOne({ email }).select('_id name email role');
  if (existingUser) {
    return {
      user: existingUser, createdUser: false, subscription: null,
      createdSubscription: false, email, emailSent: emailFlagsSet,
      emailError: null, skippedAsDuplicate: true,
    };
  }

  // Resolve selected LMS course — BEST EFFORT (legacy registrations may only
  // carry `programInterest: 'YIEP'/'YBLP'`). A missing course must NOT block
  // account creation or the two enrollment emails.
  let course = null;
  if (reg.courseId) {
    try { course = await Course.findById(reg.courseId); } catch { course = null; }
  }
  if (!course && reg.programInterest) {
    try {
      course =
        (await Course.findOne({ code: String(reg.programInterest).trim().toUpperCase() })) ||
        (await Course.findOne({ name: new RegExp(`^${String(reg.programInterest).trim()}$`, 'i') }));
    } catch { course = null; }
  }

  const internalPassword = generateTempPassword();
  let user;
  try {
    user = await User.create({
      name: reg.fullName,
      email,
      password: internalPassword,
      role: 'trainee',
      phone: reg.phone || '',
      isActive: true,
      enrolledAt: new Date(),
      isTemporaryPassword: true,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const raced = await User.findOne({ email }).select('_id name email role');
      return {
        user: raced, createdUser: false, subscription: null,
        createdSubscription: false, email, emailSent: emailFlagsSet,
        emailError: null, skippedAsDuplicate: true,
      };
    }
    throw err;
  }

  // OTP for password setup — EXISTING mechanism (same as forgot-password +
  // workshop approval): 6-digit crypto OTP, bcrypt hash, 5-min TTL, 5 attempts.
  const otp = await user.createPasswordResetOtp();
  await user.save();

  let subscription = null;
  let createdSubscription = false;
  let subscriptionError = null;
  if (course) {
    try {
      subscription = await CourseSubscription.findOne({ trainee: user._id, course: course._id });
      if (!subscription) {
        subscription = await CourseSubscription.create({
          trainee: user._id,
          course: course._id,
          plan: 'admin',
          status: 'active',
          startDate: new Date(),
          endDate: null,
          payment: { amount: 0, currency: 'INR', gateway: 'manual', paidAt: new Date() },
          activatedBy: adminId || null,
          notes: `LMS enrollment from registration ${reg._id}`,
        });
        createdSubscription = true;
      }
    } catch (err) {
      subscriptionError = err?.message || 'Failed to link course subscription';
      console.error('LMS ENROLLMENT SUBSCRIPTION WARNING:', subscriptionError);
      subscription = null;
    }
  }

  return { user, createdUser: true, otp, subscription, createdSubscription, subscriptionError, email, emailSent: false, emailError: null, course };
}

// EMAIL 1 — Login Credential email (existing lmsEnrollmentTemplate design).
// Never throws: email failure must not mark enrollment as failed.
async function sendLoginCredentialEmail({ reg, course, email, otp }) {
  const courseName = course?.name || reg.courseName || reg.programInterest || 'your LMS course';
  try {
    await sendEmail({
      to: email,
      subject: `Welcome — Your Younovate Login Credentials for ${courseName}`,
      html: lmsEnrollmentTemplate(reg.fullName, courseName, email, otp, getLoginUrl()),
    });
    return { sent: true, error: null };
  } catch (err) {
    console.error('LMS LOGIN-CREDENTIAL EMAIL ERROR:', err?.message || err);
    return { sent: false, error: err?.message || 'Failed to send login credential email' };
  }
}

// EMAIL 2 — Enrollment Confirmation (EXISTING workshopApprovedTemplate design).
// Never throws: email failure must not mark enrollment as failed.
async function sendConfirmationEmail({ reg, course, email }) {
  const courseName = course?.name || reg.courseName || reg.programInterest || 'your LMS course';
  try {
    await sendEmail({
      to: email,
      subject: `Younovate — Enrollment Confirmed: ${courseName}`,
      html: workshopApprovedTemplate(reg.fullName, courseName, getLoginUrl()),
    });
    return { sent: true, error: null };
  } catch (err) {
    console.error('LMS CONFIRMATION EMAIL ERROR:', err?.message || err);
    return { sent: false, error: err?.message || 'Failed to send enrollment confirmation email' };
  }
}

// Back-compat alias (EMAIL 1) for existing callers.
async function sendEnrollmentEmail(args) {
  return sendLoginCredentialEmail(args);
}
module.exports = { enrollLmsRegistration, sendEnrollmentEmail, sendLoginCredentialEmail, sendConfirmationEmail, getLoginUrl };