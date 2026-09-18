// src/routes/lmsAssessmentRoutes.js — part 1: setup + helpers.
// ADDITIVE LMS module/final assessment API. Existing Assignment/session/
// certificate flows are untouched. Module key = Course subject _id string or
// lmsModuleId string ('FINAL' for the course-final assignment).
'use strict';
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Session = require('../models/Session');
const Enrollment = require('../models/Enrollment');
const LmsAssessment = require('../models/LmsAssessment');
const { isLmsCourseCompleted } = require('../utils/lmsCompletion');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const FINAL_KEY = 'FINAL';
const STATUS = ['NOT_ASSIGNED', 'PENDING', 'SUBMITTED', 'COMPLETED'];

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const uploadPractical = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(pdf|doc|docx|txt|png|jpg|jpeg|zip)$/i.test(file.originalname || '');
    if (!ok) {
      const err = new Error('Unsupported file type. Allowed: PDF, DOC, DOCX, TXT, PNG, JPG, JPEG, ZIP.');
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  },
});

// Module keys advertised by a course: subject _id + lmsModuleId (dedupe, keep order).
async function moduleKeysForCourse(courseId) {
  const course = await Course.findById(courseId).select('name code trimesters').lean();
  if (!course) return { course: null, keys: [] };
  const keys = [];
  const seen = new Set();
  const push = (key, name) => {
    const k = String(key || '').trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    keys.push({ key: k, name: String(name || k) });
  };
  (course.trimesters || []).forEach((t) => {
    (t.months || []).forEach((m) => {
      (m.subjects || []).forEach((s) => {
        if (s && s._id) push(s._id, s.name);
        if (s && s.lmsModuleId) push(s.lmsModuleId, s.name);
      });
    });
  });
  return { course, keys };
}

async function validKeyForCourse(courseId, moduleKey) {
  if (String(moduleKey) === FINAL_KEY) return true;
  const data = await moduleKeysForCourse(courseId);
  return data.keys.some((k) => k.key === String(moduleKey));
}

// Trainer must own the course context: created an LMS session for it, or be the
// trainer of a batch linked to an enrollment in this course, or already owns an
// assessment doc for it.
async function trainerOwnsCourse(trainerId, courseId) {
  const course = await Course.findById(courseId).select('code').lean();
  const codes = course && course.code ? [String(course.code)] : [];
  const sess = await Session.exists({
    trainerId,
    $or: [{ moduleId: { $in: codes } }, { lmsModuleId: { $ne: '' } }],
  });
  if (sess) return true;
  const batches = await Batch.find({ trainerId }).select('_id').lean();
  if (batches.length) {
    const enr = await Enrollment.exists({ course: courseId, batch: { $in: batches.map((b) => b._id) } });
    if (enr) return true;
  }
  return Boolean(await LmsAssessment.exists({ courseId, createdBy: trainerId }));
}

async function traineeEnrolled(traineeId, courseId) {
  const course = await Course.findById(courseId).select('code').lean();
  if (!course) return false;
  if (await Enrollment.exists({ student: traineeId, course: courseId })) return true;
  const User = require('../models/User');
  const u = await User.findById(traineeId).select('batchIds').lean();
  if (!u || !(u.batchIds || []).length) return false;
  const batches = await Batch.find({ _id: { $in: u.batchIds } }).select('course').lean();
  return batches.some((b) => String(b.course || '') === String(course.code || course._id));
}

// ── Trainer: course module catalogue (course subjects as module keys) ──
router.get('/trainer/courses/:courseId/modules', authorize('trainer'), async (req, res) => {
  if (!isId(req.params.courseId)) return res.status(400).json({ success: false, message: 'Invalid course ID' });
  const data = await moduleKeysForCourse(req.params.courseId);
  if (!data.course) return res.status(404).json({ success: false, message: 'Course not found' });
  const assessments = await LmsAssessment.find({ courseId: req.params.courseId }).select('moduleKey scope').lean();
  const has = {};
  assessments.forEach((a) => { has[`${a.scope}:${a.moduleKey}`] = true; });
  return res.json({
    success: true,
    course: { _id: data.course._id, name: data.course.name, code: data.course.code },
    modules: data.keys.map((k) => ({ ...k, hasAssessment: Boolean(has[`module:${k.key}`]) })),
    hasFinal: Boolean(has[`final:${FINAL_KEY}`]),
  });
});

