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
const { sendEmail, lmsEnrollmentTemplate } = require('./emailUtils');

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

  // Already-enrolled guard (prevents duplicates on refresh/repeat).
  if (reg.traineeId) {
    const linked = await User.findById(reg.traineeId).select('_id name email role');
    if (linked) {
      return {
        user: linked, createdUser: false, subscription: null,
        createdSubscription: false, email, emailSent: reg.enrollmentEmailSent === true,
        emailError: null, skippedAsDuplicate: true,
      };
    }
  }
  const existingUser = await User.findOne({ email }).select('_id name email role');
  if (existingUser) {
    return {
      user: existingUser, createdUser: false, subscription: null,
      createdSubscription: false, email, emailSent: reg.enrollmentEmailSent === true,
      emailError: null, skippedAsDuplicate: true,
    };
  }

  // Resolve selected LMS course (existing LMS course data source).
  let course = null;
  if (reg.courseId) {
    try { course = await Course.findById(reg.courseId); } catch { course = null; }
  }
  if (!course && reg.programInterest) {
    course = await Course.findOne({ code: String(reg.programInterest).trim().toUpperCase() });
  }
  if (!course) throw Object.assign(new Error('Selected LMS course is not available'), { statusCode: 400 });

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
        createdSubscription: false, email, emailSent: reg.enrollmentEmailSent === true,
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
    // Account created but course linking failed → roll back the new account so
    // we never send a "success" email for a partial enrollment; admin retries.
    await User.deleteOne({ _id: user._id }).catch(() => {});
    throw Object.assign(
      new Error(err?.message || 'Failed to enroll trainee in the selected course'),
      { statusCode: err?.statusCode || 500 },
    );
  }

  return { user, createdUser: true, otp, subscription, createdSubscription, email, emailSent: false, emailError: null, course };
}

// Sends the enrollment credentials email to the trainee ONLY.
// Never throws: email failure must not mark enrollment as failed.
async function sendEnrollmentEmail({ reg, course, email, otp }) {
  const courseName = course?.name || reg.courseName || reg.programInterest || 'your LMS course';
  try {
    await sendEmail({
      to: email,
      subject: `Younovate — Successfully Registered & Enrolled in ${courseName}: set your password with OTP`,
      html: lmsEnrollmentTemplate(reg.fullName, courseName, email, otp, getLoginUrl()),
    });
    return { sent: true, error: null };
  } catch (err) {
    console.error('LMS ENROLLMENT EMAIL ERROR:', err?.message || err);
    return { sent: false, error: err?.message || 'Failed to send enrollment email' };
  }
}
module.exports = { enrollLmsRegistration, sendEnrollmentEmail, getLoginUrl };