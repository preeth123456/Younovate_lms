// src/routes/courseSubscriptionRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Course Subscription API — mount as: app.use('/api/subscriptions', ...)
//
// TRAINEE  (JWT required, role = 'trainee'):
//   POST   /api/subscriptions/initiate            → Create Razorpay order + pending record
//   POST   /api/subscriptions/verify              → Verify payment → activate
//   GET    /api/subscriptions/my                  → All my subscriptions
//   GET    /api/subscriptions/check/:courseId     → Do I have access to this course?
//   POST   /api/subscriptions/:id/cancel          → Cancel my subscription
//
// ADMIN    (JWT required, role = 'admin'):
//   GET    /api/subscriptions                     → List all (filter: status/course/trainee)
//   GET    /api/subscriptions/stats               → Subscription statistics
//   POST   /api/subscriptions/admin/assign        → Manually give access to a trainee
//   PATCH  /api/subscriptions/:id/status          → Update status of any subscription
//   PUT    /api/subscriptions/:id                 → Full update of any subscription record
//   DELETE /api/subscriptions/:id                 → Hard delete
//
// SHARED   (JWT required, any role):
//   GET    /api/subscriptions/:id                 → Get one subscription by ID
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const express  = require('express');
const mongoose = require('mongoose');

const { protect, authorize } = require('../middleware/auth');
const CourseSubscription     = require('../models/CourseSubscription');
const Course                 = require('../models/Course');
const User                   = require('../models/User');
// ============================================
// RAZORPAY TEMPORARILY DISABLED
// Payment integration is not enabled for the
// current Younovate LMS testing/deployment.
// Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
// later to enable Razorpay.
// ============================================
const {
  sendPaymentDisabled,
} = require('../lib/razorpay');

const router = express.Router();

// ── Micro-helpers ──────────────────────────────────────────────────────────
const asyncH  = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ok      = (res, data, code = 200) => res.status(code).json({ success: true,  ...data });
const fail    = (res, msg,  code = 400) => res.status(code).json({ success: false, message: msg });
const validId = id => mongoose.isValidObjectId(id);