// ── Trainer: list own assessments (optional courseId filter) ──
router.get('/trainer', authorize('trainer'), async (req, res) => {
  const filter = { createdBy: req.user._id };
  if (req.query.courseId) {
    if (!isId(req.query.courseId)) return res.status(400).json({ success: false, message: 'Invalid course ID' });
    filter.courseId = req.query.courseId;
  }
  const list = await LmsAssessment.find(filter)
    .populate('courseId', 'name code')
    .populate('submissions.trainee', 'name email')
    .sort({ createdAt: -1 }).lean();
  return res.json({ success: true, assessments: list });
});

// Validate one question. Returns a clean stored object or an error string.
function cleanQuestion(q, i) {
  const n = i + 1;
  const type = q?.type === 'practical' ? 'practical' : 'mcq';
  const score = Number(q?.score ?? q?.marks);
  if (!(score > 0)) return { error: `Q${n}: marks must be a positive number` };
  if (type === 'mcq') {
    const text = String(q?.question || q?.text || '').trim();
    const opts = Array.isArray(q?.options) ? q.options.map((o) => String(o ?? '').trim()).filter(Boolean) : [];
    const ci = Number(q?.correctAnswer ?? q?.correct);
    if (!text) return { error: `Q${n}: question text is required` };
    if (opts.length < 2) return { error: `Q${n}: at least 2 options are required` };
    if (!Number.isInteger(ci) || ci < 0 || ci >= opts.length) return { error: `Q${n}: valid correct answer is required` };
    return { doc: { type: 'mcq', question: text, options: opts, correctAnswer: ci, score } };
  }
  const task = String(q?.task || q?.question || q?.text || '').trim();
  if (!task) return { error: `Q${n}: practical task is required` };
  return { doc: { type: 'practical', task, instructions: String(q?.instructions || '').trim(), score } };
}

function legacyToQuestions(doc) {
  const out = [];
  if (doc?.theory?.question) {
    out.push({
      _id: new mongoose.Types.ObjectId(),
      type: 'mcq',
      question: doc.theory.question,
      options: doc.theory.options || [],
      correctAnswer: Number(doc.theory.correctAnswer ?? 0),
      score: Number(doc.theory.score || 0),
    });
  }
  if (doc?.practical?.task) {
    out.push({
      _id: new mongoose.Types.ObjectId(),
      type: 'practical',
      task: doc.practical.task,
      instructions: doc.practical.instructions || '',
      score: Number(doc.practical.score || 0),
    });
  }
  return out;
}

// Ensure every question has an _id and every submission answer row exists.
function ensureQIds(doc) {
  let touched = false;
  (doc.questions || []).forEach((q) => {
    if (!q._id) { q._id = new mongoose.Types.ObjectId(); touched = true; }
  });
  return touched;
}

function maxTotals(doc) {
  const qs = (doc.questions?.length ? doc.questions : legacyToQuestions(doc));
  let theory = 0;
  let practical = 0;
  qs.forEach((q) => {
    if (q.type === 'practical') practical += Number(q.score || 0);
    else theory += Number(q.score || 0);
  });
  return { theory, practical, total: theory + practical, qs };
}

function recompute(sub, doc) {
  const qs = (doc.questions?.length ? doc.questions : legacyToQuestions(doc));
  const byId = {};
  (sub.answers || []).forEach((a) => { byId[String(a.questionId)] = a; });
  let theory = 0;
  let practical = 0;
  qs.forEach((q) => {
    const a = byId[String(q._id)];
    if (!a) return;
    if (q.type === 'practical') practical += Number(a.practicalScore || 0);
    else theory += Number(a.score || 0);
  });
  sub.theoryScore = theory;
  sub.practicalScore = practical;
  sub.moduleTotal = theory + practical;
}

