// src/models/Placement.js — confirmed placement outcomes (additive, references candidate+offer+company+job)
'use strict';
const mongoose = require('mongoose');

const placementSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'JobOpening' },
  role: { type: String, default: '' },
  ctc: { type: String, default: '' },
  location: { type: String, default: '' },
  offerDate: { type: Date },
  joiningDate: { type: Date },
  status: { type: String, enum: ['offer_accepted', 'joining_pending', 'joined', 'placed', 'withdrawn'], default: 'offer_accepted' },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

placementSchema.index({ candidate: 1 });
placementSchema.index({ company: 1, status: 1 });

module.exports = mongoose.models.Placement || mongoose.model('Placement', placementSchema);
