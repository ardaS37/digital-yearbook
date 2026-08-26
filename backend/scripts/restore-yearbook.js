const { restoreBackup } = require('../src/services/backupService');
const { closeDatabase } = require('../src/db');
const { clearMaintenanceState, setMaintenanceState } = require('../src/utils/maintenance');

const backupPath = process.argv[2];
if (!backupPath) {
  console.error('Usage: node scripts/restore-yearbook.js <backup-directory>');
  process.exit(1);
}

const name = backupPath.split(/[\\/]/).filter(Boolean).pop();
try {
  setMaintenanceState({
    source: 'script',
    reason: 'backup_restore',
    message: 'CLI üzerinden yedek geri yükleniyor.'
  });
  closeDatabase();
  const restored = restoreBackup(name);
  clearMaintenanceState();
  console.log(`Backup restored from: ${restored.absolutePath}`);
  console.log('Restore tamamlandi. Bu komut uygulama servisi durdurulmusken calistirilmalidir.');
} catch (error) {
  clearMaintenanceState();
  console.error(error.message);
  process.exit(1);
}
