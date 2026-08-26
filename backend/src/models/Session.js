// src/models/Session.js  — Zoom-style session with trainer + trainees
'use strict';
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  // ── Basics ──────────────────────────────────────────
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', trim: true },

  // ── Context: LMS or WORKSHOP ────────────────────────────────────────────
  // sessionType distinguishes LMS sessions (linked to Batch) from Workshop
  // sessions (linked to WorkshopBatch). Defaults to 'LMS' so all existing
  // sessions remain unchanged.
  sessionType: { type: String, enum: ['LMS', 'WORKSHOP'], default: 'LMS', index: true },

  // batchId is now OPTIONAL — a session can target a whole batch
  // and/or individually-enrolled trainees.
  batchId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', index: true },

  // workshopBatchId — only set when sessionType === 'WORKSHOP'.
  // Stored separately so Mongoose ref validation for Batch is never violated.
  workshopBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopBatch', index: true },

  // who runs it
  trainerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // who is allowed to attend (THIS was the missing piece)
  trainees:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],

  // LMS curriculum linkage (trainer session scheduler)
  moduleId:    { type: String, default: '', trim: true },
  lmsModuleId: { type: String, default: '', trim: true },

  // ── Scheduling / timer (the "Zoom" part) ────────────
  scheduledAt:       { type: Date,   required: true, index: true },        // meeting start time
  durationMinutes:   { type: Number, default: 60, min: 5, max: 600 },      // length of the meeting
  timezone:          { type: String, default: 'Asia/Kolkata' },
  joinBeforeMinutes: { type: Number, default: 10, min: 0 },                // how early people may join
  autoEnd:           { type: Boolean, default: true },                     // auto-complete when timer runs out

  status: { type: String, enum: ['scheduled', 'live', 'completed', 'cancelled', 'awaiting_confirmation'], default: 'scheduled', index: true },

  // ── LiveKit room ────────────────────────────────────
  roomName:  { type: String, default: '', index: true },
  passcode:  { type: String, default: '' },                                // optional join passcode
  startedAt: { type: Date },
  endedAt:   { type: Date },

  // ── Recording (quick-access denormalised fields) ────
  egressId:        { type: String, default: '' },
  recordingUrl:    { type: String, default: '' },
  recordingStatus: { type: String, enum: ['none', 'recording', 'processing', 'available', 'failed'], default: 'none' },
  recordings:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'Recording' }],

  // ── Extras ──────────────────────────────────────────
  topics:    [{ type: String, trim: true }],
  resources: [{ name: String, url: String }],
}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

// ── Virtual "timer" fields (computed, never stored) ───
sessionSchema.virtual('endsAt').get(function () {
  if (!this.scheduledAt) return null;
  return new Date(this.scheduledAt.getTime() + (this.durationMinutes || 60) * 60000);
});

sessionSchema.virtual('joinableFrom').get(function () {
  if (!this.scheduledAt) return null;
  return new Date(this.scheduledAt.getTime() - (this.joinBeforeMinutes || 0) * 60000);
});

// seconds left until auto-end (negative once the meeting is over)
sessionSchema.virtual('secondsRemaining').get(function () {
  const end = this.endsAt;
  return end ? Math.round((end.getTime() - Date.now()) / 1000) : null;
});

// ── Instance helpers ──────────────────────────────────
sessionSchema.methods.canJoin = function () {
  const now = Date.now();
  if (this.status === 'cancelled' || this.status === 'completed') return false;
  if (this.status === 'live') return true;
  return this.joinableFrom && now >= this.joinableFrom.getTime() && now <= this.endsAt.getTime();
};

sessionSchema.methods.isOver = function () {
  return this.endsAt ? Date.now() > this.endsAt.getTime() : false;
};

// is this user the trainer OR an enrolled trainee?
sessionSchema.methods.isParticipant = function (userId) {
  const uid = String(userId);
  if (String(this.trainerId) === uid) return true;
  return (this.trainees || []).some((t) => String(t) === uid);
};

sessionSchema.index({ batchId: 1, scheduledAt: -1 });
sessionSchema.index({ workshopBatchId: 1, scheduledAt: -1 });
sessionSchema.index({ trainerId: 1, status: 1 });
sessionSchema.index({ trainees: 1, scheduledAt: -1 });
sessionSchema.index({ sessionType: 1, scheduledAt: -1 });

module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema);