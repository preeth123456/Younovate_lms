// src/models/Offer.js — offer lifecycle (additive, auditable chain candidate→company→job→evaluation)
'use strict';
const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'JobOpening' },
  evaluation: { type: mongoose.Schema.Types.ObjectId, ref: 'Evaluation' },
  role: { type: String, default: '' },
  ctc: { type: String, default: '' },
  location: { type: String, default: '' },
  offerDate: { type: Date },
  joiningDate: { type: Date },
  benefits: { type: String, default: '' },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'approved', 'released', 'accepted', 'declined', 'expired'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

offerSchema.index({ candidate: 1, status: 1 });
offerSchema.index({ company: 1, status: 1 });

module.exports = mongoose.models.Offer || mongoose.model('Offer', offerSchema);
