// src/routes/hrPlacementRoutes.js - part 1/5: overview + candidates (additive)
'use strict';
const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Interview = require('../models/Interview');
const Company = require('../models/Company');
const JobOpening = require('../models/JobOpening');
const Evaluation = require('../models/Evaluation');
const Offer = require('../models/Offer');
const Placement = require('../models/Placement');
const Attendance = require('../models/Attendance');
const LmsCertificate = require('../models/LmsCertificate');
const Enrollment = require('../models/Enrollment');
const HrSetting = require('../models/HrSetting');
const { protect, authorize } = require('../middleware/auth');
const { notifyUsers } = require('../utils/notificationService');
const router = express.Router();
router.use(protect, authorize('hr', 'admin'));
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const esc = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function notifyHrTeam(o) {
  try {
    const hrs = await User.find({ role: { $in: ['hr', 'admin'] }, isActive: true }).select('_id role').lean();
    const ts = Date.now();
    await notifyUsers(hrs.map((h, i) => ({ userId: h._id, role: h.role, module: 'HR', kind: o.kind, type: o.kind, title: o.title, message: o.message, dedupeKey: `hr:${o.kind}:${ts}:${h._id}:${i}`, link: o.link || '', meta: o.meta || {} })));
  } catch (_) {}
}
async function notifyCand(id, o) {
  try {
    if (!id || !isValidId(String(id))) return;
    await notifyUsers([{ userId: id, role: 'trainee', module: 'HR', kind: o.kind, type: o.kind, title: o.title, message: o.message, dedupeKey: `hr:${o.kind}:c:${id}:${Date.now()}`, link: o.link || '', meta: o.meta || {} }]);
  } catch (_) {}
}
// GET /api/hr/overview - dashboard KPIs from real data
router.get('/overview', async (req, res) => {
  try {
    const now = new Date();
    const base = { role: 'trainee', isActive: true };
    const agg = await User.aggregate([{ $match: base }, { $group: { _id: '$placementStatus', count: { $sum: 1 } } }]);
    const pipe = {}; (agg || []).forEach((p) => { if (p._id) pipe[p._id] = p.count; });
    const total = Object.values(pipe).reduce((a, b) => a + b, 0);
    const active = total - (pipe.placed || 0) - (pipe.not_placed || 0);
    const upcomingN = await Interview.countDocuments({ status: { $in: ['scheduled', 'confirmed', 'rescheduled'] }, scheduledAt: { $gte: now } });
    const compIds = await Interview.find({ status: 'completed' }).distinct('_id');
    const evalIds = await Evaluation.find({ interview: { $in: compIds } }).distinct('interview');
    const eSet = new Set((evalIds || []).map(String));
    const pendEval = (compIds || []).filter((id) => !eSet.has(String(id))).length;
    const sel = (await Evaluation.distinct('candidate', { recommendation: 'selected' })).length;
    const offersActive = await Offer.countDocuments({ status: { $in: ['approved', 'released', 'accepted'] } });
    const placedN = await Placement.countDocuments({ status: { $in: ['offer_accepted', 'joining_pending', 'joined', 'placed'] } });
    const upcoming = await Interview.find({ status: { $in: ['scheduled', 'confirmed', 'rescheduled'] }, scheduledAt: { $gte: now } }).populate('trainee', 'name email').populate('company', 'name').populate('job', 'title').sort({ scheduledAt: 1 }).limit(8).lean();
    return res.json({ success: true, kpis: { totalCandidates: total, activeCandidates: active, upcomingInterviews: upcomingN, pendingEvaluations: pendEval, selected: sel, offers: offersActive, placed: placedN }, pipeline: pipe, upcoming: upcoming.map((u) => ({ _id: u._id, candidate: u.trainee?.name || '', candidateId: u.trainee?._id || u.trainee, email: u.trainee?.email || '', company: u.company?.name || '', role: u.role || u.job?.title || '', round: u.round || u.type || '', scheduledAt: u.scheduledAt, mode: u.mode || '', interviewer: u.interviewerName || '', status: u.status })) });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.get('/candidates', async (req, res) => {
  try {
    const q = req.query; const filter = { role: 'trainee', isActive: true };
    const st = q.placementStatus || q.stage;
    if (st) filter.placementStatus = st;
    if (q.batchId && isValidId(q.batchId)) filter.batchIds = q.batchId;
    if (q.skill) filter.skills = { $in: [new RegExp(esc(q.skill), 'i')] };
    const tab = q.tab || 'all';
    if (tab === 'eligible') filter.placementStatus = { $in: ['enrolled', 'training', 'ready'] };
    else if (tab === 'pipeline') filter.placementStatus = { $in: ['training', 'ready', 'interview_scheduled', 'interview_done'] };
    else if (tab === 'interviewing') filter.placementStatus = { $in: ['interview_scheduled', 'interview_done'] };
    else if (tab === 'selected') filter.placementStatus = { $in: ['interview_done', 'offer_extended'] };
    else if (tab === 'placed') filter.placementStatus = 'placed';
    if (q.search) { const rx = new RegExp(esc(q.search), 'i'); filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { skills: rx }]; }
    const pg = Math.max(1, Number(q.page) || 1); const lim = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const total = await User.countDocuments(filter);
    const docs = await User.find(filter).populate('batchIds', 'name course').sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean();
    const tabs = { all: await User.countDocuments({ role: 'trainee', isActive: true }) };
    for (const t of ['eligible', 'pipeline', 'interviewing', 'selected', 'placed']) {
      const f = { role: 'trainee', isActive: true };
      if (t === 'eligible') f.placementStatus = { $in: ['enrolled', 'training', 'ready'] };
      else if (t === 'pipeline') f.placementStatus = { $in: ['training', 'ready', 'interview_scheduled', 'interview_done'] };
      else if (t === 'interviewing') f.placementStatus = { $in: ['interview_scheduled', 'interview_done'] };
      else if (t === 'selected') f.placementStatus = { $in: ['interview_done', 'offer_extended'] };
      else if (t === 'placed') f.placementStatus = 'placed';
      tabs[t] = await User.countDocuments(f);
    }
    return res.json({ success: true, total, page: pg, pages: Math.ceil(total / lim), tabs, candidates: docs.map((d) => ({ _id: d._id, name: d.name, email: d.email, phone: d.phone || '', skills: d.skills || [], batches: (d.batchIds || []).map((b) => ({ _id: b._id, name: b.name })), placementStatus: d.placementStatus, companyName: d.companyName || '', ctc: d.ctc || '', score: d.hrEvaluation?.overallScore ?? null })) });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.get('/candidate/:id/full', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const c = await User.findOne({ _id: req.params.id, role: 'trainee' }).populate('batchIds', 'name course status').lean();
    if (!c) return res.status(404).json({ success: false, message: 'Candidate not found' });
    const [ivs, evs, ofs, pls, att, certs, enr] = await Promise.all([
      Interview.find({ trainee: c._id }).populate('company', 'name').populate('job', 'title').sort({ scheduledAt: -1 }).lean(),
      Evaluation.find({ candidate: c._id }).populate('company', 'name').populate('interview', 'round type scheduledAt status').sort({ createdAt: -1 }).lean(),
      Offer.find({ candidate: c._id }).populate('company', 'name').populate('job', 'title').sort({ createdAt: -1 }).lean(),
      Placement.find({ candidate: c._id }).populate('company', 'name').populate('job', 'title').sort({ createdAt: -1 }).lean(),
      Attendance.find({ trainee: c._id }).populate('session', 'title scheduledAt').sort({ createdAt: -1 }).limit(30).lean(),
      LmsCertificate.find({ studentId: c._id }).populate('courseId', 'name code').sort({ createdAt: -1 }).lean(),
      Enrollment.find({ student: c._id }).populate('course', 'name code').populate('batch', 'name').lean(),
    ]);
    const present = (att || []).filter((a) => ['present', 'late', 'partial'].includes(a.status)).length;
    return res.json({ success: true, candidate: { _id: c._id, name: c.name, email: c.email, phone: c.phone || '', skills: c.skills || [], batches: c.batchIds || [], placementStatus: c.placementStatus, placementNote: c.placementNote || '', companyName: c.companyName || '', ctc: c.ctc || '', hrEvaluation: c.hrEvaluation || null, resumeUrl: c.resumeUrl || '' }, learning: { enrollments: (enr || []).map((e) => ({ course: e.course?.name || '', progress: e.progressPercent || 0, status: e.status })), attendance: { present, total: (att || []).length, records: (att || []).slice(0, 15) }, certificates: (certs || []).map((x) => ({ _id: x._id, course: x.courseId?.name || '', status: x.status, certificateNo: x.certificateNo || '' })) }, interviews: ivs, evaluations: evs, offers: ofs, placements: pls });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.get('/companies', async (req, res) => {
  try {
    const q = req.query; const filter = {};
    if (q.status) filter.status = q.status;
    if (q.search) { const rx = new RegExp(esc(q.search), 'i'); filter.$or = [{ name: rx }, { industry: rx }, { location: rx }]; }
    const pg = Math.max(1, Number(q.page) || 1); const lim = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const total = await Company.countDocuments(filter);
    const docs = await Company.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean();
    const out = await Promise.all(docs.map(async (c) => {
      const counts = await Promise.all([JobOpening.countDocuments({ company: c._id, status: 'open' }), Interview.countDocuments({ company: c._id }), Offer.countDocuments({ company: c._id }), Placement.countDocuments({ company: c._id })]);
      return { ...c, openPositions: counts[0], interviews: counts[1], offers: counts[2], placements: counts[3] };
    }));
    return res.json({ success: true, total, page: pg, pages: Math.ceil(total / lim), companies: out });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.post('/companies', async (req, res) => {
  try {
    const b = req.body;
    if (!b.name || !String(b.name).trim()) return res.status(400).json({ success: false, message: 'Company name required' });
    const doc = await Company.create({ name: String(b.name).trim(), industry: b.industry || '', location: b.location || '', website: b.website || '', contactName: b.contactName || '', contactEmail: b.contactEmail || '', contactPhone: b.contactPhone || '', notes: b.notes || '', createdBy: req.user._id });
    await notifyHrTeam({ kind: 'company_added', title: 'Company added: ' + doc.name, message: (req.user.name || 'HR') + ' added ' + doc.name, link: '/hr/companies', meta: { companyId: doc._id } });
    return res.status(201).json({ success: true, company: doc });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.get('/companies/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const c = await Company.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ success: false, message: 'Company not found' });
    const jobs = await JobOpening.find({ company: c._id }).sort({ createdAt: -1 }).lean();
    const ivs = await Interview.find({ company: c._id }).populate('trainee', 'name email').sort({ scheduledAt: -1 }).limit(30).lean();
    const ofs = await Offer.find({ company: c._id }).populate('candidate', 'name email').sort({ createdAt: -1 }).limit(30).lean();
    const pls = await Placement.find({ company: c._id }).populate('candidate', 'name email').sort({ createdAt: -1 }).lean();
    return res.json({ success: true, company: c, jobs, interviews: ivs, offers: ofs, placements: pls, stats: { jobs: jobs.length, interviewed: ivs.length, offers: ofs.length, placed: pls.length } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.put('/companies/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const upd = {};
    ['name','industry','location','website','contactName','contactEmail','contactPhone','status','notes'].forEach((k) => { if (req.body[k] !== undefined) upd[k] = req.body[k]; });
    if (upd.status && !['active','inactive'].includes(upd.status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const doc = await Company.findByIdAndUpdate(req.params.id, upd, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Company not found' });
    return res.json({ success: true, company: doc });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
// Shared job-opening filter — search covers title, company name, skills, location, description
async function buildJobFilter(q, ignoreStatus) {
  const filter = {};
  if (q.company && isValidId(q.company)) filter.company = q.company;
  if (q.status && !ignoreStatus) filter.status = q.status;
  if (q.jobType) filter.employmentType = q.jobType;
  if (q.location) filter.location = new RegExp(esc(q.location), 'i');
  if (q.search) {
    const rx = new RegExp(esc(q.search), 'i');
    const or = [{ title: rx }, { location: rx }, { description: rx }, { requiredSkills: rx }, { preferredSkills: rx }];
    const coIds = await Company.find({ name: rx }).distinct('_id');
    if (coIds.length) or.push({ company: { $in: coIds } });
    filter.$or = or;
  }
  return filter;
}
router.get('/jobs', async (req, res) => {
  try {
    const q = req.query;
    const filter = await buildJobFilter(q, false);
    const pg = Math.max(1, Number(q.page) || 1); const lim = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const base = await buildJobFilter(q, true);
    const [total, docs, tAll, tOpen, tClosed, tDraft, tExpired, types, locs] = await Promise.all([
      JobOpening.countDocuments(filter),
      JobOpening.find(filter).populate('company', 'name location industry status').sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
      JobOpening.countDocuments(base),
      JobOpening.countDocuments({ ...base, status: 'open' }),
      JobOpening.countDocuments({ ...base, status: 'closed' }),
      JobOpening.countDocuments({ ...base, status: 'draft' }),
      JobOpening.countDocuments({ ...base, status: 'expired' }),
      JobOpening.distinct('employmentType'),
      JobOpening.distinct('location'),
    ]);
    const out = await Promise.all(docs.map(async (j) => {
      const [ivC, ofC, plC, ivN, ofN, plN] = await Promise.all([
        Interview.distinct('trainee', { job: j._id }),
        Offer.distinct('candidate', { job: j._id }),
        Placement.distinct('candidate', { job: j._id }),
        Interview.countDocuments({ job: j._id }),
        Offer.countDocuments({ job: j._id }),
        Placement.countDocuments({ job: j._id }),
      ]);
      const apps = new Set([...ivC.map(String), ...ofC.map(String), ...plC.map(String)]).size;
      return { ...j, applications: apps, interviews: ivN, offers: ofN, placements: plN };
    }));
    return res.json({ success: true, total, page: pg, pages: Math.ceil(total / lim), jobs: out, tabs: { all: tAll, open: tOpen, closed: tClosed, draft: tDraft, expired: tExpired }, facets: { jobTypes: (types || []).filter(Boolean), locations: (locs || []).filter(Boolean) } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.post('/jobs', async (req, res) => {
  try {
    const b = req.body;
    if (!b.company || !isValidId(b.company)) return res.status(400).json({ success: false, message: 'Valid company required' });
    if (!b.title || !String(b.title).trim()) return res.status(400).json({ success: false, message: 'Job title required' });
    const comp = await Company.findById(b.company);
    if (!comp) return res.status(404).json({ success: false, message: 'Company not found' });
    if (b.deadline && Number.isNaN(new Date(b.deadline).getTime())) return res.status(400).json({ success: false, message: 'Invalid deadline' });
    const st = b.status || 'open';
    if (!['draft','open','closed','expired'].includes(st)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const doc = await JobOpening.create({ company: b.company, title: String(b.title).trim(), description: b.description || '', requiredSkills: Array.isArray(b.requiredSkills) ? b.requiredSkills : [], preferredSkills: Array.isArray(b.preferredSkills) ? b.preferredSkills : [], location: b.location || '', employmentType: b.employmentType || 'full-time', experienceMin: b.experienceMin || 0, experienceMax: b.experienceMax, salaryMin: b.salaryMin || '', salaryMax: b.salaryMax || '', ctc: b.ctc || '', openingsCount: Math.max(1, Number(b.openingsCount) || 1), eligibilityCriteria: b.eligibilityCriteria || '', deadline: b.deadline ? new Date(b.deadline) : undefined, status: st, createdBy: req.user._id });
    await notifyHrTeam({ kind: 'job_created', title: 'Job opened: ' + doc.title, message: comp.name, link: '/hr/jobs', meta: { jobId: doc._id } });
    return res.status(201).json({ success: true, job: doc });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
// GET /api/hr/jobs/stats — KPI cards from real records (declared BEFORE /jobs/:id so 'stats' is not treated as :id)
router.get('/jobs/stats', async (req, res) => {
  try {
    const linked = { job: { $exists: true, $ne: null } };
    const [total, active, ivC, ofC, plC, ivN, ofN, plN] = await Promise.all([
      JobOpening.countDocuments({}),
      JobOpening.countDocuments({ status: 'open' }),
      Interview.distinct('trainee', linked),
      Offer.distinct('candidate', linked),
      Placement.distinct('candidate', linked),
      Interview.countDocuments(linked),
      Offer.countDocuments(linked),
      Placement.countDocuments(linked),
    ]);
    const apps = new Set([...ivC.map(String), ...ofC.map(String), ...plC.map(String)]).size;
    return res.json({ success: true, stats: { total, active, applications: apps, interviews: ivN, offers: ofN, placements: plN } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.get('/jobs/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const j = await JobOpening.findById(req.params.id).populate('company', 'name industry location website contactName contactEmail').lean();
    if (!j) return res.status(404).json({ success: false, message: 'Job not found' });
    const ivs = await Interview.find({ job: j._id }).populate('trainee', 'name email placementStatus').sort({ scheduledAt: -1 }).lean();
    const ofs = await Offer.find({ job: j._id }).populate('candidate', 'name email').sort({ createdAt: -1 }).lean();
    const pls = await Placement.find({ job: j._id }).populate('candidate', 'name email').sort({ createdAt: -1 }).lean();
    const rq = (j.requiredSkills || []).map((s) => String(s).toLowerCase());
    let eligible = await User.find({ role: 'trainee', isActive: true, placementStatus: { $in: ['enrolled', 'training', 'ready'] } }).select('name email skills placementStatus').limit(50).lean();
    eligible = eligible.map((u) => {
      const us = (u.skills || []).map((s) => String(s).toLowerCase());
      const m = rq.filter((r) => us.some((s) => s.includes(r) || r.includes(s)));
      return { ...u, matchCount: m.length, matchedSkills: m };
    }).sort((a, b) => b.matchCount - a.matchCount).slice(0, 20);
    return res.json({ success: true, job: j, interviews: ivs, offers: ofs, placements: pls, eligible, matchCriteria: { requiredSkills: j.requiredSkills || [], eligibilityCriteria: j.eligibilityCriteria || '' } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.put('/jobs/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const upd = {};
    ['title','description','requiredSkills','preferredSkills','location','employmentType','experienceMin','experienceMax','salaryMin','salaryMax','ctc','openingsCount','eligibilityCriteria','deadline','status','company'].forEach((k) => { if (req.body[k] !== undefined) upd[k] = req.body[k]; });
    if (upd.status && !['draft','open','closed','expired'].includes(upd.status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const doc = await JobOpening.findByIdAndUpdate(req.params.id, upd, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Job not found' });
    return res.json({ success: true, job: doc });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
// DELETE /api/hr/jobs/:id — blocked when interviews/offers/placements reference it (protects placement history; close it instead)
router.delete('/jobs/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const refs = await Promise.all([Interview.countDocuments({ job: req.params.id }), Offer.countDocuments({ job: req.params.id }), Placement.countDocuments({ job: req.params.id })]);
    if (refs[0] + refs[1] + refs[2] > 0) return res.status(409).json({ success: false, message: 'Cannot delete: interviews, offers or placements are linked to this opening. Set status to Closed instead.' });
    const gone = await JobOpening.findByIdAndDelete(req.params.id);
    if (!gone) return res.status(404).json({ success: false, message: 'Job not found' });
    return res.json({ success: true, message: 'Job opening deleted' });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.get('/interview-evaluations', async (req, res) => {
  try {
    const q = req.query; const pg = Math.max(1, Number(q.page) || 1); const lim = Math.min(100, Math.max(1, Number(q.limit) || 20));
    if ((q.status || '') === 'pending') {
      const cIds = await Interview.find({ status: 'completed' }).distinct('_id');
      const eIds = await Evaluation.find({ interview: { $in: cIds } }).distinct('interview');
      const eSet = new Set((eIds || []).map(String));
      const pend = (cIds || []).filter((id) => !eSet.has(String(id)));
      const docs = await Interview.find({ _id: { $in: pend } }).populate('trainee', 'name email').populate('company', 'name').populate('job', 'title').sort({ scheduledAt: -1 }).skip((pg - 1) * lim).limit(lim).lean();
      return res.json({ success: true, total: pend.length, page: pg, pages: Math.ceil(pend.length / lim), pending: docs, evaluations: [] });
    }
    const filter = {};
    if (q.search) { const rx = new RegExp(esc(q.search), 'i'); const u = await User.find({ $or: [{ name: rx }, { email: rx }] }).distinct('_id'); filter.candidate = { $in: u }; }
    if (q.recommendation) filter.recommendation = q.recommendation;
    const total = await Evaluation.countDocuments(filter);
    const docs = await Evaluation.find(filter).populate('candidate', 'name email').populate('company', 'name').populate('job', 'title').populate('interview', 'round type scheduledAt status').sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean();
    return res.json({ success: true, total, page: pg, pages: Math.ceil(total / lim), evaluations: docs, pending: [] });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.post('/interview-evaluations', async (req, res) => {
  try {
    const b = req.body;
    if (!b.interview || !isValidId(b.interview)) return res.status(400).json({ success: false, message: 'Valid interview required' });
    if (b.overallScore === undefined || Number.isNaN(Number(b.overallScore))) return res.status(400).json({ success: false, message: 'overallScore required' });
    if (!['selected','rejected','on_hold'].includes(b.recommendation)) return res.status(400).json({ success: false, message: 'recommendation invalid' });
    const iv = await Interview.findById(b.interview);
    if (!iv) return res.status(404).json({ success: false, message: 'Interview not found' });
    if (iv.status !== 'completed') return res.status(400).json({ success: false, message: 'Interview must be completed' });
    const ex = await Evaluation.findOne({ interview: b.interview });
    if (ex) return res.status(409).json({ success: false, message: 'Evaluation exists for interview' });
    const doc = await Evaluation.create({ candidate: iv.trainee, interview: iv._id, company: iv.company, job: iv.job, technical: b.technical, problemSolving: b.problemSolving, communication: b.communication, roleKnowledge: b.roleKnowledge, overallScore: b.overallScore, recommendation: b.recommendation, comments: b.comments || '', evaluatedBy: req.user._id, evaluatedAt: new Date() });
    const st = b.recommendation === 'rejected' ? 'not_placed' : 'interview_done';
    const rec = b.recommendation === 'selected' ? 'Selected' : b.recommendation === 'rejected' ? 'Rejected' : 'On Hold';
    await User.findByIdAndUpdate(iv.trainee, { hrEvaluation: { communication: b.communication, technical: b.technical, problemSolving: b.problemSolving, overallScore: b.overallScore, recommendation: rec, evaluationNotes: b.comments || '', evaluatedBy: req.user._id, evaluatedAt: new Date() }, placementStatus: st, placementUpdatedAt: new Date() });
    await notifyHrTeam({ kind: 'evaluation_submitted', title: 'Evaluation: ' + b.recommendation, message: 'Score ' + b.overallScore, link: '/hr/evaluations', meta: { evaluationId: doc._id } });
    return res.status(201).json({ success: true, evaluation: doc });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.get('/offers', async (req, res) => {
  try {
    const q = req.query; const filter = {};
    if (q.status) filter.status = q.status;
    if (q.company && isValidId(q.company)) filter.company = q.company;
    if (q.search) { const rx = new RegExp(esc(q.search), 'i'); const u = await User.find({ $or: [{ name: rx }, { email: rx }] }).distinct('_id'); filter.candidate = { $in: u }; }
    const pg = Math.max(1, Number(q.page) || 1); const lim = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const total = await Offer.countDocuments(filter);
    const docs = await Offer.find(filter).populate('candidate', 'name email').populate('company', 'name').populate('job', 'title').sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean();
    return res.json({ success: true, total, page: pg, pages: Math.ceil(total / lim), offers: docs });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.post('/offers', async (req, res) => {
  try {
    const b = req.body;
    if (!b.candidate || !isValidId(b.candidate)) return res.status(400).json({ success: false, message: 'Valid candidate required' });
    if (!b.company || !isValidId(b.company)) return res.status(400).json({ success: false, message: 'Valid company required' });
    const cand = await User.findOne({ _id: b.candidate, role: 'trainee' });
    if (!cand) return res.status(404).json({ success: false, message: 'Candidate not found' });
    const sel = await Evaluation.findOne({ candidate: b.candidate, recommendation: 'selected' });
    const okStage = ['interview_done','offer_extended','ready'].includes(cand.placementStatus);
    if (!sel && !okStage) return res.status(400).json({ success: false, message: 'Candidate must be selected before offer' });
    const dup = await Offer.findOne({ candidate: b.candidate, company: b.company, status: { $in: ['draft','approved','released'] } });
    if (dup) return res.status(409).json({ success: false, message: 'Active offer exists' });
    const st = ['draft','approved','released','accepted','declined','expired'].includes(b.status) ? b.status : 'draft';
    const doc = await Offer.create({ candidate: b.candidate, company: b.company, job: b.job || undefined, evaluation: sel?._id, role: b.role || '', ctc: b.ctc || '', location: b.location || '', offerDate: b.offerDate ? new Date(b.offerDate) : undefined, joiningDate: b.joiningDate ? new Date(b.joiningDate) : undefined, benefits: b.benefits || '', notes: b.notes || '', status: st, createdBy: req.user._id });
    if (['released','approved','accepted'].includes(st)) await User.findByIdAndUpdate(b.candidate, { placementStatus: 'offer_extended', placementUpdatedAt: new Date() });
    await notifyHrTeam({ kind: 'offer_created', title: 'Offer ' + st, message: cand.name, link: '/hr/offers', meta: { offerId: doc._id } });
    await notifyCand(b.candidate, { kind: 'offer_created', title: 'New offer', message: 'You have a new offer', link: '/trainee/dashboard' });
    return res.status(201).json({ success: true, offer: doc });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.patch('/offers/:id/status', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const allowed = { draft: ['approved','expired'], approved: ['released','expired'], released: ['accepted','declined','expired'], accepted: [], declined: [], expired: [] };
    const offer = await Offer.findById(req.params.id).populate('candidate', 'name').populate('company', 'name');
    if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });
    if (!allowed[offer.status] || !allowed[offer.status].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Invalid transition' });
    offer.status = req.body.status; await offer.save();
    if (['released','accepted'].includes(offer.status)) await User.findByIdAndUpdate(offer.candidate?._id || offer.candidate, { placementStatus: 'offer_extended', placementUpdatedAt: new Date() });
    if (offer.status === 'accepted') {
      const ex = await Placement.findOne({ offer: offer._id });
      if (!ex) await Placement.create({ candidate: offer.candidate?._id || offer.candidate, offer: offer._id, company: offer.company?._id || offer.company, job: offer.job, role: offer.role, ctc: offer.ctc, location: offer.location, offerDate: offer.offerDate, joiningDate: offer.joiningDate, status: 'offer_accepted', createdBy: req.user._id });
      await notifyHrTeam({ kind: 'offer_accepted', title: 'Offer accepted', message: offer.candidate?.name || '', link: '/hr/placements', meta: { offerId: offer._id } });
    }
    return res.json({ success: true, offer });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.get('/placements', async (req, res) => {
  try {
    const q = req.query; const filter = {};
    if (q.status) filter.status = q.status;
    if (q.company && isValidId(q.company)) filter.company = q.company;
    if (q.search) { const rx = new RegExp(esc(q.search), 'i'); const u = await User.find({ $or: [{ name: rx }, { email: rx }] }).distinct('_id'); filter.candidate = { $in: u }; }
    const pg = Math.max(1, Number(q.page) || 1); const lim = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const total = await Placement.countDocuments(filter);
    const docs = await Placement.find(filter).populate('candidate', 'name email').populate('company', 'name').populate('job', 'title').sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean();
    return res.json({ success: true, total, page: pg, pages: Math.ceil(total / lim), placements: docs });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.post('/placements', async (req, res) => {
  try {
    const b = req.body;
    if (!b.candidate || !isValidId(b.candidate)) return res.status(400).json({ success: false, message: 'Valid candidate required' });
    if (!b.company || !isValidId(b.company)) return res.status(400).json({ success: false, message: 'Valid company required' });
    const dup = await Placement.findOne({ candidate: b.candidate, company: b.company, status: { $in: ['offer_accepted','joining_pending','joined','placed'] } });
    if (dup) return res.status(409).json({ success: false, message: 'Placement exists' });
    const st = b.status || 'offer_accepted';
    if (!['offer_accepted','joining_pending','joined','placed','withdrawn'].includes(st)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const doc = await Placement.create({ candidate: b.candidate, offer: b.offer || undefined, company: b.company, job: b.job || undefined, role: b.role || '', ctc: b.ctc || '', location: b.location || '', offerDate: b.offerDate ? new Date(b.offerDate) : undefined, joiningDate: b.joiningDate ? new Date(b.joiningDate) : undefined, status: st, notes: b.notes || '', createdBy: req.user._id });
    if (['joined','placed'].includes(st)) await User.findByIdAndUpdate(b.candidate, { placementStatus: 'placed', placementUpdatedAt: new Date() });
    await notifyHrTeam({ kind: 'placement_confirmed', title: 'Placement: ' + st, message: '', link: '/hr/placements', meta: { placementId: doc._id } });
    await notifyCand(b.candidate, { kind: 'placement_confirmed', title: 'Placement update', message: st, link: '/trainee/dashboard' });
    return res.status(201).json({ success: true, placement: doc });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.patch('/placements/:id/status', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    if (!['offer_accepted','joining_pending','joined','placed','withdrawn'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const doc = await Placement.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Placement not found' });
    if (['joined','placed'].includes(req.body.status)) await User.findByIdAndUpdate(doc.candidate, { placementStatus: 'placed', placementUpdatedAt: new Date() });
    return res.json({ success: true, placement: doc });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.get('/reports/summary', async (req, res) => {
  try {
    const q = req.query; const df = {};
    if (q.from) df.$gte = new Date(q.from);
    if (q.to) df.$lte = new Date(q.to);
    const hasD = Object.keys(df).length > 0;
    const cb = { role: 'trainee', isActive: true };
    if (hasD) cb.createdAt = df;
    const ca = await User.aggregate([{ $match: cb }, { $group: { _id: '$placementStatus', count: { $sum: 1 } } }]);
    const cand = {}; ca.forEach((c) => { if (c._id) cand[c._id] = c.count; });
    const ib = hasD ? { createdAt: df } : {};
    if (q.company && isValidId(q.company)) ib.company = new mongoose.Types.ObjectId(q.company);
    const ia = await Interview.aggregate([{ $match: ib }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    const ivs = {}; ia.forEach((c) => { if (c._id) ivs[c._id] = c.count; });
    const ob = hasD ? { createdAt: df } : {};
    if (q.company && isValidId(q.company)) ob.company = new mongoose.Types.ObjectId(q.company);
    const oa = await Offer.aggregate([{ $match: ob }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    const ofs = {}; oa.forEach((c) => { if (c._id) ofs[c._id] = c.count; });
    const pb = hasD ? { createdAt: df } : {};
    if (q.company && isValidId(q.company)) pb.company = new mongoose.Types.ObjectId(q.company);
    const pa = await Placement.aggregate([{ $match: pb }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    const pls = {}; pa.forEach((c) => { if (c._id) pls[c._id] = c.count; });
    const cw = await Placement.aggregate([{ $group: { _id: '$company', placed: { $sum: 1 } } }, { $lookup: { from: 'companies', localField: '_id', foreignField: '_id', as: 'c' } }, { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } }, { $project: { company: '$c.name', placed: 1 } }, { $sort: { placed: -1 } }, { $limit: 20 }]);
    return res.json({ success: true, candidates: cand, interviews: ivs, offers: ofs, placements: pls, companyWise: cw });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.get('/reports/export', async (req, res) => {
  try {
    const kind = req.query.kind || 'candidates';
    const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    let rows = [['name','email','status','company','ctc']]; let fn = 'hr-candidates.csv';
    if (kind === 'interviews') {
      const d = await Interview.find({}).populate('trainee', 'name email').populate('company', 'name').sort({ scheduledAt: -1 }).limit(1000).lean();
      rows = [['candidate','email','company','round','scheduledAt','status']];
      d.forEach((x) => rows.push([x.trainee?.name || '', x.trainee?.email || '', x.company?.name || '', x.round || x.type || '', x.scheduledAt ? new Date(x.scheduledAt).toISOString() : '', x.status]));
      fn = 'hr-interviews.csv';
    } else if (kind === 'offers') {
      const d = await Offer.find({}).populate('candidate', 'name email').populate('company', 'name').sort({ createdAt: -1 }).limit(1000).lean();
      rows = [['candidate','email','company','ctc','status']];
      d.forEach((x) => rows.push([x.candidate?.name || '', x.candidate?.email || '', x.company?.name || '', x.ctc || '', x.status]));
      fn = 'hr-offers.csv';
    } else if (kind === 'placements') {
      const d = await Placement.find({}).populate('candidate', 'name email').populate('company', 'name').sort({ createdAt: -1 }).limit(1000).lean();
      rows = [['candidate','email','company','role','ctc','status']];
      d.forEach((x) => rows.push([x.candidate?.name || '', x.candidate?.email || '', x.company?.name || '', x.role || '', x.ctc || '', x.status]));
      fn = 'hr-placements.csv';
    } else if (kind === 'jobs') {
      const filter = await buildJobFilter(req.query, false);
      const docs = await JobOpening.find(filter).populate('company', 'name').sort({ createdAt: -1 }).limit(1000).lean();
      rows = [['title','company','location','type','experience','openings','status','posted']];
      docs.forEach((x) => rows.push([x.title || '', x.company?.name || '', x.location || '', x.employmentType || '', (x.experienceMin ?? '') + (x.experienceMax != null ? '-' + x.experienceMax : '+'), x.openingsCount || 1, x.status, x.createdAt ? new Date(x.createdAt).toISOString() : '']));
      fn = 'hr-jobs.csv';
    } else {
      const d = await User.find({ role: 'trainee', isActive: true }).select('name email placementStatus companyName ctc').sort({ createdAt: -1 }).limit(1000).lean();
      d.forEach((x) => rows.push([x.name || '', x.email || '', x.placementStatus || '', x.companyName || '', x.ctc || '']));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="' + fn + '"');
    return res.send(rows.map((r) => r.map(q).join(',')).join('\n'));
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.get('/hr-settings', async (req, res) => {
  try {
    const s = await HrSetting.findOne({ user: req.user._id }).lean();
    return res.json({ success: true, settings: s || { emailNotifications: true, inAppNotifications: true, interviewReminders: true, evaluationReminders: true, offerNotifications: true, placementNotifications: true } });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
router.put('/hr-settings', async (req, res) => {
  try {
    const upd = {};
    ['emailNotifications','inAppNotifications','interviewReminders','evaluationReminders','offerNotifications','placementNotifications'].forEach((k) => { if (typeof req.body[k] === 'boolean') upd[k] = req.body[k]; });
    const s = await HrSetting.findOneAndUpdate({ user: req.user._id }, { $set: { ...upd, user: req.user._id } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return res.json({ success: true, settings: s });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});
module.exports = router;
