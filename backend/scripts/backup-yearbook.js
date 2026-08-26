const { createBackup } = require('../src/services/backupService');
const { withMaintenanceState } = require('../src/utils/maintenance');

try {
  const backup = withMaintenanceState(
    {
      source: 'script',
      reason: 'backup_create',
      message: 'CLI üzerinden yedek oluşturuluyor.'
    },
    () => createBackup()
  );
  console.log(`Backup created: ${backup.absolutePath}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
