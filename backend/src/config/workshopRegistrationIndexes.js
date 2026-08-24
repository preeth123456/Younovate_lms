'use strict';

/**
 * Public landing-page registrations live in `workshopRegistrations` and use
 * workshopId + email (no studentId). A legacy unique index on
 * { workshopId, studentId } blocks every second registration for the same
 * workshop because studentId is null for all public rows.
 */
async function repairWorkshopPublicRegistrationIndexes(connection) {
  const collection = connection.collection('workshopRegistrations');
  const staleIndexName = 'workshopId_1_studentId_1';

  try {
    const indexes = await collection.indexes();
    const hasStale = indexes.some((idx) => idx.name === staleIndexName);
    if (!hasStale) return;

    await collection.dropIndex(staleIndexName);
    console.log(
      `✅ Dropped stale index ${staleIndexName} from workshopRegistrations (public registration fix)`
    );
  } catch (err) {
    // 27 = IndexNotFound (already removed)
    if (err.code === 27 || /index not found/i.test(err.message)) return;
    console.error(
      `⚠️  Could not drop stale ${staleIndexName} index on workshopRegistrations:`,
      err.message
    );
  }
}

module.exports = { repairWorkshopPublicRegistrationIndexes };
