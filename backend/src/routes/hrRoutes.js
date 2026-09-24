// src/routes/hrRoutes.js
'use strict';
const express   = require('express');
const User      = require('../models/User');
const Interview = require('../models/Interview');
const Company   = require('../models/Company');
const JobOpening = require('../models/JobOpening');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect, authorize('hr', 'admin'));

// Pipeline stages mapping
const PIPELINE_STAGES = {
  enrolled: 'Pipeline Eligible',
  training: 'Profile Review',
  ready: 'Employer Matched',
  interview_scheduled: 'Interview Scheduled',
  interview_done: 'Interview Done',
  offer_extended: 'Offer Extended',
  placed: 'Placed',
  not_placed: 'Not Placed'
};

// GET /api/hr/dashboard
router.get('/dashboard', async (req, res) => {
  const [totalTrainees, readyTrainees, placedTrainees, scheduledInterviews] = await Promise.all([
    User.countDocuments({ role: 'trainee', isActive: true }),
    User.countDocuments({ role: 'trainee', isActive: true, placementStatus: 'ready' }),
    User.countDocuments({ role: 'trainee', isActive: true, placementStatus: 'placed' }),
    Interview.countDocuments({ status: 'scheduled' }),
  ]);
  const pipeline = await User.aggregate([
    { $match: { role: 'trainee', isActive: true } },
    { $group: { _id: '$placementStatus', count: { $sum: 1 } } },
  ]);
  return res.json({ success: true, totalTrainees, readyTrainees, placedTrainees, scheduledInterviews, pipeline });
});

// GET /api/hr/pipeline - Complete placement pipeline view
router.get('/pipeline', async (req, res) => {
  const { search, batch, program, scores } = req.query;
  const filter = { role: 'trainee', isActive: true };
  
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } }
  ];
  if (batch) filter.batchId = batch;
  
  const pipeline = await User.aggregate([
    { $match: filter },
    { $lookup: { from: 'batches', localField: 'batchId', foreignField: '_id', as: 'batch' } },
    { $unwind: { path: '$batch', preserveNullAndEmptyArrays: true } },
    { $addFields: { 
      stage: '$placementStatus',
      score: { $ifNull: ['$hrEvaluation.overallScore', 0] }
    }},
    { $group: {
      _id: '$placementStatus',
      candidates: { $push: {
        _id: '$_id',
        name: '$name',
        email: '$email',
        score: '$score',
        batch: '$batch.name',
        companyName: '$companyName',
        ctc: '$ctc',
        placementNote: '$placementNote',
        updatedAt: '$placementUpdatedAt'
      }}
    }},
    { $sort: { '_id': 1 } }
  ]);
  
  const stats = {
    total: await User.countDocuments({ role: 'trainee', isActive: true }),
    stages: Object.keys(PIPELINE_STAGES).reduce((acc, stage) => {
      const stageData = pipeline.find(p => p._id === stage);
      acc[stage] = {
        name: PIPELINE_STAGES[stage],
        count: stageData ? stageData.candidates.length : 0,
        candidates: stageData ? stageData.candidates : []
      };
      return acc;
    }, {})
  };
  
  return res.json({ success: true, pipeline: stats, stages: PIPELINE_STAGES });
});

// GET /api/hr/trainees?placementStatus=&batchId=&search=
router.get('/trainees', async (req, res) => {
  const { placementStatus, batchId, search } = req.query;
  const filter = { role: 'trainee', isActive: true };
  if (placementStatus) filter.placementStatus = placementStatus;
  if (batchId)         filter.batchId         = batchId;
  if (search)          filter.name            = { $regex: search, $options: 'i' };
  const trainees = await User.find(filter).populate('batchId', 'name status').sort('-createdAt');
  return res.json({ success: true, trainees: trainees.map(t => t.toPublic()) });
});

// GET /api/hr/trainees/:id
router.get('/trainees/:id', async (req, res) => {
  const trainee = await User.findOne({ _id: req.params.id, role: 'trainee' }).populate('batchId', 'name');
  if (!trainee) return res.status(404).json({ success: false, message: 'Trainee not found' });
  return res.json({ success: true, data: trainee.toPublic() });
});

// PATCH /api/hr/trainees/:id/placement
//   Body: { placementStatus?, placementNote?, companyName?, ctc? }
router.patch('/trainees/:id/placement', async (req, res) => {
  const { placementStatus, placementNote, companyName, ctc } = req.body;
  const update = { placementUpdatedAt: new Date() };
  if (placementStatus) update.placementStatus = placementStatus;
  if (placementNote)   update.placementNote   = placementNote;
  if (companyName)     update.companyName     = companyName;
  if (ctc)             update.ctc             = ctc;
  const trainee = await User.findOneAndUpdate({ _id: req.params.id, role: 'trainee' }, update, { new: true });
  if (!trainee) return res.status(404).json({ success: false, message: 'Trainee not found' });
  return res.json({ success: true, trainee: trainee.toPublic() });
});