// ── Trainer: create/replace module or final assessment (multiple questions) ──
router.post('/', authorize('trainer'), async (req, res) => {
  const body = req.body || {};
  const courseId = body.courseId;
  if (!isId(courseId)) return res.status(400).json({ success: false, message: 'Valid courseId is required' });
  const sc = body.scope === 'final' ? 'final' : 'module';
  const key = sc === 'final' ? FINAL_KEY : String(body.moduleKey || '').trim();
  if (!key) return res.status(400).json({ success: false, message: 'moduleKey is required' });
  if (!(await validKeyForCourse(courseId, key))) {
    return res.status(400).json({ success: false, message: 'Unknown module for this course' });
  }
  if (!(await trainerOwnsCourse(req.user._id, courseId))) {
    return res.status(403).json({ success: false, message: 'Not authorized for this course' });
  }
  // Accept the new questions[] array; fall back to the legacy single theory+practical pair.
  let incoming = Array.isArray(body.questions) ? body.questions : null;
  if (!incoming && (body.theory || body.practical)) {
    incoming = [];
    if (body.theory?.question) {
      incoming.push({
        type: 'mcq', question: body.theory.question, options: body.theory.options,
        correctAnswer: body.theory.correctAnswer, score: body.theory.score,
      });
    }
    if (body.practical?.task) {
      incoming.push({
        type: 'practical', task: body.practical.task,
        instructions: body.practical.instructions, score: body.practical.score,
      });
    }
  }
  if (!incoming || !incoming.length) return res.status(400).json({ success: false, message: 'At least one question is required' });
  if (incoming.length > 100) return res.status(400).json({ success: false, message: 'Too many questions (max 100)' });
  const cleaned = [];
  for (let i = 0; i < incoming.length; i += 1) {
    const r = cleanQuestion(incoming[i], i);
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    cleaned.push({ ...r.doc, _id: new mongoose.Types.ObjectId() });
  }
  const doc = await LmsAssessment.findOneAndUpdate(
    { courseId, moduleKey: key, scope: sc },
    {
      $set: {
        moduleName: String(body.moduleName || '').trim(),
        createdBy: req.user._id,
        ...(body.batchId && isId(body.batchId) ? { batchId: body.batchId } : {}),
        questions: cleaned,
      },
    },
    { new: true, upsert: true, runValidators: true },
  );
  try {
    const notify = require('../utils/notificationService');
    const User = require('../models/User');
    const bIds = doc.batchId ? [doc.batchId]
      : (await Batch.find({ trainerId: req.user._id }).select('_id').lean()).map((b) => b._id);
    const trainees = bIds.length
      ? await User.find({ role: 'trainee', isActive: true, batchIds: { $in: bIds } }).select('_id').lean()
      : [];
    await notify.notifyUsers(trainees.map((t) => ({
      userId: t._id, role: 'trainee', module: 'LMS',
      kind: sc === 'final' ? 'lms_final_assignment' : 'lms_module_assessment',
      title: sc === 'final' ? 'Final Course Assignment Available' : 'New Module Assessment Available',
      message: sc === 'final' ? 'Your final course assignment is now available.'
        : `A new assessment is available for module ${doc.moduleName || key}.`,
      dedupeKey: `lms:assessment:${notify.idOf(courseId)}:${key}:${notify.idOf(doc._id)}`,
      link: '/trainee/assignments',
      meta: { courseId: notify.idOf(courseId), moduleKey: key, assessmentId: notify.idOf(doc._id) },
    })));
  } catch (_) {}
  return res.status(201).json({ success: true, assessment: doc });
});

// ── Trainer: submissions for one assessment (own docs only) ──
router.get('/:id/submissions', authorize('trainer'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
  const doc = await LmsAssessment.findOne({ _id: req.params.id, createdBy: req.user._id })
    .populate('courseId', 'name code')
    .populate('submissions.trainee', 'name email').lean();
  if (!doc) return res.status(404).json({ success: false, message: 'Assessment not found' });
  return res.json({ success: true, assessment: doc });
});

