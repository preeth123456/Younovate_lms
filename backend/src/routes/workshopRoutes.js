'use strict';
const express  = require('express');
const mongoose = require('mongoose');
const crypto   = require('crypto');
const path     = require('path');
const fs       = require('fs');
const Workshop = require('../models/Workshop');
const Session   = require('../models/Session');
const Recording = require('../models/Recording');
const { WorkshopPublicRegistration, WorkshopFeedback, WorkshopCertificate, WorkshopAttendance } = require('../models/WorkshopModels');
const WorkshopBatch = require('../models/WorkshopBatch');
const User     = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { sendEmail, workshopApprovedTemplate, loginCredentialsTemplate } = require('../utils/emailUtils');
const { resolveRecordingPlayback } = require('../utils/recordingStorage');
const { rejectPastDate, rejectPastDateTime } = require('../utils/dateTimeValidation');

const router = express.Router();
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── IMPORTANT: All named/static routes MUST come before /:id ──────────────────

// GET /api/workshops — published workshops for landing page
router.get('/', async (req, res) => {
  try {
    const { category, mode, limit = 20, page = 1 } = req.query;
    const filter = {
      published: true,
      status: { $nin: ['Archived', 'Cancelled'] },
    };
    if (category) filter.category = category;
    if (mode)     filter.mode     = mode;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Workshop.countDocuments(filter);
    const workshops = await Workshop.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('trainerId', 'name email profilePicture')
      .lean();

    return res.json({
      success: true,
      data: { workshops, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } },
    });
  } catch (err) {
    const statusCode = err?.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: err.message || 'Server error' });
  }
});


// ── Registration validation helpers ─────────────────────────────────────────
const REG_PHONE_RE = /^[6-9]\d{9}$/;
const REG_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REG_NAME_RE  = /^[A-Za-z][A-Za-z\s'\-]{1,99}$/;
const REG_ONLY_SYMBOLS_RE = /^[^A-Za-z0-9]+$/;

function validateRegUrl(val, hostname) {
  if (!val || !val.trim()) return null;
  try {
    const raw = val.trim();
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (url.hostname !== hostname && url.hostname !== `www.${hostname}`) {
      return `Invalid URL. Expected domain: ${hostname}`;
    }
    return null;
  } catch {
    return `Invalid URL. Expected domain: ${hostname}`;
  }
}

function normalizeWorkshopRegEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function workshopRegEmailRegex(normalEmail) {
  const escaped = normalEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

const ACTIVE_WORKSHOP_REG_STATUSES = ['Registered', 'Approved'];

/** Find registration for one workshop + email (case-insensitive, legacy-safe). */
async function findRegistrationForWorkshop(workshopOid, normalEmail) {
  if (!workshopOid || !normalEmail) return null;
  let doc = await WorkshopPublicRegistration.findOne({ workshopId: workshopOid, email: normalEmail });
  if (doc) return doc;
  return WorkshopPublicRegistration.findOne({
    workshopId: workshopOid,
    email: { $regex: workshopRegEmailRegex(normalEmail) },
  });
}

function workshopRegistrationResponse(res, registration, { alreadyRegistered = false } = {}) {
  if (alreadyRegistered) {
    return res.status(200).json({
      success: true,
      message: 'You are already registered for this workshop.',
      data: registration,
      alreadyRegistered: true,
    });
  }
  return res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: registration,
    alreadyRegistered: false,
  });
}

