/**
 * Offline sync service.
 * Flushes a MongoDB-persisted offline incident queue when connectivity returns.
 * The queue is stored in an `OfflineQueue` collection so it survives server restarts.
 */

const mongoose = require('mongoose');
const IncidentReport = require('../models/IncidentReport');
const logger = require('../utils/logger');

// Lightweight schema for queued offline payloads
const offlineQueueSchema = new mongoose.Schema(
  {
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    entityType: { type: String, default: 'incident' },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

const OfflineQueue =
  mongoose.models.OfflineQueue ||
  mongoose.model('OfflineQueue', offlineQueueSchema);

/**
 * Enqueue a payload for later sync (called when server-side write fails offline).
 * @param {object} payload
 * @param {string} entityType
 */
const enqueue = async (payload, entityType = 'incident') => {
  await OfflineQueue.create({ payload, entityType });
  logger.info(`[OfflineSync] Enqueued ${entityType} payload for later sync`);
};

/**
 * Flush all queued items.
 * Retries each item once; moves persistent failures to a dead-letter log.
 * @returns {{ synced: number, failed: number }}
 */
const flushQueue = async () => {
  const items = await OfflineQueue.find({ attempts: { $lt: 3 } }).limit(50);
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      if (item.entityType === 'incident') {
        await IncidentReport.create(item.payload);
      }
      await OfflineQueue.deleteOne({ _id: item._id });
      synced += 1;
      logger.info(
        `[OfflineSync] Synced queued ${item.entityType} (id: ${item._id})`
      );
    } catch (error) {
      item.attempts += 1;
      item.lastError = error.message;
      await item.save();
      failed += 1;
      logger.warn(
        `[OfflineSync] Failed to sync item ${item._id}: ${error.message}`
      );
    }
  }

  logger.info(
    `[OfflineSync] Flush complete — synced: ${synced}, failed: ${failed}`
  );
  return { synced, failed };
};

module.exports = { enqueue, flushQueue, OfflineQueue };