// ════════════════════════════════════════════════════════════════════════════
//  TRAINEE — POST /api/subscriptions/initiate
//  Body: { courseId, plan? }
//  Creates a Razorpay order (or activates free access immediately).
//  Returns Razorpay order details the frontend needs to open the checkout.
// ════════════════════════════════════════════════════════════════════════════
router.post(
  '/initiate',
  protect,
  authorize('trainee'),
  asyncH(async (req, res) => {
    const { courseId, plan = 'full' } = req.body;

    if (!courseId)        return fail(res, 'courseId is required');
    if (!validId(courseId)) return fail(res, 'Invalid courseId');

    const validPlans = ['full', 'monthly', 'trial'];
    if (!validPlans.includes(plan))
      return fail(res, `plan must be one of: ${validPlans.join(', ')}`);

    // ── 1. Verify course exists ─────────────────────────────────────────
    const course = await Course.findById(courseId).select('name code price status');
    if (!course)
      return fail(res, 'Course not found', 404);
    if (course.status === 'archived')
      return fail(res, 'This course is no longer available');

    // ── 2. Check existing subscription ─────────────────────────────────
    const existing = await CourseSubscription.findOne({
      trainee: req.user._id,
      course:  courseId,
    });

    if (existing) {
      if (existing.status === 'active')
        return fail(res, 'You already have an active subscription to this course');

      if (existing.status === 'pending') {
        // ============================================
        // RAZORPAY TEMPORARILY DISABLED — resume payment blocked
        // ============================================
        return sendPaymentDisabled(res);

        // --- Enable when Razorpay is active ---
        // if (!isRazorpayConfigured() || !getRazorpayClient())
        //   return sendPaymentDisabled(res);
        //
        // return ok(res, {
        //   message:        'Pending order already exists — resume payment',
        //   subscriptionId: existing._id,
        //   orderId:        existing.payment.razorpayOrderId,
        //   amount:         existing.payment.amount,
        //   currency:       existing.payment.currency || 'INR',
        //   courseName:     course.name,
        //   keyId:          process.env.RAZORPAY_KEY_ID || '',
        //   resumed:        true,
        // });
      }

      // cancelled / failed / expired — allow re-subscribe by deleting old record
      await CourseSubscription.deleteOne({ _id: existing._id });
    }

    // ── 3. Free / Trial — activate immediately ──────────────────────────
    const isFree  = plan === 'trial';
    const amount  = isFree ? 0 : (Number(course.price) || 0) * 100; // ₹ → paise

    if (isFree || amount === 0) {
      const sub = await CourseSubscription.create({
        trainee:   req.user._id,
        course:    courseId,
        plan:      isFree ? 'trial' : plan,
        status:    'active',
        startDate: new Date(),
        payment: {
          amount:   0,
          currency: 'INR',
          gateway:  'free',
          paidAt:   new Date(),
        },
      });
      return ok(res, {
        message:      'Free access activated successfully',
        free:         true,
        subscription: {
          _id:       sub._id,
          course:    courseId,
          courseName: course.name,
          plan:      sub.plan,
          status:    sub.status,
          startDate: sub.startDate,
          endDate:   sub.endDate,
        },
      }, 201);
    }

    // ── 4. Paid — Razorpay disabled (no online payment) ─────────────────
    // ============================================
    // RAZORPAY TEMPORARILY DISABLED
    // Paid course checkout is not available until Razorpay is enabled.
    // ============================================
    return sendPaymentDisabled(res);

    // --- Enable when Razorpay is active ---
    // const razorpay = getRazorpayClient();
    // if (!razorpay)
    //   return sendPaymentDisabled(res);
    //
    // const receipt = `sub_${req.user._id.toString().slice(-6)}_${Date.now()}`;
    //
    // const order = await razorpay.orders.create({
    //   amount,
    //   currency: 'INR',
    //   receipt,
    //   notes: {
    //     traineeId:  req.user._id.toString(),
    //     courseId,
    //     courseName: course.name,
    //     plan,
    //   },
    // });
    //
    // const sub = await CourseSubscription.create({
    //   trainee: req.user._id,
    //   course:  courseId,
    //   plan,
    //   status:  'pending',
    //   payment: {
    //     amount,
    //     currency:        'INR',
    //     razorpayOrderId: order.id,
    //     gateway:         'razorpay',
    //   },
    // });
    //
    // return ok(res, {
    //   message:        'Order created — open Razorpay checkout to pay',
    //   subscriptionId: sub._id,
    //   orderId:        order.id,
    //   amount,
    //   currency:       'INR',
    //   courseName:     course.name,
    //   courseCode:     course.code,
    //   keyId:          process.env.RAZORPAY_KEY_ID,
    // }, 201);
  })
);

// ════════════════════════════════════════════════════════════════════════════
//  TRAINEE — POST /api/subscriptions/verify
//  Body: { subscriptionId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
//  Verifies Razorpay signature and activates subscription.
// ════════════════════════════════════════════════════════════════════════════
router.post(
  '/verify',
  protect,
  authorize('trainee'),
  asyncH(async (req, res) => {
    // ============================================
    // RAZORPAY TEMPORARILY DISABLED — verify payment blocked
    // ============================================
    return sendPaymentDisabled(res);

    // --- Enable when Razorpay is active ---
    // const {
    //   subscriptionId,
    //   razorpayOrderId,
    //   razorpayPaymentId,
    //   razorpaySignature,
    // } = req.body;
    //
    // if (!subscriptionId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature)
    //   return fail(res, 'subscriptionId, razorpayOrderId, razorpayPaymentId and razorpaySignature are required');
    //
    // if (!validId(subscriptionId))
    //   return fail(res, 'Invalid subscriptionId');
    //
    // const sub = await CourseSubscription
    //   .findOne({ _id: subscriptionId, trainee: req.user._id, status: 'pending' })
    //   .populate('course', 'name code');
    //
    // if (!sub)
    //   return fail(res, 'Pending subscription not found. Already verified or does not exist.', 404);
    //
    // if (!isRazorpayConfigured() || !getRazorpayClient())
    //   return sendPaymentDisabled(res);
    //
    // const secret   = process.env.RAZORPAY_KEY_SECRET || '';
    // const body     = `${razorpayOrderId}|${razorpayPaymentId}`;
    // const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    //
    // if (expected !== razorpaySignature) {
    //   sub.status                    = 'failed';
    //   sub.payment.failureReason     = 'Signature mismatch — possible tamper attempt';
    //   sub.payment.razorpayPaymentId = razorpayPaymentId;
    //   await sub.save();
    //   return fail(res, 'Payment verification failed — signature mismatch. Contact support.', 400);
    // }
    //
    // sub.status                    = 'active';
    // sub.startDate                 = new Date();
    // sub.payment.razorpayPaymentId = razorpayPaymentId;
    // sub.payment.razorpaySignature = razorpaySignature;
    // sub.payment.paidAt            = new Date();
    //
    // if (sub.plan === 'monthly') {
    //   const end = new Date();
    //   end.setDate(end.getDate() + 30);
    //   sub.endDate = end;
    // }
    //
    // await sub.save();
    //
    // return ok(res, {
    //   message: 'Payment verified. Course access is now active!',
    //   subscription: {
    //     _id:       sub._id,
    //     course:    { _id: sub.course._id, name: sub.course.name, code: sub.course.code },
    //     plan:      sub.plan,
    //     status:    sub.status,
    //     startDate: sub.startDate,
    //     endDate:   sub.endDate,
    //     isActive:  sub.isActive,
    //     paidAt:    sub.payment.paidAt,
    //     amount:    sub.payment.amount,
    //     currency:  sub.payment.currency,
    //   },
    // });
  })
);