// POST /api/workshops/register — public registration (MUST be before /:id)
router.post('/register', async (req, res) => {
  try {
    const {
      workshopId, fullName, email, phone, whatsapp,
      college, qualification, city, state,
      experience, linkedin, github,
    } = req.body;

    // ── Required field presence ───────────────────────────────────────────────
    if (!workshopId) return res.status(400).json({ success: false, message: 'workshopId is required.' });
    if (!isValidId(workshopId)) return res.status(400).json({ success: false, message: 'Invalid workshop ID.' });

    // ── Full Name ─────────────────────────────────────────────────────────────
    const cleanName = (fullName || '').trim().replace(/\s+/g, ' ');
    if (!cleanName) return res.status(400).json({ success: false, message: 'Please enter a valid full name.' });
    if (cleanName.length < 2 || cleanName.length > 100)
      return res.status(400).json({ success: false, message: 'Please enter a valid full name.' });
    if (!REG_NAME_RE.test(cleanName))
      return res.status(400).json({ success: false, message: 'Please enter a valid full name.' });

    // ── Email ─────────────────────────────────────────────────────────────────
    const normalEmail = normalizeWorkshopRegEmail(email);
    if (!normalEmail) return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    if (normalEmail.length > 254 || !REG_EMAIL_RE.test(normalEmail))
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });

    // ── Phone ─────────────────────────────────────────────────────────────────
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10 || !REG_PHONE_RE.test(cleanPhone))
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number.' });

    // ── WhatsApp (optional) ───────────────────────────────────────────────────
    let cleanWhatsApp = (whatsapp || '').replace(/\D/g, '');
    if (cleanWhatsApp) {
      if (cleanWhatsApp.length !== 10 || !REG_PHONE_RE.test(cleanWhatsApp))
        return res.status(400).json({ success: false, message: 'Enter a valid 10-digit WhatsApp number.' });
    } else {
      cleanWhatsApp = cleanPhone;
    }

    // ── College (optional) ────────────────────────────────────────────────────
    const cleanCollege = (college || '').trim();
    if (cleanCollege) {
      if (cleanCollege.length > 150)
        return res.status(400).json({ success: false, message: 'Institution name must be 150 characters or fewer.' });
      if (REG_ONLY_SYMBOLS_RE.test(cleanCollege))
        return res.status(400).json({ success: false, message: 'Please enter a valid institution name.' });
    }

    // ── Qualification (optional) ──────────────────────────────────────────────
    const cleanQual = (qualification || '').trim();
    if (cleanQual) {
      if (cleanQual.length > 100)
        return res.status(400).json({ success: false, message: 'Qualification must be 100 characters or fewer.' });
      if (REG_ONLY_SYMBOLS_RE.test(cleanQual))
        return res.status(400).json({ success: false, message: 'Please enter a valid qualification.' });
    }

    // ── State (required) ──────────────────────────────────────────────────────
    const cleanState = (state || '').trim();
    if (!cleanState) return res.status(400).json({ success: false, message: 'Please select a state.' });

    // ── City (required) ───────────────────────────────────────────────────────
    const cleanCity = (city || '').trim();
    if (!cleanCity) return res.status(400).json({ success: false, message: 'Please select a city.' });

    // ── Experience (optional) ─────────────────────────────────────────────────
    const cleanExp = (experience || '').trim().replace(/\s+/g, ' ');
    if (cleanExp) {
      if (cleanExp.length > 150)
        return res.status(400).json({ success: false, message: 'Experience must be 150 characters or fewer.' });
      if (REG_ONLY_SYMBOLS_RE.test(cleanExp))
        return res.status(400).json({ success: false, message: 'Please enter a valid experience description.' });
    }

    // ── LinkedIn (optional) ───────────────────────────────────────────────────
    const linkedinErr = validateRegUrl(linkedin, 'linkedin.com');
    if (linkedinErr) return res.status(400).json({ success: false, message: 'Please enter a valid LinkedIn profile URL.' });

    // ── GitHub (optional) ─────────────────────────────────────────────────────
    const githubErr = validateRegUrl(github, 'github.com');
    if (githubErr) return res.status(400).json({ success: false, message: 'Please enter a valid GitHub profile URL.' });

    // ── Workshop existence + open check ──────────────────────────────────────
    const workshopOid = new mongoose.Types.ObjectId(workshopId);
    const workshop = await Workshop.findById(workshopOid);
    if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found.' });
    if (!workshop.registrationOpen)
      return res.status(400).json({ success: false, message: 'Registration is closed for this workshop.' });

    // ── Capacity check ────────────────────────────────────────────────────────
    const activeRegCount = await WorkshopPublicRegistration.countDocuments({
      workshopId: workshopOid,
      registrationStatus: { $nin: ['Cancelled', 'Rejected'] },
    });
    if (workshop.maxSeats > 0 && activeRegCount >= workshop.maxSeats)
      return res.status(400).json({ success: false, message: 'Workshop Full. No seats available.' });

    const existingUser = await User.findOne({ email: normalEmail }).lean();

    // ── Duplicate check: same email for THIS workshop only ────────────────────
    const existing = await findRegistrationForWorkshop(workshopOid, normalEmail);
    if (existing) {
      if (existing.registrationStatus === 'Rejected' || existing.registrationStatus === 'Cancelled') {
        existing.fullName       = cleanName;
        existing.phone          = cleanPhone;
        existing.whatsapp       = cleanWhatsApp;
        existing.college        = cleanCollege;
        existing.qualification  = cleanQual;
        existing.city           = cleanCity;
        existing.state          = cleanState;
        existing.experience     = cleanExp;
        existing.linkedin       = (linkedin || '').trim();
        existing.github         = (github   || '').trim();
        existing.workshopName   = workshop.title;
        existing.email          = normalEmail;
        existing.userId         = existingUser?._id || existing.userId || null;
        existing.registrationStatus = 'Registered';
        existing.registrationDate   = new Date();
        await existing.save();

        const newCount = activeRegCount + 1;
        await Workshop.findByIdAndUpdate(workshopOid, {
          registrationCount: newCount,
          availableSeats: Math.max(0, workshop.maxSeats - newCount),
        });

        return workshopRegistrationResponse(res, existing);
      }

      if (ACTIVE_WORKSHOP_REG_STATUSES.includes(existing.registrationStatus)) {
        return workshopRegistrationResponse(res, existing, { alreadyRegistered: true });
      }
    }

    // ── Link to existing User account if one matches this email ────────────────
    const userId = existingUser?._id || null;

    // ── Create registration ───────────────────────────────────────────────────
    const registration = await WorkshopPublicRegistration.create({
      workshopId:         workshopOid,
      workshopName:       workshop.title,
      fullName:           cleanName,
      email:              normalEmail,
      phone:              cleanPhone,
      whatsapp:           cleanWhatsApp,
      college:            cleanCollege,
      qualification:      cleanQual,
      city:               cleanCity,
      state:              cleanState,
      experience:         cleanExp,
      linkedin:           (linkedin || '').trim(),
      github:             (github   || '').trim(),
      userId,
      registrationStatus: 'Registered',
      registrationDate:   new Date(),
    });

    // ── Update seat counts ────────────────────────────────────────────────────
    const newCount = activeRegCount + 1;
    await Workshop.findByIdAndUpdate(workshopOid, {
      registrationCount: newCount,
      availableSeats: Math.max(0, workshop.maxSeats - newCount),
    });

    return workshopRegistrationResponse(res, registration);
  } catch (err) {
    if (err.code === 11000) {
      const rawWorkshopId = String(req.body?.workshopId || '').trim();
      const workshopOid = isValidId(rawWorkshopId) ? new mongoose.Types.ObjectId(rawWorkshopId) : null;
      const normalEmail = normalizeWorkshopRegEmail(req.body?.email);
      const dup = workshopOid ? await findRegistrationForWorkshop(workshopOid, normalEmail) : null;

      if (dup && ACTIVE_WORKSHOP_REG_STATUSES.includes(dup.registrationStatus)) {
        return workshopRegistrationResponse(res, dup, { alreadyRegistered: true });
      }

      console.error('Workshop registration duplicate key (not same-workshop email):', err.message);
      return res.status(500).json({
        success: false,
        message: 'Registration could not be completed. Please try again.',
      });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/workshops/admin/stats (MUST be before /:id)
router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const [total, published, draft, completed, archived, totalRegs] = await Promise.all([
      Workshop.countDocuments(),
      Workshop.countDocuments({ status: 'Published', published: true }),
      Workshop.countDocuments({ status: 'Draft' }),
      Workshop.countDocuments({ status: 'Completed' }),
      Workshop.countDocuments({ status: 'Archived' }),
      WorkshopPublicRegistration.countDocuments(),
    ]);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const upcoming = await Workshop.countDocuments({
      published: true,
      date: { $gte: today },
      status: { $nin: ['Archived', 'Cancelled', 'Completed'] },
    });

    const seatsAgg = await Workshop.aggregate([
      { $group: { _id: null, totalSeats: { $sum: '$maxSeats' }, availableSeats: { $sum: '$availableSeats' } } },
    ]);
    const totalSeats     = seatsAgg[0]?.totalSeats     || 0;
    const availableSeats = seatsAgg[0]?.availableSeats || 0;
    const regPct = totalSeats > 0 ? Math.round(((totalSeats - availableSeats) / totalSeats) * 100) : 0;

    return res.json({
      success: true,
      data: { total, published, draft, completed, archived, upcoming, totalRegs, totalSeats, availableSeats, regPct },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/workshops/admin/all (MUST be before /:id)
router.get('/admin/all', protect, authorize('admin'), async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'All') filter.status = status;
    if (search) filter.$or = [
      { title:       { $regex: search, $options: 'i' } },
      { trainerName: { $regex: search, $options: 'i' } },
    ];

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Workshop.countDocuments(filter);
    const workshops = await Workshop.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('trainerId', 'name email')
      .lean();

    const ids = workshops.map(w => w._id);
    const regCounts = await WorkshopPublicRegistration.aggregate([
      { $match: { workshopId: { $in: ids } } },
      { $group: { _id: '$workshopId', count: { $sum: 1 } } },
    ]);
    const regMap = {};
    regCounts.forEach(r => { regMap[r._id.toString()] = r.count; });

    const result = workshops.map(w => ({ ...w, registrationCount: regMap[w._id.toString()] || w.registrationCount || 0 }));

    return res.json({
      success: true,
      data: { workshops: result, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/workshops/admin/registrations (MUST be before /:id)
router.get('/admin/registrations', protect, authorize('admin'), async (req, res) => {
  try {
    const { workshopId, status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (workshopId && isValidId(workshopId)) filter.workshopId = workshopId;
    if (status)     filter.registrationStatus = status;
    if (search)     filter.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email:    { $regex: search, $options: 'i' } },
      { phone:    { $regex: search, $options: 'i' } },
      { college:  { $regex: search, $options: 'i' } },
    ];

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await WorkshopPublicRegistration.countDocuments(filter);
    const registrations = await WorkshopPublicRegistration.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('workshopId', 'title date mode')
      .lean();

    return res.json({
      success: true,
      data: { registrations, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/workshops/admin/registrations/:id (MUST be before /:id)
// When approving (registrationStatus === 'Approved'), auto-creates or reuses a User account.
// Atomic: user creation, batch update, and registration update happen in a controlled sequence
// with rollback on failure to prevent orphaned userId references.
router.put('/admin/registrations/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid ID' });

    const reg = await WorkshopPublicRegistration.findById(req.params.id).lean();
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

    // ── Only allow specific fields to be updated ──────────────────────────
    // NEVER spread req.body blindly — that could overwrite email, fullName, etc.
    const allowedFields = ['registrationStatus'];
    const updateData = {};
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    });

    // ── Approval flow with auto user creation ─────────────────────────────
    if (updateData.registrationStatus === 'Approved' && reg.registrationStatus !== 'Approved') {
      // Step 1: Check Users collection by email
      const existingUser = await User.findOne({ email: reg.email }).select('_id name email isActive').lean();

      let userId;

      if (existingUser) {
        // Reuse existing user — ensure it's active
        userId = existingUser._id;
        if (!existingUser.isActive) {
          await User.findByIdAndUpdate(userId, { $set: { isActive: true } });
        }
        console.log(`✅ [DEBUG] Workshop approval: Reusing existing user ${existingUser.email} (${userId})`);

        // ── Send Workshop Approved email (existing user) ──
        try {
          const workshopTitle = reg.workshopName || 'Workshop';
          const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
          console.log(`📧 [DEBUG] Sending workshop approved email to ${reg.email}...`);
          const emailResult = await sendEmail({
            to: reg.email,
            subject: `Your Registration for "${workshopTitle}" has been Approved!`,
            html: workshopApprovedTemplate(reg.fullName, workshopTitle, loginUrl),
          });
          console.log(`✅ [DEBUG] Workshop approved email sent — messageId: ${emailResult.messageId}`);
        } catch (emailErr) {
          console.error(`❌ [DEBUG] Failed to send workshop approved email to ${reg.email}:`, emailErr.message);
          console.error(emailErr.stack);
          // Non-blocking — approval still succeeds
        }
      } else {
        // Step 2: Auto-create trainee account with temporary password
        const tempPassword = crypto.randomBytes(4).toString('hex') + 'Tmp@1'; // e.g. "a1b2c3d4Tmp@1"
        console.log(`🔑 [DEBUG] Generated temporary password for ${reg.email}: ${tempPassword}`);

        const newUser = await User.create({
          name:                reg.fullName,
          email:               reg.email,
          password:            tempPassword,
          role:                'trainee',
          phone:               reg.phone || '',
          isActive:            true,
          isTemporaryPassword: true,
        });

        // Step 3: VERIFY the user was actually persisted by querying it back
        const verifiedUser = await User.findById(newUser._id).select('_id isTemporaryPassword password').lean();
        if (!verifiedUser || !verifiedUser._id) {
          // Attempt to clean up the failed create
          try { await User.findByIdAndDelete(newUser._id); } catch (_) {}
          return res.status(500).json({
            success: false,
            message: 'Failed to persist user account. Please try again.',
          });
        }
        console.log(`✅ [DEBUG] User created with _id: ${verifiedUser._id}, isTemporaryPassword: ${verifiedUser.isTemporaryPassword}, password hash exists: ${!!verifiedUser.password}`);

        userId = verifiedUser._id;

        // Step 3b: Verify bcrypt comparison works
        try {
          const UserModel = require('../models/User');
          const pwCheckUser = await UserModel.findById(verifiedUser._id).select('+password');
          const pwMatch = await pwCheckUser.comparePassword(tempPassword);
          console.log(`🔐 [DEBUG] bcrypt.compare("${tempPassword}", storedHash) = ${pwMatch}`);
          if (!pwMatch) {
            console.error(`❌ [DEBUG] PASSWORD MISMATCH! The stored hash doesn't match the generated password!`);
          }
        } catch (pwErr) {
          console.error(`❌ [DEBUG] Error verifying password:`, pwErr.message);
        }

        // ── Send Login Credentials email (new user — includes temp password) ──
        try {
          const workshopTitle = reg.workshopName || 'Workshop';
          const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
          console.log(`📧 [DEBUG] Sending login credentials email to ${reg.email}...`);
          const emailResult = await sendEmail({
            to: reg.email,
            subject: `Welcome to ${workshopTitle} — Your Login Credentials`,
            html: loginCredentialsTemplate(reg.fullName, reg.email, tempPassword, workshopTitle, loginUrl),
          });
          console.log(`✅ [DEBUG] Login credentials email sent to ${reg.email} — messageId: ${emailResult.messageId}`);
        } catch (emailErr) {
          console.error(`❌ [DEBUG] Failed to send login credentials email to ${reg.email}:`, emailErr.message);
          console.error(emailErr.stack);
          // Non-blocking — approval still succeeds
        }
      }

      // Step 4: Save userId into WorkshopPublicRegistration
      updateData.userId = userId;

      // Step 5: Find any WorkshopBatch for this workshop and add userId to students
      const batches = await WorkshopBatch.find({ workshopId: reg.workshopId }).lean();
      const batchUpdateErrors = [];

      for (const batch of batches) {
        // Check if userId is already in the students array (by string comparison)
        const alreadyInBatch = (batch.students || []).some(
          s => s.toString() === userId.toString()
        );
        if (!alreadyInBatch) {
          try {
            const result = await WorkshopBatch.findByIdAndUpdate(
              batch._id,
              { $addToSet: { students: userId } },
              { new: true }
            );
            if (!result) {
              batchUpdateErrors.push(`Batch ${batch.batchCode || batch._id}: not found`);
            }
          } catch (batchErr) {
            batchUpdateErrors.push(`Batch ${batch.batchCode || batch._id}: ${batchErr.message}`);
          }
        }
      }

      // If batch updates failed, log but don't block the approval
      // (the user IS created and the registration IS approved — batch can be fixed manually)
      if (batchUpdateErrors.length > 0) {
        console.error('⚠️  Workshop batch student sync errors:', batchUpdateErrors.join('; '));
      }
    }

    // Step 6: Update the registration document
    const updated = await WorkshopPublicRegistration.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('workshopId', 'title date');

    if (!updated) return res.status(404).json({ success: false, message: 'Registration not found' });

    return res.json({ success: true, data: updated });
  } catch (err) {
    // Handle duplicate key errors (race condition on email)
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists. Please try again.',
      });
    }
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: `Validation failed: ${messages}` });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/workshops/admin/registrations/:id (MUST be before /:id)
router.delete('/admin/registrations/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid ID' });

    const reg = await WorkshopPublicRegistration.findByIdAndDelete(req.params.id);
    if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });

    await Workshop.findByIdAndUpdate(reg.workshopId, {
      $inc: { registrationCount: -1, availableSeats: 1 },
    });

    return res.json({ success: true, message: 'Registration deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/workshops/admin/feedback  [admin]
// Real MongoDB feedback across all workshops, with stats + rating distribution.
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/admin/feedback', protect, authorize('admin'), async (req, res) => {
  try {
    const { workshopId, search, rating, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (workshopId && isValidId(workshopId)) filter.workshopId = workshopId;
    if (rating) filter.rating = Number(rating);

    if (search) {
      // Search across populated student name + comment via aggregation
      const students = await User.find({ name: { $regex: search, $options: 'i' } }).select('_id').lean();
      const studentIds = students.map(s => s._id);
      filter.$or = [
        { studentId: { $in: studentIds } },
        { comment:    { $regex: search, $options: 'i' } },
        { suggestions:{ $regex: search, $options: 'i' } },
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await WorkshopFeedback.countDocuments(filter);

    const feedback = await WorkshopFeedback.find(filter)
      .populate('studentId', 'name email profilePicture')
      .populate('workshopId', 'title date mode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // ── Global stats ─────────────────────────────────────────────────────
    const [avgAgg, distAgg, countAgg] = await Promise.all([
      WorkshopFeedback.aggregate([
        { $match: filter },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, avgTrainer: { $avg: '$trainerRating' }, count: { $sum: 1 } } },
      ]),
      WorkshopFeedback.aggregate([
        { $match: filter },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ]),
      WorkshopFeedback.countDocuments(filter),
    ]);

    const dist = [5, 4, 3, 2, 1].map(star => ({
      star,
      count: distAgg.find(d => d._id === star)?.count || 0,
    }));

    return res.json({
      success: true,
      feedback,
      stats: {
        total: avgAgg[0]?.count || countAgg || 0,
        avgRating: avgAgg[0] ? Number(avgAgg[0].avgRating.toFixed(1)) : 0,
        avgTrainer: avgAgg[0] ? Number(avgAgg[0].avgTrainer.toFixed(1)) : 0,
        dist,
      },
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/workshops/admin/recordings  [admin]
// All recording documents with workshop / trainer / session enrichment.
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/admin/recordings', protect, authorize('admin'), async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;

    const skip  = (Number(page) - 1) * Number(limit);

    let baseQuery = Recording.find(filter)
      .sort({ createdAt: -1 });

    const total = await Recording.countDocuments(filter);

    let recordings = await baseQuery.skip(skip).limit(Number(limit)).lean();

    // Enrich with session + trainer info
    if (recordings.length > 0) {
      const sessionIds = [...new Set(recordings.map(r => r.sessionId).filter(Boolean))];
      const trainerIds = [...new Set(recordings.map(r => r.trainerId).filter(Boolean))];
      const [sessions, trainers] = await Promise.all([
        Session.find({ _id: { $in: sessionIds } })
          .populate({ path: 'workshopBatchId', populate: { path: 'workshopId', select: 'title' } })
          .select('title sessionType workshopBatchId scheduledAt status')
          .lean(),
        User.find({ _id: { $in: trainerIds } }).select('name email').lean(),
      ]);
      const sessMap = {};
      sessions.forEach(s => { sessMap[s._id.toString()] = s; });
      const trMap = {};
      trainers.forEach(t => { trMap[t._id.toString()] = t; });

      recordings = recordings.map(r => {
        const s = r.sessionId ? sessMap[r.sessionId.toString()] : null;
        const { url, playable } = resolveRecordingPlayback(r);
        return {
          ...r,
          url,
          playable,
          session: s ? { _id: s._id, title: s.title, status: s.status, scheduledAt: s.scheduledAt } : null,
          workshopName: s?.workshopBatchId?.workshopId?.title || '',
          trainer: r.trainerId && trMap[r.trainerId.toString()] ? trMap[r.trainerId.toString()] : null,
        };
      });

      // Client-side search after enrichment
      if (search) {
        const q = search.toLowerCase();
        recordings = recordings.filter(r =>
          (r.workshopName || '').toLowerCase().includes(q) ||
          (r.session?.title || '').toLowerCase().includes(q) ||
          (r.trainer?.name || '').toLowerCase().includes(q) ||
          (r.filename || '').toLowerCase().includes(q)
        );
      }
    }

    // ── Stats ─────────────────────────────────────────────────────────────
    const [totalAgg, activeAgg, processingAgg, storageAgg] = await Promise.all([
      Recording.countDocuments(),
      Recording.countDocuments({ status: 'active' }),
      Recording.countDocuments({ status: 'processing' }),
      Recording.aggregate([{ $group: { _id: null, totalSize: { $sum: '$sizeBytes' }, totalDuration: { $sum: '$durationSeconds' } } }]),
    ]);

    return res.json({
      success: true,
      recordings,
      stats: {
        total: totalAgg,
        active: activeAgg,
        processing: processingAgg,
        totalStorageMB: storageAgg[0] ? +(storageAgg[0].totalSize / (1024 * 1024)).toFixed(1) : 0,
        totalDurationSeconds: storageAgg[0]?.totalDuration || 0,
      },
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/workshops/admin/recordings/:id  [admin]
// ═══════════════════════════════════════════════════════════════════════════════
router.delete('/admin/recordings/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid recording ID' });
    const recording = await Recording.findByIdAndDelete(req.params.id);
    if (!recording) return res.status(404).json({ success: false, message: 'Recording not found' });

    // Also remove from session.recordings if referenced
    try {
      await Session.updateOne(
        { _id: recording.sessionId },
        { $pull: { recordings: recording._id } }
      );
    } catch (_) {}

    return res.json({ success: true, message: 'Recording deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Workshop Batch routes (all BEFORE /:id) ──────────────────────────────────

// PATCH /api/workshops/batches/:batchId/assign-trainer
router.patch('/batches/:batchId/assign-trainer', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.batchId)) return res.status(400).json({ success: false, message: 'Invalid batch ID.' });
    const { trainerId } = req.body;
    if (!trainerId || !isValidId(trainerId)) return res.status(400).json({ success: false, message: 'Valid trainerId is required.' });

    const trainer = await User.findById(trainerId).select('name email role').lean();
    if (!trainer) return res.status(404).json({ success: false, message: 'Trainer not found.' });
    if (trainer.role !== 'trainer') return res.status(400).json({ success: false, message: 'Only Trainer users can be assigned to a Workshop Batch.' });

    const existingBatch = await WorkshopBatch.findById(req.params.batchId).lean();
    if (!existingBatch) return res.status(404).json({ success: false, message: 'Workshop Batch not found.' });
    const isReassign = existingBatch.trainerId != null;

    const auditUpdate = {
      trainerId,
      trainer: trainer.name,
      assignedBy: req.user._id,
    };
    if (!isReassign) {
      auditUpdate.assignedAt = new Date();
      auditUpdate.reassignedAt = null;
    } else {
      auditUpdate.reassignedAt = new Date();
    }

    const batch = await WorkshopBatch.findByIdAndUpdate(
      req.params.batchId,
      { $set: auditUpdate },
      { new: true, runValidators: true }
    ).populate('workshopId', 'title date mode').populate('trainerId', 'name email').populate('assignedBy', 'name email');

    if (!batch) return res.status(404).json({ success: false, message: 'Workshop Batch not found.' });
    return res.json({ success: true, isReassign, data: batch });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/workshops/batches/:batchId/unassign-trainer
router.patch('/batches/:batchId/unassign-trainer', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.batchId)) return res.status(400).json({ success: false, message: 'Invalid batch ID.' });
    const batch = await WorkshopBatch.findByIdAndUpdate(
      req.params.batchId,
      { $set: { trainerId: null, trainer: '' } },
      { new: true, runValidators: true }
    ).populate('workshopId', 'title date mode').populate('trainerId', 'name email');
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });
    return res.json({ success: true, data: batch });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/workshops/batches/trainer-list — fetch all trainers for assign modal
router.get('/trainer-list', protect, authorize('admin'), async (req, res) => {
  try {
    const trainers = await User.find({ role: 'trainer', isActive: true }).select('name email profilePicture').lean();
    return res.json({ success: true, data: trainers });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Time validation helper ────────────────────────────────────────────────────
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
function validateTime(val, label) {
  if (!val || !val.trim()) return null; // optional
  if (!TIME_RE.test(val.trim())) return `Invalid ${label}. Use HH:mm format (e.g. 09:00, 14:30).`;
  return null;
}
function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// POST /api/workshops/batches — create a batch
router.post('/batches', protect, authorize('admin'), async (req, res) => {
  try {
    const { workshopId, batchName, batchCode, registrationIds, trainer, startDate, endDate, startTime, endTime, mode, capacity, status, notes } = req.body;

    if (!batchName || !batchName.trim()) return res.status(400).json({ success: false, message: 'Batch name is required.' });
    if (!batchCode || !batchCode.trim()) return res.status(400).json({ success: false, message: 'Batch code is required.' });
    if (!workshopId || !isValidId(workshopId)) return res.status(400).json({ success: false, message: 'Valid workshop ID is required.' });
    if (!startDate) return res.status(400).json({ success: false, message: 'Start date is required.' });
    if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0)
      return res.status(400).json({ success: false, message: 'Select at least one trainee.' });

    // Date validation
    const dateCheck = rejectPastDate(startDate, 'Batch start date');
    if (!dateCheck.ok) return res.status(400).json({ success: false, message: dateCheck.message });
    if (startTime) {
      const dtCheck = rejectPastDateTime(startDate, startTime, 'Batch start date/time');
      if (!dtCheck.ok) return res.status(400).json({ success: false, message: dtCheck.message });
    }
    const sd = new Date(startDate);
    if (endDate) {
      const ed = new Date(endDate);
      if (isNaN(ed.getTime())) return res.status(400).json({ success: false, message: 'Invalid end date.' });
      if (ed < sd) return res.status(400).json({ success: false, message: 'End date cannot be before start date.' });
    }

    // Time validation
    const stErr = validateTime(startTime, 'start time');
    if (stErr) return res.status(400).json({ success: false, message: stErr });
    const etErr = validateTime(endTime, 'end time');
    if (etErr) return res.status(400).json({ success: false, message: etErr });
    if (startTime && endTime && TIME_RE.test(startTime) && TIME_RE.test(endTime)) {
      if (timeToMinutes(endTime) <= timeToMinutes(startTime))
        return res.status(400).json({ success: false, message: 'End time must be later than start time.' });
    }

    // Capacity validation — must be a positive integer
    let cap = 0;
    if (capacity !== undefined && capacity !== '' && capacity !== null) {
      const rawCap = Number(capacity);
      if (!Number.isInteger(rawCap) || rawCap <= 0)
        return res.status(400).json({ success: false, message: 'Maximum seats must be a positive whole number.' });
      cap = rawCap;
    }

    if (cap > 0 && registrationIds.length > cap)
      return res.status(400).json({ success: false, message: 'Batch capacity cannot be less than selected trainee count.' });

    const workshop = await Workshop.findById(workshopId);
    if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found.' });

    const invalidIds = registrationIds.filter(id => !isValidId(id));
    if (invalidIds.length > 0) return res.status(400).json({ success: false, message: 'One or more registration IDs are invalid.' });

    // Deduplicate registration IDs
    const uniqueRegIds = [...new Set(registrationIds.map(String))];

    const regs = await WorkshopPublicRegistration.find({ _id: { $in: uniqueRegIds } }).lean();
    if (regs.length !== uniqueRegIds.length)
      return res.status(404).json({ success: false, message: 'One or more selected registrations were not found.' });

    const wrongWorkshop = regs.find(r => r.workshopId.toString() !== workshopId.toString());
    if (wrongWorkshop)
      return res.status(400).json({ success: false, message: `Selected registration does not belong to this workshop (${wrongWorkshop.fullName}).` });

    const notApproved = regs.find(r => r.registrationStatus !== 'Approved');
    if (notApproved)
      return res.status(400).json({ success: false, message: `Only approved registrations can be added to a batch. "${notApproved.fullName}" is not approved.` });

    // Validate status value
    const validStatuses = ['Draft', 'Scheduled', 'Active', 'Completed', 'Cancelled', 'Archived'];
    const batchStatus = status && validStatuses.includes(status) ? status : 'Draft';

    const existing = await WorkshopBatch.findOne({ batchCode: batchCode.trim() });
    if (existing) return res.status(409).json({ success: false, message: 'Batch code already exists.' });

    // ═══════════════════════════════════════════════════════════════════
    // CRITICAL: Populate students[] from registration userId fields
    // Without this, trainees won't be able to see their sessions
    // because the API queries { students: userId } to find batches.
    // ═══════════════════════════════════════════════════════════════════
    const regDocs = await WorkshopPublicRegistration.find({ _id: { $in: uniqueRegIds } })
      .select('userId')
      .lean();
    const userIds = regDocs
      .filter(r => r.userId)
      .map(r => r.userId.toString());

    const batchData = {
      workshopId,
      batchName: batchName.trim(),
      batchCode: batchCode.trim(),
      registrationIds: uniqueRegIds,
      students: userIds, // ← CRITICAL: populated from registration.userId
      trainer: trainer || '',
      startDate: sd,
      endDate: endDate ? new Date(endDate) : null,
      startTime: startTime ? startTime.trim() : '',
      endTime: endTime ? endTime.trim() : '',
      mode: mode || 'Online',
      capacity: cap,
      status: batchStatus,
      notes: notes || '',
      createdBy: req.user._id,
    };

    const batch = await WorkshopBatch.create(batchData);

    return res.status(201).json({ success: true, message: 'Batch created successfully.', data: batch });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Batch code already exists.' });
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/workshops/batches — all batches (admin) or trainer's own batches
router.get('/batches', protect, authorize('admin', 'trainer'), async (req, res) => {
  try {
    const { workshopId, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (workshopId && isValidId(workshopId)) filter.workshopId = workshopId;
    // Trainers only see their own batches
    if (req.user.role === 'trainer') filter.trainerId = req.user._id;
    const skip = (Number(page) - 1) * Number(limit);
    const total = await WorkshopBatch.countDocuments(filter);
    const batches = await WorkshopBatch.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('workshopId', 'title date mode')
      .populate('trainerId', 'name email')
      .lean();
    const result = batches.map(b => ({ ...b, traineeCount: b.registrationIds?.length || 0 }));
    return res.json({ success: true, data: { batches: result, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/workshops/batches/:batchId — single batch by ID (admin or assigned trainer)
router.get('/batches/:batchId', protect, authorize('admin', 'trainer'), async (req, res) => {
  try {
    if (!isValidId(req.params.batchId))
      return res.status(400).json({ success: false, message: 'Invalid batch ID.' });
    const batch = await WorkshopBatch.findById(req.params.batchId)
      .populate('workshopId', 'title date mode')
      .populate('trainerId', 'name email')
      .populate('registrationIds', 'fullName email phone whatsapp college qualification city state registrationStatus registrationDate')
      .lean();
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });
    // Trainer access control — only assigned trainer can view
    if (req.user.role === 'trainer' && (!batch.trainerId || batch.trainerId._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Forbidden — you are not assigned to this batch.' });
    }
    return res.json({ success: true, data: batch });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/workshops/batches/:batchId — update batch
router.put('/batches/:batchId', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.batchId)) return res.status(400).json({ success: false, message: 'Invalid batch ID.' });
    const { batchCode, startDate, endDate, startTime, endTime, capacity, registrationIds, status } = req.body;

     if (endDate && startDate && new Date(endDate) < new Date(startDate))
       return res.status(400).json({ success: false, message: 'End date cannot be before start date.' });

    if (startDate) {
      const dateCheck = rejectPastDate(startDate, 'Batch start date');
      if (!dateCheck.ok) return res.status(400).json({ success: false, message: dateCheck.message });
      if (startTime) {
        const dtCheck = rejectPastDateTime(startDate, startTime, 'Batch start date/time');
        if (!dtCheck.ok) return res.status(400).json({ success: false, message: dtCheck.message });
      }
    }

    if (startTime) {
      const stErr = validateTime(startTime, 'start time');
      if (stErr) return res.status(400).json({ success: false, message: stErr });
    }
    if (endTime) {
      const etErr = validateTime(endTime, 'end time');
      if (etErr) return res.status(400).json({ success: false, message: etErr });
    }
    if (startTime && endTime && TIME_RE.test(startTime) && TIME_RE.test(endTime)) {
      if (timeToMinutes(endTime) <= timeToMinutes(startTime))
        return res.status(400).json({ success: false, message: 'End time must be later than start time.' });
    }

    if (capacity !== undefined && capacity !== '' && capacity !== null) {
      const rawCap = Number(capacity);
      if (!Number.isInteger(rawCap) || rawCap <= 0)
        return res.status(400).json({ success: false, message: 'Maximum seats must be a positive whole number.' });
    }

    if (status) {
      const validStatuses = ['Draft', 'Scheduled', 'Active', 'Completed', 'Cancelled', 'Archived'];
      if (!validStatuses.includes(status))
        return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}.` });
    }

    if (batchCode) {
      const conflict = await WorkshopBatch.findOne({ batchCode: batchCode.trim(), _id: { $ne: req.params.batchId } });
      if (conflict) return res.status(409).json({ success: false, message: 'Batch code already exists.' });
    }

    const cap = capacity !== undefined && capacity !== '' ? Number(capacity) : undefined;
    if (cap !== undefined && cap > 0 && registrationIds && registrationIds.length > cap)
      return res.status(400).json({ success: false, message: 'Batch capacity cannot be less than selected trainee count.' });

    const batch = await WorkshopBatch.findByIdAndUpdate(req.params.batchId, { $set: req.body }, { new: true, runValidators: true })
      .populate('workshopId', 'title date mode');
    if (!batch) return res.status(404).json({ success: false, message: 'Workshop Batch not found.' });
    return res.json({ success: true, data: batch });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Batch code already exists.' });
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/workshops/batches/:batchId — admin deletes a batch
router.delete('/batches/:batchId', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.batchId))
      return res.status(400).json({ success: false, message: 'Invalid batch ID.' });
    const batch = await WorkshopBatch.findByIdAndDelete(req.params.batchId);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found.' });
    return res.json({ success: true, message: 'Batch deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/workshops — admin creates workshop
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { title, date } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });
    if (!date)  return res.status(400).json({ success: false, message: 'date is required' });

    const resolvedDate = new Date(date);
    if (isNaN(resolvedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date.' });
    }
    const pastCheck = rejectPastDateTime(date, req.body.time, 'Workshop date/time');
    if (!pastCheck.ok) return res.status(400).json({ success: false, message: pastCheck.message });

    let resolvedTrainerId = req.body.trainerId || req.user._id;

    if (!isValidId(resolvedTrainerId)) resolvedTrainerId = req.user._id;

    let trainerName = req.body.trainerName || '';
    if (!trainerName) {
      const trainer = await User.findById(resolvedTrainerId).select('name').lean();
      trainerName = trainer?.name || '';
    }

    const maxSeats = (function validateAndParseMaxSeats(raw) {
      if (raw === null || raw === undefined) {
        throw Object.assign(new Error('Maximum seats must be a positive whole number.'), { statusCode: 400 });
      }

      const s = String(raw).trim();
      if (!s) {
        throw Object.assign(new Error('Maximum seats must be a positive whole number.'), { statusCode: 400 });
      }

      if (!/^[1-9]\d*$/.test(s)) {
        throw Object.assign(new Error('Maximum seats must be a positive whole number.'), { statusCode: 400 });
      }

      return Number(s);
    })(req.body.maxSeats);

    const isPublished = req.body.status === 'Published';


    const workshop = await Workshop.create({
      ...req.body,
      trainerId:         resolvedTrainerId,
      trainerName,
      createdBy:         req.user._id,
      maxSeats,
      availableSeats:    maxSeats,
      registrationCount: 0,
      isFree:            req.body.feeType !== 'Paid',
      published:         isPublished,
      registrationOpen:  isPublished,
      startDate:         req.body.startDate || req.body.date,
      endDate:           req.body.endDate   || req.body.date,
    });

    await workshop.populate('trainerId', 'name email');
    return res.status(201).json({ success: true, data: workshop });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/workshops/attendance/admin — admin view of all workshop attendance
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/attendance/admin', protect, authorize('admin'), async (req, res) => {
  try {
    const { workshopId, batchId, page = 1, limit = 500 } = req.query;
    const filter = {};
    if (workshopId && isValidId(workshopId)) filter.workshopId = workshopId;
    if (batchId   && isValidId(batchId))    filter.workshopBatchId = batchId;
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await WorkshopAttendance.countDocuments(filter);
    const records = await WorkshopAttendance.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('studentId', 'name email')
      .populate('workshopId', 'title date')
      .populate('sessionId',  'title scheduledAt')
      .lean();
    return res.json({ success: true, records, total });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/workshops/:id — single workshop (public) — AFTER all named routes
router.get('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid workshop ID' });

    const workshop = await Workshop.findById(req.params.id)
      .populate('trainerId', 'name email profilePicture bio')
      .lean();

    if (!workshop)
      return res.status(404).json({ success: false, message: 'Workshop not found' });

    return res.json({ success: true, data: workshop });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/workshops/:id — admin updates workshop
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid ID' });

    const existing = await Workshop.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Workshop not found' });

    const updates = { ...req.body };
    if (updates.date) {
      const resolvedDate = new Date(updates.date);
      if (isNaN(resolvedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date.' });
      }
      const pastCheck = rejectPastDateTime(updates.date, updates.time, 'Workshop date/time');
      if (!pastCheck.ok) return res.status(400).json({ success: false, message: pastCheck.message });
    }

    if (updates.status === 'Published') { updates.published = true; updates.registrationOpen = true; }
    if (updates.status === 'Archived' || updates.status === 'Cancelled') { updates.published = false; updates.registrationOpen = false; }

    if (updates.maxSeats !== undefined) {
      const s = String(updates.maxSeats).trim();
      if (!s || !/^[1-9]\d*$/.test(s)) {
        return res.status(400).json({ success: false, message: 'Maximum seats must be a positive whole number.' });
      }

      const nextMaxSeats = Number(s);

      if (nextMaxSeats !== existing.maxSeats) {
        const diff = nextMaxSeats - existing.maxSeats;
        updates.availableSeats = Math.max(0, existing.availableSeats + diff);
      }

      updates.maxSeats = nextMaxSeats;
    }


    if (updates.trainerId && updates.trainerId !== String(existing.trainerId)) {
      const trainer = await User.findById(updates.trainerId).select('name').lean();
      updates.trainerName = trainer?.name || updates.trainerName || '';
    }

    const workshop = await Workshop.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('trainerId', 'name email');

    return res.json({ success: true, data: workshop });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/workshops/:id — admin deletes workshop
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid ID' });

    const workshop = await Workshop.findByIdAndDelete(req.params.id);
    if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found' });

    return res.json({ success: true, message: 'Workshop deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
