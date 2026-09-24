// src/models/HrSetting.js — HR-specific preferences only (never admin system settings)
'use strict';
const mongoose = require('mongoose');

const hrSettingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  emailNotifications: { type: Boolean, default: true },
  inAppNotifications: { type: Boolean, default: true },
  interviewReminders: { type: Boolean, default: true },
  evaluationReminders: { type: Boolean, default: true },
  offerNotifications: { type: Boolean, default: true },
  placementNotifications: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.models.HrSetting || mongoose.model('HrSetting', hrSettingSchema);
