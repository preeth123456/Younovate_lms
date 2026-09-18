// src/routes/courseRoutes.js   (backend — Express router)
// Full CRUD for Courses + granular CRUD for the nested curriculum.
// Response shapes exactly match what src/features/admin/courseSlice.js expects:
//
//   GET    /api/courses              → { success, data: { courses, meta } }
//   GET    /api/courses/:id          → { success, data: { course, batches } }
//   POST   /api/courses              → { success, data: course }
//   PUT    /api/courses/:id          → { success, data: course }
//   DELETE /api/courses/:id          → { success, message }
//
// Curriculum CRUD (edit the tree without resending the whole course):
//   POST   /api/courses/:id/trimesters
//   PUT    /api/courses/:id/trimesters/:triId
//   DELETE /api/courses/:id/trimesters/:triId
//   POST   /api/courses/:id/trimesters/:triId/months
//   PUT    /api/courses/:id/trimesters/:triId/months/:monthId
//   DELETE /api/courses/:id/trimesters/:triId/months/:monthId
//   POST   /api/courses/:id/trimesters/:triId/months/:monthId/subjects
//   PUT    /api/courses/:id/trimesters/:triId/months/:monthId/subjects/:subId
//   DELETE /api/courses/:id/trimesters/:triId/months/:monthId/subjects/:subId
//
// Mount in your app:
//   app.use('/api/courses', require('./routes/courseRoutes'));

const express = require('express');
const mongoose = require('mongoose');
const Course = require('../models/Course');

const router = express.Router();

// ── Auth (optional). Wire your real middleware if present; otherwise pass-through
//    so the file loads/runs without crashing. The frontend sends a Bearer token.
let protect   = (req, res, next) => next();
let adminOnly = (req, res, next) => next();
try {
  const mw = require('../middleware/authMiddleware');
  if (typeof mw.protect === 'function')   protect   = mw.protect;
  if (typeof mw.adminOnly === 'function') adminOnly = mw.adminOnly;
} catch (_) { /* no auth middleware found — routes stay open; secure before prod */ }

// ── Helpers ───────────────────────────────────────────────────────────────────
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const COURSE_FIELDS = ['name', 'code', 'description', 'duration', 'durationUnit', 'level', 'status', 'tags', 'trimesters'];
const TRI_FIELDS    = ['trimesterNumber', 'code', 'title', 'focus', 'months'];
const MONTH_FIELDS  = ['monthNumber', 'code', 'name', 'subjects'];
const SUBJ_FIELDS   = ['name', 'category', 'status', 'hours'];

const pick = (obj = {}, fields) =>
  fields.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k]; return o; }, {});

// Load course by :id (responds 400/404 itself and returns null on failure).
const loadCourse = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ success: false, message: 'Invalid course id' });
    return null;
  }
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404).json({ success: false, message: 'Course not found' });
    return null;
  }
  return course;
};

// Resolve nested subdocs, responding 404 when a level is missing.
const getTrimester = (course, res, triId) => {
  const t = course.trimesters.id(triId);
  if (!t) { res.status(404).json({ success: false, message: 'Trimester not found' }); return null; }
  return t;
};
const getMonth = (tri, res, monthId) => {
  const m = tri.months.id(monthId);
  if (!m) { res.status(404).json({ success: false, message: 'Month not found' }); return null; }
  return m;
};
const getSubject = (month, res, subId) => {
  const s = month.subjects.id(subId);
  if (!s) { res.status(404).json({ success: false, message: 'Subject not found' }); return null; }
  return s;
};

// Find batches that reference this course (defensive — supports a few field names).
const findBatches = async (course) => {
  try {
    const Batch = mongoose.model('Batch');
    return await Batch.find({
      $or: [{ course: course._id }, { courseId: course._id }, { courseCode: course.code }],
    })
      .select('name code status startDate')
      .lean();
  } catch (_) {
    return []; // Batch model not registered — fine.
  }
};

const ok    = (res, data, code = 200) => res.status(code).json({ success: true, data });
const saved = (res, course, code = 200) => ok(res, course.toJSON(), code);

// ════════════════════════════════════════════════════════════════════════════
// COURSE CRUD
// ════════════════════════════════════════════════════════════════════════════