// ── Trainer: review practical question (score + optional complete; never auto-complete) ──
router.put('/:id/review', authorize('trainer'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
  const body = req.body || {};
  const doc = await LmsAssessment.findOne({ _id: req.params.id, createdBy: req.user._id });
  if (!doc) return res.status(404).json({ success: false, message: 'Assessment not found' });
  if (ensureQIds(doc)) await doc.save();
  // Accept per-question review: { questionId, traineeId, practicalScore?, complete? }
  // or legacy { traineeId, practicalScore?, complete? } (first practical question).
  let q = null;
  if (body.questionId) {
    q = (doc.questions || []).find((x) => String(x._id) === String(body.questionId));
    if (!q) return res.status(404).json({ success: false, message: 'Question not found' });
    if (q.type !== 'practical') return res.status(400).json({ success: false, message: 'Only practical questions are reviewed here' });
  } else {
    q = (doc.questions?.length ? doc.questions : legacyToQuestions(doc)).find((x) => x.type === 'practical');
  }
  if (!q) return res.status(404).json({ success: false, message: 'No practical question found' });
  if (!isId(body.traineeId)) return res.status(400).json({ success: false, message: 'Valid traineeId required' });
  const sub = doc.submissions.find((s) => String(s.trainee) === String(body.traineeId));
  if (!sub) return res.status(404).json({ success: false, message: 'No submission from this trainee' });
  let ans = (sub.answers || []).find((a) => String(a.questionId) === String(q._id));
  if (!ans) return res.status(404).json({ success: false, message: 'Trainee has not submitted this question' });
  if (!ans.practicalAnswer && !ans.practicalFileUrl) {
    return res.status(400).json({ success: false, message: 'Nothing submitted for this question yet' });
  }
  if (body.practicalScore !== undefined) {
    const ps = Number(body.practicalScore);
    if (!(ps >= 0) || ps > Number(q.score || 0)) {
      return res.status(400).json({ success: false, message: `Score must be 0-${Number(q.score || 0)}` });
    }
    ans.practicalScore = ps;
    ans.practicalReviewed = true;
    ans.practicalReviewedBy = req.user._id;
    ans.practicalReviewedAt = new Date();
  }
  recompute(sub, doc);
  sub.submittedAt = sub.submittedAt || new Date();
  if (body.complete) {
    // Every MCQ answered + every submitted practical reviewed before COMPLETED.
    const t = maxTotals(doc);
    const mcqs = t.qs.filter((x) => x.type !== 'practical');
    const pracs = t.qs.filter((x) => x.type === 'practical');
    const byId = {};
    (sub.answers || []).forEach((a) => { byId[String(a.questionId)] = a; });
    const mcqDone = mcqs.every((x) => byId[String(x._id)] && byId[String(x._id)].selected != null);
    if (!mcqDone && mcqs.length) return res.status(400).json({ success: false, message: 'All theory questions must be answered first' });
    const submittedPracs = pracs.filter((x) => {
      const a = byId[String(x._id)];
      return a && (a.practicalAnswer || a.practicalFileUrl);
    });
    const reviewed = submittedPracs.every((x) => byId[String(x._id)].practicalReviewed);
    if (!reviewed && submittedPracs.length) return res.status(400).json({ success: false, message: 'Review all submitted practicals first' });
    sub.status = 'COMPLETED';
    sub.completedAt = new Date();
  } else if ((!sub.status || sub.status === 'PENDING')) {
    sub.status = 'SUBMITTED';
  }
  await doc.save();
  return res.json({ success: true, submission: sub });
});

// ── Trainee: my assessments for an enrolled course ──
// Final scope hidden until isLmsCourseCompleted; correct answers hidden pre-submit.
router.get('/my', authorize('trainee'), async (req, res) => {
  if (!isId(req.query.courseId)) return res.status(400).json({ success: false, message: 'Valid courseId required' });
  if (!(await traineeEnrolled(req.user._id, req.query.courseId))) {
    return res.status(403).json({ success: false, message: 'Not enrolled in this course' });
  }
  const completion = await isLmsCourseCompleted(req.user._id, req.query.courseId);
  const docs = await LmsAssessment.find({ courseId: req.query.courseId }).sort({ createdAt: 1 }).lean();
  const out = docs
    .filter((d) => (d.scope === 'final' ? completion.completed : true))
    .map((d) => {
      const t = maxTotals(d);
      const mine = (d.submissions || []).find((s) => String(s.trainee) === String(req.user._id)) || null;
      const byId = {};
      (mine?.answers || []).forEach((a) => { byId[String(a.questionId)] = a; });
      const questions = t.qs.map((q) => {
        const a = byId[String(q._id)];
        const base = {
          _id: q._id, type: q.type, score: q.score,
          myScore: a ? Number(a.score || a.practicalScore || 0) : 0,
          myStatus: !a ? 'PENDING' : (q.type === 'practical'
            ? (a.practicalReviewed ? 'COMPLETED' : 'SUBMITTED') : 'COMPLETED'),
        };
        if (q.type === 'practical') {
          return { ...base, task: q.task, instructions: q.instructions, myFileName: a?.practicalFileName || '' };
        }
        // MCQ: withhold correctAnswer until THIS trainee answers THIS question.
        return a && a.selected != null
          ? { ...base, question: q.question, options: q.options, selected: a.selected, correct: a.correct }
          : { ...base, question: q.question, options: q.options };
      });
      return {
        _id: d._id, courseId: d.courseId, moduleKey: d.moduleKey, moduleName: d.moduleName, scope: d.scope,
        questions,
        myStatus: mine?.status || 'PENDING',
        theoryScore: mine?.theoryScore || 0, practicalScore: mine?.practicalScore || 0,
        moduleTotal: mine?.moduleTotal || 0,
        maxTheory: t.theory, maxPractical: t.practical, maxTotal: t.total,
      };
    });
  return res.json({ success: true, courseCompleted: completion.completed, assessments: out });
});

