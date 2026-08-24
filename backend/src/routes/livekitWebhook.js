// src/routes/livekitWebhook.js
'use strict';
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { webhookReceiver } = require('../services/livekitService');
const Session   = require('../models/Session');
const Recording = require('../models/Recording');
const {
  RECORDINGS_DIR,
  normalizeRelPath,
  resolveEgressFileUrl,
  reconcileRecordingByEgressId,
  fileExistsForRelPath,
  ensureMp4WebPlayable,
  finalizeRecordingRemote,
  defaultRecordingStorage,
} = require('../utils/recordingStorage');

const router = express.Router();

const TERMINAL_EGRESS_STATUSES = new Set([
  'EGRESS_COMPLETE',
  'EGRESS_FAILED',
  'EGRESS_ABORTED',
]);

async function ensureRecording(egressId, roomName) {
  if (!egressId) return null;
  let recording = await Recording.findOne({ egressId }).lean();
  if (recording) return recording;

  const session = await Session.findOne({
    $or: [{ egressId }, { roomName }],
  }).select('_id trainerId batchId sessionType recordings startedAt roomName').lean();

  if (!session) return null;

  recording = await Recording.create({
    sessionId: session._id,
    batchId:   session.batchId,
    trainerId: session.trainerId,
    egressId,
    roomName:  roomName || session.roomName,
    status:    'processing',
    storage:   defaultRecordingStorage(),
    startedAt: session.startedAt || new Date(),
  });

  await Session.findByIdAndUpdate(session._id, {
    $addToSet: { recordings: recording._id },
  });

  return recording;
}

function buildUpdateFromEvent(eg, resolved) {
  const file = eg.fileResults?.[0] || {};
  const durationSeconds = file.duration ? Math.round(Number(file.duration) / 1e9) : 0;
  const sizeBytes       = file.size ? Number(file.size) : 0;

  return {
    update: {
      url: resolved.url || '',
      filename: resolved.filename || normalizeRelPath(file.filename || ''),
      storage: resolved.storage || defaultRecordingStorage(),
      durationSeconds,
      sizeBytes,
    },
    durationSeconds,
    sizeBytes,
  };
}

function tryFastStartMp4(filePath) {
  ensureMp4WebPlayable(filePath);
}

router.post('/', async (req, res) => {
  try {
    const event = await webhookReceiver.receive(req.body, req.get('Authorization'));
    const eg = event.egressInfo;

    if (!eg) {
      res.status(200).send('ok');
      return;
    }

    const file = eg.fileResults?.[0] || {};
    const resolved = resolveEgressFileUrl(file);
    const isTerminal = event.event === 'egress_ended' || TERMINAL_EGRESS_STATUSES.has(eg.status);

    if (isTerminal) {
      const relPath = resolved.storage === 'local' ? resolved.filename : '';
      const filePath = relPath ? path.join(RECORDINGS_DIR, relPath) : '';
      const fileExists = relPath ? fileExistsForRelPath(relPath) : false;
      const s3Ready = resolved.storage === 's3' && resolved.url;

      const { update, durationSeconds, sizeBytes } = buildUpdateFromEvent(eg, resolved);
      update.endedAt = new Date();

      if (s3Ready) {
        update.status = 'completed';
        update.error  = '';
      } else if (fileExists) {
        ensureMp4WebPlayable(filePath);
        update.status = 'completed';
        update.error  = '';
      } else {
        update.status = 'processing';
        update.error  = '';
      }

      let recording = await Recording.findOneAndUpdate(
        { egressId: eg.egressId },
        { $set: update },
        { new: true }
      );

      if (!recording) {
        await ensureRecording(eg.egressId, eg.roomName);
        recording = await Recording.findOneAndUpdate(
          { egressId: eg.egressId },
          { $set: update },
          { new: true }
        );
      }

      let finalRec = recording;
      if (s3Ready && recording) {
        finalRec = await finalizeRecordingRemote(recording, {
          url: resolved.url,
          filename: resolved.filename,
          storage: 's3',
          sizeBytes,
          durationSeconds,
          endedAt: update.endedAt,
        }) || recording;
      } else {
        const reconciled = await reconcileRecordingByEgressId(eg.egressId, { maxAttempts: 3, delayMs: 1000 });
        finalRec = reconciled || recording;
      }

      if (finalRec && (finalRec.status === 'completed' || fileExists || s3Ready)) {
        const playUrl = finalRec.url || resolved.url;
        await Session.findOneAndUpdate(
          { $or: [{ egressId: eg.egressId }, { roomName: eg.roomName }] },
          { recordingUrl: playUrl, recordingStatus: 'available', egressId: '' }
        );
        console.log('Recording saved →', playUrl, `(${durationSeconds}s, ${sizeBytes} bytes)`, finalRec._id);

        if (filePath && fs.existsSync(filePath)) {
          setImmediate(() => tryFastStartMp4(filePath));
        }
      } else {
        console.error('Recording file missing after egress ended →', filePath || resolved.filename, 'egressId:', eg.egressId);
      }
    } else {
      const { update } = buildUpdateFromEvent(eg, resolved);
      await Recording.findOneAndUpdate(
        { egressId: eg.egressId },
        { $set: update },
        { new: true }
      );
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).send('ok');
  }
});

module.exports = router;
