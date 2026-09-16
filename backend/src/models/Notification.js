'use strict';
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:             { type: String, required: true }, // e.g., 'certificate_assigned', 'certificate_sent', 'session_scheduled', etc.
  title:            { type: String, required: true },
  message:          { type: String, required: true },
  read:             { type: Boolean, default: false, index: true },
  readAt:           { type: Date, default: null },
  relatedEntity:    {
    entityType:     { type: String }, // 'certificate', 'session', 'workshop', 'batch', etc.
    entityId:       { type: mongoose.Schema.Types.ObjectId },
  },
  actionUrl:        { type: String }, // optional URL to navigate when clicked
  metadata:         { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);