// ── Trainee: answer one theory MCQ (auto-graded, per-question) ──
router.post('/:id/theory', authorize('trainee'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
  const doc = await LmsAssessment.findById(req.params.id);
  if (!doc) return res.status(404).json({ success: false, message: 'Assessment not found' });
  if (!(await traineeEnrolled(req.user._id, doc.courseId))) {
    return res.status(403).json({ success: false, message: 'Not enrolled in this course' });
  }
  if (doc.scope === 'final' && !(await isLmsCourseCompleted(req.user._id, doc.courseId)).completed) {
    return res.status(403).json({ success: false, message: 'Final unlocks after full course completion' });
  }
  if (ensureQIds(doc)) await doc.save();
  const qs = (doc.questions?.length ? doc.questions : legacyToQuestions(doc));
  // Accept { questionId, selected } or legacy { selected } (single-MCQ docs).
  let q = req.body?.questionId
    ? qs.find((x) => String(x._id) === String(req.body.questionId))
    : qs.find((x) => x.type !== 'practical');
  if (!q) return res.status(404).json({ success: false, message: 'Question not found' });
  if (q.type !== 'mcq') return res.status(400).json({ success: false, message: 'Use the practical endpoint for this question' });
  const sel = Number(req.body?.selected);
  if (!Number.isInteger(sel) || sel < 0 || sel >= (q.options || []).length) {
    return res.status(400).json({ success: false, message: 'Valid answer option required' });
  }
  let sub = doc.submissions.find((s) => String(s.trainee) === String(req.user._id));
  if (!sub) { doc.submissions.push({ trainee: req.user._id, answers: [] }); sub = doc.submissions[doc.submissions.length - 1]; }
  if (!Array.isArray(sub.answers)) sub.answers = [];
  let ans = sub.answers.find((a) => String(a.questionId) === String(q._id));
  if (!ans) { sub.answers.push({ questionId: q._id }); ans = sub.answers[sub.answers.length - 1]; }
  const correct = sel === Number(q.correctAnswer);
  ans.selected = sel;
  ans.correct = correct;
  ans.score = correct ? Number(q.score || 0) : 0;
  recompute(sub, doc);
  sub.submittedAt = new Date();
  if (!sub.status || sub.status === 'PENDING') sub.status = 'SUBMITTED';
  await doc.save();
  const t = maxTotals(doc);
  return res.json({ success: true, correct, score: ans.score, theoryScore: sub.theoryScore, moduleTotal: sub.moduleTotal, maxTheory: t.theory, maxTotal: t.total, status: sub.status });
});

