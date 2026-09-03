const simulateOfflineSync = async () => {
  const queuedOfflineRecords = [
    { entity: 'shipment', action: 'update', status: 'in-transit' },
    { entity: 'incident', action: 'create', severity: 'moderate' },
  ];

  await new Promise((resolve) => setTimeout(resolve, 300));

  return queuedOfflineRecords.map((record) => ({
    ...record,
    syncedAt: new Date().toISOString(),
    syncStatus: 'synced',
  }));
};

const startSyncWorker = () => {
  const triggerSync = async () => {
    try {
      const syncedRecords = await simulateOfflineSync();
      console.log(`Offline sync completed for ${syncedRecords.length} record(s).`);
    } catch (error) {
      console.error('Offline sync worker failed:', error.message);
    }
  };

  setTimeout(triggerSync, 1000);

  return {
    triggerSync,
  };
};

module.exports = {
  startSyncWorker,
  simulateOfflineSync,
};