// POST /api/hr/evaluations
//   Body: { traineeId, communication, technical, problemSolving, attitude, learningAgility, operationalReadiness, confidence?, overallScore, recommendation?, evaluationNotes? }
router.post('/evaluations', async (req, res) => {
  const { traineeId, communication, technical, problemSolving, attitude, learningAgility, operationalReadiness, confidence, overallScore, recommendation, evaluationNotes } = req.body;
  if (!traineeId) return res.status(400).json({ success: false, message: 'traineeId required' });
  
  const evaluationData = {
    communication,
    technical,
    problemSolving,
    attitude,
    learningAgility,
    operationalReadiness,
    confidence,
    overallScore,
    recommendation,
    evaluationNotes,
    evaluatedBy: req.user._id,
    evaluatedAt: new Date()
  };
  
  const trainee = await User.findByIdAndUpdate(
    traineeId,
    { hrEvaluation: evaluationData },
    { new: true }
  );
  
  if (!trainee) return res.status(404).json({ success: false, message: 'Trainee not found' });
  return res.status(201).json({ success: true, evaluation: trainee.hrEvaluation });
});

// GET /api/hr/interviews?traineeId=&status=&company=&from=&to=
router.get('/interviews', async (req, res) => {
  const { traineeId, status, company, from, to } = req.query;
  const filter = {};
  if (traineeId) filter.trainee = traineeId;
  if (status)    filter.status  = status;
  if (company)   filter.company = company;
  if (from || to) { filter.scheduledAt = {}; if (from) filter.scheduledAt.$gte = new Date(from); if (to) filter.scheduledAt.$lte = new Date(to); }
  const interviews = await Interview.find(filter)
    .populate('trainee', 'name email').populate('company', 'name').populate('job', 'title').populate('scheduledBy', 'name').sort('-scheduledAt');
  return res.json({ success: true, interviews });
});

// GET /api/hr/interviews/:id
router.get('/interviews/:id', async (req, res) => {
  const interview = await Interview.findById(req.params.id).populate('trainee', 'name email batchId').populate('scheduledBy', 'name');
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
  return res.json({ success: true, interview });
});

// POST /api/hr/interviews (validated: no past, end>start, conflict check, company/job link)
//   Body: { traineeId, scheduledAt, endAt?, company?, job?, role?, round?, mode?, ... }
router.post('/interviews', async (req, res) => {
  const { traineeId, scheduledAt, endAt, company, job } = req.body;
  if (!traineeId || !scheduledAt)
    return res.status(400).json({ success: false, message: 'traineeId and scheduledAt required' });
  const start = new Date(scheduledAt);
  if (Number.isNaN(start.getTime())) return res.status(400).json({ success: false, message: 'Invalid scheduledAt' });
  if (start < new Date(Date.now() - 60 * 1000)) return res.status(400).json({ success: false, message: 'Cannot schedule in the past' });
  if (endAt) { const e = new Date(endAt); if (Number.isNaN(e.getTime()) || e <= start) return res.status(400).json({ success: false, message: 'endAt must be after scheduledAt' }); }
  const cand = await User.findOne({ _id: traineeId, role: 'trainee' });
  if (!cand) return res.status(404).json({ success: false, message: 'Candidate not found' });
  if (company) { const c = await Company.findById(company).catch(() => null); if (!c) return res.status(404).json({ success: false, message: 'Company not found' }); }
  if (job) { const j = await JobOpening.findById(job).catch(() => null); if (!j) return res.status(404).json({ success: false, message: 'Job not found' }); }
  const win = 60 * 60 * 1000;
  const clash = await Interview.findOne({ trainee: traineeId, status: { $in: ['scheduled', 'confirmed', 'rescheduled'] }, scheduledAt: { $gte: new Date(start.getTime() - win), $lte: new Date(start.getTime() + win) } });
  if (clash) return res.status(409).json({ success: false, message: 'Candidate already has an interview near this time' });
  const interview = await Interview.create({ trainee: traineeId, type: req.body.type || 'placement', ...req.body, company: company || undefined, job: job || undefined, scheduledBy: req.user._id });
  await User.findByIdAndUpdate(traineeId, { placementStatus: 'interview_scheduled', placementUpdatedAt: new Date() });
  try {
    const hrs = await User.find({ role: { $in: ['hr', 'admin'] }, isActive: true }).select('_id role').lean();
    const { notifyUsers } = require('../utils/notificationService');
    await notifyUsers(hrs.map((h, i) => ({ userId: h._id, role: h.role, module: 'HR', kind: 'interview_scheduled', type: 'interview_scheduled', title: 'Interview scheduled: ' + (cand.name || ''), message: new Date(start).toLocaleString('en-IN'), dedupeKey: `hr:iv:${interview._id}:${h._id}:${i}`, link: '/hr/interviews', meta: { interviewId: interview._id } })));
  } catch (_) {}
  return res.status(201).json({ success: true, interview });
});

