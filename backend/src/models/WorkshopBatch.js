'use strict';
const mongoose = require('mongoose');

const workshopBatchSchema = new mongoose.Schema({
  workshopId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Workshop', required: true },
  batchName:       { type: String, required: true, trim: true },
  batchCode:       { type: String, required: true, trim: true },
  registrationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WorkshopPublicRegistration' }],
  // students holds User ObjectId refs for login-enabled participants (set on approval)
  students:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  trainer:         { type: String, required: true, trim: true },
  trainerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAt:      { type: Date, default: null },
  reassignedAt:    { type: Date, default: null },
  startDate:       { type: Date, required: true },
  endDate:         { type: Date },
  startTime:       { type: String, default: '' },
  endTime:         { type: String, default: '' },
  mode:            { type: String, enum: ['Online', 'Offline', 'Hybrid'], default: 'Online' },
  capacity:        { type: Number, required: true, min: 1 },
  status:          { type: String, enum: ['Draft', 'Scheduled', 'Active', 'Completed', 'Cancelled', 'Archived'], default: 'Draft' },
  notes:           { type: String, default: '' },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, collection: 'workshopBatches' });

workshopBatchSchema.index({ workshopId: 1 });

module.exports = mongoose.models.WorkshopBatch || mongoose.model('WorkshopBatch', workshopBatchSchema);
