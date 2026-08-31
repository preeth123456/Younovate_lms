'use strict';
/**
 * Full project smoke + integration test suite.
 * Requires: backend running on PORT 8080, MongoDB connected via .env
 */
const { spawnSync } = require('child_process');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const API = `http://localhost:${process.env.PORT || 8080}`;
const ROOT = path.join(__dirname, '..', '..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');

const results = [];
const pass = (name, detail = '') => { results.push({ name, ok: true, detail }); console.log(`✅ PASS: ${name}${detail ? ` — ${detail}` : ''}`); };
const fail = (name, detail = '') => { results.push({ name, ok: false, detail }); console.error(`❌ FAIL: ${name}${detail ? ` — ${detail}` : ''}`); };

function runNode(script, cwd = BACKEND) {
  const r = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', timeout: 120000 });
  return { code: r.status ?? 1, out: (r.stdout || '') + (r.stderr || '') };
}

function runNpm(script, cwd) {
  const r = spawnSync('npm', ['run', script], { cwd, encoding: 'utf8', shell: true, timeout: 300000 });
  return { code: r.status ?? 1, out: (r.stdout || '') + (r.stderr || '') };
}

async function login(email, password) {
  const { data } = await axios.post(`${API}/api/auth/login`, { email, password }, { timeout: 15000 });
  return data.accessToken;
}

async function testHealth() {
  try {
    const { status } = await axios.get(`${API}/api/health`, { timeout: 5000 });
    if (status === 200) pass('Backend health', API);
    else fail('Backend health', `status ${status}`);
  } catch (e) {
    try {
      await axios.get(`${API}/api/workshops`, { timeout: 5000 });
      pass('Backend reachable', API);
    } catch (e2) {
      fail('Backend reachable', e2.message);
    }
  }
}

async function testAuth() {
  const accounts = [
    ['Admin login', 'admin@younovate.in', 'Admin@1234'],
    ['Trainer login', 'trainer@younovate.in', 'Trainer@1234'],
    ['Trainee login', 'trainee@younovate.in', 'Trainee@1234'],
  ];
  for (const [label, email, password] of accounts) {
    try {
      const token = await login(email, password);
      if (token) pass(label, email);
      else fail(label, 'no token');
    } catch (e) {
      fail(label, e.response?.data?.message || e.message);
    }
  }
}

async function testSessionStatusLogic() {
  const { effectiveSessionStatus } = require(path.join(BACKEND, 'src/utils/sessionStatusUtils'));
  const now = Date.parse('2026-08-31T12:00:00Z');
  const cases = [
    [{ status: 'completed', scheduledAt: '2026-08-31T10:00:00Z', durationMinutes: 240 }, 'completed'],
    [{ status: 'live', scheduledAt: '2026-08-31T10:00:00Z', durationMinutes: 240, endedAt: '2026-08-31T11:00:00Z' }, 'completed'],
    [{ status: 'live', scheduledAt: '2026-08-31T10:00:00Z', durationMinutes: 240 }, 'live'],
    [{ status: 'scheduled', scheduledAt: '2026-08-31T15:00:00Z', durationMinutes: 60 }, 'scheduled'],
  ];
  let ok = true;
  for (const [session, expect] of cases) {
    const got = effectiveSessionStatus(session, now);
    if (got !== expect) { ok = false; break; }
  }
  if (ok) pass('Session status unit logic');
  else fail('Session status unit logic');
}

async function testWorkshopEndFlow() {
  const mongoose = require('mongoose');
  const Session = require(path.join(BACKEND, 'src/models/Session'));
  const User = require(path.join(BACKEND, 'src/models/User'));
  const WorkshopBatch = require(path.join(BACKEND, 'src/models/WorkshopBatch'));

  await mongoose.connect(process.env.MONGODB_URI);
  const trainer = await User.findOne({ email: 'trainer@younovate.in' }).lean();
  const batch = await WorkshopBatch.findOne({ trainerId: trainer._id }).lean();
  if (!trainer || !batch) {
    fail('Workshop end flow', 'no trainer/batch');
    await mongoose.disconnect();
    return;
  }

  const created = await Session.create({
    sessionType: 'WORKSHOP',
    workshopBatchId: batch._id,
    title: `FullTest End ${Date.now()}`,
    scheduledAt: new Date(Date.now() - 5 * 60 * 1000),
    durationMinutes: 120,
    trainerId: trainer._id,
    status: 'scheduled',
    joinBeforeMinutes: 15,
  });
  const id = created._id.toString();
  const token = await login('trainer@younovate.in', 'Trainer@1234');
  const headers = { Authorization: `Bearer ${token}` };

  try {
    await axios.post(`${API}/api/workshop-sessions/${id}/start`, {}, { headers });
    await axios.post(`${API}/api/workshop-sessions/${id}/end`, {}, { headers });
    const { data } = await axios.get(`${API}/api/workshop-sessions/${id}`, { headers });
    const st = data.session?.status;
    if (st === 'completed') pass('Workshop end + refresh', id);
    else fail('Workshop end + refresh', `got ${st}`);
  } catch (e) {
    fail('Workshop end + refresh', e.response?.data?.message || e.message);
  }
  await mongoose.disconnect();
}

async function testTraineeFeedbackFlow() {
  const token = await login('trainee@younovate.in', 'Trainee@1234');
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const { data: list } = await axios.get(`${API}/api/trainee/workshop-sessions`, { headers });
    const { data: fb } = await axios.get(`${API}/api/trainee/workshop-sessions?forFeedback=1`, { headers });
    const { data: feedback } = await axios.get(`${API}/api/trainee/workshop-feedback`, { headers });
    pass('Trainee workshop sessions', `${list.sessions?.length || 0} sessions`);
    pass('Trainee feedback list', `${fb.sessions?.length || 0} eligible`);
    pass('Trainee feedback GET', `${feedback.feedback?.length || 0} records`);
  } catch (e) {
    fail('Trainee workshop/feedback APIs', e.response?.data?.message || e.message);
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  YOUNOVATE LMS — FULL PROJECT TEST SUITE');
  console.log('═'.repeat(60));
  console.log(`API: ${API}\n`);

  await testHealth();
  await testAuth();
  await testSessionStatusLogic();
  await testWorkshopEndFlow();
  await testTraineeFeedbackFlow();

  console.log('\n--- Backend API smoke (api-test.js) ---');
  const apiTest = runNode(path.join('scripts', 'api-test.js'));
  if (apiTest.code === 0) pass('API smoke test script');
  else fail('API smoke test script', apiTest.out.split('\n').slice(-3).join(' '));

  console.log('\n--- Trainer API smoke ---');
  const trainerTest = runNode(path.join('scripts', 'test-trainer-api.js'));
  if (trainerTest.code === 0) pass('Trainer API smoke');
  else fail('Trainer API smoke', trainerTest.out.split('\n').slice(-2).join(' '));

  console.log('\n--- Frontend production build ---');
  const build = runNpm('build', FRONTEND);
  if (build.code === 0 && build.out.includes('Compiled successfully')) pass('Frontend build');
  else fail('Frontend build', build.out.split('\n').filter(l => /error|fail/i.test(l)).slice(0, 3).join(' | ') || 'build failed');

  const failed = results.filter(r => !r.ok);
  console.log('\n' + '═'.repeat(60));
  console.log(`  RESULT: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('  FAILED:');
    failed.forEach(f => console.log(`    - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
  console.log('  ALL TESTS PASSED');
  console.log('═'.repeat(60));
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