// LIST
router.get('/', protect, asyncH(async (req, res) => {
  const { status, level, search, page = 1, limit = 0 } = req.query;
  const q = {};
  if (status) q.status = status;
  if (level)  q.level = level;
  if (search) {
    const rx = new RegExp(String(search).trim(), 'i');
    q.$or = [{ name: rx }, { code: rx }, { tags: rx }];
  }

  const lim = Math.max(0, Number(limit) || 0);
  const pg  = Math.max(1, Number(page) || 1);

  const cursor = Course.find(q).sort({ createdAt: -1 });
  if (lim > 0) cursor.skip((pg - 1) * lim).limit(lim);

  const [docs, total] = await Promise.all([cursor.exec(), Course.countDocuments(q)]);
  const courses = docs.map((d) => d.toJSON()); // include virtuals (stats, hours.total)

  ok(res, {
    courses,
    meta: { total, page: pg, limit: lim, pages: lim > 0 ? Math.ceil(total / lim) : 1 },
  });
}));

// DETAIL  → { course, batches }
router.get('/:id', protect, asyncH(async (req, res) => {
  const course = await loadCourse(req, res);
  if (!course) return;
  const batches = await findBatches(course);
  ok(res, { course: course.toJSON(), batches });
}));

// CREATE
router.post('/', protect, adminOnly, asyncH(async (req, res) => {
  const body = pick(req.body, COURSE_FIELDS);
  if (body.code) body.code = String(body.code).toUpperCase().trim();
  try {
    const course = await Course.create(body);
    // Admin monitoring inbox (best-effort).
    try {
      const { notifyAdmins, idOf } = require('../utils/notificationService');
      const User = require('../models/User');
      await notifyAdmins({
        User, module: 'LMS', kind: 'lms_course_created',
        title: 'New LMS Course Created',
        message: `Course "${course.name}" (${course.code}) has been created.`,
        dedupeKey: `lms:course:${idOf(course._id)}:created`,
        link: '/admin/courses',
        meta: { courseId: idOf(course._id), courseName: course.name, entityType: 'course' },
      });
    } catch (_) {}
    saved(res, course, 201);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: `Course code "${body.code}" already exists` });
    }
    throw err;
  }
}));

// UPDATE (top-level fields; only sends what you pass, so the curriculum is safe
// when the edit form omits `trimesters`)
router.put('/:id', protect, adminOnly, asyncH(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid course id' });
  }
  const body = pick(req.body, COURSE_FIELDS);
  console.log(body)
  if (body.code) body.code = String(body.code).toUpperCase().trim();
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    saved(res, course);
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Course code already exists' });
    }
    throw err;
  }
}));

// DELETE (blocked when batches still reference the course)
router.delete('/:id', protect, adminOnly, asyncH(async (req, res) => {
  const course = await loadCourse(req, res);
  if (!course) return;
  const batches = await findBatches(course);
  if (batches.length) {
    return res.status(409).json({
      success: false,
      message: `Cannot delete: ${batches.length} batch(es) still use this course`,
    });
  }
  await course.deleteOne();
  res.json({ success: true, message: 'Course deleted' });
}));

// ════════════════════════════════════════════════════════════════════════════
// CURRICULUM CRUD — TRIMESTERS
// ════════════════════════════════════════════════════════════════════════════

router.post('/:id/trimesters', protect, adminOnly, asyncH(async (req, res) => {
  const course = await loadCourse(req, res); if (!course) return;
  course.trimesters.push(pick(req.body, TRI_FIELDS));
  await course.save();
  saved(res, course, 201);
}));

router.put('/:id/trimesters/:triId', protect, adminOnly, asyncH(async (req, res) => {
  const course = await loadCourse(req, res); if (!course) return;
  const tri = getTrimester(course, res, req.params.triId); if (!tri) return;
  Object.assign(tri, pick(req.body, TRI_FIELDS));
  await course.save();
  saved(res, course);
}));

router.delete('/:id/trimesters/:triId', protect, adminOnly, asyncH(async (req, res) => {
  const course = await loadCourse(req, res); if (!course) return;
  if (!course.trimesters.id(req.params.triId)) {
    return res.status(404).json({ success: false, message: 'Trimester not found' });
  }
  course.trimesters.pull(req.params.triId);
  await course.save();
  saved(res, course);
}));

// ════════════════════════════════════════════════════════════════════════════
// CURRICULUM CRUD — MONTHS
// ════════════════════════════════════════════════════════════════════════════

router.post('/:id/trimesters/:triId/months', protect, adminOnly, asyncH(async (req, res) => {
  const course = await loadCourse(req, res); if (!course) return;
  const tri = getTrimester(course, res, req.params.triId); if (!tri) return;
  tri.months.push(pick(req.body, MONTH_FIELDS));
  await course.save();
  saved(res, course, 201);
}));

