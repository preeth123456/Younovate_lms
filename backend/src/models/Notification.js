'use strict';
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role:             { type: String, default: 'trainee' },
  module:           { type: String, default: 'LMS' }, // 'LMS' | 'Workshop'
  kind:             { type: String, default: '' },   // e.g. 'lms_session_scheduled'
  type:             { type: String, required: true }, // e.g., 'certificate_assigned', 'certificate_sent', 'session_scheduled', etc.
  title:            { type: String, required: true },
  message:          { type: String, required: true },
  read:             { type: Boolean, default: false, index: true },
  readAt:           { type: Date, default: null },
  dedupeKey:        { type: String, index: true },
  link:             { type: String, default: '' },
  relatedEntity:    {
    entityType:     { type: String }, // 'certificate', 'session', 'workshop', 'batch', etc.
    entityId:       { type: mongoose.Schema.Types.ObjectId },
  },
  actionUrl:        { type: String }, // optional URL to navigate when clicked
  metadata:         { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);