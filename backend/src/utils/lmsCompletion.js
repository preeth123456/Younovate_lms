// src/utils/lmsCompletion.js
// Single source of truth for LMS full-course completion used by certificate
// eligibility. Mirrors the existing trainee progress aggregation
// (GET /api/trainee/progress in traineeRoutes.js):
//   - prefer Enrollment record (progressPercent / status === 'completed')
//   - else aggregate LessonProgress (completed === total, total > 0)
// A single completed session NEVER counts as course completion.
'use strict';

const Enrollment = require('../models/Enrollment');
const LessonProgress = require('../models/LessonProgress');

async function isLmsCourseCompleted(studentId, courseId) {
  if (!studentId || !courseId) return { completed: false, reason: 'missing ids' };
  try {
    const enrollment = await Enrollment.findOne({ student: studentId, course: courseId })
      .select('status progressPercent')
      .lean();
    if (enrollment) {
      if (String(enrollment.status || '').toLowerCase() === 'completed') {
        return { completed: true, source: 'enrollment-status' };
      }
      if (Number(enrollment.progressPercent) >= 100) {
        return { completed: true, source: 'enrollment-percent' };
      }
      return {
        completed: false,
        source: 'enrollment',
        progressPercent: Number(enrollment.progressPercent) || 0,
      };
    }
    const total = await LessonProgress.countDocuments({ student: studentId, course: courseId });
    if (!total) return { completed: false, reason: 'no lessons tracked' };
    const done = await LessonProgress.countDocuments({
      student: studentId,
      course: courseId,
      status: 'completed',
    });
    return {
      completed: done >= total && total > 0,
      source: 'lesson-progress',
      completedLessons: done,
      totalLessons: total,
    };
  } catch (err) {
    return { completed: false, reason: err?.message || 'lookup failed' };
  }
}

module.exports = { isLmsCourseCompleted };
