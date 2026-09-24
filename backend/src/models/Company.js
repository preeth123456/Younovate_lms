// src/models/Company.js — HR placement companies (additive, no impact on LMS/Workshop)
'use strict';
const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  industry: { type: String, default: '' },
  location: { type: String, default: '' },
  website: { type: String, default: '' },
  contactName: { type: String, default: '' },
  contactEmail: { type: String, default: '', lowercase: true, trim: true },
  contactPhone: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

companySchema.index({ name: 1 });
companySchema.index({ status: 1 });

module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);
