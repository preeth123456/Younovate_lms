// src/models/LmsAssessment.js
// ADDITIVE module/final assessment model for LMS courses.
// Coexists with Assignment (session/file workflow) — nothing in Assignment changes.
// Module key = Course subject (trimesters→months→subjects) _id string or
// lmsModuleId string; scope 'final' rows use moduleKey 'FINAL'.
// questions[] preserves trainer creation order; each entry is EITHER:
//   { type:'mcq', question, options[], correctAnswer, score }  (auto-graded)
//   { type:'practical', task, instructions, score }              (trainer-reviewed)
// Per-trainee answers/scores live in submissions[].answers[] keyed by
// questionId so individual + theory/practical/module totals never leak
// across modules, questions, or trainees.
'use strict';
const mongoose = require('mongoose');

const STATUS = ['NOT_ASSIGNED', 'PENDING', 'SUBMITTED', 'COMPLETED'];

const questionSchema = new mongoose.Schema({
  type:          { type: String, enum: ['mcq', 'practical'], required: true },
  // mcq fields
  question:      { type: String, default: '', trim: true },
  options:       { type: [String], default: [] },
  correctAnswer: { type: Number }, // index into options; never sent to trainees pre-submit
  // practical fields
  task:          { type: String, default: '', trim: true },
  instructions:  { type: String, default: '', trim: true },
  score:         { type: Number, default: 0, min: 0 },
}, { timestamps: false });

const answerSchema = new mongoose.Schema({
  questionId:           { type: mongoose.Schema.Types.ObjectId, required: true },
  // mcq answer
  selected:             { type: Number },
  correct:              { type: Boolean },
  score:                { type: Number, default: 0, min: 0 },
  // practical answer
  practicalAnswer:      { type: String, default: '' },
  practicalFileUrl:     { type: String, default: '' },
  practicalFileName:    { type: String, default: '' },
  practicalScore:       { type: Number, default: 0, min: 0 },
  practicalReviewed:    { type: Boolean, default: false },
  practicalReviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  practicalReviewedAt:  { type: Date },
}, { _id: false });

const submissionSchema = new mongoose.Schema({
  trainee:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:        { type: String, enum: STATUS, default: 'PENDING' },
  answers:       { type: [answerSchema], default: [] },
  // roll-ups (recomputed on every write; moduleTotal = theory + practical)
  theoryScore:    { type: Number, default: 0, min: 0 },
  practicalScore: { type: Number, default: 0, min: 0 },
  moduleTotal:    { type: Number, default: 0, min: 0 },
  // legacy single-question fields (kept so old docs still read; new writes use answers[])
  theorySelected:  { type: Number },
  theoryCorrect:   { type: Boolean },
  practicalAnswer: { type: String, default: '' },
  practicalFileUrl: { type: String, default: '' },
  practicalFileName: { type: String, default: '' },
  practicalReviewed:    { type: Boolean, default: false },
  practicalReviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  practicalReviewedAt:  { type: Date },
  submittedAt:   { type: Date },
  completedAt:   { type: Date },
}, { timestamps: true });

const lmsAssessmentSchema = new mongoose.Schema({
  courseId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  // moduleKey: subject _id string, lmsModuleId string, or 'FINAL' for course-final.
  moduleKey:   { type: String, required: true, trim: true },
  moduleName:  { type: String, default: '', trim: true },
  scope:       { type: String, enum: ['module', 'final'], default: 'module' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  batchId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  questions:   { type: [questionSchema], default: [] },
  // legacy single-question fields (kept so old docs still read; new writes use questions[])
  theory:      {
    question: { type: String, default: '', trim: true },
    options: { type: [String], default: [] },
    correctAnswer: { type: Number, default: -1 },
    score: { type: Number, default: 0, min: 0 },
  },
  practical:   {
    task: { type: String, default: '', trim: true },
    instructions: { type: String, default: '', trim: true },
    score: { type: Number, default: 0, min: 0 },
  },
  submissions: { type: [submissionSchema], default: [] },
}, { timestamps: true });

lmsAssessmentSchema.index({ courseId: 1, moduleKey: 1, scope: 1 }, { unique: true });
lmsAssessmentSchema.index({ courseId: 1, createdBy: 1 });
lmsAssessmentSchema.index({ 'submissions.trainee': 1 });

module.exports = mongoose.models.LmsAssessment || mongoose.model('LmsAssessment', lmsAssessmentSchema);

