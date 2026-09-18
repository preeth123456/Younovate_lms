// src/models/LmsCertificate.js
// LMS course-completion certificate. Mirrors the WorkshopCertificate pattern
// (same statuses + certificateNo/issuedDate/issuedBy) but scoped to an LMS
// Course (courseId) instead of a Workshop (workshopId), because LMS
// eligibility requires completion of the ENTIRE course, not one session.
// sentToTrainer / sentToTrainee track the Admin → Trainer → Trainee handoff
// without inventing new statuses.
'use strict';
const mongoose = require('mongoose');

const lmsCertificateSchema = new mongoose.Schema({
  courseId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  batchId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  trainerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  certificateNo: { type: String, unique: true, sparse: true },
  issuedDate:    { type: Date },
  status:        { type: String, enum: ['Eligible', 'Issued', 'Pending', 'Rejected'], default: 'Pending' },
  sentToTrainer: { type: Boolean, default: false },
  sentToTrainee: { type: Boolean, default: false },
  issuedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentByTrainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

lmsCertificateSchema.index({ courseId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.models.LmsCertificate || mongoose.model('LmsCertificate', lmsCertificateSchema);