// ── Trainee: submit one practical question (text and/or file; SUBMITTED, never auto-complete) ──
router.post('/:id/practical', authorize('trainee'), uploadPractical.single('file'), async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ID' });
  const doc = await LmsAssessment.findById(req.params.id);
  if (!doc) return res.status(404).json({ success: false, message: 'Assessment not found' });
  if (!(await traineeEnrolled(req.user._id, doc.courseId))) {
    return res.status(403).json({ success: false, message: 'Not enrolled in this course' });
  }
  if (doc.scope === 'final' && !(await isLmsCourseCompleted(req.user._id, doc.courseId)).completed) {
    return res.status(403).json({ success: false, message: 'Final unlocks after full course completion' });
  }
  if (ensureQIds(doc)) await doc.save();
  const qs = (doc.questions?.length ? doc.questions : legacyToQuestions(doc));
  // Accept { questionId, answer } or legacy { answer } (single-practical docs).
  let q = req.body?.questionId
    ? qs.find((x) => String(x._id) === String(req.body.questionId))
    : qs.find((x) => x.type === 'practical');
  if (!q) return res.status(404).json({ success: false, message: 'Question not found' });
  if (q.type !== 'practical') return res.status(400).json({ success: false, message: 'Use the theory endpoint for this question' });
  const answer = String(req.body?.answer || '').trim();
  if (!answer && !req.file) return res.status(400).json({ success: false, message: 'Answer text or file required' });
  let sub = doc.submissions.find((s) => String(s.trainee) === String(req.user._id));
  if (!sub) { doc.submissions.push({ trainee: req.user._id, answers: [] }); sub = doc.submissions[doc.submissions.length - 1]; }
  if (!Array.isArray(sub.answers)) sub.answers = [];
  let ans = sub.answers.find((a) => String(a.questionId) === String(q._id));
  if (!ans) { sub.answers.push({ questionId: q._id }); ans = sub.answers[sub.answers.length - 1]; }
  if (answer) ans.practicalAnswer = answer;
  if (req.file) { ans.practicalFileUrl = `/uploads/${req.file.filename}`; ans.practicalFileName = req.file.originalname; }
  sub.submittedAt = new Date();
  if (!sub.status || sub.status === 'PENDING') sub.status = 'SUBMITTED';
  recompute(sub, doc);
  await doc.save();
  try {
    const notify = require('../utils/notificationService');
    await notify.notifyUsers([{
      userId: doc.createdBy, role: 'trainer', module: 'LMS', kind: 'lms_practical_submitted',
      title: 'Practical Submitted',
      message: `A trainee submitted a practical for ${doc.moduleName || doc.moduleKey}.`,
      dedupeKey: `lms:practical:${notify.idOf(doc._id)}:${String(q._id)}:${notify.idOf(req.user._id)}:${Date.now()}`,
      link: '/trainer/assignments',
      meta: { assessmentId: notify.idOf(doc._id), courseId: notify.idOf(doc.courseId) },
    }]);
  } catch (_) {}
  return res.json({ success: true, status: sub.status, moduleTotal: sub.moduleTotal });
});

// ── Admin: read-only monitor for a course (no writes on this router) ──
router.get('/admin', authorize('admin'), async (req, res) => {
  if (!isId(req.query.courseId)) return res.status(400).json({ success: false, message: 'Valid courseId required' });
  const docs = await LmsAssessment.find({ courseId: req.query.courseId })
    .populate('courseId', 'name code')
    .populate('createdBy', 'name email')
    .populate('submissions.trainee', 'name email')
    .sort({ createdAt: 1 }).lean();
  const data = await moduleKeysForCourse(req.query.courseId);
  const nameOf = {};
  data.keys.forEach((k) => { nameOf[k.key] = k.name; });
  const rows = [];
  docs.forEach((d) => {
    const t = maxTotals(d);
    const mcqCount = t.qs.filter((q) => q.type !== 'practical').length;
    const pracCount = t.qs.filter((q) => q.type === 'practical').length;
    const base = {
      course: d.courseId, moduleKey: d.moduleKey,
      moduleName: d.moduleName || nameOf[d.moduleKey] || d.moduleKey,
      scope: d.scope, trainer: d.createdBy,
      questionCount: t.qs.length, mcqCount, pracCount,
      maxTheory: t.theory, maxPractical: t.practical, maxTotal: t.total,
    };
    if (!d.submissions || !d.submissions.length) {
      rows.push({ ...base, trainee: null, theory: 'Not Assigned', practical: 'Not Assigned', overall: 'Not Assigned', theoryScore: 0, practicalScore: 0, moduleTotal: 0 });
      return;
    }
    d.submissions.forEach((s) => {
      const byId = {};
      (s.answers || []).forEach((a) => { byId[String(a.questionId)] = a; });
      const mcqAnswered = t.qs.filter((q) => q.type !== 'practical' && byId[String(q._id)] && byId[String(q._id)].selected != null).length;
      const pracSubmitted = t.qs.filter((q) => {
        const a = byId[String(q._id)];
        return q.type === 'practical' && a && (a.practicalAnswer || a.practicalFileUrl);
      }).length;
      rows.push({
        ...base,
        trainee: s.trainee,
        theory: mcqCount === 0 ? '—' : (`${mcqAnswered}/${mcqCount} answered`),
        practical: pracCount === 0 ? '—' : (s.status === 'COMPLETED' ? 'Completed' : (`${pracSubmitted}/${pracCount} submitted`)),
        overall: s.status || 'Pending',
        theoryScore: s.theoryScore || 0,
        practicalScore: s.practicalScore || 0,
        moduleTotal: s.moduleTotal || 0,
      });
    });
  });
  return res.json({ success: true, rows });
});

module.exports = router;

