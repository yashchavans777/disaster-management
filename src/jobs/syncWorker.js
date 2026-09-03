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
      await simulateOfflineSync();
    } catch (error) {
      process.stderr.write(`Offline sync worker failed: ${error.message}\n`);
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