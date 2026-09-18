// Part 1/3 — admin endpoints (mirrors Workshop admin issue pattern).
'use strict';
const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const LmsCert = require('../models/LmsCertificate');
const { isLmsCourseCompleted } = require('../utils/lmsCompletion');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const Cert = () => LmsCert;

// GET /api/lms-certificates/admin/eligibility?courseId=
router.get('/admin/eligibility', authorize('admin'), async (req, res) => {
  try {
    const { courseId } = req.query;
    if (!isId(courseId)) return res.status(400).json({ success: false, message: 'Valid courseId is required' });
    const course = await Course.findById(courseId).select('name code').lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    const enrollments = await Enrollment.find({ course: courseId })
      .populate('student', 'name email')
      .populate('batch', 'name trainerId')
      .lean();
    const certs = await Cert().find({ courseId }).lean();
    const certMap = {};
    certs.forEach((c) => { certMap[String(c.studentId)] = c; });
    const rows = await Promise.all(enrollments.map(async (e) => {
      if (!e.student) return null;
      const sId = e.student._id || e.student;
      const completion = await isLmsCourseCompleted(sId, courseId);
      let trainerId = e.batch?.trainerId || null;
      if (!trainerId && e.batch?._id) {
        const b = await Batch.findById(e.batch._id).select('trainerId').lean();
        trainerId = b?.trainerId || null;
      }
      const cert = certMap[String(sId)] || null;
      return {
        student: e.student,
        course: { _id: course._id, name: course.name, code: course.code },
        batch: e.batch ? { _id: e.batch._id, name: e.batch.name } : null,
        trainerId,
        completed: completion.completed,
        completion,
        certificate: cert,
        canIssue: completion.completed && (!cert || cert.status !== 'Issued'),
      };
    }));
    return res.json({ success: true, course, rows: rows.filter(Boolean) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/lms-certificates/admin?courseId=&status=
router.get('/admin', authorize('admin'), async (req, res) => {
  try {
    const { courseId, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (courseId && isId(courseId)) filter.courseId = courseId;
    if (status) filter.status = status;
    const total = await Cert().countDocuments(filter);
    const certificates = await Cert().find(filter)
      .populate('studentId', 'name email')
      .populate('courseId', 'name code')
      .populate('trainerId', 'name email')
      .populate('issuedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();
    const enriched = await Promise.all(certificates.map(async (c) => {
      const completion = await isLmsCourseCompleted(c.studentId?._id || c.studentId, c.courseId?._id || c.courseId);
      return { ...c, courseCompleted: completion.completed, completion };
    }));
    return res.json({ success: true, certificates: enriched, total, page: Number(page) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/lms-certificates/admin/issue  { courseId, studentId }
// Backend-enforced: enrolled + ENTIRE course completed. Idempotent reuse.
router.post('/admin/issue', authorize('admin'), async (req, res) => {
  try {
    const { courseId, studentId } = req.body || {};
    if (!isId(courseId)) return res.status(400).json({ success: false, message: 'Valid courseId is required' });
    if (!isId(studentId)) return res.status(400).json({ success: false, message: 'Valid studentId is required' });
    const course = await Course.findById(courseId).select('name code').lean();
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    const trainee = await User.findById(studentId).select('_id name email role').lean();
    if (!trainee || trainee.role !== 'trainee') return res.status(404).json({ success: false, message: 'Trainee not found' });
    const enrolled = await Enrollment.findOne({ student: studentId, course: courseId }).select('_id batch').lean();
    if (!enrolled) return res.status(403).json({ success: false, message: 'Trainee is not enrolled in this course' });
    const completion = await isLmsCourseCompleted(studentId, courseId);
    if (!completion.completed) {
      return res.status(400).json({ success: false, message: 'Course not completed — certificate cannot be issued' });
    }
    let trainerId = null;
    if (enrolled.batch) {
      const b = await Batch.findById(enrolled.batch).select('trainerId').lean();
      trainerId = b?.trainerId || null;
    }
    const existing = await Cert().findOne({ courseId, studentId })
      .populate('studentId', 'name email').populate('courseId', 'name code');
    if (existing && existing.status === 'Issued') {
      return res.json({ success: true, certificate: existing.toObject(), duplicate: true });
    }
    const certificateNo = (existing && existing.certificateNo)
      || `LMS-${String(courseId).slice(-6).toUpperCase()}-${String(studentId).slice(-6).toUpperCase()}-${Date.now()}`;
    const cert = await Cert().findOneAndUpdate(
      { courseId, studentId },
      {
        $set: {
          status: 'Issued', certificateNo, issuedDate: new Date(), issuedBy: req.user._id,
          sentToTrainer: true, batchId: enrolled.batch || undefined, trainerId: trainerId || undefined,
        },
        $setOnInsert: { courseId, studentId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('studentId', 'name email').populate('courseId', 'name code').populate('trainerId', 'name email');
    try {
      const { notifyUsers, idOf } = require('../utils/notificationService');
      const tId = cert.trainerId?._id || trainerId;
      if (tId) {
        await notifyUsers([{
          userId: tId, role: 'trainer', module: 'LMS', kind: 'lms_certificate_issued',
          title: 'LMS Certificate Issued',
          message: `Admin issued the ${course.name} certificate for ${trainee.name}. Please send it to the trainee.`,
          dedupeKey: `lms:certificate:${idOf(courseId)}:${idOf(studentId)}:trainer:${idOf(tId)}`,
          link: '/trainer/certificates',
          meta: { courseId: idOf(courseId), studentId: idOf(studentId), certificateId: idOf(cert._id) },
        }]);
      }
    } catch (_) {}
    return res.json({ success: true, certificate: cert });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Certificate already exists' });
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Trainer ──────────────────────────────────────────────────────────────

// GET /api/lms-certificates/trainer — certs for the trainer's batches/students
router.get('/trainer', authorize('trainer'), async (req, res) => {
  try {
    const myBatchIds = await Batch.find({ trainerId: req.user._id }).distinct('_id');
    const mySessionBatchIds = await require('../models/Session').find({
      trainerId: req.user._id,
      $or: [{ sessionType: 'LMS' }, { sessionType: { $exists: false } }, { sessionType: null }],
    }).distinct('batchId');
    const batchIds = [...new Set([...myBatchIds.map(String), ...mySessionBatchIds.filter(Boolean).map(String)])];
    const certs = await Cert().find({
      $or: [{ trainerId: req.user._id }, ...(batchIds.length ? [{ batchId: { $in: batchIds } }] : [])],
    }).populate('studentId', 'name email').populate('courseId', 'name code').sort({ createdAt: -1 }).lean();
    const enriched = await Promise.all(certs.map(async (c) => {
      const completion = await isLmsCourseCompleted(c.studentId?._id || c.studentId, c.courseId?._id || c.courseId);
      return { ...c, courseCompleted: completion.completed };
    }));
    return res.json({ success: true, certificates: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/lms-certificates/trainer/:id/send — trainer sends to trainee
router.post('/trainer/:id/send', authorize('trainer'), async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid certificate ID' });
    const cert = await Cert().findById(req.params.id);
    if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found' });
    if (cert.status !== 'Issued' || !cert.sentToTrainer) {
      return res.status(400).json({ success: false, message: 'Admin has not issued this certificate yet' });
    }
    if (cert.trainerId && String(cert.trainerId) !== String(req.user._id)) {
      const owns = cert.batchId ? await Batch.exists({ _id: cert.batchId, trainerId: req.user._id }) : null;
      if (!owns) return res.status(403).json({ success: false, message: 'Not your certificate' });
    }
    if (cert.sentToTrainee) {
      await cert.populate('studentId', 'name email');
      await cert.populate('courseId', 'name code');
      return res.json({ success: true, certificate: cert.toObject(), duplicate: true });
    }
    cert.sentToTrainee = true;
    cert.sentByTrainer = req.user._id;
    await cert.save();
    await cert.populate('studentId', 'name email');
    await cert.populate('courseId', 'name code');
    try {
      const { notifyUsers, idOf } = require('../utils/notificationService');
      await notifyUsers([{
        userId: cert.studentId?._id || cert.studentId, role: 'trainee', module: 'LMS', kind: 'lms_certificate_ready',
        title: 'Your Certificate Is Ready',
        message: `Your ${cert.courseId?.name || 'course'} completion certificate is now available.`,
        dedupeKey: `lms:certificate:${idOf(cert.courseId)}:${idOf(cert.studentId)}:trainee`,
        link: '/trainee/certificates',
        meta: { courseId: idOf(cert.courseId), certificateId: idOf(cert._id) },
      }]);
    } catch (_) {}
    return res.json({ success: true, certificate: cert.toObject() });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Trainee (IDOR-safe: always scoped to req.user._id + sentToTrainee) ────

// GET /api/lms-certificates/my — own certificates, only after trainer sends
router.get('/my', authorize('trainee'), async (req, res) => {
  try {
    const certificates = await Cert().find({ studentId: req.user._id, sentToTrainee: true })
      .populate('courseId', 'name code')
      .sort({ createdAt: -1 }).lean();
    return res.json({ success: true, certificates });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/lms-certificates/my/:id — own single certificate
router.get('/my/:id', authorize('trainee'), async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid certificate ID' });
    const cert = await Cert().findOne({ _id: req.params.id, studentId: req.user._id, sentToTrainee: true })
      .populate('courseId', 'name code').lean();
    if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found' });
    return res.json({ success: true, certificate: cert });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
