'use strict';
const express = require('express');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /api/notifications — get user's notifications
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const filter = { userId: req.user._id };
    if (unreadOnly === 'true') filter.read = false;

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    return res.json({
      success: true,
      notifications,
      unreadCount,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/notifications/unread-count — get unread count only
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, read: false });
    return res.json({ success: true, count });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/notifications/:id/read — mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    ).lean();
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.json({ success: true, notification });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/notifications/read-all — mark all notifications as read
router.put('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );
    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/notifications/:id — delete/archive notification
router.delete('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;