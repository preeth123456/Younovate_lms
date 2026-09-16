'use strict';
const mongoose = require('mongoose');

// ── WorkshopRegistration ──────────────────────────────────────────────────────
const workshopRegistrationSchema = new mongoose.Schema({
  workshopId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Workshop', required: true },
  studentId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
  registrationStatus: { type: String, enum: ['Registered', 'Enrolled', 'Cancelled', 'Waitlisted'], default: 'Registered' },
  paymentStatus:      { type: String, enum: ['Free', 'Paid', 'Pending', 'Refunded'], default: 'Free' },
  paymentAmount:      { type: Number, default: 0 },
}, { timestamps: true });

workshopRegistrationSchema.index({ workshopId: 1, studentId: 1 }, { unique: true });

// ── WorkshopAttendance ────────────────────────────────────────────────────────
const workshopAttendanceSchema = new mongoose.Schema({
  // sessionId scopes the record to a specific Workshop Session (Session model).
  // workshopBatchId is denormalised for batch-level queries.
  // workshopId is kept for legacy compatibility with older records.
  sessionId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  workshopBatchId:  { type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopBatch' },
  workshopId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Workshop' },
  studentId:        { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  joinTime:         { type: Date },
  leaveTime:        { type: Date },
  attendanceStatus: { type: String, enum: ['Present', 'Absent', 'Late', 'Partial'], default: 'Absent' },
  duration:         { type: Number, default: 0 },   // minutes attended
  attendancePct:    { type: Number, default: 0 },
  markedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reconnectCount:   { type: Number, default: 0 },
  device:           { type: String, default: '' },
  browser:          { type: String, default: '' },
  ipAddress:        { type: String, default: '' },
}, { timestamps: true });

// Unique per session + participant (session-scoped attendance) - CRITICAL: use sessionId+studentId
workshopAttendanceSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
workshopAttendanceSchema.index({ workshopBatchId: 1, studentId: 1 });
workshopAttendanceSchema.index({ workshopId: 1, studentId: 1 });

// ── WorkshopResource ──────────────────────────────────────────────────────────
const workshopResourceSchema = new mongoose.Schema({
  workshopId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Workshop', required: true },
  title:       { type: String, required: true, trim: true },
  type:        { type: String, enum: ['PDF', 'PPT', 'ZIP', 'MP4', 'GitHub', 'Drive', 'Link', 'Other'], default: 'PDF' },
  url:         { type: String, required: true },
  fileSize:    { type: String, default: '' },
  downloads:   { type: Number, default: 0 },
  uploadedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

workshopResourceSchema.index({ workshopId: 1 });

// ── WorkshopFeedback ──────────────────────────────────────────────────────────
const workshopFeedbackSchema = new mongoose.Schema({
  workshopId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Workshop', required: true },
  sessionId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Session',  required: true },
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
  trainerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
  rating:        { type: Number, min: 1, max: 5, required: true },
  trainerRating: { type: Number, min: 0, max: 5, default: 0 },
  contentRating: { type: Number, min: 0, max: 5, default: 0 },
  audioRating:   { type: Number, min: 0, max: 5, default: 0 },
  videoRating:   { type: Number, min: 0, max: 5, default: 0 },
  comment:       { type: String, default: '' },
  suggestions:   { type: String, default: '' },
}, { timestamps: true });

workshopFeedbackSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

// ── WorkshopCertificate ───────────────────────────────────────────────────────
const workshopCertificateSchema = new mongoose.Schema({
  workshopId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Workshop', required: true },
  studentId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
  certificateNo:    { type: String, unique: true, sparse: true },
  issuedDate:       { type: Date },
  status:           { type: String, enum: ['Eligible', 'Issued', 'Pending', 'Rejected'], default: 'Pending' },
  downloadUrl:      { type: String, default: '' },
  issuedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Certificate workflow fields
  assignedTrainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAt:       { type: Date, default: null },
  sentToTraineeAt:  { type: Date, default: null },
  deliveryStatus:   { type: String, enum: ['generated', 'assigned_to_trainer', 'sent_to_trainee', 'delivered'], default: 'generated' },
}, { timestamps: true });

workshopCertificateSchema.index({ workshopId: 1, studentId: 1 }, { unique: true });

// ── WorkshopBatch ─────────────────────────────────────────────────────────────
const workshopBatchSchema = new mongoose.Schema({
  workshopId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Workshop', required: true },
  batchName:       { type: String, required: true, trim: true },
  batchCode:       { type: String, required: true, trim: true },
  registrationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopPublicRegistration' }],
  // students holds User ObjectId references for login-enabled participants (additive — registrationIds is kept)
  students:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  trainer:         { type: String, required: true, trim: true },
  trainerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAt:      { type: Date, default: null },
  reassignedAt:    { type: Date, default: null },
  startDate:       { type: Date, required: true },
  endDate:         { type: Date },
  startTime:       { type: String, default: '' },
  endTime:         { type: String, default: '' },
  mode:            { type: String, enum: ['Online', 'Offline', 'Hybrid'], default: 'Online' },
  capacity:        { type: Number, required: true, min: 1 },
  status:          { type: String, enum: ['Draft', 'Scheduled', 'Active', 'Completed', 'Cancelled', 'Archived'], default: 'Draft' },
  notes:           { type: String, default: '' },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, collection: 'workshopBatches' });

workshopBatchSchema.index({ workshopId: 1 });

// ── WorkshopPublicRegistration (public landing page registrations — no login required) ──
// Explicitly bound to the canonical 'workshopRegistrations' collection.
const workshopPublicRegistrationSchema = new mongoose.Schema({
  workshopId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Workshop', required: true },
  workshopName:        { type: String, default: '' },
  fullName:            { type: String, required: true, trim: true },
  email:               { type: String, required: true, lowercase: true, trim: true },
  phone:               { type: String, default: '', trim: true },
  whatsapp:            { type: String, default: '', trim: true },
  college:             { type: String, default: '', trim: true },
  qualification:       { type: String, default: '', trim: true },
  city:                { type: String, default: '', trim: true },
  state:               { type: String, default: '', trim: true },
  experience:          { type: String, default: '' },
  linkedin:            { type: String, default: '' },
  github:              { type: String, default: '' },
  // userId is set when admin approves — references the User account (auto-created or existing)
  userId:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  registrationStatus:  { type: String, enum: ['Registered', 'Approved', 'Rejected', 'Cancelled'], default: 'Registered' },
  registrationDate:    { type: Date, default: Date.now },
}, { timestamps: true, collection: 'workshopRegistrations' });

workshopPublicRegistrationSchema.index({ workshopId: 1, email: 1 }, { unique: true });
workshopPublicRegistrationSchema.index({ workshopId: 1 });
workshopPublicRegistrationSchema.index({ email: 1 });

// Delete any stale cached model so the schema (with the explicit collection name) is always used.
delete mongoose.models.WorkshopPublicRegistration;

module.exports = {
  WorkshopRegistration:       mongoose.models.WorkshopRegistration       || mongoose.model('WorkshopRegistration',       workshopRegistrationSchema),
  WorkshopAttendance:         mongoose.models.WorkshopAttendance         || mongoose.model('WorkshopAttendance',         workshopAttendanceSchema),
  WorkshopResource:           mongoose.models.WorkshopResource           || mongoose.model('WorkshopResource',           workshopResourceSchema),
  WorkshopFeedback:           mongoose.models.WorkshopFeedback           || mongoose.model('WorkshopFeedback',           workshopFeedbackSchema),
  WorkshopCertificate:        mongoose.models.WorkshopCertificate        || mongoose.model('WorkshopCertificate',        workshopCertificateSchema),
  WorkshopPublicRegistration: mongoose.model('WorkshopPublicRegistration', workshopPublicRegistrationSchema),
};

