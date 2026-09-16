'use strict';
/**
 * Trainer Workshop Routes — /api/trainer/workshops
 * ALL ownership checks use WorkshopBatch.trainerId === req.user._id
 * Never uses Workshop.trainerId for authorization.
 */

const express  = require('express');
const mongoose = require('mongoose');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const Workshop = require('../models/Workshop');
const WorkshopBatch = require('../models/WorkshopBatch');
const {
  WorkshopRegistration,
  WorkshopAttendance,
  WorkshopResource,
  WorkshopFeedback,
  WorkshopCertificate,
  WorkshopPublicRegistration,
} = require('../models/WorkshopModels');
const { protect, authorize } = require('../middleware/auth');
const Notification = require('../models/Notification');
const { sendEmail, certificateIssuedTemplate } = require('../utils/emailUtils');

const router = express.Router();
router.use(protect, authorize('trainer'));

// ── Multer ────────────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/workshop-resources');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /pdf|ppt|pptx|zip|mp4|png|jpg|jpeg/i.test(path.extname(file.originalname))),
});

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── Shared ownership helper ───────────────────────────────────────────────────
// Returns null if trainer owns a batch for this workshop, else { status, message }
async function assertTrainerOwnsWorkshop(workshopId, trainerId) {
  const batch = await WorkshopBatch.findOne({ workshopId, trainerId }).select('_id').lean();
  return batch ? null : { status: 403, message: 'Forbidden — you are not assigned to this workshop.' };
}

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/trainer/workshops/my-batches
// ═════════════════════════════════════════════════════════════════════════════
router.get('/my-batches', async (req, res) => {
  try {
    const batches = await WorkshopBatch.find({ trainerId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('workshopId', 'title date mode')
      .populate('trainerId', 'name email')
      .lean();
    return res.json({ success: true, batches: batches.map(b => ({ ...b, traineeCount: b.registrationIds?.length || 0 })) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/trainer/workshops/my-batches/:batchId/participants
// ═════════════════════════════════════════════════════════════════════════════
router.get('/my-batches/:batchId/participants', async (req, res) => {
  try {
    if (!isValidId(req.params.batchId)) return res.status(400).json({ success: false, message: 'Invalid batch ID.' });
    const batch = await WorkshopBatch.findById(req.params.batchId)
      .populate('registrationIds', 'fullName email phone whatsapp college qualification city state registrationStatus registrationDate')
      .lean();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });
    if (!batch.trainerId || batch.trainerId.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Forbidden — you are not assigned to this batch.' });
    const participants = (batch.registrationIds || []).map(r => ({
      _id: r._id,
      studentId: { _id: r._id, name: r.fullName, email: r.email, phone: r.phone, collegeName: r.college },
      registrationStatus: r.registrationStatus,
      registrationDate: r.registrationDate,
      batchName: batch.batchName,
    }));
    return res.json({ success: true, participants });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/trainer/workshops/my-batches/:batchId
// ═════════════════════════════════════════════════════════════════════════════
router.get('/my-batches/:batchId', async (req, res) => {
  try {
    if (!isValidId(req.params.batchId)) return res.status(400).json({ success: false, message: 'Invalid batch ID.' });
    const batch = await WorkshopBatch.findById(req.params.batchId)
      .populate('workshopId', 'title date mode')
      .populate('trainerId', 'name email')
      .populate('registrationIds', 'fullName email phone whatsapp college qualification city state registrationStatus registrationDate')
      .lean();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });
    if (!batch.trainerId || batch.trainerId._id.toString() !== req.user._id.toString())
      return res.status(403).json({ success: false, message: 'Forbidden — you are not assigned to this batch.' });
    return res.json({ success: true, batch });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/trainer/workshops/stats
// ═════════════════════════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  try {
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const myBatches = await WorkshopBatch.find({ trainerId: req.user._id }).lean();
    const total     = myBatches.length;
    const completed = myBatches.filter(b => b.status === 'Completed').length;
    const upcoming  = myBatches.filter(b => b.startDate && new Date(b.startDate) >= tomorrow && b.status === 'Active').length;
    const todayWS   = myBatches.filter(b => b.startDate && new Date(b.startDate).toDateString() === today.toDateString()).length;
    const totalParticipants = myBatches.reduce((sum, b) => sum + (b.registrationIds?.length || 0), 0);
    return res.json({ success: true, stats: { total, upcoming, completed, todayWS, liveWS: 0, totalParticipants, avgRating: 0, pendingCerts: 0 } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/trainer/workshops
// ═════════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const batchFilter = { trainerId: req.user._id };
    if (req.query.status) batchFilter.status = req.query.status;
    const myBatches = await WorkshopBatch.find(batchFilter)
      .populate('workshopId', 'title date mode status category fee feeType maxSeats availableSeats registrationCount duration time')
      .populate('trainerId', 'name email profilePicture')
      .sort({ createdAt: -1 })
      .lean();
    const workshopMap = new Map();
    for (const b of myBatches) {
      if (!b.workshopId) continue;
      const wid = b.workshopId._id.toString();
      if (!workshopMap.has(wid)) {
        workshopMap.set(wid, { ...b.workshopId, registrationCount: b.registrationIds?.length || 0, batchId: b._id, batchName: b.batchName, batchStatus: b.status });
      } else {
        workshopMap.get(wid).registrationCount += b.registrationIds?.length || 0;
      }
    }
    return res.json({ success: true, workshops: Array.from(workshopMap.values()) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/trainer/workshops/:id
// ═════════════════════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const authErr = await assertTrainerOwnsWorkshop(req.params.id, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.message });
    const workshop = await Workshop.findById(req.params.id).populate('trainerId', 'name email profilePicture').lean();
    if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found' });
    return res.json({ success: true, workshop });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/trainer/workshops/:id/start  (legacy — prefer /api/workshop-sessions/:id/start)
// ═════════════════════════════════════════════════════════════════════════════
router.post('/:id/start', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const authErr = await assertTrainerOwnsWorkshop(req.params.id, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.message });
    const workshop = await Workshop.findByIdAndUpdate(
      req.params.id,
      { status: 'Live' },
      { new: true }
    );
    if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found' });
    return res.json({ success: true, workshop });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/trainer/workshops/:id/end
// ═════════════════════════════════════════════════════════════════════════════
router.post('/:id/end', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const authErr = await assertTrainerOwnsWorkshop(req.params.id, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.message });
    const workshop = await Workshop.findByIdAndUpdate(req.params.id, { status: 'Completed' }, { new: true });
    if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found' });
    return res.json({ success: true, workshop });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/trainer/workshops/:id/participants
// ═════════════════════════════════════════════════════════════════════════════
router.get('/:id/participants', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const authErr = await assertTrainerOwnsWorkshop(req.params.id, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.message });

    const registrations = await WorkshopRegistration.find({ workshopId: req.params.id })
      .populate('studentId', 'name email phone profilePicture collegeName degree')
      .lean();
    const studentIds = registrations.map(r => r.studentId?._id);
    const [attendances, certs] = await Promise.all([
      WorkshopAttendance.find({ workshopId: req.params.id, studentId: { $in: studentIds } }).lean(),
      WorkshopCertificate.find({ workshopId: req.params.id, studentId: { $in: studentIds } }).lean(),
    ]);
    const attMap  = {}; attendances.forEach(a => { attMap[a.studentId.toString()]  = a; });
    const certMap = {}; certs.forEach(c => { certMap[c.studentId.toString()] = c; });
    return res.json({ success: true, participants: registrations.map(r => {
      const sid = r.studentId?._id?.toString();
      return { ...r, attendance: attMap[sid] || null, certificate: certMap[sid] || null };
    })});
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/trainer/workshops/:id/attendance
// ═════════════════════════════════════════════════════════════════════════════
router.post('/:id/attendance', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const authErr = await assertTrainerOwnsWorkshop(req.params.id, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.message });

    const { studentId, attendanceStatus, joinTime, leaveTime, duration } = req.body;
    if (!studentId || !attendanceStatus)
      return res.status(400).json({ success: false, message: 'studentId and attendanceStatus are required' });

    const workshop = await Workshop.findById(req.params.id).select('duration').lean();
    const mins = Number(duration) || 0;
    const pct  = workshop?.duration > 0 ? Math.min(100, Math.round((mins / workshop.duration) * 100)) : 0;

    const record = await WorkshopAttendance.findOneAndUpdate(
      { workshopId: req.params.id, studentId },
      { workshopId: req.params.id, studentId, attendanceStatus,
        joinTime: joinTime ? new Date(joinTime) : undefined,
        leaveTime: leaveTime ? new Date(leaveTime) : undefined,
        duration: mins, attendancePct: pct, markedBy: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (pct >= 60) {
      await WorkshopCertificate.findOneAndUpdate(
        { workshopId: req.params.id, studentId },
        { workshopId: req.params.id, studentId, status: 'Eligible' },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
    return res.json({ success: true, record });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/trainer/workshops/:id/attendance
// ═════════════════════════════════════════════════════════════════════════════
router.get('/:id/attendance', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const authErr = await assertTrainerOwnsWorkshop(req.params.id, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.message });
    const records = await WorkshopAttendance.find({ workshopId: req.params.id })
      .populate('studentId', 'name email phone profilePicture')
      .lean();
    return res.json({ success: true, records });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/trainer/workshops/:id/resources
// ═════════════════════════════════════════════════════════════════════════════
router.get('/:id/resources', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const authErr = await assertTrainerOwnsWorkshop(req.params.id, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.message });
    const resources = await WorkshopResource.find({ workshopId: req.params.id })
      .populate('uploadedBy', 'name').sort('-createdAt').lean();
    return res.json({ success: true, resources });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/trainer/workshops/:id/resources
// ═════════════════════════════════════════════════════════════════════════════
router.post('/:id/resources', upload.single('file'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const authErr = await assertTrainerOwnsWorkshop(req.params.id, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.message });
    const { title, type, url } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });
    const resourceUrl = req.file ? `/uploads/workshop-resources/${req.file.filename}` : (url || '');
    if (!resourceUrl) return res.status(400).json({ success: false, message: 'Provide a file or URL' });
    const resource = await WorkshopResource.create({
      workshopId: req.params.id, title, type: type || 'Link', url: resourceUrl,
      fileSize: req.file ? `${(req.file.size / 1024).toFixed(0)} KB` : '', uploadedBy: req.user._id,
    });
    await resource.populate('uploadedBy', 'name');
    return res.status(201).json({ success: true, resource });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/trainer/workshops/:id/resources/:resourceId
// ═════════════════════════════════════════════════════════════════════════════
router.delete('/:id/resources/:resourceId', async (req, res) => {
  try {
    const authErr = await assertTrainerOwnsWorkshop(req.params.id, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.message });
    const resource = await WorkshopResource.findOneAndDelete({ _id: req.params.resourceId, workshopId: req.params.id, uploadedBy: req.user._id });
    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });
    return res.json({ success: true, message: 'Resource deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/trainer/workshops/:id/feedback
// ═════════════════════════════════════════════════════════════════════════════
router.get('/:id/feedback', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const authErr = await assertTrainerOwnsWorkshop(req.params.id, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.message });
    const feedback = await WorkshopFeedback.find({ workshopId: req.params.id })
      .populate('studentId', 'name email profilePicture')
      .populate('sessionId', 'title scheduledAt status')
      .populate('trainerId', 'name email')
      .sort('-createdAt').lean();
    const total = feedback.length;
    const avgRating  = total ? Number((feedback.reduce((a, f) => a + f.rating, 0) / total).toFixed(1)) : 0;
    const avgTrainer = total ? Number((feedback.filter(f => f.trainerRating).reduce((a, f) => a + (f.trainerRating || 0), 0) / total).toFixed(1)) : 0;
    const dist = [5, 4, 3, 2, 1].map(star => ({ star, count: feedback.filter(f => f.rating === star).length }));
    return res.json({ success: true, feedback, stats: { total, avgRating, avgTrainer, dist } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/trainer/workshops/:id/certificates
// ═════════════════════════════════════════════════════════════════════════════
router.get('/:id/certificates', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
    const authErr = await assertTrainerOwnsWorkshop(req.params.id, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.message });
    const certificates = await WorkshopCertificate.find({ workshopId: req.params.id })
      .populate('studentId', 'name email profilePicture').sort('-createdAt').lean();
    const studentIds = certificates.map(c => c.studentId?._id);
    const attendances = await WorkshopAttendance.find({ workshopId: req.params.id, studentId: { $in: studentIds } }).lean();
    const attMap = {}; attendances.forEach(a => { attMap[a.studentId.toString()] = a; });
    return res.json({ success: true, certificates: certificates.map(c => ({ ...c, attendance: attMap[c.studentId?._id?.toString()] || null })) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/trainer/workshops/:id/certificates/:certId/send-to-trainee — Trainer sends certificate to trainee
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/:id/certificates/:certId/send-to-trainee', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid workshop ID' });
    if (!isValidId(req.params.certId)) return res.status(400).json({ success: false, message: 'Invalid certificate ID' });

    const authErr = await assertTrainerOwnsWorkshop(req.params.id, req.user._id);
    if (authErr) return res.status(authErr.status).json({ success: false, message: authErr.message });

    const cert = await WorkshopCertificate.findById(req.params.certId);
    if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found' });
    if (cert.workshopId.toString() !== req.params.id) {
      return res.status(400).json({ success: false, message: 'Certificate does not belong to this workshop' });
    }
    if (cert.status !== 'Issued') {
      return res.status(400).json({ success: false, message: 'Certificate must be issued before sending to trainee' });
    }
    if (cert.deliveryStatus === 'sent_to_trainee' || cert.deliveryStatus === 'delivered') {
      return res.status(400).json({ success: false, message: 'Certificate has already been sent to trainee' });
    }
    // Verify this trainer is assigned to this certificate
    if (cert.assignedTrainerId && cert.assignedTrainerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'This certificate is assigned to another trainer' });
    }

    await cert.populate('studentId', 'name email');
    await cert.populate('workshopId', 'title date');

    const updated = await WorkshopCertificate.findByIdAndUpdate(
      cert._id,
      {
        sentToTraineeAt: new Date(),
        deliveryStatus: 'sent_to_trainee',
      },
      { new: true }
    )
      .populate('studentId', 'name email')
      .populate('workshopId', 'title date')
      .populate('issuedBy', 'name')
      .lean();

    // Create notification for trainee
    await Notification.create({
      userId: cert.studentId._id,
      type: 'certificate_received',
      title: 'Certificate Received',
      message: `Your certificate for "${updated.workshopId?.title}" has been sent to you and is now available in your dashboard.`,
      relatedEntity: { entityType: 'certificate', entityId: updated._id },
      actionUrl: `/trainee/certificates`,
    });

    // Send email
    const dashboardUrl = `${process.env.FRONTEND_URL || 'https://younovate.in'}/trainee/certificates`;
    try {
      await sendEmail({
        to: updated.studentId.email,
        subject: 'YouVA OS – Your Workshop Certificate Has Been Sent',
        html: certificateIssuedTemplate(
          updated.studentId.name,
          updated.workshopId?.title || 'Workshop',
          updated.certificateNo,
          100,
          dashboardUrl
        ),
      });
    } catch (emailErr) {
      console.error('Certificate email notification failed:', emailErr.message);
    }

    return res.json({ success: true, certificate: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
