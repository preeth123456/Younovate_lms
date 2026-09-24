// src/models/Interview.js — extended additively for HR placement (existing fields untouched)
'use strict';
const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
  trainee:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:             { type: String, enum: ['mock', 'technical', 'hr', 'final', 'client', 'placement'], required: true },
  status:           { type: String, enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show'], default: 'scheduled' },
  scheduledAt:      { type: Date, required: true },
  endAt:            { type: Date },
  interviewerName:  { type: String, default: '' },
  interviewerEmail: { type: String, default: '' },
  meetingLink:      { type: String, default: '' },
  mode:             { type: String, enum: ['online', 'offline', 'telephonic', ''], default: '' },
  location:         { type: String, default: '' },
  notes:            { type: String, default: '' },
  outcome:          { type: String, enum: ['passed', 'failed', 'on_hold', ''], default: '' },
  feedback:         { type: String, default: '' },
  score:            { type: Number, min: 0, max: 100 },
  nextStep:         { type: String, default: '' },
  completedAt:      { type: Date },
  scheduledBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // ── HR placement links (additive, optional so legacy interviews keep working) ──
  company:          { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  job:              { type: mongoose.Schema.Types.ObjectId, ref: 'JobOpening' },
  role:             { type: String, default: '' },
  round:            { type: String, default: '' },
}, { timestamps: true });

interviewSchema.index({ trainee: 1, scheduledAt: -1 });
interviewSchema.index({ status: 1 });
interviewSchema.index({ company: 1, status: 1 });

module.exports = mongoose.models.Interview || mongoose.model('Interview', interviewSchema);

