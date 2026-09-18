// routes/batches.js — assign / remove / list trainees for a batch
'use strict';
const express = require('express');
const Batch   = require('../models/Batch');
const User    = require('../models/User');

// Resilient import: works whether auth.js does
//   module.exports = auth;            → authModule        is the function
//   module.exports = { auth };        → authModule.auth   is the function
//   module.exports.protect = auth;    → authModule.protect is the function
const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function'
  ? authModule
  : (authModule.auth || authModule.protect || authModule.default);

if (typeof auth !== 'function') {
  throw new Error(
    "routes/batches.js: '../middleware/auth' did not export a middleware function. " +
    "Check how auth.js sets module.exports."
  );
}

const router = express.Router();
const uid = (req) => String(req.user.id || req.user._id);

// ───────────────────────────────────────────────────────────
// POST /api/batches/:id/trainees   body: { traineeIds: [...] }
// Assigns trainees to a batch. Source of truth = User.batchIds.
// ───────────────────────────────────────────────────────────
router.post('/:id/trainees', auth, async (req, res) => {
  try {
    const { traineeIds = [] } = req.body || {};
    if (!Array.isArray(traineeIds) || traineeIds.length === 0) {
      return res.status(400).json({ message: 'traineeIds[] is required' });
    }

    const batch = await Batch.findById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    // Capacity check: how many are already in, vs how many NEW ones we'd add.
    const current = await User.countDocuments({ batchIds: batch._id });
    const toAdd   = await User.countDocuments({
      _id: { $in: traineeIds }, role: 'trainee', batchIds: { $ne: batch._id },
    });
    if (current + toAdd > batch.maxStudents) {
      return res.status(409).json({
        message: `Batch is full — ${current}/${batch.maxStudents} seats used, can't add ${toAdd} more.`,
      });
    }

    // Add the batch to each trainee's batchIds (idempotent via $addToSet).
    const update = { $addToSet: { batchIds: batch._id } };
    if (batch.trainerId) update.$set = { assignedTrainer: batch.trainerId }; // optional direct link
    await User.updateMany({ _id: { $in: traineeIds }, role: 'trainee' }, update);

    // Stamp enrolledAt only for those who don't have it yet.
    await User.updateMany(
      { _id: { $in: traineeIds }, role: 'trainee', enrolledAt: { $exists: false } },
      { $set: { enrolledAt: new Date() } }
    );

    const students = await User.find({ batchIds: batch._id }).select('name email placementStatus');

    // Trainee inbox (best-effort — assignment still succeeds on failure).
    try {
      const { notifyUsers, idOf } = require('../utils/notificationService');
      await notifyUsers(traineeIds.map((id) => ({
        userId: id, role: 'trainee', module: 'LMS',
        type: 'batch_assigned', kind: 'lms_batch_assigned',
        title: 'Added to a Batch',
        message: `You have been added to batch "${batch.name}".`,
        dedupeKey: `lms:batch:${idOf(batch._id)}:trainee:${id}`,
        link: '/trainee/dashboard',
        meta: { batchId: idOf(batch._id), batchName: batch.name, entityType: 'batch' },
      })));
    } catch (_) {}

    return res.json({ batch, students, count: students.length });
  } catch (err) {
    console.error('assign batch trainees error →', err);
    return res.status(500).json({ message: err.message });
  }
});

// ───────────────────────────────────────────────────────────
// DELETE /api/batches/:id/trainees/:traineeId   (remove from batch)
// ───────────────────────────────────────────────────────────
router.delete('/:id/trainees/:traineeId', auth, async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    await User.updateOne(
      { _id: req.params.traineeId },
      { $pull: { batchIds: batch._id } }
    );
    return res.json({ removed: req.params.traineeId, batchId: batch._id });
  } catch (err) {
    console.error('remove batch trainee error →', err);
    return res.status(500).json({ message: err.message });
  }
});

// ───────────────────────────────────────────────────────────
// GET /api/batches/:id/trainees   (list a batch's trainees)
// ───────────────────────────────────────────────────────────
router.get('/:id/trainees', auth, async (req, res) => {
  try {
    const students = await User.find({ batchIds: req.params.id })
      .select('name email placementStatus');
    return res.json(students);
  } catch (err) {
    console.error('list batch trainees error →', err);
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;

// Mount in app.js:
//   app.use('/api/batches', require('./routes/batches'));