// ════════════════════════════════════════════════════════════════════════════
//  TRAINEE — GET /api/subscriptions/my
//  Returns all subscriptions for the logged-in trainee.
// ════════════════════════════════════════════════════════════════════════════
router.get(
  '/my',
  protect,
  authorize('trainee'),
  asyncH(async (req, res) => {
    const subs = await CourseSubscription
      .find({ trainee: req.user._id })
      .populate('course', 'name code status level duration')
      .sort({ createdAt: -1 });

    return ok(res, { total: subs.length, subscriptions: subs });
  })
);

// ════════════════════════════════════════════════════════════════════════════
//  TRAINEE — GET /api/subscriptions/check/:courseId
//  Returns whether the logged-in trainee has active access to a course.
// ════════════════════════════════════════════════════════════════════════════
router.get(
  '/check/:courseId',
  protect,
  authorize('trainee'),
  asyncH(async (req, res) => {
    const { courseId } = req.params;
    if (!validId(courseId)) return fail(res, 'Invalid courseId');

    const sub = await CourseSubscription
      .findOne({ trainee: req.user._id, course: courseId })
      .populate('course', 'name code status');

    if (!sub)
      return ok(res, { hasAccess: false, subscription: null });

    return ok(res, {
      hasAccess: sub.isActive,
      subscription: {
        _id:       sub._id,
        plan:      sub.plan,
        status:    sub.status,
        isActive:  sub.isActive,
        startDate: sub.startDate,
        endDate:   sub.endDate,
        course:    sub.course,
      },
    });
  })
);

