const fs = require('fs');
const path = require('path');
const { db, initializeSchema } = require('../src/db');
const { ROOT_DIR } = require('../src/config');

initializeSchema();

const outDir = path.join(ROOT_DIR, 'docs', 'offline-export');
fs.mkdirSync(outDir, { recursive: true });

const users = db
  .prepare('SELECT id, name, student_number, role, class_branch, photo_path, slogan, created_at, updated_at FROM users ORDER BY role, class_branch, name')
  .all();

const messages = db
  .prepare('SELECT id, from_user_id, to_user_id, message, created_at, updated_at FROM messages ORDER BY created_at ASC')
  .all();

const galleryPhotos = db
  .prepare('SELECT id, uploader_user_id, section, class_branch, photo_path, caption, date_stamp_text, created_at FROM gallery_photos ORDER BY created_at ASC')
  .all();

const exportData = {
  generated_at: new Date().toISOString(),
  users,
  messages,
  galleryPhotos
};

fs.writeFileSync(path.join(outDir, 'yearbook-data.json'), JSON.stringify(exportData, null, 2));

const uploadsSource = path.join(ROOT_DIR, 'uploads', 'photos');
const uploadsTarget = path.join(outDir, 'photos');
fs.mkdirSync(uploadsTarget, { recursive: true });

if (fs.existsSync(uploadsSource)) {
  const files = fs.readdirSync(uploadsSource);
  files.forEach((file) => {
    fs.copyFileSync(path.join(uploadsSource, file), path.join(uploadsTarget, file));
  });
}

const gallerySource = path.join(ROOT_DIR, 'uploads', 'gallery');
const galleryTarget = path.join(outDir, 'gallery');
fs.mkdirSync(galleryTarget, { recursive: true });

if (fs.existsSync(gallerySource)) {
  const files = fs.readdirSync(gallerySource);
  files.forEach((file) => {
    fs.copyFileSync(path.join(gallerySource, file), path.join(galleryTarget, file));
  });
}

console.log(`Offline export generated at: ${outDir}`);
