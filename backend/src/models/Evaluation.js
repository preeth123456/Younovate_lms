// src/models/Evaluation.js — per-interview evaluation (additive, keeps User.hrEvaluation intact)
'use strict';
const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  interview: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'JobOpening' },
  technical: { type: Number, min: 0, max: 100 },
  problemSolving: { type: Number, min: 0, max: 100 },
  communication: { type: Number, min: 0, max: 100 },
  roleKnowledge: { type: Number, min: 0, max: 100 },
  overallScore: { type: Number, min: 0, max: 100 },
  recommendation: { type: String, enum: ['selected', 'rejected', 'on_hold', ''], default: '' },
  comments: { type: String, default: '' },
  evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  evaluatedAt: { type: Date },
}, { timestamps: true });

evaluationSchema.index({ interview: 1 }, { unique: true });
evaluationSchema.index({ candidate: 1, createdAt: -1 });

module.exports = mongoose.models.Evaluation || mongoose.model('Evaluation', evaluationSchema);