// ════════════════════════════════════════════════════════════════════════════
//  TRAINEE — POST /api/subscriptions/:id/cancel
//  Body: { reason? }
// ════════════════════════════════════════════════════════════════════════════
router.post(
  '/:id/cancel',
  protect,
  authorize('trainee'),
  asyncH(async (req, res) => {
    if (!validId(req.params.id)) return fail(res, 'Invalid subscription id');

    const sub = await CourseSubscription.findOne({
      _id:     req.params.id,
      trainee: req.user._id,
      status:  'active',
    });
    if (!sub) return fail(res, 'Active subscription not found', 404);

    sub.status      = 'cancelled';
    sub.cancelledBy = req.user._id;
    sub.cancelledAt = new Date();
    sub.notes       = req.body.reason || 'Cancelled by trainee';
    await sub.save();

    return ok(res, {
      message: 'Subscription cancelled successfully',
      subscription: {
        _id:         sub._id,
        status:      sub.status,
        cancelledAt: sub.cancelledAt,
        notes:       sub.notes,
      },
    });
  })
);

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN — GET /api/subscriptions/stats
//  Returns subscription counts grouped by status and plan.
// ════════════════════════════════════════════════════════════════════════════
router.get(
  '/stats',
  protect,
  authorize('admin'),
  asyncH(async (req, res) => {
    const [byStatus, byPlan, totalRevenue] = await Promise.all([
      // Count by status
      CourseSubscription.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort:  { _id: 1 } },
      ]),
      // Count by plan
      CourseSubscription.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } },
        { $sort:  { _id: 1 } },
      ]),
      // Total revenue (paise) from active paid subscriptions
      CourseSubscription.aggregate([
        { $match: { status: 'active', 'payment.gateway': 'razorpay' } },
        { $group: { _id: null, total: { $sum: '$payment.amount' } } },
      ]),
    ]);

    const revenueInRupees = totalRevenue[0]
      ? (totalRevenue[0].total / 100).toFixed(2)
      : '0.00';

    return ok(res, {
      byStatus:       byStatus.map(s => ({ status: s._id, count: s.count })),
      byPlan:         byPlan.map(p => ({ plan: p._id, count: p.count })),
      totalRevenue:   `₹${revenueInRupees}`,
      totalRevenueRaw: totalRevenue[0]?.total || 0,
    });
  })
);

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN — GET /api/subscriptions
//  Query: status, courseId, traineeId, plan, page, limit
// ════════════════════════════════════════════════════════════════════════════
router.get(
  '/',
  protect,
  authorize('admin'),
  asyncH(async (req, res) => {
    const {
      status, courseId, traineeId, plan,
      page = 1, limit = 20,
    } = req.query;

    const filter = {};
    if (status    && status    !== 'all') filter.status  = status;
    if (plan      && plan      !== 'all') filter.plan    = plan;
    if (courseId  && validId(courseId))   filter.course  = courseId;
    if (traineeId && validId(traineeId))  filter.trainee = traineeId;

    const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const pg  = Math.max(Number(page) || 1, 1);

    const [subs, total] = await Promise.all([
      CourseSubscription.find(filter)
        .populate('trainee', 'name email phone role')
        .populate('course',  'name code status')
        .sort({ createdAt: -1 })
        .skip((pg - 1) * lim)
        .limit(lim),
      CourseSubscription.countDocuments(filter),
    ]);

    return ok(res, {
      subscriptions: subs,
      meta: {
        total,
        page:  pg,
        limit: lim,
        pages: Math.ceil(total / lim),
      },
    });
  })
);

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN — POST /api/subscriptions/admin/assign
//  Body: { traineeId, courseId, plan?, endDate?, notes? }
//  Manually gives course access without payment.
// ════════════════════════════════════════════════════════════════════════════
router.post(
  '/admin/assign',
  protect,
  authorize('admin'),
  asyncH(async (req, res) => {
    const { traineeId, courseId, plan = 'admin', endDate, notes } = req.body;

    if (!traineeId || !courseId)
      return fail(res, 'traineeId and courseId are required');
    if (!validId(traineeId)) return fail(res, 'Invalid traineeId');
    if (!validId(courseId))  return fail(res, 'Invalid courseId');

    const validPlans = ['full', 'monthly', 'trial', 'admin'];
    if (!validPlans.includes(plan))
      return fail(res, `plan must be one of: ${validPlans.join(', ')}`);

    const [trainee, course] = await Promise.all([
      User.findOne({ _id: traineeId, role: 'trainee', isActive: true }),
      Course.findById(courseId).select('name code'),
    ]);
    if (!trainee) return fail(res, 'Trainee not found or inactive', 404);
    if (!course)  return fail(res, 'Course not found', 404);

    // Upsert — update if exists, create if not
    const sub = await CourseSubscription.findOneAndUpdate(
      { trainee: traineeId, course: courseId },
      {
        $set: {
          plan,
          status:      'active',
          startDate:   new Date(),
          endDate:     endDate ? new Date(endDate) : null,
          activatedBy: req.user._id,
          notes:       notes || `Access assigned by admin: ${req.user.name}`,
          'payment.amount':   0,
          'payment.currency': 'INR',
          'payment.gateway':  'manual',
          'payment.paidAt':   new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
      .populate('trainee', 'name email')
      .populate('course',  'name code');

    // Trainee inbox (best-effort — assignment still succeeds on failure).
    try {
      const { notifyUsers, idOf } = require('../utils/notificationService');
      await notifyUsers([{
        userId: traineeId, role: 'trainee', module: 'LMS',
        type: 'course_assigned', kind: 'lms_course_assigned',
        title: 'New Course Assigned',
        message: `You have been enrolled in "${course.name}".`,
        dedupeKey: `lms:course:${idOf(courseId)}:trainee:${traineeId}`,
        link: '/trainee/courses',
        meta: { courseId: idOf(courseId), courseName: course.name, entityType: 'course' },
      }]);
    } catch (_) {}

    return ok(res, {
      message:      `Course access assigned to ${trainee.name}`,
      subscription: sub,
    }, 201);
  })
);

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN — PATCH /api/subscriptions/:id/status
//  Body: { status, notes? }
//  Quick status change only.
// ════════════════════════════════════════════════════════════════════════════
router.patch(
  '/:id/status',
  protect,
  authorize('admin'),
  asyncH(async (req, res) => {
    const { status, notes } = req.body;
    const allowed = ['pending', 'active', 'expired', 'cancelled', 'failed'];

    if (!validId(req.params.id)) return fail(res, 'Invalid subscription id');
    if (!status || !allowed.includes(status))
      return fail(res, `status must be one of: ${allowed.join(', ')}`);

    const update = { status };
    if (notes) update.notes = notes;
    if (status === 'active')    { update.startDate = new Date(); }
    if (status === 'cancelled') { update.cancelledBy = req.user._id; update.cancelledAt = new Date(); }

    const sub = await CourseSubscription.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    )
      .populate('trainee', 'name email')
      .populate('course',  'name code');

    if (!sub) return fail(res, 'Subscription not found', 404);

    return ok(res, {
      message:      `Status updated to "${status}"`,
      subscription: sub,
    });
  })
);

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN — PUT /api/subscriptions/:id
//  Body: full or partial subscription fields to update
//  Full update — allows editing plan, dates, notes, payment info, status.
// ════════════════════════════════════════════════════════════════════════════
router.put(
  '/:id',
  protect,
  authorize('admin'),
  asyncH(async (req, res) => {
    if (!validId(req.params.id)) return fail(res, 'Invalid subscription id');

    // Only allow safe fields to be updated — never trainee/course
    const allowed = [
      'plan', 'status', 'startDate', 'endDate', 'notes',
      'payment.amount', 'payment.currency', 'payment.razorpayOrderId',
      'payment.razorpayPaymentId', 'payment.transactionId',
      'payment.gateway', 'payment.paidAt', 'payment.failureReason',
      'cancelledAt', 'cancelledBy',
    ];

    // Build update object from allowed fields only (supports dot-notation)
    const update = {};
    allowed.forEach(key => {
      const keys = key.split('.');
      if (keys.length === 1 && req.body[key] !== undefined) {
        update[key] = req.body[key];
      }
      // Handle nested e.g. payment.amount
      if (keys.length === 2 && req.body[keys[0]]?.[keys[1]] !== undefined) {
        update[key] = req.body[keys[0]][keys[1]];
      }
    });

    if (Object.keys(update).length === 0)
      return fail(res, 'No valid fields provided to update');

    // If admin sets status → active, stamp startDate
    if (update.status === 'active' && !update.startDate)
      update.startDate = new Date();

    update.activatedBy = req.user._id;

    const sub = await CourseSubscription.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    )
      .populate('trainee', 'name email phone role')
      .populate('course',  'name code status');

    if (!sub) return fail(res, 'Subscription not found', 404);

    return ok(res, {
      message:      'Subscription updated successfully',
      subscription: sub,
    });
  })
);

// ════════════════════════════════════════════════════════════════════════════
//  SHARED — GET /api/subscriptions/:id
//  Trainee can view their own; Admin can view any.
// ════════════════════════════════════════════════════════════════════════════
router.get(
  '/:id',
  protect,
  asyncH(async (req, res) => {
    if (!validId(req.params.id)) return fail(res, 'Invalid subscription id');

    const sub = await CourseSubscription.findById(req.params.id)
      .populate('trainee',     'name email role')
      .populate('course',      'name code status')
      .populate('activatedBy', 'name email')
      .populate('cancelledBy', 'name email');

    if (!sub) return fail(res, 'Subscription not found', 404);

    // Trainee can only see their own
    if (
      req.user.role === 'trainee' &&
      sub.trainee._id.toString() !== req.user._id.toString()
    ) {
      return fail(res, 'Access denied', 403);
    }

    return ok(res, { subscription: sub });
  })
);

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN — DELETE /api/subscriptions/:id
// ════════════════════════════════════════════════════════════════════════════
router.delete(
  '/:id',
  protect,
  authorize('admin'),
  asyncH(async (req, res) => {
    if (!validId(req.params.id)) return fail(res, 'Invalid subscription id');

    const sub = await CourseSubscription.findByIdAndDelete(req.params.id);
    if (!sub) return fail(res, 'Subscription not found', 404);

    return ok(res, {
      message: 'Subscription deleted permanently',
      deletedId: sub._id,
    });
  })
);

module.exports = router;