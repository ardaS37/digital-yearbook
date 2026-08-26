const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { BACKUP_DIR, DB_PATH, UPLOAD_DIR, GALLERY_UPLOAD_DIR, CLASS_COVER_UPLOAD_DIR, ROOT_DIR } = require('../config');
const { checkpointDatabase } = require('../db');

function ensureBackupDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    return;
  }
  fs.mkdirSync(target, { recursive: true });
  fs.readdirSync(source, { withFileTypes: true }).forEach((entry) => {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      return;
    }
    fs.copyFileSync(sourcePath, targetPath);
  });
}

function createBackup() {
  ensureBackupDir();
  checkpointDatabase('TRUNCATE');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `backup-${stamp}`;
  const outDir = path.join(BACKUP_DIR, name);
  fs.mkdirSync(outDir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, path.join(outDir, 'yearbook.db'));
  }
  copyDirectory(UPLOAD_DIR, path.join(outDir, 'photos'));
  copyDirectory(GALLERY_UPLOAD_DIR, path.join(outDir, 'gallery'));
  copyDirectory(CLASS_COVER_UPLOAD_DIR, path.join(outDir, 'class-covers'));

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        name,
        createdAt: new Date().toISOString(),
        rootDir: ROOT_DIR,
        dbPath: DB_PATH
      },
      null,
      2
    )
  );

  return {
    name,
    absolutePath: outDir
  };
}

function normalizeBackupName(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return normalized || `backup-${Date.now()}`;
}

function ensureUniqueBackupName(name) {
  let candidate = normalizeBackupName(name);
  let counter = 1;
  while (fs.existsSync(path.join(BACKUP_DIR, candidate))) {
    counter += 1;
    candidate = `${normalizeBackupName(name)}-${counter}`;
  }
  return candidate;
}

function findImportedBackupRoot(extractDir) {
  const directDbPath = path.join(extractDir, 'yearbook.db');
  if (fs.existsSync(directDbPath)) {
    return extractDir;
  }

  const candidates = fs
    .readdirSync(extractDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(extractDir, entry.name))
    .filter((candidate) => fs.existsSync(path.join(candidate, 'yearbook.db')));

  if (candidates.length !== 1) {
    throw new Error('Yedek arşivi doğrulanamadı.');
  }

  return candidates[0];
}

function validateArchiveEntries(archivePath) {
  const listing = execFileSync('tar', ['-tzf', archivePath], { encoding: 'utf8' });
  const entries = listing
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!entries.length) {
    throw new Error('Yedek arşivi boş.');
  }

  entries.forEach((entry) => {
    if (entry.startsWith('/') || entry.includes('..\\') || entry.includes('../')) {
      throw new Error('Yedek arşivi güvenli olmayan dosya yolları içeriyor.');
    }
  });
}

function importBackupArchive(archivePath) {
  ensureBackupDir();
  const extractDir = fs.mkdtempSync(path.join(BACKUP_DIR, 'import-'));

  try {
    validateArchiveEntries(archivePath);
    execFileSync('tar', ['-xzf', archivePath, '-C', extractDir]);
    const sourceRoot = findImportedBackupRoot(extractDir);
    const manifestPath = path.join(sourceRoot, 'manifest.json');
    let manifest = null;

    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (error) {
        manifest = null;
      }
    }

    const requestedName = manifest && manifest.name ? manifest.name : path.basename(sourceRoot);
    const backupName = ensureUniqueBackupName(requestedName);
    const backupPath = path.join(BACKUP_DIR, backupName);

    fs.mkdirSync(backupPath, { recursive: true });
    copyDirectory(sourceRoot, backupPath);

    if (!fs.existsSync(path.join(backupPath, 'manifest.json'))) {
      fs.writeFileSync(
        path.join(backupPath, 'manifest.json'),
        JSON.stringify(
          {
            name: backupName,
            createdAt: new Date().toISOString(),
            importedAt: new Date().toISOString(),
            rootDir: ROOT_DIR,
            dbPath: DB_PATH
          },
          null,
          2
        )
      );
    }

    return {
      name: backupName,
      absolutePath: backupPath
    };
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true });
    if (archivePath.startsWith(os.tmpdir())) {
      fs.rmSync(archivePath, { force: true });
    }
  }
}

function restoreBackup(name) {
  const backupPath = path.join(BACKUP_DIR, name);
  const dbBackup = path.join(backupPath, 'yearbook.db');

  if (!fs.existsSync(dbBackup)) {
    throw new Error('Backup database not found.');
  }

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.copyFileSync(dbBackup, DB_PATH);
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  fs.rmSync(GALLERY_UPLOAD_DIR, { recursive: true, force: true });
  fs.rmSync(CLASS_COVER_UPLOAD_DIR, { recursive: true, force: true });
  copyDirectory(path.join(backupPath, 'photos'), UPLOAD_DIR);
  copyDirectory(path.join(backupPath, 'gallery'), GALLERY_UPLOAD_DIR);
  copyDirectory(path.join(backupPath, 'class-covers'), CLASS_COVER_UPLOAD_DIR);

  return {
    name,
    absolutePath: backupPath
  };
}

function listBackups() {
  ensureBackupDir();
  return fs
    .readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const backupPath = path.join(BACKUP_DIR, entry.name);
      const manifestPath = path.join(backupPath, 'manifest.json');
      let manifest = null;
      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch (error) {
          manifest = null;
        }
      }

      return {
        name: entry.name,
        absolutePath: backupPath,
        createdAt: manifest && manifest.createdAt ? manifest.createdAt : fs.statSync(backupPath).mtime.toISOString()
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function getBackupPath(name) {
  return path.join(BACKUP_DIR, name);
}

function createBackupArchive(name) {
  const backupPath = getBackupPath(name);
  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup not found.');
  }

  const archivePath = path.join(BACKUP_DIR, `${name}.tar.gz`);
  execFileSync('tar', ['-czf', archivePath, '-C', BACKUP_DIR, name]);
  return archivePath;
}

function deleteBackup(name) {
  const backupPath = getBackupPath(name);
  if (!fs.existsSync(backupPath)) {
    throw new Error('Yedek bulunamadı.');
  }

  fs.rmSync(backupPath, { recursive: true, force: true });
  fs.rmSync(path.join(BACKUP_DIR, `${name}.tar.gz`), { force: true });

  return {
    name,
    absolutePath: backupPath
  };
}

module.exports = {
  createBackup,
  importBackupArchive,
  restoreBackup,
  listBackups,
  getBackupPath,
  createBackupArchive,
  deleteBackup
};
