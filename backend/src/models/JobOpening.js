// src/models/JobOpening.js — HR job openings (additive, references Company)
'use strict';
const mongoose = require('mongoose');

const jobOpeningSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  requiredSkills: [{ type: String }],
  preferredSkills: [{ type: String }],
  location: { type: String, default: '' },
  employmentType: { type: String, enum: ['full-time', 'part-time', 'internship', 'contract', ''], default: 'full-time' },
  experienceMin: { type: Number, default: 0 },
  experienceMax: { type: Number },
  salaryMin: { type: String, default: '' },
  salaryMax: { type: String, default: '' },
  ctc: { type: String, default: '' },
  openingsCount: { type: Number, default: 1, min: 1 },
  eligibilityCriteria: { type: String, default: '' },
  deadline: { type: Date },
  status: { type: String, enum: ['draft', 'open', 'closed', 'expired'], default: 'open' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

jobOpeningSchema.index({ company: 1, status: 1 });
jobOpeningSchema.index({ status: 1, deadline: 1 });

module.exports = mongoose.models.JobOpening || mongoose.model('JobOpening', jobOpeningSchema);
