// src/models/Batch.js
'use strict';
const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  trainerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  startDate:   { type: Date, required: true },
  endDate:     { type: Date },
  maxStudents: { type: Number, default: 30, min: 1 },
  status:      { type: String, enum: ['upcoming', 'active', 'completed', 'cancelled'], default: 'upcoming' },
  course:      { type: String, default: '' },
  tags:        [{ type: String }],
}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

// ── Reverse virtuals (NO stored array — single source of truth is User.batchIds) ──
// batch.populate('students')  → all trainees whose batchIds includes this batch
batchSchema.virtual('students', {
  ref:          'User',
  localField:   '_id',
  foreignField: 'batchIds',
});

// batch.populate('studentCount')  → number only, without loading the docs
batchSchema.virtual('studentCount', {
  ref:          'User',
  localField:   '_id',
  foreignField: 'batchIds',
  count:        true,
});

batchSchema.index({ status: 1 });
batchSchema.index({ trainerId: 1 });

module.exports = mongoose.models.Batch || mongoose.model('Batch', batchSchema);