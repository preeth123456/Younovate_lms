// src/models/Registration.js
'use strict';
const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  // Display name (kept as the canonical name field used across the app).
  fullName:        { type: String, required: true, trim: true },
  // Split names (used by the public LMS registration form). Optional so
  // legacy docs created with only `fullName` keep validating.
  firstName:       { type: String, default: '', trim: true },
  secondName:      { type: String, default: '', trim: true },
  email:           { type: String, required: true, lowercase: true, trim: true },
  phone:           { type: String, default: '', trim: true },
  programInterest: { type: String, default: '', trim: true },
  // LMS course selected at registration (optional — public form stores it).
  // Kept optional + strict-safe so legacy docs without it keep working.
  courseId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  courseName:      { type: String, default: '', trim: true },
  source:          { type: String, enum: ['web', 'referral', 'social', 'direct', 'other'], default: 'web' },
  // Pipeline stages used by Admin UI: new → contacted → registered → enrolled.
  // Legacy values (lead/pending/converted/rejected) are preserved so existing
  // documents and old flows keep validating. `converted`/`lead` are treated
  // as `new` by the frontend normalizer.
  status:          { type: String, enum: ['new', 'contacted', 'registered', 'enrolled', 'lead', 'pending', 'converted', 'rejected'], default: 'registered' },
  // Conversion tracking
  convertedAt: { type: Date, default: null },
  convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  traineeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notes:       { type: String, default: '' },
  // Duplicate-email protection: set ONLY when the matching email was
  // actually accepted by the mail provider during an enrolled transition.
  // Checked together with (prevStatus !== 'enrolled') + traineeId/user lookup.
  credentialEmailSent:  { type: Boolean, default: false },
  enrollmentEmailSent:  { type: Boolean, default: false },
}, { timestamps: true });

registrationSchema.index({ email: 1 });
registrationSchema.index({ status: 1 });
registrationSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Registration || mongoose.model('Registration', registrationSchema);