router.put('/:id/trimesters/:triId/months/:monthId', protect, adminOnly, asyncH(async (req, res) => {
  const course = await loadCourse(req, res); if (!course) return;
  const tri = getTrimester(course, res, req.params.triId); if (!tri) return;
  const month = getMonth(tri, res, req.params.monthId); if (!month) return;
  Object.assign(month, pick(req.body, MONTH_FIELDS));
  await course.save();
  saved(res, course);
}));

router.delete('/:id/trimesters/:triId/months/:monthId', protect, adminOnly, asyncH(async (req, res) => {
  const course = await loadCourse(req, res); if (!course) return;
  const tri = getTrimester(course, res, req.params.triId); if (!tri) return;
  if (!tri.months.id(req.params.monthId)) {
    return res.status(404).json({ success: false, message: 'Month not found' });
  }
  tri.months.pull(req.params.monthId);
  await course.save();
  saved(res, course);
}));

// ════════════════════════════════════════════════════════════════════════════
// CURRICULUM CRUD — SUBJECTS  (the S1–S4 hours live here)
// ════════════════════════════════════════════════════════════════════════════

router.post('/:id/trimesters/:triId/months/:monthId/subjects', protect, adminOnly, asyncH(async (req, res) => {
  const course = await loadCourse(req, res); if (!course) return;
  const tri = getTrimester(course, res, req.params.triId); if (!tri) return;
  const month = getMonth(tri, res, req.params.monthId); if (!month) return;
  month.subjects.push(pick(req.body, SUBJ_FIELDS));
  await course.save();
  saved(res, course, 201);
}));

router.put('/:id/trimesters/:triId/months/:monthId/subjects/:subId', protect, adminOnly, asyncH(async (req, res) => {
  const course = await loadCourse(req, res); if (!course) return;
  const tri = getTrimester(course, res, req.params.triId); if (!tri) return;
  const month = getMonth(tri, res, req.params.monthId); if (!month) return;
  const subject = getSubject(month, res, req.params.subId); if (!subject) return;
  const body = pick(req.body, SUBJ_FIELDS);
  // merge hours so a partial { s1Theory } update doesn't wipe the others
  if (body.hours) { subject.hours = { ...(subject.hours ? subject.hours.toObject() : {}), ...body.hours }; delete body.hours; }
  Object.assign(subject, body);
  await course.save();
  saved(res, course);
}));

router.delete('/:id/trimesters/:triId/months/:monthId/subjects/:subId', protect, adminOnly, asyncH(async (req, res) => {
  const course = await loadCourse(req, res); if (!course) return;
  const tri = getTrimester(course, res, req.params.triId); if (!tri) return;
  const month = getMonth(tri, res, req.params.monthId); if (!month) return;
  if (!month.subjects.id(req.params.subId)) {
    return res.status(404).json({ success: false, message: 'Subject not found' });
  }
  month.subjects.pull(req.params.subId);
  await course.save();
  saved(res, course);
}));

// ── Router-level error handler (self-contained; your global one can override) ──
router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ success: false, message: 'Duplicate key' });
  }
  console.error('[courseRoutes]', err);
  res.status(500).json({ success: false, message: (err && err.message) || 'Server error' });
});

module.exports = router;

/* ──────────────────────────────────────────────────────────────────────────────
 * SEED EXAMPLE — populate the YIEP course (_id 6a1e78a732bcf0dc40360e5f)
 * PUT /api/courses/6a1e78a732bcf0dc40360e5f  with a body like:
 *
 * {
 *   "name": "Younovate Industry Engineering Program",
 *   "code": "YIEP",
 *   "level": "beginner",
 *   "status": "active",
 *   "duration": 9,
 *   "durationUnit": "month",
 *   "tags": ["full-stack","php","laravel","react","industry","residency"],
 *   "trimesters": [
 *     { "trimesterNumber": 1, "code": "T1", "title": "Engineering Foundations",
 *       "focus": "HTML/CSS/JS, PHP & OOP, MySQL, Git",
 *       "months": [
 *         { "monthNumber": 1, "code": "M1", "name": "Programming Fundamentals",
 *           "subjects": [
 *             { "name": "Web Fundamentals", "category": "Web",
 *               "hours": { "s1Theory": 5, "s2Practical": 8, "s3Assignment": 0, "s4Feedback": 2 } }
 *           ] }
 *       ] }
 *   ]
 * }
 * ────────────────────────────────────────────────────────────────────────────── */