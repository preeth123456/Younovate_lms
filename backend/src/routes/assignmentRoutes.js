// src/routes/assignmentRoutes.js
'use strict';
const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const Assignment = require('../models/Assignment');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ── Multer — local disk storage (replace with S3 in production) ───────────────
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|zip|png|jpg|jpeg|mp4/i;
    cb(null, allowed.test(path.extname(file.originalname)));
  },
});

router.use(protect);

// GET /api/assignments?batchId=&status=
router.get('/', async (req, res) => {
  const { batchId, status } = req.query;
  const filter = {};
  if (req.user.role === 'trainee') { filter.batchId = req.user.batchId; filter.status = { $ne: 'draft' }; }
  if (req.user.role === 'trainer') { filter.createdBy = req.user._id; }
  if (batchId) filter.batchId = batchId;
  if (status)  filter.status  = status;

  const assignments = await Assignment.find(filter)
    .populate('batchId',   'name')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 });

  // For trainees, attach their own submission status
  if (req.user.role === 'trainee') {
    const enriched = assignments.map(a => {
      const sub = a.submissions.find(s => s.trainee.toString() === req.user._id.toString());
      return { ...a.toObject(), mySubmission: sub || null };
    });
    return res.json({ success: true, assignments: enriched });
  }
  return res.json({ success: true, assignments });
});

// GET /api/assignments/:id
router.get('/:id', async (req, res) => {
  const assignment = await Assignment.findById(req.params.id)
    .populate('batchId', 'name').populate('createdBy', 'name')
    .populate('submissions.trainee',  'name email profilePicture')
    .populate('submissions.gradedBy', 'name');
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
  return res.json({ success: true, assignment });
});

// POST /api/assignments  [trainer ONLY — Admin is view/monitor-only]
//   Body: { title, batchId, dueDate, description?, instructions?, maxScore?, status? }
router.post('/', authorize('trainer'), async (req, res) => {
  const { title, batchId, dueDate } = req.body;
  if (!title || !batchId || !dueDate)
    return res.status(400).json({ success: false, message: 'title, batchId and dueDate required' });
  const assignment = await Assignment.create({ ...req.body, createdBy: req.user._id });
  // Trainee inbox: everyone in the batch (best-effort).
  try {
    const notify = require('../utils/notificationService');
    const User = require('../models/User');
    const trainees = await User.find({ role: 'trainee', isActive: true, batchIds: assignment.batchId }).select('_id').lean();
    await notify.notifyUsers(trainees.map((t) => ({
      userId: t._id, role: 'trainee', module: 'LMS',
      type: 'assignment_assigned', kind: 'lms_assignment_assigned',
      title: 'New Assignment Available',
      message: `A new assignment "${assignment.title}" is available for your batch.`,
      dedupeKey: `lms:assignment:${notify.idOf(assignment._id)}:trainee:${t._id}`,
      link: '/trainee/assignments',
      meta: { assignmentId: notify.idOf(assignment._id), batchId: notify.idOf(assignment.batchId), entityType: 'assignment' },
    })));
  } catch (_) {}
  return res.status(201).json({ success: true, assignment });
});

// PUT /api/assignments/:id  [trainer/admin — own assignments only]
//   Body: any assignment fields
router.put('/:id', authorize('trainer', 'admin'), async (req, res) => {
  const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, createdBy: req.user._id };
  const assignment = await Assignment.findOneAndUpdate(filter, req.body, { new: true, runValidators: true });
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found or unauthorized' });
  return res.json({ success: true, assignment });
});

// DELETE /api/assignments/:id  [trainer/admin]
router.delete('/:id', authorize('trainer', 'admin'), async (req, res) => {
  const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, createdBy: req.user._id };
  const assignment = await Assignment.findOneAndDelete(filter);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found or unauthorized' });
  return res.json({ success: true, message: 'Assignment deleted' });
});

// POST /api/assignments/:id/submit  [trainee]
//   Multipart: file (optional) + body: { submissionUrl?, notes? }
router.post('/:id/submit', authorize('trainee'), upload.single('file'), async (req, res) => {
  const assignment = await Assignment.findOne({ _id: req.params.id, status: 'active' });
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found or closed' });

  const submissionUrl = req.file
    ? `/uploads/${req.file.filename}`
    : req.body.submissionUrl;
  if (!submissionUrl)
    return res.status(400).json({ success: false, message: 'Provide file upload or submissionUrl' });

  const idx = assignment.submissions.findIndex(s => s.trainee.toString() === req.user._id.toString());
  const submissionData = { trainee: req.user._id, submissionUrl, notes: req.body.notes || '', submittedAt: new Date(), status: 'submitted' };

  if (idx >= 0) {
    Object.assign(assignment.submissions[idx], { ...submissionData, status: 'resubmitted' });
  } else {
    assignment.submissions.push(submissionData);
  }
  await assignment.save();
  // Trainer inbox: assignment creator only (best-effort).
  try {
    const notify = require('../utils/notificationService');
    if (assignment.createdBy) {
      await notify.notifyUsers([{
        userId: assignment.createdBy, role: 'trainer', module: 'LMS',
        type: 'assignment_submitted', kind: 'lms_assignment_submitted',
        title: 'Assignment Submitted',
        message: `${req.user?.name || 'A trainee'} submitted "${assignment.title}".`,
        dedupeKey: `lms:assignment:${notify.idOf(assignment._id)}:submitted:${notify.idOf(req.user._id)}`,
        link: '/trainer/assignments',
        meta: { assignmentId: notify.idOf(assignment._id), entityType: 'assignment' },
      }]);
    }
  } catch (_) {}
  return res.status(201).json({ success: true, message: 'Assignment submitted' });
});

// PUT /api/assignments/:id/grade  [trainer/admin]
//   Body: { traineeId, grade, feedback?, allowResubmit? }
router.put('/:id/grade', authorize('trainer', 'admin'), async (req, res) => {
  const { traineeId, grade, feedback, allowResubmit } = req.body;
  if (!traineeId || grade === undefined)
    return res.status(400).json({ success: false, message: 'traineeId and grade required' });

  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

  const sub = assignment.submissions.find(s => s.trainee.toString() === traineeId);
  if (!sub) return res.status(404).json({ success: false, message: 'No submission from this trainee' });

  Object.assign(sub, { grade, feedback: feedback || '', status: 'graded', gradedBy: req.user._id, gradedAt: new Date(), allowResubmit: Boolean(allowResubmit) });
  await assignment.save();
  // Trainee inbox: graded/completed (best-effort).
  try {
    const notify = require('../utils/notificationService');
    await notify.notifyUsers([{
      userId: traineeId, role: 'trainee', module: 'LMS',
      type: 'assignment_graded', kind: 'lms_assignment_completed',
      title: 'Assignment Reviewed',
      message: `Your submission for "${assignment.title}" has been reviewed.`,
      dedupeKey: `lms:assignment:${notify.idOf(assignment._id)}:graded:${notify.idOf(traineeId)}`,
      link: '/trainee/assignments',
      meta: { assignmentId: notify.idOf(assignment._id), entityType: 'assignment' },
    }]);
  } catch (_) {}
  return res.json({ success: true, submission: sub });
});

module.exports = router;