// PUT /api/hr/interviews/:id — status transitions (scheduled/confirmed/in_progress/completed/cancelled/rescheduled/no_show)
router.put('/interviews/:id', async (req, res) => {
  const allowed = { scheduled: ['confirmed', 'cancelled', 'rescheduled'], confirmed: ['in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show'], in_progress: ['completed', 'cancelled'], completed: [], cancelled: [], rescheduled: ['confirmed', 'cancelled'], no_show: ['rescheduled'] };
  const interview = await Interview.findById(req.params.id).populate('trainee', 'name email');
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
  if (req.body.status && req.body.status !== interview.status) {
    const from = allowed[interview.status] || [];
    if (!from.includes(req.body.status)) return res.status(400).json({ success: false, message: `Invalid transition ${interview.status} → ${req.body.status}` });
    if (req.body.status === 'completed') { req.body.completedAt = new Date(); await User.findByIdAndUpdate(interview.trainee._id || interview.trainee, { placementStatus: 'interview_done', placementUpdatedAt: new Date() }); }
    if (req.body.status === 'cancelled') await User.findByIdAndUpdate(interview.trainee._id || interview.trainee, { placementUpdatedAt: new Date() });
  }
  Object.assign(interview, req.body);
  try { await interview.save(); } catch (e) { return res.status(400).json({ success: false, message: e.message }); }
  const out = await Interview.findById(interview._id).populate('trainee', 'name email').populate('company', 'name').populate('job', 'title');
  return res.json({ success: true, interview: out });
});

// DELETE /api/hr/interviews/:id
router.delete('/interviews/:id', async (req, res) => {
  const interview = await Interview.findByIdAndDelete(req.params.id);
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
  return res.json({ success: true, message: 'Interview deleted' });
});

// PUT /api/hr/pipeline/:id/stage - Move candidate between pipeline stages
router.put('/pipeline/:id/stage', async (req, res) => {
  const { stage, notes, companyName, ctc, interviewDate } = req.body;
  
  if (!Object.keys(PIPELINE_STAGES).includes(stage)) {
    return res.status(400).json({ success: false, message: 'Invalid pipeline stage' });
  }
  
  const update = {
    placementStatus: stage,
    placementUpdatedAt: new Date()
  };
  
  if (notes) update.placementNote = notes;
  if (companyName) update.companyName = companyName;
  if (ctc) update.ctc = ctc;
  
  const candidate = await User.findByIdAndUpdate(req.params.id, update, { new: true })
    .populate('batchId', 'name');
    
  if (!candidate) {
    return res.status(404).json({ success: false, message: 'Candidate not found' });
  }
  
  // Auto-schedule interview if moved to interview_scheduled
  if (stage === 'interview_scheduled' && interviewDate) {
    await Interview.create({
      trainee: candidate._id,
      type: 'placement',
      scheduledAt: new Date(interviewDate),
      scheduledBy: req.user._id,
      status: 'scheduled'
    });
  }
  
  return res.json({ 
    success: true, 
    candidate: candidate.toPublic(),
    stage: PIPELINE_STAGES[stage]
  });
});

// POST /api/hr/bulk-move - Bulk move candidates between stages
router.post('/bulk-move', async (req, res) => {
  const { candidateIds, targetStage, notes } = req.body;
  
  if (!candidateIds?.length || !Object.keys(PIPELINE_STAGES).includes(targetStage)) {
    return res.status(400).json({ success: false, message: 'Invalid request data' });
  }
  
  const update = {
    placementStatus: targetStage,
    placementUpdatedAt: new Date()
  };
  
  if (notes) update.placementNote = notes;
  
  const result = await User.updateMany(
    { _id: { $in: candidateIds }, role: 'trainee' },
    update
  );
  
  return res.json({ 
    success: true, 
    message: `${result.modifiedCount} candidates moved to ${PIPELINE_STAGES[targetStage]}`,
    modifiedCount: result.modifiedCount
  });
});

// GET /api/hr/pipeline/stats - Pipeline statistics
router.get('/pipeline/stats', async (req, res) => {
  const stats = await User.aggregate([
    { $match: { role: 'trainee', isActive: true } },
    { $group: {
      _id: '$placementStatus',
      count: { $sum: 1 },
      avgScore: { $avg: '$hrEvaluation.overallScore' }
    }},
    { $sort: { '_id': 1 } }
  ]);
  
  const total = stats.reduce((sum, s) => sum + s.count, 0);
  const conversionRate = total > 0 ? 
    ((stats.find(s => s._id === 'placed')?.count || 0) / total * 100).toFixed(1) : 0;
  
  return res.json({ 
    success: true, 
    stats: {
      total,
      conversionRate: `${conversionRate}%`,
      stages: stats.map(s => ({
        stage: s._id,
        name: PIPELINE_STAGES[s._id],
        count: s.count,
        percentage: ((s.count / total) * 100).toFixed(1),
        avgScore: s.avgScore ? s.avgScore.toFixed(1) : null
      }))
    }
  });
});

module.exports = router;
