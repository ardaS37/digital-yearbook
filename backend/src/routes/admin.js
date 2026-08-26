const fs = require('fs');
const os = require('os');
const path = require('path');
const process = require('process');
const { execFileSync } = require('child_process');
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const rateLimit = require('express-rate-limit');
const { db, closeDatabase, getActiveClassBranches, getAllClassBranches, isValidClassBranch } = require('../db');
const { requireAdmin, requireLogin } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { generateAccessCode, hashAccessCode, verifyAccessCode } = require('../utils/accessCode');
const { parseRowsFromExcel, normalizeStudentRows, normalizeTeacherRows } = require('../services/importService');
const {
  ROOT_DIR,
  UPLOAD_DIR,
  GALLERY_UPLOAD_DIR,
  CLASS_COVER_UPLOAD_DIR,
  MAX_UPLOAD_SIZE_BYTES,
  LOG_DIR,
  MAX_MESSAGE_LENGTH
} = require('../config');
const { normalizeName, stripHtml } = require('../utils/sanitize');
const { ensureLoginIdentifier } = require('../utils/loginIdentifier');
const { deleteFileIfExists } = require('../utils/files');
const { assertImageSignature, getSafeImageExtension, isAllowedImageMime } = require('../utils/uploadValidation');
const { writeAuditLog } = require('../utils/auditLog');
const { compressImage } = require('../utils/imageCompress');
const { createBackup, importBackupArchive, restoreBackup, listBackups, getBackupPath, createBackupArchive, deleteBackup } = require('../services/backupService');
const {
  CORE_FEATURE_DEFINITIONS,
  FEATURE_DEFINITIONS,
  GAME_MENU_DEFINITIONS,
  PROFILE_PHOTO_EDIT_MODES,
  featureSettingKey,
  buildFeatureFlags
} = require('../utils/features');
const { compareUsersTurkish } = require('../utils/sort');
const { getSettingValue, setSettingValue: _setSettingValue } = require('../utils/settings');
// getAppSetting / setAppSetting — eski isimler, settings.js'deki ile aynı işlev
const getAppSetting = getSettingValue;
const setAppSetting = _setSettingValue;
const { clearMaintenanceState, getMaintenanceState, withMaintenanceState, setMaintenanceState } = require('../utils/maintenance');
const { createInboxNotification } = require('../utils/inbox');
const { calculateProfileCompletion } = require('../utils/profileCompletion');
const { appendSchoolScope, canAccessSchool, getUserSchoolScope, isSchoolManager: canManageBySchoolRole } = require('../utils/schoolScope');
const { getYearbookLockState, setYearbookLockState } = require('../utils/yearbookLock');
const { validateContentText } = require('../utils/contentModeration');
const {
  applyApprovalRequest,
  canReviewContent,
  getContentApprovalLabel,
  isContentApprovalEnabled,
  parsePayload,
  setContentApprovalEnabled
} = require('../utils/contentApproval');

const router = express.Router();

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const profilePhotoStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = getSafeImageExtension(file.mimetype);
    cb(null, `admin-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});

const adminPhotoUpload = multer({
  storage: profilePhotoStorage,
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) {
      return cb(new Error('Yalnızca görsel dosyaları yüklenebilir.'));
    }
    return cb(null, true);
  }
});

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (!allowed.includes(file.mimetype) && !/\.xlsx?$/.test(file.originalname.toLowerCase())) {
      return cb(new Error('Yalnızca Excel dosyaları kabul edilir.'));
    }
    return cb(null, true);
  }
});

const archiveYearUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const isJsonMime = ['application/json', 'text/json', 'application/octet-stream'].includes(file.mimetype);
    const isJsonName = /\.json$/i.test(file.originalname || '');
    if (!isJsonMime && !isJsonName) {
      return cb(new Error('Yalnızca .json arşiv yılı dosyaları yüklenebilir.'));
    }
    return cb(null, true);
  }
});

const backupArchiveUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, os.tmpdir()),
    filename: (_, file, cb) => {
      const ext = file.originalname.toLowerCase().endsWith('.tgz') ? '.tgz' : '.tar.gz';
      cb(null, `yearbook-backup-import-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
    }
  }),
  limits: { fileSize: 250 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const isArchiveMime = [
      'application/gzip',
      'application/x-gzip',
      'application/octet-stream',
      'application/x-tar'
    ].includes(file.mimetype);
    const isArchiveName = /\.(tar\.gz|tgz)$/i.test(file.originalname || '');
    if (!isArchiveMime && !isArchiveName) {
      return cb(new Error('Yalnızca .tar.gz veya .tgz yedekleri yüklenebilir.'));
    }
    return cb(null, true);
  }
});

const adminWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çok fazla yönetim işlemi yapıldı. Lütfen biraz sonra tekrar deneyin.'
});

const adminExportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çok sık toplu export yapıldı. Lütfen daha sonra tekrar deneyin.'
});
const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMBEDDED_ASSET_CACHE = new Map();

function parseDetailsJson(payload) {
  try {
    return JSON.parse(payload || '{}');
  } catch (error) {
    return {};
  }
}

function parsePage(value) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function requireAdminAccessCode(req) {
  const accessCode = stripHtml(req.body.admin_access_code);
  if (!accessCode || !verifyAccessCode(accessCode, req.currentUser.access_code_hash)) {
    req.flash('error', 'Yönetici erişim kodu doğrulanamadı.');
    return false;
  }
  return true;
}

function requireContentReviewer(req, res, next) {
  if (!canReviewContent(req.currentUser)) {
    req.flash('error', 'İçerik onay yetkisi gereklidir.');
    return res.redirect('/');
  }
  return next();
}

function isSchoolManager(user) {
  return canManageBySchoolRole(user);
}

function requireSchoolManager(req, res, next) {
  if (!isSchoolManager(req.currentUser)) {
    req.flash('error', 'Okul yönetimi yetkisi gereklidir.');
    return res.redirect('/');
  }
  return next();
}

function normalizeSchoolSlug(value) {
  return stripHtml(value || '')
    .toLocaleLowerCase('tr')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `okul-${Date.now()}`;
}

function getVisibleSchools(user) {
  if (user && user.role === 'admin') {
    return db.prepare(
      `SELECT id, name, slug, theme_color, background_wallpaper_path, background_wallpaper_enabled, background_gradient_enabled, is_active
       FROM schools
       ORDER BY name COLLATE NOCASE ASC`
    ).all();
  }
  if (user && user.school_id) {
    return db.prepare(
      `SELECT id, name, slug, theme_color, background_wallpaper_path, background_wallpaper_enabled, background_gradient_enabled, is_active
       FROM schools
       WHERE id = ?`
    ).all(user.school_id);
  }
  return [];
}

function canManageSchool(user, schoolId) {
  if (!user || !schoolId) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  return isSchoolManager(user) && Number(user.school_id || 0) === Number(schoolId);
}

function getModerationSettings() {
  return {
    bannedWords: getSettingValue('moderation_banned_words', ''),
    blockLinks: getSettingValue('moderation_block_links', '1') !== '0',
    managerLinkBypass: getSettingValue('moderation_manager_link_bypass', '1') !== '0'
  };
}

function renderImportPage(req, res, extra = {}) {
  return res.render('admin/import', {
    title: 'Kullanıcı İçe Aktar',
    importedUsers: [],
    previewResult: null,
    schools: getVisibleSchools(req.currentUser),
    ...extra
  });
}

function stripImportHeader(rows, kind) {
  const nextRows = [...rows];
  if (!nextRows.length) return nextRows;
  const first = nextRows[0].map((cell) => String(cell || '').toLocaleLowerCase('tr'));
  const isStudentHeader =
    kind === 'students' &&
    (first[0].includes('name') || first[0].includes('ad')) &&
    (first[1].includes('student') || first[1].includes('öğrenci')) &&
    (first[2].includes('class') || first[2].includes('sınıf'));
  const isTeacherHeader =
    kind === 'teachers' &&
    (first[0].includes('name') || first[0].includes('ad'));
  if (isStudentHeader || isTeacherHeader) nextRows.shift();
  return nextRows;
}

function encodeImportPayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeImportPayload(value) {
  try {
    const decoded = JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
    if (!decoded || !['students', 'teachers'].includes(decoded.kind) || !Array.isArray(decoded.validRows)) {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
}

function buildImportPreview(kind, rows, schoolId) {
  const normalizedRows = stripImportHeader(rows, kind);
  const validRows = [];
  const errorRows = [];
  const conflictRows = [];
  const seenKeys = new Set();
  const existingStudents = kind === 'students'
    ? new Set(db.prepare("SELECT student_number FROM users WHERE role = 'student' AND school_id = ? AND student_number IS NOT NULL").all(schoolId).map((row) => String(row.student_number)))
    : new Set();
  const existingTeachers = kind === 'teachers'
    ? new Set(db.prepare("SELECT name FROM users WHERE role = 'teacher' AND school_id = ?").all(schoolId).map((row) => normalizeName(row.name).toLocaleLowerCase('tr')))
    : new Set();

  normalizedRows.forEach((row, index) => {
    const rowNumber = index + 1;
    if (kind === 'students') {
      const name = normalizeName(row[0]);
      const studentNumber = stripHtml(row[1]);
      const classBranch = stripHtml(row[2]).toUpperCase();
      const errors = [];
      if (!name) errors.push('Ad soyad zorunlu');
      if (!studentNumber) errors.push('Öğrenci numarası zorunlu');
      if (!classBranch) errors.push('Sınıf şubesi zorunlu');
      if (classBranch && !isValidClassBranch(classBranch)) errors.push(`Geçersiz sınıf şubesi: ${classBranch}`);
      if (errors.length) {
        errorRows.push({ rowNumber, values: row, reason: errors.join(', ') });
        return;
      }
      const key = studentNumber;
      if (seenKeys.has(key)) {
        conflictRows.push({ rowNumber, name, student_number: studentNumber, class_branch: classBranch, reason: 'Excel içinde tekrar eden öğrenci numarası' });
        return;
      }
      if (existingStudents.has(studentNumber)) {
        conflictRows.push({ rowNumber, name, student_number: studentNumber, class_branch: classBranch, reason: 'Bu okulda öğrenci numarası zaten kayıtlı' });
        return;
      }
      seenKeys.add(key);
      validRows.push({ rowNumber, name, student_number: studentNumber, class_branch: classBranch, role: 'student' });
      return;
    }

    const name = normalizeName(row[0]);
    if (!name) {
      errorRows.push({ rowNumber, values: row, reason: 'Ad soyad zorunlu' });
      return;
    }
    const key = name.toLocaleLowerCase('tr');
    if (seenKeys.has(key)) {
      conflictRows.push({ rowNumber, name, reason: 'Excel içinde tekrar eden öğretmen adı' });
      return;
    }
    if (existingTeachers.has(key)) {
      conflictRows.push({ rowNumber, name, reason: 'Bu okulda aynı adlı öğretmen zaten kayıtlı' });
      return;
    }
    seenKeys.add(key);
    validRows.push({ rowNumber, name, student_number: null, class_branch: null, role: 'teacher' });
  });

  return {
    kind,
    schoolId,
    validRows,
    errorRows,
    conflictRows,
    totalRows: normalizedRows.length,
    payload: encodeImportPayload({ kind, schoolId, validRows })
  };
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function buildApprovalLinkPath(request) {
  const payload = parsePayload(request.payload_json);
  if (request.item_type === 'gallery_photo_comment' || request.item_type === 'gallery_collage_comment') {
    return `/gallery?class=${encodeURIComponent(payload.classFilter || 'GENERAL')}`;
  }
  if (request.item_type === 'gallery_upload') {
    return `/gallery?class=${encodeURIComponent(payload.classBranch || 'GENERAL')}`;
  }
  if (request.item_type === 'anonymous_board_post') {
    return '/anonymous-board';
  }
  if (request.item_type === 'teacher_farewell') {
    return '/teachers';
  }
  if (request.target_user_id) {
    return `/profiles/${request.target_user_id}`;
  }
  return '';
}

function notifyApprovalActor(request, status) {
  const label = getContentApprovalLabel(request.item_type);
  const approved = status === 'approved';
  createInboxNotification({
    userId: request.actor_user_id,
    actorUserId: null,
    kind: approved ? 'content_approval_approved' : 'content_approval_rejected',
    title: approved ? 'İçeriğin onaylandı' : 'İçeriğin reddedildi',
    body: `${label} ${approved ? 'onaylandı ve yayınlandı.' : 'reddedildi.'}`,
    linkPath: buildApprovalLinkPath(request)
  });
}

function isValidClass(classBranch) {
  return !classBranch || isValidClassBranch(classBranch);
}

function getCurrentSchoolYear() {
  return db.prepare('SELECT id, label FROM school_years WHERE is_current = 1 ORDER BY id DESC LIMIT 1').get();
}

function normalizeTeacherCategory(value) {
  const category = stripHtml(value || '').toLowerCase();
  return ['teacher', 'principal', 'vice_principal', 'head_vice_principal', 'other'].includes(category) ? category : 'teacher';
}

function parseCheckboxYes(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.some((item) => ['yes', '1', 'true', 'on'].includes(String(item || '').toLowerCase()));
}

function getUniqueImportedYearLabel(baseLabel) {
  const safeBaseLabel = stripHtml(baseLabel || '').slice(0, 60) || 'Arşiv Yılı';
  let label = `${safeBaseLabel} (Yüklenen)`;
  let suffix = 2;
  while (db.prepare('SELECT 1 FROM school_years WHERE label = ?').get(label)) {
    label = `${safeBaseLabel} (Yüklenen ${suffix})`;
    suffix += 1;
  }
  return label;
}

function runAdminMaintenanceWindow(req, details, operation) {
  return withMaintenanceState(
    {
      source: 'admin',
      actorUserId: req.currentUser.id,
      message: details.message,
      reason: details.reason
    },
    operation
  );
}

function syncClassPresident(userId, role, classBranch, shouldBePresident, actorUserId = null) {
  const previousPresident = classBranch
    ? db.prepare('SELECT id FROM users WHERE president_class_branch = ? AND id <> ?').get(classBranch, userId)
    : null;

  if (role !== 'student' || !classBranch || !shouldBePresident) {
    const existing = db.prepare('SELECT president_class_branch FROM users WHERE id = ?').get(userId);
    db.prepare('UPDATE users SET president_class_branch = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    if (existing && existing.president_class_branch) {
      db.prepare(
        `INSERT INTO class_president_history (class_branch, user_id, action, actor_user_id)
         VALUES (?, ?, 'cleared', ?)`
      ).run(existing.president_class_branch, userId, actorUserId);
    }
    return null;
  }

  db.prepare('UPDATE users SET president_class_branch = NULL, updated_at = CURRENT_TIMESTAMP WHERE president_class_branch = ? AND id <> ?').run(classBranch, userId);
  db.prepare('UPDATE users SET president_class_branch = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(classBranch, userId);
  if (previousPresident) {
    db.prepare(
      `INSERT INTO class_president_history (class_branch, user_id, action, actor_user_id)
       VALUES (?, ?, 'reassigned', ?)`
    ).run(classBranch, previousPresident.id, actorUserId);
  }
  db.prepare(
    `INSERT INTO class_president_history (class_branch, user_id, action, actor_user_id)
     VALUES (?, ?, 'assigned', ?)`
  ).run(classBranch, userId, actorUserId);
  return classBranch;
}

function buildUsersExport(usersWithCodes) {
  const workbook = XLSX.utils.book_new();
  const header = [['ID', 'Ad Soyad', 'Rol', 'Giris Kimligi', 'Öğrenci No', 'Sınıf', 'Erişim Kodu']];
  const allowedClasses = getActiveClassBranches();

  allowedClasses.forEach((branch) => {
    const classRows = usersWithCodes
      .filter((user) => user.role === 'student' && user.class_branch === branch)
      .map((user) => [user.id, user.name, 'öğrenci', user.login_identifier || '', user.student_number, user.class_branch, user.access_code]);
    const sheet = XLSX.utils.aoa_to_sheet([...header, ...classRows]);
    XLSX.utils.book_append_sheet(workbook, sheet, branch);
  });

  const teachers = usersWithCodes
    .filter((user) => user.role === 'teacher')
    .map((user) => [user.id, user.name, 'öğretmen', user.login_identifier || '', '', '', user.access_code]);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([...header, ...teachers]), 'Ogretmenler');

  const admins = usersWithCodes
    .filter((user) => user.role === 'admin')
    .map((user) => [user.id, user.name, 'yönetici', user.login_identifier || '', '', '', user.access_code]);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([...header, ...admins]), 'Yoneticiler');

  const guests = usersWithCodes
    .filter((user) => user.role === 'guest')
    .map((user) => [user.id, user.name, 'misafir', user.login_identifier || '', '', '', user.access_code]);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([...header, ...guests]), 'Misafirler');

  const allRows = usersWithCodes.map((user) => [
    user.id,
    user.name,
    user.role,
    user.login_identifier || '',
    user.student_number,
    user.class_branch,
    user.access_code
  ]);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([...header, ...allRows]), 'Tum_Kullanicilar');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function buildReimportableUsersExport(users) {
  const workbook = XLSX.utils.book_new();
  const studentRows = users
    .filter((user) => user.role === 'student')
    .map((user) => [user.name, user.student_number || '', user.class_branch || '']);
  const teacherRows = users
    .filter((user) => user.role === 'teacher')
    .map((user) => [user.name]);
  const otherRows = users
    .filter((user) => user.role === 'other')
    .map((user) => [user.name, user.login_identifier || '', user.school_name || '']);
  const allRows = users.map((user) => [
    user.name,
    user.role,
    user.student_number || '',
    user.login_identifier || '',
    user.class_branch || '',
    user.school_name || '',
    user.status || 'active'
  ]);

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['Ad Soyad', 'Öğrenci Numarası', 'Sınıf Şubesi'], ...studentRows]),
    'Ogrenciler_Import'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['Ad Soyad'], ...teacherRows]),
    'Ogretmenler_Import'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['Ad Soyad', 'Giriş Kimliği', 'Okul'], ...otherRows]),
    'Diger_Bilgi'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['Ad Soyad', 'Rol', 'Öğrenci Numarası', 'Giriş Kimliği', 'Sınıf Şubesi', 'Okul', 'Durum'], ...allRows]),
    'Tum_Kullanicilar'
  );
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function resetUserCode(userId) {
  const newCode = generateAccessCode();
  db.prepare(
    `UPDATE users
     SET access_code_hash = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(hashAccessCode(newCode), userId);
  return newCode;
}

function buildArchiveYearExport(yearId) {
  const schoolYear = db
    .prepare('SELECT id, label, is_archived, archived_at, created_at FROM school_years WHERE id = ?')
    .get(yearId);
  if (!schoolYear) {
    throw new Error('Arşiv yılı bulunamadı.');
  }

  const classes = db
    .prepare(
      `SELECT branch, theme_color, cover_photo_path, class_slogan, created_at
       FROM archive_year_classes
       WHERE school_year_id = ?
       ORDER BY branch`
    )
    .all(yearId);

  const users = db
    .prepare(
      `SELECT id, name, student_number, role, teacher_category, photo_path, profile_cover_path, profile_theme_color,
              slogan, bio, free_text, favorite_memory, favorite_quote, birth_date,
              contact_phone, contact_email, contact_instagram, contact_x, contact_facebook, contact_linkedin,
              contact_nsocial, custom_contacts_json, archived_class_branch, graduated_at, status, created_at, updated_at
       FROM users
       WHERE archived_school_year_id = ?
       ORDER BY CASE role WHEN 'student' THEN 1 WHEN 'teacher' THEN 2 ELSE 3 END, archived_class_branch, name COLLATE NOCASE`
    )
    .all(yearId);
  const exportUsers = users.map((user, index) => ({
    ...user,
    archive_key: `archive-user-${yearId}-${index + 1}`
  }));
  const userKeyById = new Map(exportUsers.map((user) => [Number(user.id), user.archive_key]));
  const userIds = exportUsers.map((user) => Number(user.id));
  const messages = userIds.length
    ? db.prepare(
        `SELECT from_user_id, to_user_id, message, created_at, updated_at
         FROM messages
         WHERE from_user_id IN (${userIds.map(() => '?').join(',')})
           AND to_user_id IN (${userIds.map(() => '?').join(',')})
         ORDER BY created_at ASC`
      ).all(...userIds, ...userIds).map((message) => ({
        from_archive_key: userKeyById.get(Number(message.from_user_id)) || null,
        to_archive_key: userKeyById.get(Number(message.to_user_id)) || null,
        message: message.message,
        created_at: message.created_at,
        updated_at: message.updated_at
      })).filter((message) => message.from_archive_key && message.to_archive_key)
    : [];

  const threeWords = userIds.length
    ? db.prepare(
        `SELECT profile_user_id, author_user_id, words, created_at, updated_at
         FROM profile_three_words
         WHERE profile_user_id IN (${userIds.map(() => '?').join(',')})
           AND author_user_id IN (${userIds.map(() => '?').join(',')})
         ORDER BY updated_at ASC`
      ).all(...userIds, ...userIds).map((entry) => ({
        profile_archive_key: userKeyById.get(Number(entry.profile_user_id)) || null,
        author_archive_key: userKeyById.get(Number(entry.author_user_id)) || null,
        words: entry.words,
        created_at: entry.created_at,
        updated_at: entry.updated_at
      })).filter((entry) => entry.profile_archive_key && entry.author_archive_key)
    : [];

  const guestbookEntries = userIds.length
    ? db.prepare(
        `SELECT profile_user_id, author_user_id, body, created_at, updated_at
         FROM profile_guestbook_entries
         WHERE profile_user_id IN (${userIds.map(() => '?').join(',')})
           AND author_user_id IN (${userIds.map(() => '?').join(',')})
         ORDER BY created_at ASC`
      ).all(...userIds, ...userIds).map((entry) => ({
        profile_archive_key: userKeyById.get(Number(entry.profile_user_id)) || null,
        author_archive_key: userKeyById.get(Number(entry.author_user_id)) || null,
        body: entry.body,
        created_at: entry.created_at,
        updated_at: entry.updated_at
      })).filter((entry) => entry.profile_archive_key && entry.author_archive_key)
    : [];

  const likes = userIds.length
    ? db.prepare(
        `SELECT profile_user_id, liker_user_id, created_at
         FROM profile_likes
         WHERE profile_user_id IN (${userIds.map(() => '?').join(',')})
           AND liker_user_id IN (${userIds.map(() => '?').join(',')})
         ORDER BY created_at ASC`
      ).all(...userIds, ...userIds).map((entry) => ({
        profile_archive_key: userKeyById.get(Number(entry.profile_user_id)) || null,
        liker_archive_key: userKeyById.get(Number(entry.liker_user_id)) || null,
        created_at: entry.created_at
      })).filter((entry) => entry.profile_archive_key && entry.liker_archive_key)
    : [];

  return {
    exportedAt: new Date().toISOString(),
    schoolYear,
    classes,
    users: exportUsers,
    students: exportUsers.filter((user) => user.role === 'student'),
    messages,
    threeWords,
    guestbookEntries,
    likes
  };
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvEscape(value) {
  const text = String(value == null ? '' : value);
  return `"${text.replace(/"/g, '""')}"`;
}

function sendCsv(res, filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(`\uFEFF${csv}`);
}

function getUserActivityRows(limit = 40, filters = {}) {
  const where = ["u.role <> 'admin'"];
  const params = [];
  if (filters.role && ['student', 'teacher', 'other', 'guest'].includes(filters.role)) {
    where.push('u.role = ?');
    params.push(filters.role);
  }
  if (filters.schoolId) {
    where.push('u.school_id = ?');
    params.push(Number(filters.schoolId));
  }
  if (filters.missingOnly) {
    where.push(
      `(u.photo_path IS NULL
        OR length(trim(COALESCE(u.slogan, ''))) = 0
        OR length(trim(COALESCE(u.bio, ''))) = 0
        OR length(trim(COALESCE(u.free_text, ''))) = 0)`
    );
  }
  const pendingApprovalCounts = db
    .prepare(
      `SELECT actor_user_id AS user_id, COUNT(*) AS total
       FROM content_approval_requests
       WHERE status = 'pending'
       GROUP BY actor_user_id`
    )
    .all();
  const pendingApprovalMap = new Map(pendingApprovalCounts.map((row) => [Number(row.user_id), Number(row.total)]));
  return db
    .prepare(
      `SELECT u.id, u.name, u.role, u.school_id, s.name AS school_name, u.class_branch, u.status,
              u.photo_path, u.slogan, u.bio, u.free_text, u.favorite_memory, u.favorite_quote,
              u.contact_phone, u.contact_email, u.contact_instagram, u.contact_x, u.contact_facebook,
              u.contact_linkedin, u.contact_nsocial, u.custom_contacts_json,
              u.last_active_at, u.updated_at, u.created_at
       FROM users u
       LEFT JOIN schools s ON s.id = u.school_id
       WHERE ${where.join(' AND ')}
       ORDER BY COALESCE(u.last_active_at, u.updated_at, u.created_at) DESC
       LIMIT ?`
    )
    .all(...params, limit)
    .map((user) => {
      const completion = calculateProfileCompletion(user);
      return {
        ...user,
        completion,
        pendingApprovalCount: pendingApprovalMap.get(Number(user.id)) || 0
      };
    });
}

function parseSettingList(value, fallback) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) && parsed.length ? parsed.map(String) : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeArrayInput(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value == null || value === '') return [];
  return [String(value)];
}

function getYearbookBookSettings() {
  const defaultSections = ['classes', 'teachers', 'others', 'anonymous', 'gallery', 'closing'];
  const defaultProfileFields = ['slogan', 'bio', 'free_text', 'favorite_memory', 'favorite_quote', 'birth_date', 'contact', 'messages', 'likes', 'guestbook', 'three_words'];
  return {
    coverTitle: getAppSetting('yearbook_book_cover_title', 'Yıllık'),
    coverSubtitle: getAppSetting('yearbook_book_cover_subtitle', 'Okul yıllığı özel baskısı'),
    coverYear: getAppSetting('yearbook_book_cover_year', new Date().getFullYear()),
    introText: getAppSetting('yearbook_book_intro_text', 'Bu çıktı sınıflar, profiller, mesajlar, galeri ve mantar pano içeriklerinden otomatik hazırlanmıştır.'),
    preparedBy: getAppSetting('yearbook_book_prepared_by', 'Yıllık'),
    coverImagePath: getAppSetting('yearbook_book_cover_image_path', ''),
    themeColor: getAppSetting('yearbook_book_theme_color', '#6f4e1e'),
    sectionOrder: parseSettingList(getAppSetting('yearbook_book_section_order', ''), defaultSections),
    profileFields: parseSettingList(getAppSetting('yearbook_book_profile_fields', ''), defaultProfileFields),
    messageLimit: parseInt(getAppSetting('yearbook_book_message_limit', '5'), 10) || 0
  };
}

function yearbookTeacherCategoryLabel(category) {
  switch (category) {
    case 'principal':
      return 'Müdür';
    case 'vice_principal':
      return 'Müdür Yardımcısı';
    case 'head_vice_principal':
      return 'Baş Müdür Yardımcısı';
    case 'teacher':
      return 'Öğretmen';
    default:
      return 'Diğer';
  }
}

function getMimeTypeForExport(filePath) {
  switch (path.extname(String(filePath || '')).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function resolveLocalExportAssetPath(src) {
  const value = String(src || '');
  if (!value.startsWith('/')) return '';
  if (value.startsWith('/uploads/photos/')) {
    return path.join(UPLOAD_DIR, path.basename(value));
  }
  if (value.startsWith('/uploads/gallery/')) {
    return path.join(GALLERY_UPLOAD_DIR, path.basename(value));
  }
  if (value.startsWith('/uploads/class-covers/')) {
    return path.join(CLASS_COVER_UPLOAD_DIR, path.basename(value));
  }
  if (value.startsWith('/public/')) {
    return path.join(ROOT_DIR, 'frontend', 'public', value.slice('/public/'.length));
  }
  return '';
}

function assetUrl(src, baseUrl) {
  if (!src) return '';
  const value = String(src);
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  const localPath = resolveLocalExportAssetPath(value);
  if (localPath && fs.existsSync(localPath)) {
    if (!EMBEDDED_ASSET_CACHE.has(localPath)) {
      const mimeType = getMimeTypeForExport(localPath);
      const encoded = fs.readFileSync(localPath).toString('base64');
      EMBEDDED_ASSET_CACHE.set(localPath, `data:${mimeType};base64,${encoded}`);
    }
    return EMBEDDED_ASSET_CACHE.get(localPath);
  }
  if (value.startsWith('/')) return `${baseUrl}${value}`;
  return value;
}

function groupBy(list, keyFn) {
  return list.reduce((map, item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

function getYearbookExportSchoolContext(query, currentUser) {
  const visibleSchools = getVisibleSchools(currentUser).filter((school) => Number(school.is_active) === 1);
  if (!visibleSchools.length) {
    return { schoolId: 0, schoolName: '', visibleSchools };
  }
  if (currentUser && currentUser.role !== 'admin') {
    const school = visibleSchools[0];
    return { schoolId: Number(school.id), schoolName: school.name, visibleSchools };
  }
  const requestedSchoolId = Number(query && query.school_id ? query.school_id : 0);
  const currentSchoolId = Number(getAppSetting('current_school_id', 0));
  const selected =
    visibleSchools.find((school) => Number(school.id) === requestedSchoolId) ||
    visibleSchools.find((school) => Number(school.id) === currentSchoolId) ||
    visibleSchools[0];
  return { schoolId: Number(selected.id), schoolName: selected.name, visibleSchools };
}

function getClassBranchesForSchool(schoolId) {
  if (!schoolId) return [];
  return db
    .prepare(
      `SELECT DISTINCT class_branch
       FROM users
       WHERE school_id = ? AND role = 'student' AND class_branch IS NOT NULL AND class_branch <> ''
       ORDER BY class_branch`
    )
    .all(schoolId)
    .map((row) => row.class_branch);
}

function parseCustomContacts(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.label && item.value).slice(0, 12) : [];
  } catch (error) {
    return [];
  }
}

function getYearbookBookData(query, baseUrl, currentUser) {
  const { scope, classBranch } = getExportScope(query || {});
  const schoolContext = getYearbookExportSchoolContext(query || {}, currentUser);
  const settings = getYearbookBookSettings();
  const schoolClassBranches = getClassBranchesForSchool(schoolContext.schoolId);
  const exportClassBranches = scope === 'class'
    ? schoolClassBranches.filter((branch) => branch === classBranch)
    : schoolClassBranches;
  const classFilterSql = exportClassBranches.length ? `WHERE c.branch IN (${exportClassBranches.map(() => '?').join(',')})` : 'WHERE 1 = 0';
  const classParams = exportClassBranches;
  const classes = db.prepare(
    `SELECT c.branch, c.theme_color, cp.cover_photo_path, cp.class_slogan
     FROM classes c
     LEFT JOIN class_pages cp ON cp.class_branch = c.branch
     ${classFilterSql}
     ORDER BY c.branch`
  ).all(...classParams);
  const classBranches = classes.map((item) => item.branch);
  const usersWhere = scope === 'class'
    ? "WHERE role = 'student' AND class_branch = ? AND school_id = ?"
    : "WHERE role <> 'admin' AND school_id = ?";
  const usersParams = scope === 'class' ? [classBranch, schoolContext.schoolId] : [schoolContext.schoolId];
  const users = db.prepare(
    `SELECT id, name, student_number, role, class_branch, teacher_category, photo_path, profile_cover_path, slogan, bio,
            favorite_memory, favorite_quote, birth_date, contact_phone, contact_email, contact_instagram,
            contact_x, contact_facebook, contact_linkedin, contact_nsocial, custom_contacts_json, free_text
     FROM users
     ${usersWhere}
     ORDER BY CASE role WHEN 'student' THEN 1 WHEN 'teacher' THEN 2 ELSE 3 END, class_branch, name COLLATE NOCASE`
  ).all(...usersParams);
  const userIds = new Set(users.map((user) => Number(user.id)));
  const allMessages = db.prepare(
    `SELECT m.id, m.message, m.created_at, m.is_export_priority,
            sender.id AS sender_id, sender.name AS sender_name,
            receiver.id AS receiver_id
     FROM messages m
     JOIN users sender ON sender.id = m.from_user_id
     JOIN users receiver ON receiver.id = m.to_user_id
     WHERE receiver.school_id = ?
     ORDER BY m.is_export_priority DESC, m.created_at ASC`
  ).all(schoolContext.schoolId).filter((message) => scope === 'school' || userIds.has(Number(message.receiver_id)));
  const bookMessageLimit = settings.messageLimit || 0;
  const messages = bookMessageLimit > 0 ? applyMessageLimit(allMessages, bookMessageLimit) : allMessages;

  const photos = db.prepare(
    `SELECT p.id, p.photo_path, p.caption, p.date_stamp_text, p.class_branch, p.created_at, p.group_id, p.group_index,
            p.album_id, uploader.name AS uploader_name, a.title AS album_title
     FROM gallery_photos p
     JOIN users uploader ON uploader.id = p.uploader_user_id
     LEFT JOIN gallery_albums a ON a.id = p.album_id
     WHERE p.section = 'gallery' AND uploader.school_id = ?
     ORDER BY p.class_branch, p.group_id, p.sort_order, p.created_at`
  ).all(schoolContext.schoolId).filter((photo) => scope === 'school' ? true : String(photo.class_branch || '') === classBranch);
  const selectedPhotoIds = new Set(photos.map((photo) => Number(photo.id)));
  const selectedGroupIds = new Set(photos.map((photo) => String(photo.group_id || '')).filter(Boolean));
  const photoComments = db.prepare(
    `SELECT c.photo_id, c.body, c.created_at, author.name AS author_name
     FROM gallery_photo_comments c
     JOIN users author ON author.id = c.author_user_id
     ORDER BY c.created_at ASC`
  ).all().filter((comment) => selectedPhotoIds.has(Number(comment.photo_id)));
  const collageComments = db.prepare(
    `SELECT c.group_id, c.body, c.created_at, author.name AS author_name
     FROM gallery_collage_comments c
     JOIN users author ON author.id = c.author_user_id
     ORDER BY c.created_at ASC`
  ).all().filter((comment) => selectedGroupIds.has(String(comment.group_id || '')));
  const photoReactions = db.prepare(
    `SELECT photo_id, emoji, COUNT(*) AS total
     FROM gallery_photo_reactions
     GROUP BY photo_id, emoji`
  ).all().filter((entry) => selectedPhotoIds.has(Number(entry.photo_id)));
  const collageReactions = db.prepare(
    `SELECT group_id, emoji, COUNT(*) AS total
     FROM gallery_collage_reactions
     GROUP BY group_id, emoji`
  ).all().filter((entry) => selectedGroupIds.has(String(entry.group_id || '')));
  const anonymousPosts = scope === 'school'
    ? db.prepare('SELECT id, body, created_at FROM anonymous_board_posts ORDER BY created_at ASC').all()
    : [];
  const guestbookEntries = db.prepare(
    `SELECT g.profile_user_id, g.body, g.created_at, author.name AS author_name
     FROM profile_guestbook_entries g
     JOIN users author ON author.id = g.author_user_id
     ORDER BY g.created_at ASC`
  ).all().filter((entry) => userIds.has(Number(entry.profile_user_id)));
  const profileLikeCounts = db.prepare(
    `SELECT profile_user_id, COUNT(*) AS total
     FROM profile_likes
     GROUP BY profile_user_id`
  ).all().filter((entry) => userIds.has(Number(entry.profile_user_id)));
  const threeWords = db.prepare(
    `SELECT t.profile_user_id, t.words, t.updated_at, author.name AS author_name
     FROM profile_three_words t
     JOIN users author ON author.id = t.author_user_id
     ORDER BY t.updated_at DESC`
  ).all().filter((entry) => userIds.has(Number(entry.profile_user_id)));
  const closing = {
    title: getAppSetting('closing_title', ''),
    body: getAppSetting('closing_body', ''),
    graduationDate: getAppSetting('graduation_date', '')
  };
  return {
    generatedAt: new Date().toISOString(),
    scope,
    classBranch,
    schoolId: schoolContext.schoolId,
    schoolName: schoolContext.schoolName,
    visibleSchools: schoolContext.visibleSchools,
    settings,
    classes,
    classBranches,
    users,
    messagesByReceiver: groupBy(messages, (message) => Number(message.receiver_id)),
    photos,
    photosByClass: groupBy(photos.filter((photo) => photo.class_branch), (photo) => photo.class_branch),
    generalPhotos: photos.filter((photo) => !photo.class_branch),
    photoCommentsByPhoto: groupBy(photoComments, (comment) => Number(comment.photo_id)),
    collageCommentsByGroup: groupBy(collageComments, (comment) => String(comment.group_id || '')),
    photoReactionsByPhoto: groupBy(photoReactions, (entry) => Number(entry.photo_id)),
    collageReactionsByGroup: groupBy(collageReactions, (entry) => String(entry.group_id || '')),
    guestbookByProfile: groupBy(guestbookEntries, (entry) => Number(entry.profile_user_id)),
    threeWordsByProfile: groupBy(threeWords, (entry) => Number(entry.profile_user_id)),
    profileLikeCountByUser: new Map(profileLikeCounts.map((entry) => [Number(entry.profile_user_id), Number(entry.total || 0)])),
    anonymousPosts,
    closing,
    stats: {
      totalProfiles: users.length,
      studentCount: users.filter((user) => user.role === 'student').length,
      teacherCount: users.filter((user) => user.role === 'teacher').length,
      otherCount: users.filter((user) => !['student', 'teacher'].includes(user.role)).length,
      classCount: classes.length,
      galleryCount: photos.length,
      anonymousCount: anonymousPosts.length
    },
    baseUrl
  };
}

function renderGalleryBlocks(photos, data) {
  if (!photos.length) return '<p class="muted">Galeri fotoğrafı yok.</p>';
  const grouped = groupBy(photos, (photo) => photo.group_id ? `collage:${photo.group_id}` : `photo:${photo.id}`);
  return Array.from(grouped.entries()).map(([key, items]) => {
    const first = items[0];
    const comments = first.group_id
      ? data.collageCommentsByGroup.get(String(first.group_id)) || []
      : data.photoCommentsByPhoto.get(Number(first.id)) || [];
    const reactions = first.group_id
      ? data.collageReactionsByGroup.get(String(first.group_id)) || []
      : data.photoReactionsByPhoto.get(Number(first.id)) || [];
    return `
      <article class="gallery-block">
        <div class="gallery-collage ${items.length > 1 ? 'multi' : ''}">
          ${items.slice(0, 6).map((photo) => `<img src="${escapeHtml(assetUrl(photo.photo_path, data.baseUrl))}" alt="${escapeHtml(photo.caption || 'Galeri fotoğrafı')}" />`).join('')}
        </div>
        <h4>${escapeHtml(first.caption || (items.length > 1 ? 'Kollaj' : 'Fotoğraf'))}</h4>
        ${first.album_title ? `<p class="gallery-meta"><strong>Albüm:</strong> ${escapeHtml(first.album_title)}</p>` : ''}
        ${first.date_stamp_text ? `<p class="muted">${escapeHtml(first.date_stamp_text)}</p>` : ''}
        ${reactions.length ? `<p class="gallery-meta"><strong>Tepkiler:</strong> ${reactions.map((item) => `${escapeHtml(item.emoji)} ${escapeHtml(String(item.total))}`).join(' / ')}</p>` : ''}
        ${comments.length ? `<ul class="comments">${comments.slice(0, 6).map((comment) => `<li><strong>${escapeHtml(comment.author_name)}:</strong> ${escapeHtml(comment.body)}</li>`).join('')}</ul>` : ''}
      </article>
    `;
  }).join('');
}

function renderSectionDivider(title, subtitle = '') {
  return `
    <section class="page section-divider">
      <div>
        <p class="eyebrow-print">Bölüm</p>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      </div>
    </section>
  `;
}

function renderClassRoster(classStudents, data) {
  if (!classStudents.length) {
    return '<p class="muted">Bu sınıfta öğrenci görünmüyor.</p>';
  }
  return `
    <div class="roster-grid">
      ${classStudents.map((user) => `
        <article class="roster-card">
          <img src="${escapeHtml(assetUrl(user.photo_path || '/public/default-avatar.svg', data.baseUrl))}" alt="${escapeHtml(user.name)}" />
          <strong>${escapeHtml(user.name)}</strong>
          ${user.student_number ? `<span>No: ${escapeHtml(user.student_number)}</span>` : '<span>Arşiv profil</span>'}
        </article>
      `).join('')}
    </div>
  `;
}

function renderProfilePage(user, data) {
  const messages = data.messagesByReceiver.get(Number(user.id)) || [];
  const guestbookEntries = data.guestbookByProfile.get(Number(user.id)) || [];
  const threeWords = data.threeWordsByProfile.get(Number(user.id)) || [];
  const likeCount = data.profileLikeCountByUser.get(Number(user.id)) || 0;
  const fields = new Set(data.settings.profileFields || []);
  const contact = [
    user.contact_phone,
    user.contact_email,
    user.contact_instagram,
    user.contact_x,
    user.contact_facebook,
    user.contact_linkedin,
    user.contact_nsocial,
    ...parseCustomContacts(user.custom_contacts_json).map((item) => `${item.label}: ${item.value}`)
  ].filter(Boolean);
  return `
    <section class="page profile-page">
      ${user.profile_cover_path ? `<div class="profile-banner"><img src="${escapeHtml(assetUrl(user.profile_cover_path, data.baseUrl))}" alt="${escapeHtml(user.name)} kapak görseli" /></div>` : ''}
      <div class="profile-layout">
        <aside>
          <img class="portrait" src="${escapeHtml(assetUrl(user.photo_path || '/public/default-avatar.svg', data.baseUrl))}" alt="${escapeHtml(user.name)}" />
          <h2>${escapeHtml(user.name)}</h2>
          <p>${escapeHtml(user.role === 'teacher' ? yearbookTeacherCategoryLabel(user.teacher_category) : user.role)}${user.class_branch ? ` / ${escapeHtml(user.class_branch)}` : ''}</p>
          ${user.student_number ? `<p>No: ${escapeHtml(user.student_number)}</p>` : ''}
          ${fields.has('birth_date') && user.birth_date ? `<p>Doğum günü: ${escapeHtml(user.birth_date)}</p>` : ''}
          ${fields.has('likes') ? `<p>Beğeni: ${escapeHtml(String(likeCount))}</p>` : ''}
        </aside>
        <main>
          ${fields.has('slogan') && user.slogan ? `<blockquote>${escapeHtml(user.slogan)}</blockquote>` : ''}
          ${fields.has('bio') && user.bio ? `<h3>Biyografi</h3><p>${escapeHtml(user.bio)}</p>` : ''}
          ${fields.has('free_text') && user.free_text ? `<h3>Serbest Yazı</h3><p class="free-text">${escapeHtml(user.free_text)}</p>` : ''}
          ${fields.has('favorite_memory') && user.favorite_memory ? `<h3>Anı</h3><p>${escapeHtml(user.favorite_memory)}</p>` : ''}
          ${fields.has('favorite_quote') && user.favorite_quote ? `<h3>Alıntı</h3><p>${escapeHtml(user.favorite_quote)}</p>` : ''}
          ${fields.has('contact') && contact.length ? `<h3>İletişim</h3><p>${contact.map(escapeHtml).join(' / ')}</p>` : ''}
          ${fields.has('three_words') ? `<h3>3 Kelime</h3>${threeWords.length ? `<ul class="messages">${threeWords.slice(0, 12).map((item) => `<li><strong>${escapeHtml(item.author_name)}:</strong> ${escapeHtml(item.words)}</li>`).join('')}</ul>` : '<p class="muted">3 kelime yorumu yok.</p>'}` : ''}
          ${fields.has('messages') ? `<h3>Yıllık Mesajları</h3>${messages.length ? `<ul class="messages">${messages.map((message) => `<li><strong>${escapeHtml(message.sender_name)}:</strong> ${escapeHtml(message.message)}</li>`).join('')}</ul>` : '<p class="muted">Mesaj yok.</p>'}` : ''}
          ${fields.has('guestbook') ? `<h3>Ziyaretçi Defteri</h3>${guestbookEntries.length ? `<ul class="messages">${guestbookEntries.slice(0, 10).map((entry) => `<li><strong>${escapeHtml(entry.author_name)}:</strong> ${escapeHtml(entry.body)}</li>`).join('')}</ul>` : '<p class="muted">Ziyaretçi defteri notu yok.</p>'}` : ''}
        </main>
      </div>
    </section>
  `;
}

function renderYearbookBookHtml(data) {
  const students = data.users.filter((user) => user.role === 'student');
  const teachers = data.users.filter((user) => user.role === 'teacher');
  const others = data.users.filter((user) => !['student', 'teacher'].includes(user.role));
  const tocClasses = data.scope === 'class' ? data.classBranches : data.classBranches;
  const allowedSections = new Set(data.settings.sectionOrder || []);
  const sectionOrder = (data.settings.sectionOrder || ['classes', 'teachers', 'others', 'anonymous', 'gallery', 'closing'])
    .filter((section) => allowedSections.has(section));
  const sectionBlocks = {
    classes: data.classes.map((klass) => {
      const classStudents = students.filter((user) => user.class_branch === klass.branch);
      const classPhotos = data.photosByClass.get(klass.branch) || [];
      return `
        ${renderSectionDivider(`${klass.branch} Sınıfı`, klass.class_slogan || 'Sınıf bölümü')}
        <section class="page">
          <div class="class-title">
            ${klass.cover_photo_path ? `<img src="${escapeHtml(assetUrl(klass.cover_photo_path, data.baseUrl))}" alt="${escapeHtml(klass.branch)}" />` : ''}
            <div><h1>${escapeHtml(klass.branch)}</h1><p>${escapeHtml(klass.class_slogan || 'Sınıf sayfası')}</p></div>
          </div>
          <p class="muted">Bu sınıfta ${classStudents.length} öğrenci ve ${classPhotos.length} galeri öğesi bulunuyor.</p>
          <h2>Sınıf Kadrosu</h2>
          ${renderClassRoster(classStudents, data)}
          <h2>Sınıf Galerisi</h2>
          <div class="gallery-grid">${renderGalleryBlocks(classPhotos, data)}</div>
        </section>
        ${classStudents.map((user) => renderProfilePage(user, data)).join('')}
      `;
    }).join(''),
    teachers: teachers.length ? `${renderSectionDivider('Öğretmenler', 'Okuldaki öğretmen profilleri')}${teachers.map((user) => renderProfilePage(user, data)).join('')}` : '',
    others: others.length ? `${renderSectionDivider('Diğer Profiller', 'Misafir ve diğer kullanıcı profilleri')}${others.map((user) => renderProfilePage(user, data)).join('')}` : '',
    anonymous: data.scope === 'school' ? `${renderSectionDivider('Mantar Pano', 'Okul genel anonim notları')}<section class="page"><h1>Mantar Pano</h1><div class="anonymous-list">${data.anonymousPosts.map((post) => `<article class="anonymous-note">${escapeHtml(post.body)}</article>`).join('') || '<p class="muted">Mantar pano notu yok.</p>'}</div></section>` : '',
    gallery: data.scope === 'school' ? `${renderSectionDivider('Okul Galerisi', 'Genel okul fotoğrafları ve kollajlar')}<section class="page"><h1>Okul Galerisi</h1><div class="gallery-grid">${renderGalleryBlocks(data.generalPhotos, data)}</div></section>` : '',
    closing: `<section class="page"><h1>Kapanış</h1><h2>${escapeHtml(data.closing.title || 'Kapanış')}</h2><p>${escapeHtml(data.closing.body || '')}</p>${data.closing.graduationDate ? `<p>Mezuniyet: ${escapeHtml(data.closing.graduationDate)}</p>` : ''}</section>`
  };
  const orderedSectionHtml = sectionOrder.map((section) => sectionBlocks[section] || '').join('');
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <base href="${escapeHtml(data.baseUrl)}/" />
  <title>${escapeHtml(data.settings.coverTitle)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #1f2937; font-family: Georgia, 'Times New Roman', serif; background: #f6efe3; }
    .page { min-height: 267mm; break-after: page; page-break-after: always; padding: 18mm; background: #fffaf0; border: 1px solid #decaa6; }
    .cover { display: grid; place-items: center; text-align: center; background: radial-gradient(circle at 30% 20%, #fff, #ead7ad); }
    .cover-image { width: 220px; height: 220px; object-fit: cover; border-radius: 34px; border: 6px solid rgba(255,255,255,.72); box-shadow: 0 18px 40px rgba(0,0,0,.18); margin-bottom: 24px; }
    .cover h1 { font-size: 54px; margin: 0; letter-spacing: .04em; }
    .cover p { font-size: 20px; max-width: 620px; }
    .section-divider { display: grid; place-items: center; text-align: center; background: linear-gradient(160deg, #fff8eb, #ecd5ac); }
    .section-divider h1 { font-size: 48px; margin: 8px 0 10px; }
    .section-divider p { font-size: 20px; max-width: 560px; }
    .eyebrow-print { margin: 0; letter-spacing: .18em; text-transform: uppercase; font-size: 13px; color: #8a6b2d; font-weight: 700; }
    .cover-stats { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin: 22px 0; }
    .cover-stat { padding: 10px 14px; border-radius: 999px; background: rgba(255,255,255,.62); border: 1px solid rgba(111,78,30,.18); font-size: 16px; }
    .toc ol { columns: 2; font-size: 18px; line-height: 1.9; }
    h1, h2, h3 { color: ${escapeHtml(data.settings.themeColor || '#6f4e1e')}; }
    .class-title { display: flex; gap: 22px; align-items: center; }
    .class-title img { width: 180px; height: 120px; object-fit: cover; border-radius: 18px; }
    .gallery-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .gallery-block { border: 1px solid #e3cfac; border-radius: 16px; padding: 12px; background: #fffdf8; break-inside: avoid; }
    .gallery-meta { margin: 6px 0; font-size: 14px; color: #5b4630; }
    .gallery-collage { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
    .gallery-collage img { width: 100%; height: 120px; object-fit: cover; border-radius: 10px; }
    .gallery-collage:not(.multi) { display: block; }
    .gallery-collage:not(.multi) img { height: 240px; }
    .roster-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
    .roster-card { padding: 10px; border-radius: 16px; border: 1px solid #e3cfac; background: #fffdf8; text-align: center; }
    .roster-card img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 14px; margin-bottom: 8px; }
    .roster-card strong, .roster-card span { display: block; }
    .roster-card span { font-size: 13px; color: #6b7280; }
    .profile-banner { margin-bottom: 16px; }
    .profile-banner img { width: 100%; height: 160px; object-fit: cover; border-radius: 22px; border: 2px solid #d8bc86; }
    .profile-layout { display: grid; grid-template-columns: 34% 1fr; gap: 20px; }
    .portrait { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 24px; border: 4px solid #d8bc86; }
    blockquote { font-size: 22px; color: ${escapeHtml(data.settings.themeColor || '#7a4c12')}; border-left: 5px solid ${escapeHtml(data.settings.themeColor || '#b7873f')}; padding-left: 14px; }
    .messages, .comments { padding-left: 18px; }
    .messages li, .comments li { margin-bottom: 7px; }
    .free-text { white-space: pre-wrap; }
    .muted { color: #6b7280; }
    .anonymous-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; padding: 22px; border: 8px solid #8a5a2b; border-radius: 14px; background: radial-gradient(circle at 18px 18px, rgba(80,44,14,.22) 0 2px, transparent 2.5px), linear-gradient(135deg, #b9803d, #c8934b 44%, #a9692e); background-size: 54px 54px, auto; }
    .anonymous-note { position: relative; padding: 24px 14px 14px; border: 1px solid #e0c89d; border-radius: 4px; background: #fff7a6; box-shadow: 0 8px 14px rgba(72,43,10,.18); }
    .anonymous-note::before { content: ''; position: absolute; top: 8px; left: 50%; width: 13px; height: 13px; border-radius: 50%; background: #b42318; box-shadow: 0 2px 4px rgba(0,0,0,.28); transform: translateX(-50%); }
    @media screen { body { padding: 20px; } .page { max-width: 900px; margin: 0 auto 18px; box-shadow: 0 12px 30px rgba(0,0,0,.16); } }
  </style>
</head>
<body>
  <section class="page cover">
    <div>
      <h1>${escapeHtml(data.settings.coverTitle)}</h1>
      ${data.settings.coverImagePath ? `<img class="cover-image" src="${escapeHtml(assetUrl(data.settings.coverImagePath, data.baseUrl))}" alt="Kapak görseli" />` : ''}
      ${data.schoolName ? `<p>${escapeHtml(data.schoolName)}</p>` : ''}
      <p>${escapeHtml(data.settings.coverSubtitle)}</p>
      <p>${escapeHtml(data.settings.coverYear)}</p>
      <div class="cover-stats">
        <span class="cover-stat">${escapeHtml(String(data.stats.classCount))} sınıf</span>
        <span class="cover-stat">${escapeHtml(String(data.stats.totalProfiles))} profil</span>
        <span class="cover-stat">${escapeHtml(String(data.stats.galleryCount))} galeri öğesi</span>
        ${data.scope === 'school' ? `<span class="cover-stat">${escapeHtml(String(data.stats.anonymousCount))} mantar pano notu</span>` : ''}
      </div>
      <p>${escapeHtml(data.settings.introText)}</p>
      <small>${escapeHtml(data.settings.preparedBy)} / ${escapeHtml(data.generatedAt)}</small>
    </div>
  </section>
  <section class="page toc">
    <h1>İçindekiler</h1>
    <p class="muted">
      Öğrenci: ${escapeHtml(String(data.stats.studentCount))} /
      Öğretmen: ${escapeHtml(String(data.stats.teacherCount))} /
      Diğer: ${escapeHtml(String(data.stats.otherCount))}
    </p>
    <ol>
      ${allowedSections.has('classes') ? tocClasses.map((branch) => `<li>${escapeHtml(branch)} sınıfı</li>`).join('') : ''}
      ${allowedSections.has('teachers') ? '<li>Öğretmenler</li>' : ''}
      ${allowedSections.has('others') ? '<li>Diğer profiller</li>' : ''}
      ${allowedSections.has('anonymous') ? '<li>Mantar pano</li>' : ''}
      ${allowedSections.has('gallery') ? '<li>Okul galerisi</li>' : ''}
      ${allowedSections.has('closing') ? '<li>Kapanış</li>' : ''}
    </ol>
  </section>
  ${orderedSectionHtml}
</body>
</html>`;
}

function toWindowsReadablePath(filePath) {
  if (filePath.startsWith('/mnt/') && filePath.length > 7) {
    const drive = filePath.slice(5, 6).toUpperCase();
    const rest = filePath.slice(7).replace(/\//g, '\\');
    return `${drive}:\\${rest}`;
  }
  const distro = process.env.WSL_DISTRO_NAME || 'Debian';
  return `\\\\wsl.localhost\\${distro}${filePath.replace(/\//g, '\\')}`;
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe'
  ].filter(Boolean);

  return candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch (error) {
      return false;
    }
  }) || '';
}

function renderBookPdfWithChrome(html) {
  const chromePath = findChromeExecutable();
  if (!chromePath) {
    throw new Error('PDF üretimi için Chrome/Chromium bulunamadı. HTML çıktıyı açıp tarayıcıdan PDF olarak kaydedin.');
  }
  const exportTmpDir = '/tmp/yearbook-pdf-export';
  fs.mkdirSync(exportTmpDir, { recursive: true });
  const stamp = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const htmlPath = path.join(exportTmpDir, `yearbook-book-${stamp}.html`);
  const pdfPath = path.join(exportTmpDir, `yearbook-book-${stamp}.pdf`);
  const chromeProfilePath = path.join(exportTmpDir, `yearbook-chrome-${stamp}`);
  const isWindowsChrome = /chrome\.exe$/i.test(chromePath);
  const htmlPathForChrome = isWindowsChrome ? toWindowsReadablePath(htmlPath) : htmlPath;
  const pdfPathForChrome = isWindowsChrome ? toWindowsReadablePath(pdfPath) : pdfPath;
  const chromeProfilePathForChrome = isWindowsChrome ? toWindowsReadablePath(chromeProfilePath) : chromeProfilePath;
  const htmlFileUrl = isWindowsChrome
    ? `file:///${htmlPathForChrome.replace(/\\/g, '/')}`
    : `file://${htmlPathForChrome}`;
  fs.writeFileSync(htmlPath, html, 'utf8');
  try {
    const chromeOutput = execFileSync(chromePath, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--allow-file-access-from-files',
      `--user-data-dir=${chromeProfilePathForChrome}`,
      `--print-to-pdf=${pdfPathForChrome}`,
      '--print-to-pdf-no-header',
      htmlFileUrl
    ], { encoding: 'utf8', timeout: 120000 });
    if (!fs.existsSync(pdfPath) || fs.statSync(pdfPath).size === 0) {
      throw new Error(`Tarayıcı PDF dosyasını oluşturamadı. Çıktı: ${chromeOutput || 'boş'}`);
    }
    return fs.readFileSync(pdfPath);
  } finally {
    fs.rmSync(htmlPath, { force: true });
    fs.rmSync(pdfPath, { force: true });
    fs.rmSync(chromeProfilePath, { recursive: true, force: true });
  }
}

function applyMessageLimit(messages, limit) {
  const grouped = new Map();
  messages.forEach((m) => {
    const key = m.receiver_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(m);
  });
  const result = [];
  grouped.forEach((msgs) => {
    result.push(...msgs.slice(0, limit));
  });
  return result;
}

function getExportScope(query) {
  const classBranch = stripHtml(query.class_branch || '').toUpperCase();
  const scope = classBranch && isValidClassBranch(classBranch, { includeArchived: true }) ? 'class' : 'school';
  return { scope, classBranch: scope === 'class' ? classBranch : '' };
}

function getYearbookExportData(query) {
  const { scope, classBranch } = getExportScope(query || {});
  const userWhere = scope === 'class' ? "WHERE role = 'student' AND class_branch = ?" : "WHERE role <> 'admin'";
  const userParams = scope === 'class' ? [classBranch] : [];
  const users = db
    .prepare(
      `SELECT id, name, student_number, role, class_branch, photo_path, slogan, bio, free_text, favorite_memory, favorite_quote
       FROM users
       ${userWhere}
       ORDER BY CASE role WHEN 'student' THEN 1 WHEN 'teacher' THEN 2 ELSE 3 END, class_branch, name COLLATE NOCASE`
    )
    .all(...userParams);
  const userIds = users.map((user) => user.id);
  const idSet = new Set(userIds);
  const allMessages = db
    .prepare(
      `SELECT m.id, m.message, m.created_at, m.is_export_priority,
              sender.id AS sender_id, sender.name AS sender_name,
              receiver.id AS receiver_id, receiver.name AS receiver_name
       FROM messages m
       JOIN users sender ON sender.id = m.from_user_id
       JOIN users receiver ON receiver.id = m.to_user_id
       ORDER BY receiver.name COLLATE NOCASE, m.is_export_priority DESC, m.created_at ASC`
    )
    .all()
    .filter((message) => (scope === 'school' ? true : idSet.has(message.receiver_id)));
  const exportMessageLimit = parseInt(getAppSetting('yearbook_book_message_limit', '5'), 10) || 0;
  const messages = exportMessageLimit > 0 ? applyMessageLimit(allMessages, exportMessageLimit) : allMessages;
  const anonymousPosts = scope === 'school'
    ? db.prepare('SELECT id, body, created_at FROM anonymous_board_posts ORDER BY created_at ASC').all()
    : [];
  const title = scope === 'class' ? `${classBranch} Yıllık Çıktısı` : 'Okul Yıllık Çıktısı';
  return { title, scope, classBranch, users, messages, anonymousPosts, generatedAt: new Date().toISOString() };
}

function renderYearbookHtmlExport(data) {
  const groupedMessages = new Map();
  data.messages.forEach((message) => {
    if (!groupedMessages.has(message.receiver_id)) {
      groupedMessages.set(message.receiver_id, []);
    }
    groupedMessages.get(message.receiver_id).push(message);
  });

  const boardSection = data.scope === 'school'
    ? `<section class="profile"><h2>Mantar Pano</h2>${data.anonymousPosts.length ? `<ul>${data.anonymousPosts.map((post) => `<li>${escapeHtml(post.body)}</li>`).join('')}</ul>` : '<p>Mantar pano notu yok.</p>'}</section>`
    : '';
  const userCards = data.users.map((user) => {
    const messages = groupedMessages.get(user.id) || [];
    return `
      <article class="profile">
        <h2>${escapeHtml(user.name)}</h2>
        <p>${escapeHtml(user.role)}${user.class_branch ? ` / ${escapeHtml(user.class_branch)}` : ''}${user.student_number ? ` / ${escapeHtml(user.student_number)}` : ''}</p>
        <p><strong>Slogan:</strong> ${escapeHtml(user.slogan || 'Henüz slogan yok.')}</p>
        <p><strong>Biyografi:</strong> ${escapeHtml(user.bio || '-')}</p>
        <p><strong>Serbest Yazı:</strong> ${escapeHtml(user.free_text || '-')}</p>
        <p><strong>Anı:</strong> ${escapeHtml(user.favorite_memory || '-')}</p>
        <p><strong>Alıntı:</strong> ${escapeHtml(user.favorite_quote || '-')}</p>
        <h3>Mesajlar</h3>
        ${messages.length ? `<ul>${messages.map((message) => `<li><strong>${escapeHtml(message.sender_name)}:</strong> ${escapeHtml(message.message)}</li>`).join('')}</ul>` : '<p>Mesaj yok.</p>'}
      </article>
    `;
  }).join('');

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(data.title)}</title>
  <style>
    body { font-family: Georgia, serif; color: #1f2937; margin: 32px; line-height: 1.5; }
    header { border-bottom: 2px solid #0d6e6e; margin-bottom: 24px; }
    h1 { color: #0d6e6e; }
    .profile { break-inside: avoid; border-bottom: 1px solid #d1d5db; padding: 20px 0; }
    @media print { body { margin: 18mm; } .profile { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(data.title)}</h1>
    <p>Oluşturma tarihi: ${escapeHtml(data.generatedAt)}</p>
  </header>
  ${boardSection}
  ${userCards}
</body>
</html>`;
}

function buildSimplePdf(textLines) {
  const safeLines = textLines
    .flatMap((line) => String(line || '').match(/.{1,88}/g) || [''])
    .slice(0, 180)
    .map((line) => line.replace(/[\\()]/g, '\\$&'));
  const content = [
    'BT',
    '/F1 10 Tf',
    '50 790 Td',
    '14 TL',
    ...safeLines.map((line, index) => `${index === 0 ? '' : 'T* '}(${line}) Tj`),
    'ET'
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

function buildYearbookPdf(data) {
  const lines = [data.title, `Olusturma tarihi: ${data.generatedAt}`, ''];
  if (data.scope === 'school') {
    lines.push('Mantar Pano');
    if (data.anonymousPosts.length) {
      data.anonymousPosts.forEach((post) => lines.push(`- ${post.body}`));
    } else {
      lines.push('Mantar pano notu yok.');
    }
    lines.push('');
  }
  data.users.forEach((user) => {
    lines.push(`${user.name} - ${user.role}${user.class_branch ? ` / ${user.class_branch}` : ''}`);
    if (user.slogan) lines.push(`Slogan: ${user.slogan}`);
    if (user.bio) lines.push(`Bio: ${user.bio}`);
    if (user.free_text) lines.push(`Serbest yazi: ${user.free_text}`);
    const messages = data.messages.filter((message) => message.receiver_id === user.id).slice(0, 5);
    messages.forEach((message) => lines.push(`Mesaj - ${message.sender_name}: ${message.message}`));
    lines.push('');
  });
  return buildSimplePdf(lines);
}

function buildLogsFilter(query) {
  return {
    type: ['audit', 'login', 'app'].includes(query.type) ? query.type : 'all',
    q: stripHtml(query.q || '').slice(0, 120),
    status: stripHtml(query.status || '').slice(0, 40),
    action: stripHtml(query.action || '').slice(0, 80)
  };
}

function getFilteredAuditLogs(filter, limit = 100) {
  if (filter.type === 'login' || filter.type === 'app') {
    return [];
  }
  const where = [];
  const params = [];
  if (filter.q) {
    where.push('(l.action LIKE ? COLLATE NOCASE OR l.target_type LIKE ? COLLATE NOCASE OR l.details_json LIKE ? COLLATE NOCASE OR u.name LIKE ? COLLATE NOCASE)');
    params.push(`%${filter.q}%`, `%${filter.q}%`, `%${filter.q}%`, `%${filter.q}%`);
  }
  if (filter.action) {
    where.push('l.action = ?');
    params.push(filter.action);
  }
  return db
    .prepare(
      `SELECT l.id, l.action, l.target_type, l.target_id, l.details_json, l.created_at, u.name AS actor_name
       FROM audit_logs l
       LEFT JOIN users u ON u.id = l.actor_user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY l.created_at DESC
       LIMIT ?`
    )
    .all(...params, limit)
    .map((entry) => ({ ...entry, details: parseDetailsJson(entry.details_json) }));
}

function getFilteredLoginAttempts(filter, limit = 100) {
  if (filter.type === 'audit' || filter.type === 'app') {
    return [];
  }
  const where = [];
  const params = [];
  if (filter.q) {
    where.push('(la.identifier LIKE ? COLLATE NOCASE OR la.ip_address LIKE ? OR la.user_agent LIKE ? COLLATE NOCASE OR resolved.name LIKE ? COLLATE NOCASE)');
    params.push(`%${filter.q}%`, `%${filter.q}%`, `%${filter.q}%`, `%${filter.q}%`);
  }
  if (filter.status) {
    where.push('la.status = ?');
    params.push(filter.status);
  }
  return db
    .prepare(
      `SELECT la.id, la.role, la.identifier, la.ip_address, la.ip_chain, la.user_agent,
              la.browser_name, la.browser_version, la.os_name, la.os_version,
              la.device_type, la.device_vendor, la.device_model, la.accept_language,
              la.request_headers_json, la.attempted_identifiers_json, la.status, la.reason, la.created_at,
              resolved.name AS resolved_user_name
       FROM login_attempts la
       LEFT JOIN users resolved ON resolved.id = la.resolved_user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY la.created_at DESC
       LIMIT ?`
    )
    .all(...params, limit)
    .map((entry) => ({
      ...entry,
      attemptedIdentifiers: parseDetailsJson(entry.attempted_identifiers_json || '[]'),
      requestHeaders: parseDetailsJson(entry.request_headers_json || '{}')
    }));
}

function getAppLogEntries(filter, limit = 120) {
  if (filter.type === 'audit' || filter.type === 'login') {
    return [];
  }
  const appLogPath = path.join(LOG_DIR, 'app.log');
  if (!fs.existsSync(appLogPath)) {
    return [];
  }
  const content = fs.readFileSync(appLogPath, 'utf8');
  const entries = content
    .split(/\r?\n(?=\[|\d{4}-\d{2}-\d{2}T)/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const q = filter.q.toLocaleLowerCase('tr');
  return entries
    .filter((entry) => !q || entry.toLocaleLowerCase('tr').includes(q))
    .slice(-limit)
    .reverse();
}

router.get('/admin', requireAdmin, (req, res) => {
  const allowedClasses = getActiveClassBranches();
  const allClasses = getAllClassBranches();
  const roleFilter = stripHtml(req.query.role || '');
  const classFilter = stripHtml(req.query.class_branch || '').toUpperCase();
  const schoolFilter = Number(req.query.school_id || 0);
  const completionFilter = stripHtml(req.query.completion || '');
  const search = stripHtml(req.query.q || '').slice(0, 80);
  const page = parsePage(req.query.page);
  const perPage = 20;
  const usersTotal = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  const studentsTotal = db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'student'").get().total;
  const teachersTotal = db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'teacher'").get().total;
  const messagesTotal = db.prepare('SELECT COUNT(*) AS total FROM messages').get().total;

  const classStats = db
    .prepare(
      `SELECT c.branch AS class_branch, COUNT(u.id) AS total
       FROM classes c
       LEFT JOIN users u ON u.class_branch = c.branch AND u.role = 'student'
       WHERE c.is_active = 1 AND c.is_archived = 0 AND c.deleted_at IS NULL
       GROUP BY c.branch
       ORDER BY c.branch`
    )
    .all();

  const filters = [];
  const params = [];
  if (['student', 'teacher', 'admin', 'guest', 'other'].includes(roleFilter)) {
    filters.push('role = ?');
    params.push(roleFilter);
  }
  if (allowedClasses.includes(classFilter)) {
    filters.push('class_branch = ?');
    params.push(classFilter);
  }
  if (schoolFilter > 0 && db.prepare('SELECT id FROM schools WHERE id = ?').get(schoolFilter)) {
    filters.push('school_id = ?');
    params.push(schoolFilter);
  }
  if (search) {
    filters.push('(name LIKE ? COLLATE NOCASE OR student_number LIKE ? OR login_identifier LIKE ? COLLATE NOCASE)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (completionFilter === 'missing_photo') filters.push('photo_path IS NULL');
  if (completionFilter === 'missing_slogan') filters.push("length(trim(COALESCE(slogan, ''))) = 0");
  if (completionFilter === 'missing_bio') filters.push("length(trim(COALESCE(bio, ''))) = 0");
  if (completionFilter === 'missing_free_text') filters.push("length(trim(COALESCE(free_text, ''))) = 0");
  if (completionFilter === 'missing_contact') {
    filters.push(
      `length(trim(COALESCE(contact_phone, '') || COALESCE(contact_email, '') || COALESCE(contact_instagram, '') || COALESCE(contact_x, '') || COALESCE(contact_facebook, '') || COALESCE(contact_linkedin, '') || COALESCE(contact_nsocial, '') || COALESCE(custom_contacts_json, ''))) = 2`
    );
  }
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const countStatement = db.prepare(`SELECT COUNT(*) AS total FROM users ${whereClause}`);
  const filteredUsersTotal = countStatement.get(...params).total;
  const totalPages = Math.max(1, Math.ceil(filteredUsersTotal / perPage));
  const currentPage = Math.min(page, totalPages);

  const users = db
    .prepare(
      `SELECT id, name, student_number, login_identifier, role, class_branch, president_class_branch, created_at, photo_locked,
              school_id, status, photo_path, slogan, bio, free_text, favorite_memory, favorite_quote,
              contact_phone, contact_email, contact_instagram, contact_x, contact_facebook, contact_linkedin,
              contact_nsocial, custom_contacts_json, updated_at,
              CASE WHEN photo_path IS NOT NULL THEN 1 ELSE 0 END AS has_photo,
              CASE WHEN length(trim(COALESCE(slogan, ''))) > 0 THEN 1 ELSE 0 END AS has_slogan
       FROM users
       ${whereClause}
       ORDER BY role, class_branch, name
       LIMIT ? OFFSET ?`
    )
    .all(...params, perPage, (currentPage - 1) * perPage);
  const usersWithIdentifiers = users.map((user) => ({
    ...user,
    login_identifier: ensureLoginIdentifier(user),
    completion: calculateProfileCompletion(user)
  })).sort(compareUsersTurkish);

  const activityUsers = getUserActivityRows(40);

  const recentMessages = db
    .prepare(
      `SELECT m.id, m.message, m.created_at, sender.name as sender_name, receiver.name as receiver_name
       FROM messages m
       JOIN users sender ON sender.id = m.from_user_id
       JOIN users receiver ON receiver.id = m.to_user_id
       ORDER BY m.created_at DESC
       LIMIT 20`
    )
    .all();

  const flaggedMessages = db
    .prepare(
      `SELECT f.id, f.reason, f.created_at, f.status, m.id AS message_id, m.message,
              reporter.name AS reporter_name, receiver.name AS receiver_name, sender.name AS sender_name
       FROM message_flags f
       JOIN messages m ON m.id = f.message_id
       JOIN users reporter ON reporter.id = f.reporter_user_id
       JOIN users sender ON sender.id = m.from_user_id
       JOIN users receiver ON receiver.id = m.to_user_id
       WHERE f.status = 'open'
       ORDER BY f.created_at DESC
       LIMIT 20`
    )
    .all();
  const reportedUsers = db
    .prepare(
      `SELECT r.id, r.reason, r.created_at, r.status,
              reporter.name AS reporter_name,
              reported.id AS reported_user_id,
              reported.name AS reported_user_name,
              reported.role AS reported_user_role,
              reported.class_branch AS reported_user_class_branch
       FROM user_reports r
       JOIN users reporter ON reporter.id = r.reporter_user_id
       JOIN users reported ON reported.id = r.reported_user_id
       WHERE r.status = 'open'
       ORDER BY r.created_at DESC
       LIMIT 20`
    )
    .all();

  const announcements = db
    .prepare(
      `SELECT a.id, a.title, a.body, a.is_active, a.created_at, u.name AS author_name
       FROM announcements a
       JOIN users u ON u.id = a.created_by_user_id
       ORDER BY a.created_at DESC
       LIMIT 20`
    )
    .all();

  const auditLogs = db
    .prepare(
      `SELECT l.id, l.action, l.target_type, l.target_id, l.details_json, l.created_at, u.name AS actor_name
       FROM audit_logs l
       LEFT JOIN users u ON u.id = l.actor_user_id
       ORDER BY l.created_at DESC
       LIMIT 30`
    )
    .all()
    .map((entry) => ({
      ...entry,
      details: parseDetailsJson(entry.details_json)
    }));

  const loginAttempts = db
    .prepare(
      `SELECT la.id, la.role, la.identifier, la.ip_address, la.ip_chain, la.user_agent,
              la.browser_name, la.browser_version, la.os_name, la.os_version,
              la.device_type, la.device_vendor, la.device_model, la.accept_language,
              la.request_headers_json, la.attempted_identifiers_json, la.status, la.reason, la.created_at,
              resolved.name AS resolved_user_name
       FROM login_attempts la
       LEFT JOIN users resolved ON resolved.id = la.resolved_user_id
       ORDER BY la.created_at DESC
       LIMIT 30`
    )
    .all()
    .map((entry) => ({
      ...entry,
      attemptedIdentifiers: parseDetailsJson(entry.attempted_identifiers_json || '[]')
    }));

  const backups = listBackups();
  const schools = db.prepare(
    `SELECT id, name, slug, theme_color, background_wallpaper_path, background_wallpaper_enabled, background_gradient_enabled, is_active
     FROM schools
     ORDER BY name COLLATE NOCASE ASC`
  ).all();
  const currentSchoolSetting = db.prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'current_school_id'").get();
  const currentSchoolId = currentSchoolSetting ? Number(currentSchoolSetting.setting_value || 0) : (schools[0] ? schools[0].id : 0);
  const signupRequests = db
    .prepare(
      `SELECT sr.id, sr.name, sr.role, sr.student_number, sr.class_branch, sr.note, sr.created_at,
              s.name AS school_name
       FROM signup_requests sr
       LEFT JOIN schools s ON s.id = sr.school_id
       WHERE sr.status = 'pending'
       ORDER BY sr.created_at ASC
       LIMIT 30`
    )
    .all();
  const homeBackground = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'home_background_path'")
    .get();
  const graduationDateSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'graduation_date'")
    .get();
  const closingTitleSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'closing_title'")
    .get();
  const closingBodySetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'closing_body'")
    .get();
  const archivePublicSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'archive_public'")
    .get();
  const profilePhotoEditModeSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'profile_photo_edit_mode'")
    .get();
  const liquidGlassSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'liquid_glass_enabled'")
    .get();
  const liquidGlassPresetSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'liquid_glass_preset'")
    .get();
  const liquidGlassStyleSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'liquid_glass_style'")
    .get();
  const homeHeroTextSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'home_hero_text'")
    .get();
  const userAccentModeSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'user_accent_mode'")
    .get();
  const contentApprovalEnabled = isContentApprovalEnabled(db);
  const schoolYears = db
    .prepare(
      `SELECT id, label, is_current, is_archived, created_at, archived_at
       FROM school_years
       ORDER BY is_current DESC, created_at DESC`
    )
    .all();
  const classRecords = db
    .prepare(
      `SELECT c.id, c.branch, c.theme_color, c.is_active, c.is_archived, c.deleted_at, c.created_at,
              y.label AS school_year_label,
              COUNT(u.id) AS student_total
       FROM classes c
       LEFT JOIN school_years y ON y.id = c.school_year_id
       LEFT JOIN users u ON u.class_branch = c.branch AND u.role = 'student' AND u.status = 'active'
       GROUP BY
         c.id,
         c.branch,
         c.theme_color,
         c.is_active,
         c.is_archived,
         c.deleted_at,
         c.created_at,
         y.label
       ORDER BY c.deleted_at IS NOT NULL ASC, c.is_archived ASC, c.branch`
    )
    .all();
  const presidentHistory = db
    .prepare(
      `SELECT h.id, h.class_branch, h.action, h.created_at, president.name AS president_name, actor.name AS actor_name
       FROM class_president_history h
       LEFT JOIN users president ON president.id = h.user_id
       LEFT JOIN users actor ON actor.id = h.actor_user_id
       ORDER BY h.created_at DESC
       LIMIT 30`
    )
    .all();
  const reportStats = {
    activeStudents: db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'student' AND status = 'active'").get().total,
    inactiveUsers: db.prepare("SELECT COUNT(*) AS total FROM users WHERE status = 'inactive'").get().total,
    graduatedStudents: db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'student' AND status = 'graduated'").get().total,
    archivedStudents: db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'student' AND status = 'archived'").get().total,
    classesActive: db.prepare('SELECT COUNT(*) AS total FROM classes WHERE is_active = 1 AND is_archived = 0 AND deleted_at IS NULL').get().total,
    classesArchived: db.prepare('SELECT COUNT(*) AS total FROM classes WHERE is_archived = 1 AND deleted_at IS NULL').get().total
  };

  return res.render('admin/dashboard', {
    title: 'Yönetim Paneli',
    stats: { usersTotal, studentsTotal, teachersTotal, messagesTotal },
    classStats,
    users: usersWithIdentifiers,
    activityUsers,
    recentMessages,
    flaggedMessages,
    reportedUsers,
    announcements,
    auditLogs,
    loginAttempts,
    backups,
    homeBackgroundPath: homeBackground ? homeBackground.setting_value : '',
    yearEndSettings: {
      graduationDate: graduationDateSetting ? graduationDateSetting.setting_value : '',
      closingTitle: closingTitleSetting ? closingTitleSetting.setting_value : '',
      closingBody: closingBodySetting ? closingBodySetting.setting_value : '',
      archivePublic: archivePublicSetting ? archivePublicSetting.setting_value === '1' : false,
      profilePhotoEditMode:
        profilePhotoEditModeSetting && profilePhotoEditModeSetting.setting_value === 'admin_only' ? 'admin_only' : 'self',
      liquidGlassEnabled: liquidGlassSetting ? liquidGlassSetting.setting_value === '1' : false,
      liquidGlassPreset: ['soft', 'vivid', 'mist', 'gradient'].includes(liquidGlassPresetSetting && liquidGlassPresetSetting.setting_value)
        ? liquidGlassPresetSetting.setting_value
        : 'soft',
      liquidGlassStyle: ['solid', 'clear', 'v2', 'v3'].includes(liquidGlassStyleSetting && liquidGlassStyleSetting.setting_value)
        ? liquidGlassStyleSetting.setting_value
        : 'clear',
      homeHeroText: homeHeroTextSetting ? homeHeroTextSetting.setting_value : 'Sınıfları gezebilir, öğretmen profillerini inceleyebilir ve tek seferlik yıllık mesajlarını yazabilirsin.',
      userAccentMode: (userAccentModeSetting && userAccentModeSetting.setting_value === 'default') ? 'default' : 'random'
    },
    filters: { roleFilter, classFilter, schoolFilter, completionFilter, search, currentPage, totalPages, perPage, filteredUsersTotal },
    allowedClasses,
    allClasses,
    schools,
    currentSchoolId,
    signupRequests,
    schoolYears,
    classRecords,
    presidentHistory,
    reportStats,
    featureDefinitions: CORE_FEATURE_DEFINITIONS,
    gameMenuDefinitions: GAME_MENU_DEFINITIONS,
    profilePhotoEditModes: PROFILE_PHOTO_EDIT_MODES,
    currentFeatureFlags: buildFeatureFlags(db),
    contentApprovalEnabled,
    moderationSettings: getModerationSettings(),
    yearbookLockState: getYearbookLockState(db),
    maintenanceState: getMaintenanceState()
  });
});

router.post('/admin/features', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const update = db.prepare(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value = excluded.setting_value,
       updated_at = CURRENT_TIMESTAMP`
  );

  const formScope = ['sistem', 'oyunlar', 'arayuz'].includes(req.body.form_scope) ? req.body.form_scope : 'sistem';

  FEATURE_DEFINITIONS.forEach((feature) => {
    const fallbackKey = `feature_${feature.key}_fallback`;
    if (!(fallbackKey in req.body)) return; // bu form bu feature'ı yönetmiyor, atla
    const enabled = req.body[`feature_${feature.key}`] === 'yes' ? '1' : '0';
    update.run(featureSettingKey(feature.key), enabled);
  });

  let profilePhotoEditMode, liquidGlassEnabled, liquidGlassPreset, liquidGlassStyle, contentApprovalEnabled;

  if (formScope === 'sistem') {
    const submittedPhotoModes = Array.isArray(req.body.profile_photo_edit_mode)
      ? req.body.profile_photo_edit_mode
      : [req.body.profile_photo_edit_mode];
    profilePhotoEditMode = submittedPhotoModes.includes('admin_only') ? 'admin_only' : 'self';
    update.run('profile_photo_edit_mode', profilePhotoEditMode);
    contentApprovalEnabled = req.body.content_approval_enabled === 'yes';
    setContentApprovalEnabled(db, contentApprovalEnabled);
  }

  if (formScope === 'arayuz') {
    liquidGlassEnabled = req.body.liquid_glass_enabled === 'yes';
    liquidGlassPreset = ['soft', 'vivid', 'mist', 'gradient'].includes(req.body.liquid_glass_preset)
      ? req.body.liquid_glass_preset
      : 'soft';
    liquidGlassStyle = ['solid', 'clear', 'v2', 'v3'].includes(req.body.liquid_glass_style)
      ? req.body.liquid_glass_style
      : 'clear';
    update.run('liquid_glass_enabled', liquidGlassEnabled ? '1' : '0');
    update.run('liquid_glass_preset', liquidGlassPreset);
    update.run('liquid_glass_style', liquidGlassStyle);
    const userAccentMode = req.body.user_accent_mode === 'random' ? 'random' : 'default';
    update.run('user_accent_mode', userAccentMode);
    const homeHeroText = (req.body.home_hero_text || '').trim().slice(0, 500);
    update.run('home_hero_text', homeHeroText);
  }

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_feature_flags_update',
    targetType: 'app_settings',
    targetId: null,
    details: { formScope, features: buildFeatureFlags(db), profilePhotoEditMode, liquidGlassEnabled, liquidGlassPreset, liquidGlassStyle, contentApprovalEnabled }
  });
  req.flash('success', 'Özellik ayarları güncellendi.');
  return res.redirect('/admin');
});

router.post('/admin/users/unlock-photo-locks', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const result = db
    .prepare('UPDATE users SET photo_locked = 0, updated_at = CURRENT_TIMESTAMP WHERE photo_locked = 1')
    .run();

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_unlock_all_photo_locks',
    targetType: 'users',
    targetId: null,
    details: { unlockedCount: result.changes || 0 }
  });

  req.flash('success', `${result.changes || 0} kullanıcının fotoğraf kilidi açıldı.`);
  return res.redirect('/admin#admin-feature-settings');
});

router.post('/admin/users/reset-kvkk-all', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const result = db
    .prepare('UPDATE users SET kvkk_approved_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE kvkk_approved_at IS NOT NULL')
    .run();

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_kvkk_consent_reset_all',
    targetType: 'users',
    targetId: null,
    details: { resetCount: result.changes || 0 }
  });

  req.flash('success', `${result.changes || 0} kullanıcının KVKK onayı sıfırlandı.`);
  return res.redirect('/admin#admin-feature-settings');
});

router.post('/admin/yearbook-lock', requireLogin, requireSchoolManager, adminWriteLimiter, verifyCsrf, (req, res) => {
  const locked = req.body.yearbook_locked === 'yes';
  const message = stripHtml(req.body.yearbook_lock_message || '').slice(0, 300);
  setYearbookLockState(db, locked, message || 'Yıllık kilitli. İçerikler yalnızca okunabilir.');
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_yearbook_lock_update',
    targetType: 'app_settings',
    targetId: null,
    details: { locked }
  });
  req.flash('success', locked ? 'Yıllık kilitlendi.' : 'Yıllık kilidi açıldı.');
  return res.redirect(req.get('referer') || '/admin');
});

router.post('/admin/moderation-settings', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const bannedWords = stripHtml(req.body.banned_words || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 200)
    .join(',');
  setSettingValue('moderation_banned_words', bannedWords);
  setSettingValue('moderation_block_links', req.body.block_links === 'yes' ? '1' : '0');
  setSettingValue('moderation_manager_link_bypass', req.body.manager_link_bypass === 'yes' ? '1' : '0');
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_moderation_settings_update',
    targetType: 'app_settings',
    targetId: null,
    details: { wordCount: bannedWords ? bannedWords.split(',').length : 0, blockLinks: req.body.block_links === 'yes' }
  });
  req.flash('success', 'Moderasyon ayarları güncellendi.');
  return res.redirect('/admin');
});

router.post('/admin/bulk-notifications', requireLogin, requireSchoolManager, adminWriteLimiter, verifyCsrf, (req, res) => {
  const scope = getUserSchoolScope(req.currentUser);
  const title = stripHtml(req.body.title || '').slice(0, 120);
  const body = stripHtml(req.body.body || '').slice(0, 1000);
  const schoolId = Number(req.body.school_id || 0);
  const role = stripHtml(req.body.role || '');
  const classBranch = stripHtml(req.body.class_branch || '').toUpperCase();
  const userIds = String(req.body.user_ids || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 300);
  if (!title || !body) {
    req.flash('error', 'Bildirim başlığı ve mesajı zorunludur.');
    return res.redirect(req.get('referer') || '/admin');
  }
  if (!scope.allSchools && schoolId && !canAccessSchool(req.currentUser, schoolId)) {
    req.flash('error', 'Bu okula bildirim gönderme yetkiniz yok.');
    return res.redirect(req.get('referer') || '/admin');
  }
  const moderation = validateContentText(db, `${title} ${body}`, { minLength: 3, allowLinks: getModerationSettings().managerLinkBypass });
  if (!moderation.ok) {
    req.flash('error', moderation.message);
    return res.redirect(req.get('referer') || '/admin');
  }
  const where = ["role <> 'admin'", "status <> 'archived'"];
  const params = [];
  if (schoolId) {
    where.push('school_id = ?');
    params.push(schoolId);
  } else {
    appendSchoolScope(where, params, req.currentUser, 'school_id');
  }
  if (['student', 'teacher', 'other', 'guest'].includes(role)) {
    where.push('role = ?');
    params.push(role);
  }
  if (classBranch) {
    where.push('class_branch = ?');
    params.push(classBranch);
  }
  if (userIds.length) {
    where.push(`id IN (${userIds.map(() => '?').join(',')})`);
    params.push(...userIds);
  }
  const targets = db.prepare(`SELECT id FROM users WHERE ${where.join(' AND ')} LIMIT 1000`).all(...params);
  targets.forEach((target) => {
    createInboxNotification({
      userId: target.id,
      actorUserId: req.currentUser.id,
      kind: 'bulk_announcement',
      title,
      body,
      linkPath: '/'
    });
  });
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_bulk_notification_create',
    targetType: 'inbox_notifications',
    targetId: null,
    details: { sentCount: targets.length, schoolId: schoolId || null, role: role || null, classBranch: classBranch || null, explicitUsers: userIds.length }
  });
  req.flash('success', `${targets.length} kullanıcıya bildirim gönderildi.`);
  return res.redirect(req.get('referer') || '/admin');
});

router.get('/admin/schools', requireLogin, requireSchoolManager, (req, res) => {
  const schools = getVisibleSchools(req.currentUser);
  const activeSchools = req.currentUser.role === 'admin'
    ? schools.filter((school) => Number(school.is_active) === 1)
    : schools;
  const currentSchoolSetting = db.prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'current_school_id'").get();
  const currentSchoolId = currentSchoolSetting ? Number(currentSchoolSetting.setting_value || 0) : (activeSchools[0] ? activeSchools[0].id : 0);
  const pendingSignupCount = req.currentUser.role === 'admin'
    ? db.prepare("SELECT COUNT(*) AS total FROM signup_requests WHERE status = 'pending'").get().total
    : req.currentUser.school_id
      ? db.prepare("SELECT COUNT(*) AS total FROM signup_requests WHERE status = 'pending' AND school_id = ?").get(req.currentUser.school_id).total
      : 0;
  const userCounts = schools.length
    ? db.prepare(
        `SELECT school_id,
                SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) AS students,
                SUM(CASE WHEN role = 'teacher' THEN 1 ELSE 0 END) AS teachers,
                SUM(CASE WHEN role = 'other' THEN 1 ELSE 0 END) AS others
         FROM users
         WHERE school_id IN (${schools.map(() => '?').join(',')})
         GROUP BY school_id`
      ).all(...schools.map((school) => school.id))
    : [];
  const countBySchool = new Map(userCounts.map((row) => [row.school_id, row]));

  return res.render('admin/schools', {
    title: 'Okul Ayarları',
    schools,
    activeSchools,
    currentSchoolId,
    pendingSignupCount,
    countBySchool,
    canManageAllSchools: req.currentUser.role === 'admin'
  });
});

router.post('/admin/schools', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const name = stripHtml(req.body.name || '').slice(0, 120);
  const themeColor = stripHtml(req.body.theme_color || '').slice(0, 20);
  if (!name) {
    req.flash('error', 'Okul adı zorunludur.');
    return res.redirect('/admin/schools');
  }
  if (themeColor && !/^#[0-9a-fA-F]{6}$/.test(themeColor)) {
    req.flash('error', 'Okul tema rengi geçersiz.');
    return res.redirect('/admin/schools');
  }
  const slug = normalizeSchoolSlug(name);
  try {
    db.prepare(
      `INSERT INTO schools (name, slug, theme_color, background_wallpaper_enabled, background_gradient_enabled)
       VALUES (?, ?, ?, 0, 1)
       ON CONFLICT(name) DO UPDATE SET
         theme_color = excluded.theme_color,
         is_active = 1,
         updated_at = CURRENT_TIMESTAMP`
    ).run(name, slug, themeColor || '');
  } catch (error) {
    req.flash('error', `Okul kaydedilemedi: ${error.message}`);
    return res.redirect('/admin/schools');
  }
  req.flash('success', 'Okul kaydedildi.');
  return res.redirect('/admin/schools');
});

router.post('/admin/schools/select', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const schoolId = Number(req.body.school_id || 0);
  const school = db.prepare('SELECT id FROM schools WHERE id = ? AND is_active = 1').get(schoolId);
  if (!school) {
    req.flash('error', 'Okul bulunamadı.');
    return res.redirect('/admin/schools');
  }
  db.prepare(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES ('current_school_id', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`
  ).run(String(schoolId));
  req.flash('success', 'Aktif okul seçildi.');
  return res.redirect('/admin/schools');
});

router.post('/admin/schools/:id/theme', requireLogin, requireSchoolManager, adminWriteLimiter, adminPhotoUpload.single('wallpaper_image'), verifyCsrf, (req, res) => {
  const schoolId = Number(req.params.id);
  const themeColor = stripHtml(req.body.theme_color || '').slice(0, 20);
  const backgroundWallpaperEnabled = req.body.background_wallpaper_enabled === 'yes';
  const backgroundGradientEnabled = req.body.background_gradient_enabled === 'yes';
  const removeWallpaper = req.body.remove_wallpaper === 'yes';
  if (themeColor && !/^#[0-9a-fA-F]{6}$/.test(themeColor)) {
    req.flash('error', 'Okul tema rengi geçersiz.');
    return res.redirect('/admin/schools');
  }
  if (!canManageSchool(req.currentUser, schoolId)) {
    if (req.file) {
      deleteFileIfExists(`/uploads/photos/${req.file.filename}`);
    }
    req.flash('error', 'Bu okulu düzenleme yetkiniz yok.');
    return res.redirect('/admin/schools');
  }
  const school = db
    .prepare('SELECT id, name, background_wallpaper_path FROM schools WHERE id = ?')
    .get(schoolId);
  if (!school) {
    if (req.file) {
      deleteFileIfExists(`/uploads/photos/${req.file.filename}`);
    }
    req.flash('error', 'Okul bulunamadı.');
    return res.redirect('/admin/schools');
  }

  let nextWallpaperPath = school.background_wallpaper_path || '';
  try {
    if (req.file) {
      assertImageSignature(req.file);
      const uploadedPath = `/uploads/photos/${req.file.filename}`;
      if (nextWallpaperPath && nextWallpaperPath !== uploadedPath) {
        deleteFileIfExists(nextWallpaperPath);
      }
      nextWallpaperPath = uploadedPath;
    }
  } catch (error) {
    if (req.file) {
      deleteFileIfExists(`/uploads/photos/${req.file.filename}`);
    }
    req.flash('error', error.message || 'Arka plan görseli doğrulanamadı.');
    return res.redirect('/admin/schools');
  }

  if (removeWallpaper && nextWallpaperPath) {
    deleteFileIfExists(nextWallpaperPath);
    nextWallpaperPath = '';
  }

  db.prepare(
    `UPDATE schools
     SET theme_color = ?,
         background_wallpaper_path = ?,
         background_wallpaper_enabled = ?,
         background_gradient_enabled = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    themeColor || '',
    nextWallpaperPath,
    backgroundWallpaperEnabled ? 1 : 0,
    backgroundGradientEnabled ? 1 : 0,
    schoolId
  );
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'school_theme_updated',
    targetType: 'school',
    targetId: schoolId,
    details: {
      schoolName: school.name,
      themeColor: themeColor || '',
      backgroundWallpaperEnabled,
      backgroundGradientEnabled,
      backgroundWallpaperPath: nextWallpaperPath
    }
  });
  req.flash('success', 'Okul teması ve arka planı güncellendi.');
  return res.redirect('/admin/schools');
});

router.post('/admin/schools/:id/assign-role', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const schoolId = Number(req.params.id);
  const role = stripHtml(req.body.role || '');
  const school = db.prepare('SELECT id, name FROM schools WHERE id = ? AND is_active = 1').get(schoolId);
  if (!school) {
    req.flash('error', 'Okul bulunamadı.');
    return res.redirect('/admin/schools');
  }
  if (!['student', 'teacher', 'other'].includes(role)) {
    req.flash('error', 'Geçersiz kullanıcı grubu.');
    return res.redirect('/admin/schools');
  }
  const result = db.prepare('UPDATE users SET school_id = ?, updated_at = CURRENT_TIMESTAMP WHERE role = ?').run(schoolId, role);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_school_assign_role',
    targetType: 'school',
    targetId: schoolId,
    details: { role, affectedUsers: result.changes }
  });
  const roleLabel = role === 'student' ? 'öğrenci' : role === 'teacher' ? 'öğretmen' : 'diğer kullanıcı';
  req.flash('success', `${result.changes} ${roleLabel} ${school.name} okuluna atandı.`);
  return res.redirect('/admin/schools');
});

router.post('/admin/schools/:id/delete', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const schoolId = Number(req.params.id);
  const deleteConfirmation = stripHtml(req.body.delete_confirmation || '');
  const school = db.prepare('SELECT id, name FROM schools WHERE id = ? AND is_active = 1').get(schoolId);
  if (!school) {
    const inactiveSchool = db.prepare('SELECT id FROM schools WHERE id = ? AND is_active = 0').get(schoolId);
    if (inactiveSchool) {
      req.flash('error', 'Bu okul zaten silinmiş durumda. Tamamen kaldırmak için Kalıcı Sil butonunu kullanın.');
      return res.redirect('/admin/schools');
    }
    req.flash('error', 'Okul bulunamadı.');
    return res.redirect('/admin/schools');
  }
  if (deleteConfirmation !== school.name) {
    req.flash('error', 'Okul silme onayı hatalı. Onay alanına okul adını aynen yazın.');
    return res.redirect('/admin/schools');
  }
  if (!requireAdminAccessCode(req)) {
    return res.redirect('/admin/schools');
  }
  const activeTotal = db.prepare('SELECT COUNT(*) AS total FROM schools WHERE is_active = 1').get().total;
  if (activeTotal <= 1) {
    req.flash('error', 'Son aktif okul silinemez.');
    return res.redirect('/admin/schools');
  }

  db.prepare('UPDATE schools SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(schoolId);
  const currentSchoolSetting = db.prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'current_school_id'").get();
  if (currentSchoolSetting && Number(currentSchoolSetting.setting_value || 0) === schoolId) {
    const nextSchool = db.prepare('SELECT id FROM schools WHERE is_active = 1 ORDER BY id ASC LIMIT 1').get();
    if (nextSchool) {
      db.prepare(
        `INSERT INTO app_settings (setting_key, setting_value, updated_at)
         VALUES ('current_school_id', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`
      ).run(String(nextSchool.id));
    }
  }
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_school_delete',
    targetType: 'school',
    targetId: schoolId,
    details: { schoolName: school.name }
  });
  req.flash('success', `${school.name} okulu silindi.`);
  return res.redirect('/admin/schools');
});

router.post('/admin/schools/:id/recover', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const schoolId = Number(req.params.id);
  const school = db.prepare('SELECT id, name FROM schools WHERE id = ? AND is_active = 0').get(schoolId);
  if (!school) {
    req.flash('error', 'Geri yüklenecek okul bulunamadı.');
    return res.redirect('/admin/schools');
  }

  db.prepare('UPDATE schools SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(schoolId);
  const currentSchoolSetting = db.prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'current_school_id'").get();
  if (!currentSchoolSetting || !Number(currentSchoolSetting.setting_value || 0)) {
    db.prepare(
      `INSERT INTO app_settings (setting_key, setting_value, updated_at)
       VALUES ('current_school_id', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`
    ).run(String(schoolId));
  }
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_school_recover',
    targetType: 'school',
    targetId: schoolId,
    details: { schoolName: school.name }
  });
  req.flash('success', `${school.name} okulu geri yüklendi.`);
  return res.redirect('/admin/schools');
});

router.post('/admin/schools/:id/permanent-delete', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const schoolId = Number(req.params.id);
  const deleteConfirmation = stripHtml(req.body.delete_confirmation || '');
  const school = db.prepare('SELECT id, name FROM schools WHERE id = ? AND is_active = 0').get(schoolId);
  if (!school) {
    req.flash('error', 'Kalıcı silinecek okul bulunamadı. Önce okulu normal silme ile pasife alın.');
    return res.redirect('/admin/schools');
  }
  if (deleteConfirmation !== school.name) {
    req.flash('error', 'Kalıcı silme onayı hatalı. Onay alanına okul adını aynen yazın.');
    return res.redirect('/admin/schools');
  }
  if (!requireAdminAccessCode(req)) {
    return res.redirect('/admin/schools');
  }

  const attachedUsers = db.prepare('SELECT COUNT(*) AS total FROM users WHERE school_id = ?').get(schoolId).total;
  if (Number(attachedUsers || 0) > 0) {
    req.flash('error', 'Bu okula bağlı kullanıcılar varken okul kalıcı silinemez. Önce kullanıcıları başka okula taşıyın.');
    return res.redirect('/admin/schools');
  }

  const detachedRequests = db.prepare('UPDATE signup_requests SET school_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE school_id = ?').run(schoolId);
  db.prepare("DELETE FROM app_settings WHERE setting_key = 'current_school_id' AND setting_value = ?").run(String(schoolId));
  db.prepare('DELETE FROM schools WHERE id = ? AND is_active = 0').run(schoolId);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_school_permanent_delete',
    targetType: 'school',
    targetId: schoolId,
    details: { schoolName: school.name, detachedSignupRequests: detachedRequests.changes }
  });
  req.flash('success', `${school.name} okulu kalıcı olarak silindi.`);
  return res.redirect('/admin/schools');
});

router.get('/admin/signup-requests', requireLogin, requireSchoolManager, (req, res) => {
  const schools = getVisibleSchools(req.currentUser);
  const schoolIds = schools.map((school) => school.id);
  const requests = req.currentUser.role === 'admin'
    ? db.prepare(
        `SELECT sr.*, s.name AS school_name
         FROM signup_requests sr
         LEFT JOIN schools s ON s.id = sr.school_id
         WHERE sr.status = 'pending'
         ORDER BY sr.created_at ASC`
      ).all()
    : schoolIds.length
      ? db.prepare(
          `SELECT sr.*, s.name AS school_name
           FROM signup_requests sr
           LEFT JOIN schools s ON s.id = sr.school_id
           WHERE sr.status = 'pending' AND sr.school_id = ?
           ORDER BY sr.created_at ASC`
        ).all(schoolIds[0])
      : [];
  return res.render('admin/signup-requests', {
    title: 'Hesap Başvuruları',
    requests
  });
});

router.post('/admin/signup-requests/:id/:decision', requireLogin, requireSchoolManager, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  const decision = stripHtml(req.params.decision || '');
  const request = db.prepare("SELECT * FROM signup_requests WHERE id = ? AND status = 'pending'").get(id);
  if (!request) {
    req.flash('error', 'Başvuru bulunamadı.');
    return res.redirect('/admin/signup-requests');
  }
  if (req.currentUser.role !== 'admin' && Number(req.currentUser.school_id) !== Number(request.school_id)) {
    req.flash('error', 'Bu okulun başvurusunu yönetme yetkiniz yok.');
    return res.redirect('/admin/signup-requests');
  }
  if (decision === 'reject') {
    db.prepare(
      "UPDATE signup_requests SET status = 'rejected', reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(req.currentUser.id, id);
    req.flash('success', 'Başvuru reddedildi.');
    return res.redirect('/admin/signup-requests');
  }
  if (decision !== 'approve') {
    req.flash('error', 'Geçersiz işlem.');
    return res.redirect('/admin/signup-requests');
  }
  const accessCode = generateAccessCode();
  const result = db.prepare(
    `INSERT INTO users (name, student_number, role, school_id, class_branch, teacher_category, access_code_hash, initial_access_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    normalizeName(request.name),
    request.role === 'student' ? request.student_number : null,
    request.role,
    request.school_id || null,
    request.role === 'student' ? request.class_branch : null,
    request.role === 'teacher' ? request.teacher_category : 'other',
    hashAccessCode(accessCode),
    accessCode
  );
  const createdUserId = Number(result.lastInsertRowid);
  const loginIdentifier = ensureLoginIdentifier({ id: createdUserId, role: request.role, name: request.name, login_identifier: null });
  db.prepare(
    "UPDATE signup_requests SET status = 'approved', reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, created_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(req.currentUser.id, createdUserId, id);
  req.flash('success', `Başvuru onaylandı. Kullanıcı ilk girişte erişim kodunu boş bırakabilir. Giriş kimliği: ${loginIdentifier}`);
  return res.redirect('/admin/signup-requests');
});

router.get('/admin/yearbook-book', requireLogin, requireSchoolManager, (req, res) => {
  const schoolContext = getYearbookExportSchoolContext(req.query || {}, req.currentUser);
  return res.render('admin/yearbook-book', {
    title: 'Yıllık Export',
    settings: getYearbookBookSettings(),
    allClasses: getClassBranchesForSchool(schoolContext.schoolId),
    schools: schoolContext.visibleSchools,
    selectedSchoolId: schoolContext.schoolId,
    canChooseSchool: req.currentUser.role === 'admin'
  });
});

router.post('/admin/yearbook-book/settings', requireLogin, requireSchoolManager, adminWriteLimiter, verifyCsrf, adminPhotoUpload.single('cover_image'), (req, res) => {
  const coverTitle = stripHtml(req.body.cover_title || '').slice(0, 120) || 'Yıllık';
  const coverSubtitle = stripHtml(req.body.cover_subtitle || '').slice(0, 180);
  const coverYear = stripHtml(req.body.cover_year || '').slice(0, 40);
  const introText = stripHtml(req.body.intro_text || '').slice(0, 1200);
  const preparedBy = stripHtml(req.body.prepared_by || '').slice(0, 120);
  const themeColor = /^#[0-9a-f]{6}$/i.test(String(req.body.theme_color || '')) ? req.body.theme_color : '#6f4e1e';
  const allowedSections = ['classes', 'teachers', 'others', 'anonymous', 'gallery', 'closing'];
  const allowedProfileFields = ['slogan', 'bio', 'free_text', 'favorite_memory', 'favorite_quote', 'birth_date', 'contact', 'messages', 'likes', 'guestbook', 'three_words'];
  const sectionOrderText = stripHtml(req.body.section_order || '').slice(0, 240);
  const requestedSectionOrder = sectionOrderText
    .split(',')
    .map((item) => item.trim())
    .filter((item) => allowedSections.includes(item));
  const selectedSections = normalizeArrayInput(req.body.include_sections).filter((item) => allowedSections.includes(item));
  const sectionOrder = requestedSectionOrder.length
    ? requestedSectionOrder.filter((section) => selectedSections.includes(section))
    : allowedSections.filter((section) => selectedSections.includes(section));
  const profileFields = normalizeArrayInput(req.body.profile_fields).filter((item) => allowedProfileFields.includes(item));
  setAppSetting('yearbook_book_cover_title', coverTitle);
  setAppSetting('yearbook_book_cover_subtitle', coverSubtitle);
  setAppSetting('yearbook_book_cover_year', coverYear);
  setAppSetting('yearbook_book_intro_text', introText);
  setAppSetting('yearbook_book_prepared_by', preparedBy);
  if (req.file) {
    try {
      assertImageSignature(req.file);
      setAppSetting('yearbook_book_cover_image_path', `/uploads/photos/${req.file.filename}`);
    } catch (error) {
      deleteFileIfExists(`/uploads/photos/${req.file.filename}`);
      req.flash('error', error.message || 'Kapak görseli geçersiz.');
      return res.redirect('/admin/yearbook-book');
    }
  } else if (req.body.remove_cover_image === 'yes') {
    const oldPath = getAppSetting('yearbook_book_cover_image_path', '');
    if (oldPath) deleteFileIfExists(oldPath);
    setAppSetting('yearbook_book_cover_image_path', '');
  }
  setAppSetting('yearbook_book_theme_color', themeColor);
  const messageLimit = Math.max(0, parseInt(req.body.message_limit || '0', 10) || 0);
  setAppSetting('yearbook_book_section_order', JSON.stringify(sectionOrder.length ? sectionOrder : allowedSections));
  setAppSetting('yearbook_book_profile_fields', JSON.stringify(profileFields.length ? profileFields : allowedProfileFields));
  setAppSetting('yearbook_book_message_limit', String(messageLimit));
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'yearbook_book_settings_update',
    targetType: 'app_settings',
    targetId: null,
    details: { coverTitle, coverYear, themeColor, sectionOrder, profileFields }
  });
  req.flash('success', 'Yıllık export kapak ayarları kaydedildi.');
  return res.redirect('/admin/yearbook-book');
});

router.get('/admin/yearbook-book.html', requireLogin, requireSchoolManager, adminExportLimiter, (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const data = getYearbookBookData(req.query, baseUrl, req.currentUser);
  const html = renderYearbookBookHtml(data);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="kitap-yillik-${data.scope === 'class' ? data.classBranch : 'okul'}.html"`);
  return res.send(html);
});

router.get('/admin/yearbook-book.pdf', requireLogin, requireSchoolManager, adminExportLimiter, (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const data = getYearbookBookData(req.query, baseUrl, req.currentUser);
  let pdf;
  try {
    pdf = renderBookPdfWithChrome(renderYearbookBookHtml(data));
  } catch (error) {
    req.flash('error', error.message || 'PDF üretilemedi. HTML önizlemeden tarayıcı ile PDF kaydedin.');
    return res.redirect('/admin/yearbook-book');
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="kitap-yillik-${data.scope === 'class' ? data.classBranch : 'okul'}.pdf"`);
  return res.send(pdf);
});

router.get('/admin/yearbook-export.html', requireAdmin, adminExportLimiter, (req, res) => {
  const data = getYearbookExportData(req.query);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="yillik-${data.scope === 'class' ? data.classBranch : 'okul'}.html"`
  );
  return res.send(renderYearbookHtmlExport(data));
});

router.get('/admin/yearbook-export.pdf', requireAdmin, adminExportLimiter, (req, res) => {
  const data = getYearbookExportData(req.query);
  const pdf = buildYearbookPdf(data);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="yillik-${data.scope === 'class' ? data.classBranch : 'okul'}.pdf"`
  );
  return res.send(pdf);
});

router.get('/admin/logs', requireAdmin, (req, res) => {
  const filter = buildLogsFilter(req.query);
  const auditLogs = getFilteredAuditLogs(filter, 100);
  const loginAttempts = getFilteredLoginAttempts(filter, 100);
  const appLogs = getAppLogEntries(filter, 120);
  const auditActions = db
    .prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action ASC LIMIT 200')
    .all()
    .map((row) => row.action);
  return res.render('admin/logs', {
    title: 'Kayıt Merkezi',
    filter,
    auditLogs,
    loginAttempts,
    appLogs,
    auditActions
  });
});

router.get('/admin/logs/audit.csv', requireAdmin, adminExportLimiter, (req, res) => {
  const filter = buildLogsFilter({ ...req.query, type: 'audit' });
  const rows = getFilteredAuditLogs(filter, 1000).map((entry) => [
    entry.created_at,
    entry.actor_name || 'Sistem',
    entry.action,
    entry.target_type,
    entry.target_id || '',
    JSON.stringify(entry.details)
  ]);
  return sendCsv(res, 'audit-log.csv', [['Tarih', 'Aktör', 'Aksiyon', 'Hedef Türü', 'Hedef ID', 'Detay'], ...rows]);
});

router.get('/admin/logs/login.csv', requireAdmin, adminExportLimiter, (req, res) => {
  const filter = buildLogsFilter({ ...req.query, type: 'login' });
  const rows = getFilteredLoginAttempts(filter, 1000).map((entry) => [
    entry.created_at,
    entry.status,
    entry.role || '',
    entry.identifier || '',
    entry.ip_address || '',
    entry.ip_chain || '',
    entry.browser_name || '',
    entry.browser_version || '',
    entry.os_name || '',
    entry.os_version || '',
    entry.device_type || '',
    entry.resolved_user_name || '',
    entry.reason || '',
    JSON.stringify(entry.attemptedIdentifiers || [])
  ]);
  return sendCsv(
    res,
    'giris-kayitlari.csv',
    [['Tarih', 'Durum', 'Rol', 'Kimlik', 'IP', 'Proxy Zinciri', 'Tarayıcı', 'Tarayıcı Sürümü', 'OS', 'OS Sürümü', 'Cihaz', 'Hesap', 'Neden', 'Önce Denenenler'], ...rows]
  );
});

router.get('/admin/users/activity.csv', requireAdmin, adminExportLimiter, (req, res) => {
  const rows = getUserActivityRows(2000, {
    role: stripHtml(req.query.role || ''),
    schoolId: Number(req.query.school_id || 0),
    missingOnly: req.query.missing_only === '1'
  }).map((user) => [
    user.id,
    user.name,
    user.role,
    user.school_name || '',
    user.class_branch || '',
    user.status || '',
    user.last_active_at || '',
    user.updated_at || '',
    `${user.completion.percent}%`,
    user.pendingApprovalCount,
    user.completion.missing.join(', ')
  ]);
  return sendCsv(
    res,
    'kullanici-aktivite.csv',
    [['ID', 'Ad', 'Rol', 'Okul', 'Sınıf', 'Durum', 'Son Giriş', 'Profil Güncelleme', 'Tamamlanma', 'Bekleyen Onay', 'Eksikler'], ...rows]
  );
});

router.get('/admin/users/export-importable.xlsx', requireAdmin, adminExportLimiter, (req, res) => {
  const users = db
    .prepare(
      `SELECT u.name, u.role, u.student_number, u.login_identifier, u.class_branch, u.status, s.name AS school_name
       FROM users u
       LEFT JOIN schools s ON s.id = u.school_id
       WHERE u.role <> 'admin'
       ORDER BY u.role, u.class_branch, u.name COLLATE NOCASE`
    )
    .all()
    .map((user) => ({
      ...user,
      login_identifier: ensureLoginIdentifier(user)
    }));
  const buffer = buildReimportableUsersExport(users);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_export_users_importable',
    targetType: 'user_export',
    targetId: null,
    details: { exportedUsers: users.length }
  });
  const exportDate = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="kullanici-listesi-import-${exportDate}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buffer);
});

router.get('/admin/content-approvals', requireLogin, requireContentReviewer, (req, res) => {
  const scopeWhere = req.currentUser.role === 'admin' ? '' : 'AND actor.school_id = ?';
  const scopeParams = req.currentUser.role === 'admin' ? [] : [req.currentUser.school_id || 0];
  const pendingRequests = db
    .prepare(
      `SELECT r.id, r.item_type, r.actor_user_id, r.target_user_id, r.existing_item_id, r.payload_json,
              r.created_at, actor.name AS actor_name, actor.role AS actor_role,
              target.name AS target_name
       FROM content_approval_requests r
       JOIN users actor ON actor.id = r.actor_user_id
       LEFT JOIN users target ON target.id = r.target_user_id
       WHERE r.status = 'pending'
       ${scopeWhere}
       ORDER BY r.created_at ASC`
    )
    .all(...scopeParams)
    .map((item) => ({
      ...item,
      label: getContentApprovalLabel(item.item_type),
      payload: parsePayload(item.payload_json)
    }));

  return res.render('admin/content-approvals', {
    title: 'İçerik Onay Paneli',
    pendingRequests,
    contentApprovalEnabled: isContentApprovalEnabled(db)
  });
});

router.post('/admin/content-approvals/:id/approve', requireLogin, requireContentReviewer, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  const request = db
    .prepare(
      `SELECT r.*, actor.school_id AS actor_school_id
       FROM content_approval_requests r
       JOIN users actor ON actor.id = r.actor_user_id
       WHERE r.id = ? AND r.status = 'pending'`
    )
    .get(id);
  if (!request) {
    req.flash('error', 'Onay kaydı bulunamadı.');
    return res.redirect('/admin/content-approvals');
  }
  if (req.currentUser.role !== 'admin' && Number(req.currentUser.school_id || 0) !== Number(request.actor_school_id || 0)) {
    req.flash('error', 'Bu okulun onay isteğini yönetme yetkiniz yok.');
    return res.redirect('/admin/content-approvals');
  }

  try {
    applyApprovalRequest(db, request);
    db.prepare(
      `UPDATE content_approval_requests
       SET status = 'approved', reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(req.currentUser.id, id);
  } catch (error) {
    req.flash('error', error && error.message ? error.message : 'İçerik onaylanamadı.');
    return res.redirect('/admin/content-approvals');
  }

  if (request.item_type === 'profile_message') {
    createInboxNotification({
      userId: request.target_user_id,
      actorUserId: request.actor_user_id,
      kind: 'profile_message',
      title: 'Yeni yillik mesaji',
      body: 'Profiline yeni bir yorum onaylanarak eklendi.',
      linkPath: `/profiles/${request.target_user_id}#yorumlar`
    });
  }
  if (request.item_type === 'profile_guestbook') {
    createInboxNotification({
      userId: request.target_user_id,
      actorUserId: request.actor_user_id,
      kind: 'guestbook_entry',
      title: 'Yeni ziyaretci defteri notu',
      body: 'Profiline yeni bir not onaylanarak eklendi.',
      linkPath: `/profiles/${request.target_user_id}#ziyaretci-defteri`
    });
  }
  if (request.item_type === 'gallery_photo_comment') {
    const payload = parsePayload(request.payload_json);
    createInboxNotification({
      userId: request.target_user_id,
      actorUserId: request.actor_user_id,
      kind: 'gallery_photo_comment',
      title: 'Fotografina yorum geldi',
      body: 'Galerideki fotografina yeni bir yorum onaylanarak eklendi.',
      linkPath: `/gallery?class=${encodeURIComponent(payload.classFilter || 'GENERAL')}`
    });
  }
  if (request.item_type === 'gallery_collage_comment') {
    const payload = parsePayload(request.payload_json);
    db.prepare('SELECT DISTINCT uploader_user_id FROM gallery_photos WHERE group_id = ?')
      .all(payload.groupId || '')
      .forEach((row) => {
        createInboxNotification({
          userId: row.uploader_user_id,
          actorUserId: request.actor_user_id,
          kind: 'gallery_collage_comment',
          title: 'Kollajina yorum geldi',
          body: 'Galerideki kollajina yeni bir yorum onaylanarak eklendi.',
          linkPath: `/gallery?class=${encodeURIComponent(payload.classFilter || 'GENERAL')}`
        });
      });
  }
  notifyApprovalActor(request, 'approved');

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'content_approval_approve',
    targetType: 'content_approval_request',
    targetId: id,
    details: { itemType: request.item_type, actorUserId: request.actor_user_id, targetUserId: request.target_user_id }
  });
  req.flash('success', 'İçerik onaylandı ve yayınlandı.');
  return res.redirect('/admin/content-approvals');
});

router.post('/admin/content-approvals/:id/reject', requireLogin, requireContentReviewer, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  const request = db
    .prepare(
      `SELECT r.*, actor.school_id AS actor_school_id
       FROM content_approval_requests r
       JOIN users actor ON actor.id = r.actor_user_id
       WHERE r.id = ? AND r.status = 'pending'`
    )
    .get(id);
  if (!request) {
    req.flash('error', 'Onay kaydı bulunamadı.');
    return res.redirect('/admin/content-approvals');
  }
  if (req.currentUser.role !== 'admin' && Number(req.currentUser.school_id || 0) !== Number(request.actor_school_id || 0)) {
    req.flash('error', 'Bu okulun onay isteğini yönetme yetkiniz yok.');
    return res.redirect('/admin/content-approvals');
  }

  if (request.item_type === 'gallery_upload') {
    const payload = parsePayload(request.payload_json);
    (Array.isArray(payload.files) ? payload.files : []).forEach((file) => {
      deleteFileIfExists(file.photoPath);
    });
  }

  db.prepare(
    `UPDATE content_approval_requests
     SET status = 'rejected', reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(req.currentUser.id, id);
  notifyApprovalActor(request, 'rejected');
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'content_approval_reject',
    targetType: 'content_approval_request',
    targetId: id,
    details: { itemType: request.item_type, actorUserId: request.actor_user_id, targetUserId: request.target_user_id }
  });
  req.flash('success', 'İçerik reddedildi.');
  return res.redirect('/admin/content-approvals');
});

router.get('/admin/users/new', requireAdmin, (req, res) => {
  return res.render('admin/new-user', {
    title: 'Kullanıcı Oluştur',
    allowedClasses: getActiveClassBranches(),
    schools: getVisibleSchools(req.currentUser),
    teacherCategories: [
      { value: 'teacher', label: 'Öğretmen' },
      { value: 'principal', label: 'Müdür' },
      { value: 'vice_principal', label: 'Müdür Yardımcısı' },
      { value: 'head_vice_principal', label: 'Baş Müdür Yardımcısı' },
      { value: 'other', label: 'Diğer' }
    ],
    generatedCode: null,
    generatedLoginIdentifier: null
  });
});

router.post('/admin/classes', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const branch = stripHtml(req.body.branch || '').toUpperCase().slice(0, 20);
  const themeColor = stripHtml(req.body.theme_color || '').slice(0, 20);
  const currentYear = getCurrentSchoolYear();

  if (!branch) {
    req.flash('error', 'Sınıf adı zorunludur.');
    return res.redirect('/admin');
  }

  db.prepare(
    `INSERT INTO classes (branch, school_year_id, theme_color, is_active, is_archived)
     VALUES (?, ?, ?, 1, 0)
     ON CONFLICT(branch) DO UPDATE SET
       deleted_at = NULL,
       is_active = 1,
       is_archived = 0,
       school_year_id = COALESCE(excluded.school_year_id, classes.school_year_id),
       theme_color = CASE WHEN excluded.theme_color <> '' THEN excluded.theme_color ELSE classes.theme_color END,
       updated_at = CURRENT_TIMESTAMP`
  ).run(branch, currentYear ? currentYear.id : null, themeColor);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_class_create_or_recover',
    targetType: 'class',
    targetId: null,
    details: { branch }
  });
  req.flash('success', `${branch} sınıfı kaydedildi.`);
  return res.redirect('/admin');
});

router.post('/admin/classes/:branch/delete', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const branch = stripHtml(req.params.branch || '').toUpperCase();
  if (!requireAdminAccessCode(req)) {
    return res.redirect('/admin');
  }

  db.prepare(
    `UPDATE classes
     SET deleted_at = CURRENT_TIMESTAMP, is_active = 0, updated_at = CURRENT_TIMESTAMP
     WHERE branch = ?`
  ).run(branch);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_class_delete',
    targetType: 'class',
    targetId: null,
    details: { branch }
  });
  req.flash('success', `${branch} sınıfı kaldırıldı. Recover ile geri alınabilir.`);
  return res.redirect('/admin');
});

router.post('/admin/classes/:branch/recover', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const branch = stripHtml(req.params.branch || '').toUpperCase();

  db.prepare(
    `UPDATE classes
     SET deleted_at = NULL, is_active = CASE WHEN is_archived = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP
     WHERE branch = ?`
  ).run(branch);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_class_recover',
    targetType: 'class',
    targetId: null,
    details: { branch }
  });
  req.flash('success', `${branch} sınıfı geri alındı.`);
  return res.redirect('/admin');
});

router.post('/admin/classes/bulk-move', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const fromBranch = stripHtml(req.body.from_class_branch || '').toUpperCase();
  const toBranch = stripHtml(req.body.to_class_branch || '').toUpperCase();

  if (!isValidClass(fromBranch) || !isValidClass(toBranch) || fromBranch === toBranch) {
    req.flash('error', 'Geçerli ve farklı iki sınıf seçmelisiniz.');
    return res.redirect('/admin');
  }

  const moved = db.prepare(
    `UPDATE users
     SET class_branch = ?, president_class_branch = CASE WHEN president_class_branch = ? THEN ? ELSE president_class_branch END, updated_at = CURRENT_TIMESTAMP
     WHERE role = 'student' AND class_branch = ?`
  ).run(toBranch, fromBranch, toBranch, fromBranch);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_bulk_class_move',
    targetType: 'class',
    targetId: null,
    details: { fromBranch, toBranch, movedUsers: moved.changes }
  });
  req.flash('success', `${moved.changes} öğrenci ${fromBranch} sınıfından ${toBranch} sınıfına taşındı.`);
  return res.redirect('/admin');
});

router.post('/admin/users/:id/status', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  const status = stripHtml(req.body.status || '');
  if (!['active', 'inactive', 'graduated', 'archived'].includes(status)) {
    req.flash('error', 'Geçersiz durum.');
    return res.redirect('/admin');
  }

  const currentYear = getCurrentSchoolYear();
  db.prepare(
    `UPDATE users
     SET status = ?,
         archived_school_year_id = CASE
           WHEN ? IN ('graduated', 'archived') THEN ?
           WHEN ? IN ('active', 'inactive') THEN NULL
           ELSE archived_school_year_id
         END,
         archived_class_branch = CASE
           WHEN ? IN ('graduated', 'archived') THEN class_branch
           WHEN ? IN ('active', 'inactive') THEN NULL
           ELSE archived_class_branch
         END,
         graduated_at = CASE
           WHEN ? = 'graduated' THEN CURRENT_TIMESTAMP
           WHEN ? IN ('active', 'inactive', 'archived') THEN NULL
           ELSE graduated_at
         END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    status,
    status,
    currentYear ? currentYear.id : null,
    status,
    status,
    status,
    status,
    status,
    id
  );

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_user_status_update',
    targetType: 'user',
    targetId: id,
    details: { status }
  });
  req.flash('success', 'Kullanıcı durumu güncellendi.');
  return res.redirect('/admin');
});

router.post('/admin/users/status/bulk', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const status = stripHtml(req.body.status || '');
  if (!['active', 'inactive'].includes(status)) {
    req.flash('error', 'Geçersiz toplu durum.');
    return res.redirect('/admin');
  }

  const result = db.prepare(
    `UPDATE users
     SET status = ?,
         archived_school_year_id = NULL,
         archived_class_branch = NULL,
         graduated_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE role <> 'admin'`
  ).run(status);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: status === 'active' ? 'admin_users_bulk_activate' : 'admin_users_bulk_deactivate',
    targetType: 'user',
    targetId: null,
    details: { affectedUsers: result.changes, excludedRole: 'admin' }
  });
  req.flash('success', `${result.changes} hesap ${status === 'active' ? 'aktif' : 'pasif'} duruma getirildi.`);
  return res.redirect('/admin');
});

router.post('/admin/school-years/start', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  if (!requireAdminAccessCode(req)) {
    return res.redirect('/admin');
  }

  const nextYearLabel = stripHtml(req.body.next_year_label || '').slice(0, 40);
  const nextClassBranches = String(req.body.next_class_branches || '')
    .split(',')
    .map((item) => stripHtml(item).toUpperCase())
    .filter(Boolean);

  if (!nextYearLabel || nextClassBranches.length < 1) {
    req.flash('error', 'Yeni yıl etiketi ve en az bir sınıf zorunludur.');
    return res.redirect('/admin');
  }

  const currentYear = getCurrentSchoolYear();
  const tx = db.transaction(() => {
    if (currentYear) {
      db.prepare(
        `UPDATE school_years
         SET is_current = 0, is_archived = 1, archived_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(currentYear.id);
      db.prepare(
        `UPDATE classes
         SET is_active = 0, is_archived = 1, updated_at = CURRENT_TIMESTAMP
         WHERE school_year_id = ? AND deleted_at IS NULL`
      ).run(currentYear.id);
      db.prepare(
        `INSERT INTO archive_year_classes (school_year_id, branch, theme_color, cover_photo_path, class_slogan, updated_at)
         SELECT c.school_year_id, c.branch, c.theme_color, cp.cover_photo_path, cp.class_slogan, CURRENT_TIMESTAMP
         FROM classes c
         LEFT JOIN class_pages cp ON cp.class_branch = c.branch
         WHERE c.school_year_id = ? AND c.deleted_at IS NULL
         ON CONFLICT(school_year_id, branch) DO UPDATE SET
           theme_color = excluded.theme_color,
           cover_photo_path = excluded.cover_photo_path,
           class_slogan = excluded.class_slogan,
           updated_at = CURRENT_TIMESTAMP`
      ).run(currentYear.id);
      db.prepare(
        `UPDATE users
         SET status = CASE WHEN role = 'student' THEN 'graduated' ELSE status END,
             archived_school_year_id = CASE WHEN role = 'student' THEN ? ELSE archived_school_year_id END,
             archived_class_branch = CASE WHEN role = 'student' THEN class_branch ELSE archived_class_branch END,
             graduated_at = CASE WHEN role = 'student' THEN CURRENT_TIMESTAMP ELSE graduated_at END,
             president_class_branch = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE role = 'student' AND status = 'active'`
      ).run(currentYear.id);
    }

    const createdYear = db.prepare(
      `INSERT INTO school_years (label, is_current, is_archived)
       VALUES (?, 1, 0)`
    ).run(nextYearLabel);
    const nextYearId = Number(createdYear.lastInsertRowid);

    const upsertClass = db.prepare(
      `INSERT INTO classes (branch, school_year_id, is_active, is_archived, deleted_at)
       VALUES (?, ?, 1, 0, NULL)
       ON CONFLICT(branch) DO UPDATE SET
         school_year_id = excluded.school_year_id,
         is_active = 1,
         is_archived = 0,
         deleted_at = NULL,
         updated_at = CURRENT_TIMESTAMP`
    );
    nextClassBranches.forEach((branch) => upsertClass.run(branch, nextYearId));

    db.prepare(
      `INSERT INTO year_transitions (from_school_year_id, to_school_year_id, created_by_user_id, classes_json)
       VALUES (?, ?, ?, ?)`
    ).run(currentYear ? currentYear.id : null, nextYearId, req.currentUser.id, JSON.stringify(nextClassBranches));
  });
  tx();

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_school_year_start',
    targetType: 'school_year',
    targetId: null,
    details: { nextYearLabel, nextClassBranches }
  });
  req.flash('success', `${nextYearLabel} yılı başlatıldı ve önceki yıl arşive alındı.`);
  return res.redirect('/admin');
});

router.get('/admin/archive-years/:yearId/download', requireAdmin, (req, res) => {
  const yearId = Number(req.params.yearId);
  if (!Number.isInteger(yearId) || yearId <= 0) {
    req.flash('error', 'Geçersiz arşiv yılı.');
    return res.redirect('/admin');
  }

  let payload;
  try {
    payload = buildArchiveYearExport(yearId);
  } catch (error) {
    req.flash('error', error.message);
    return res.redirect('/admin');
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="arsiv-yili-${payload.schoolYear.label}.json"`);
  return res.send(JSON.stringify(payload, null, 2));
});

router.post('/admin/archive-years/import', requireAdmin, adminWriteLimiter, verifyCsrf, archiveYearUpload.single('archive_year_file'), (req, res) => {
  if (!req.file) {
    req.flash('error', 'Lütfen bir arşiv yılı dosyası seçin.');
    return res.redirect('/admin');
  }

  let payload;
  try {
    payload = JSON.parse(req.file.buffer.toString('utf8'));
  } catch (error) {
    req.flash('error', 'Arşiv yılı dosyası geçerli JSON değil.');
    return res.redirect('/admin');
  }

  const archiveUsers = Array.isArray(payload && payload.users)
    ? payload.users
    : Array.isArray(payload && payload.students)
      ? payload.students
      : null;
  const archiveMessages = Array.isArray(payload && payload.messages) ? payload.messages : [];
  const archiveThreeWords = Array.isArray(payload && payload.threeWords) ? payload.threeWords : [];
  const archiveGuestbookEntries = Array.isArray(payload && payload.guestbookEntries) ? payload.guestbookEntries : [];
  const archiveLikes = Array.isArray(payload && payload.likes) ? payload.likes : [];

  if (!payload || !payload.schoolYear || !payload.schoolYear.label || !Array.isArray(payload.classes) || !Array.isArray(archiveUsers)) {
    req.flash('error', 'Arşiv yılı dosya yapısı geçersiz.');
    return res.redirect('/admin');
  }

  const invalidClass = payload.classes.find((item) => !item || !stripHtml(item.branch || '').trim());
  if (invalidClass) {
    req.flash('error', 'Arşiv dosyasındaki sınıf kayıtları geçersiz.');
    return res.redirect('/admin');
  }

  const duplicateBranches = new Set();
  const branchSet = new Set();
  payload.classes.forEach((item) => {
    const branch = stripHtml(item.branch || '').toUpperCase();
    if (branchSet.has(branch)) {
      duplicateBranches.add(branch);
    }
    branchSet.add(branch);
  });
  if (duplicateBranches.size) {
    req.flash('error', `Arşiv dosyasında tekrar eden sınıf var: ${Array.from(duplicateBranches).join(', ')}`);
    return res.redirect('/admin');
  }

  const duplicateStudentNumber = archiveUsers.find((user) => {
    if (!user || user.role !== 'student' || !user.student_number) {
      return false;
    }
    return Boolean(db.prepare('SELECT 1 FROM users WHERE student_number = ?').get(user.student_number));
  });
  if (duplicateStudentNumber) {
    req.flash('error', `Öğrenci numarası zaten kullanımda: ${duplicateStudentNumber.student_number}`);
    return res.redirect('/admin');
  }

  const invalidArchiveUser = archiveUsers.find((user) => !user || !normalizeName(user.name || '').trim() || !['student', 'teacher', 'other', 'guest'].includes(String(user.role || 'student')));
  if (invalidArchiveUser) {
    req.flash('error', 'Arşiv dosyasındaki profil kayıtlarından biri geçersiz.');
    return res.redirect('/admin');
  }

  try {
    runAdminMaintenanceWindow(
      req,
      {
        reason: 'archive_year_import',
        message: 'Arşiv yılı içe aktarılıyor. Kısa süre sonra site tekrar açılacak.'
      },
      () => {
        const tx = db.transaction(() => {
          const schoolYearResult = db.prepare(
            `INSERT INTO school_years (label, is_current, is_archived, created_at, archived_at)
             VALUES (?, 0, 1, CURRENT_TIMESTAMP, ?)`
          ).run(getUniqueImportedYearLabel(payload.schoolYear.label), payload.schoolYear.archived_at || new Date().toISOString());
          const schoolYearId = Number(schoolYearResult.lastInsertRowid);

          const insertClass = db.prepare(
            `INSERT INTO archive_year_classes (school_year_id, branch, theme_color, cover_photo_path, class_slogan)
             VALUES (?, ?, ?, ?, ?)`
          );
          payload.classes.forEach((item) => {
            insertClass.run(
              schoolYearId,
              stripHtml(item.branch || '').toUpperCase(),
              stripHtml(item.theme_color || '').slice(0, 20),
              stripHtml(item.cover_photo_path || '').slice(0, 500) || null,
              stripHtml(item.class_slogan || '').slice(0, 300)
            );
          });

          const insertUser = db.prepare(
            `INSERT INTO users (
              name, student_number, login_identifier, role, class_branch, teacher_category, president_class_branch, access_code_hash,
              photo_path, profile_cover_path, profile_theme_color, slogan, bio, free_text, favorite_memory, favorite_quote,
              birth_date, contact_phone, contact_email, contact_instagram, contact_x, contact_facebook, contact_linkedin,
              contact_nsocial, custom_contacts_json, last_active_at, status, archived_school_year_id, archived_class_branch,
              graduated_at, created_at, updated_at
            ) VALUES (?, ?, NULL, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`
          );
          const insertedUserIdByArchiveKey = new Map();
          archiveUsers.forEach((user, index) => {
            const result = insertUser.run(
              normalizeName(user.name) || `Arşiv Profil ${index + 1}`,
              user.role === 'student' ? user.student_number || null : null,
              ['student', 'teacher', 'other', 'guest'].includes(String(user.role || '')) ? user.role : 'student',
              user.role === 'teacher' ? normalizeTeacherCategory(user.teacher_category) : 'other',
              hashAccessCode(`archived-import-${schoolYearId}-${index + 1}`),
              user.photo_path || null,
              user.profile_cover_path || null,
              /^#[0-9a-f]{6}$/i.test(String(user.profile_theme_color || '')) ? user.profile_theme_color : null,
              stripHtml(user.slogan || '').slice(0, 300),
              stripHtml(user.bio || '').slice(0, 1200),
              stripHtml(user.free_text || '').slice(0, 4000),
              stripHtml(user.favorite_memory || '').slice(0, 600),
              stripHtml(user.favorite_quote || '').slice(0, 600),
              user.birth_date || null,
              stripHtml(user.contact_phone || '').slice(0, 40),
              stripHtml(user.contact_email || '').slice(0, 120),
              stripHtml(user.contact_instagram || '').slice(0, 120),
              stripHtml(user.contact_x || '').slice(0, 120),
              stripHtml(user.contact_facebook || '').slice(0, 120),
              stripHtml(user.contact_linkedin || '').slice(0, 120),
              stripHtml(user.contact_nsocial || '').slice(0, 120),
              JSON.stringify(parseCustomContacts(user.custom_contacts_json).slice(0, 12)),
              'archived',
              schoolYearId,
              user.role === 'student' ? stripHtml(user.archived_class_branch || '').toUpperCase() || null : null,
              user.graduated_at || null,
              user.created_at || new Date().toISOString(),
              user.updated_at || new Date().toISOString()
            );
            insertedUserIdByArchiveKey.set(String(user.archive_key || `legacy-${index}`), Number(result.lastInsertRowid));
          });

          const insertMessage = db.prepare(
            `INSERT INTO messages (from_user_id, to_user_id, message, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`
          );
          archiveMessages.forEach((item) => {
            const fromUserId = insertedUserIdByArchiveKey.get(String(item.from_archive_key || ''));
            const toUserId = insertedUserIdByArchiveKey.get(String(item.to_archive_key || ''));
            if (!fromUserId || !toUserId) return;
            insertMessage.run(
              fromUserId,
              toUserId,
              stripHtml(item.message || '').slice(0, MAX_MESSAGE_LENGTH),
              item.created_at || new Date().toISOString(),
              item.updated_at || item.created_at || new Date().toISOString()
            );
          });

          const insertThreeWords = db.prepare(
            `INSERT INTO profile_three_words (profile_user_id, author_user_id, words, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`
          );
          archiveThreeWords.forEach((item) => {
            const profileUserId = insertedUserIdByArchiveKey.get(String(item.profile_archive_key || ''));
            const authorUserId = insertedUserIdByArchiveKey.get(String(item.author_archive_key || ''));
            if (!profileUserId || !authorUserId) return;
            insertThreeWords.run(
              profileUserId,
              authorUserId,
              stripHtml(item.words || '').slice(0, 80),
              item.created_at || new Date().toISOString(),
              item.updated_at || item.created_at || new Date().toISOString()
            );
          });

          const insertGuestbookEntry = db.prepare(
            `INSERT INTO profile_guestbook_entries (profile_user_id, author_user_id, body, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`
          );
          archiveGuestbookEntries.forEach((item) => {
            const profileUserId = insertedUserIdByArchiveKey.get(String(item.profile_archive_key || ''));
            const authorUserId = insertedUserIdByArchiveKey.get(String(item.author_archive_key || ''));
            if (!profileUserId || !authorUserId) return;
            insertGuestbookEntry.run(
              profileUserId,
              authorUserId,
              stripHtml(item.body || '').slice(0, 500),
              item.created_at || new Date().toISOString(),
              item.updated_at || item.created_at || new Date().toISOString()
            );
          });

          const insertLike = db.prepare(
            `INSERT OR IGNORE INTO profile_likes (profile_user_id, liker_user_id, created_at)
             VALUES (?, ?, ?)`
          );
          archiveLikes.forEach((item) => {
            const profileUserId = insertedUserIdByArchiveKey.get(String(item.profile_archive_key || ''));
            const likerUserId = insertedUserIdByArchiveKey.get(String(item.liker_archive_key || ''));
            if (!profileUserId || !likerUserId) return;
            insertLike.run(profileUserId, likerUserId, item.created_at || new Date().toISOString());
          });
        });
        tx();
      }
    );
  } catch (error) {
    req.flash('error', error.message || 'Arşiv yılı içe aktarılamadı.');
    return res.redirect('/admin');
  }

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_archive_year_import',
    targetType: 'school_year',
    targetId: null,
    details: {
      label: payload.schoolYear.label,
      classes: payload.classes.length,
      users: archiveUsers.length,
      students: archiveUsers.filter((user) => user.role === 'student').length,
      teachers: archiveUsers.filter((user) => user.role === 'teacher').length,
      others: archiveUsers.filter((user) => !['student', 'teacher'].includes(user.role)).length,
      messages: archiveMessages.length,
      threeWords: archiveThreeWords.length,
      guestbookEntries: archiveGuestbookEntries.length,
      likes: archiveLikes.length
    }
  });
  req.flash('success', `${payload.schoolYear.label} arşivi yüklendi.`);
  return res.redirect('/admin');
});

router.post('/admin/users', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const role = stripHtml(req.body.role);
  const name = normalizeName(req.body.name);
  const studentNumber = stripHtml(req.body.student_number) || null;
  const classBranch = stripHtml(req.body.class_branch).toUpperCase() || null;
  const schoolId = Number(req.body.school_id || 0) || null;
  const isClassPresident = req.body.is_class_president === 'yes';
  const teacherCategory = normalizeTeacherCategory(req.body.teacher_category);

  if (!['student', 'teacher', 'admin', 'guest', 'other'].includes(role)) {
    req.flash('error', 'Geçersiz rol.');
    return res.redirect('/admin/users/new');
  }

  if (!name) {
    req.flash('error', 'Ad alanı zorunludur.');
    return res.redirect('/admin/users/new');
  }

  if (role === 'student' && (!studentNumber || !isValidClass(classBranch))) {
    req.flash('error', 'Öğrenciler için öğrenci numarası ve geçerli sınıf şubesi zorunludur.');
    return res.redirect('/admin/users/new');
  }

  if (role !== 'student' && classBranch && !isValidClass(classBranch)) {
    req.flash('error', 'Geçersiz sınıf şubesi.');
    return res.redirect('/admin/users/new');
  }

  const accessCode = generateAccessCode();
  const accessCodeHash = hashAccessCode(accessCode);

  let createdUserId;
  try {
    const result = db.prepare(
      `INSERT INTO users (name, student_number, role, school_id, class_branch, teacher_category, access_code_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      name,
      role === 'student' ? studentNumber : null,
      role,
      schoolId,
      role === 'student' ? classBranch : null,
      role === 'teacher' ? teacherCategory : 'other',
      accessCodeHash
    );
    createdUserId = Number(result.lastInsertRowid);
    syncClassPresident(createdUserId, role, role === 'student' ? classBranch : null, isClassPresident, req.currentUser.id);
  } catch (error) {
    req.flash('error', `Kullanıcı oluşturulamadı: ${error.message}`);
    return res.redirect('/admin/users/new');
  }

  const loginIdentifier = ensureLoginIdentifier({ id: createdUserId, role, name, login_identifier: null });
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_user_create',
    targetType: 'user',
    targetId: createdUserId,
    details: { role, schoolId, loginIdentifier, isClassPresident: Boolean(isClassPresident && role === 'student' && classBranch) }
  });

  return res.render('admin/new-user', {
    title: 'Kullanıcı Oluştur',
    allowedClasses: getActiveClassBranches(),
    schools: getVisibleSchools(req.currentUser),
    teacherCategories: [
      { value: 'teacher', label: 'Öğretmen' },
      { value: 'principal', label: 'Müdür' },
      { value: 'vice_principal', label: 'Müdür Yardımcısı' },
      { value: 'head_vice_principal', label: 'Baş Müdür Yardımcısı' },
      { value: 'other', label: 'Diğer' }
    ],
    generatedCode: accessCode,
    generatedLoginIdentifier: loginIdentifier
  });
});

router.get('/admin/users/:id/edit', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const user = db
    .prepare('SELECT id, name, student_number, login_identifier, role, school_id, class_branch, teacher_category, president_class_branch, photo_path, profile_cover_path, photo_locked, profile_cover_locked, birth_date, yearbook_opt_out, kvkk_approved_at FROM users WHERE id = ?')
    .get(id);

  if (!user) {
    req.flash('error', 'Kullanıcı bulunamadı.');
    return res.redirect('/admin');
  }

  return res.render('admin/edit-user', {
    title: 'Kullanıcı Düzenle',
    user: {
      ...user,
      login_identifier: ensureLoginIdentifier(user)
    },
    allowedClasses: getActiveClassBranches(),
    schools: getVisibleSchools(req.currentUser),
    teacherCategories: [
      { value: 'teacher', label: 'Öğretmen' },
      { value: 'principal', label: 'Müdür' },
      { value: 'vice_principal', label: 'Müdür Yardımcısı' },
      { value: 'head_vice_principal', label: 'Baş Müdür Yardımcısı' },
      { value: 'other', label: 'Diğer' }
    ],
    resetCode: null
  });
});

router.get('/admin/confirm', requireAdmin, (req, res) => {
  const action = stripHtml(req.query.action || '');
  const targetId = Number(req.query.target_id || 0);
  const backTo = stripHtml(req.query.back_to || '/admin');
  const backupName = stripHtml(req.query.backup_name || '');

  let summary = null;

  if (action === 'delete-user') {
    const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(targetId);
    if (!user) {
      req.flash('error', 'Kullanıcı bulunamadı.');
      return res.redirect('/admin');
    }
    summary = {
      title: 'Kullanıcı Silme Onayı',
      description: `${user.name} (${user.role}) hesabı silinecek.`,
      actionPath: `/admin/users/${user.id}/delete`,
      fields: { back_to: '/admin' }
    };
  } else if (action === 'delete-message') {
    const message = db
      .prepare(
        `SELECT m.id, sender.name AS sender_name, receiver.name AS receiver_name
         FROM messages m
         JOIN users sender ON sender.id = m.from_user_id
         JOIN users receiver ON receiver.id = m.to_user_id
         WHERE m.id = ?`
      )
      .get(targetId);
    if (!message) {
      req.flash('error', 'Mesaj bulunamadı.');
      return res.redirect('/admin');
    }
    summary = {
      title: 'Mesaj Silme Onayı',
      description: `${message.sender_name} -> ${message.receiver_name} mesajı silinecek.`,
      actionPath: `/admin/messages/${message.id}/delete`,
      fields: { back_to: backTo || '/admin' }
    };
  } else if (action === 'export-users-codes') {
    summary = {
      title: 'Kod Export Onayı',
      description: 'Tüm erişim kodları yenilenip Excel dışa aktarımı başlatılacak.',
      actionPath: '/admin/export/users-codes',
      fields: {}
    };
  } else if (action === 'reset-user-code') {
    const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(targetId);
    if (!user) {
      req.flash('error', 'Kullanıcı bulunamadı.');
      return res.redirect('/admin');
    }
    summary = {
      title: 'Kod Sıfırlama Onayı',
      description: `${user.name} (${user.role}) için yeni erişim kodu üretilecek.`,
      actionPath: `/admin/users/${user.id}/reset-code`,
      fields: {}
    };
  } else if (action === 'restore-backup') {
    const backup = listBackups().find((item) => item.name === backupName);
    if (!backup) {
      req.flash('error', 'Yedek bulunamadı.');
      return res.redirect('/admin');
    }
    summary = {
      title: 'Yedek Geri Yükleme Onayı',
      description: `${backup.name} geri yüklenecek. Mevcut veritabanı ve upload klasörleri üzerine yazılır.`,
      actionPath: `/admin/backups/${encodeURIComponent(backup.name)}/restore`,
      fields: {}
    };
  } else if (action === 'delete-backup') {
    const backup = listBackups().find((item) => item.name === backupName);
    if (!backup) {
      req.flash('error', 'Yedek bulunamadı.');
      return res.redirect('/admin');
    }
    summary = {
      title: 'Yedek Silme Onayı',
      description: `${backup.name} yedeği ve varsa indirilebilir arşivi silinecek.`,
      actionPath: `/admin/backups/${encodeURIComponent(backup.name)}/delete`,
      fields: {}
    };
  } else if (action === 'clear-logs') {
    summary = {
      title: 'Log Temizleme Onayı',
      description: 'Denetim kayıtları, giriş kayıtları ve uygulama log dosyası temizlenecek.',
      actionPath: '/admin/logs/clear',
      fields: {}
    };
  } else if (action === 'delete-class') {
    const classBranch = stripHtml(req.query.class_branch || '').toUpperCase();
    const classRecord = db.prepare('SELECT branch FROM classes WHERE branch = ? AND deleted_at IS NULL').get(classBranch);
    if (!classRecord) {
      req.flash('error', 'Sınıf bulunamadı.');
      return res.redirect('/admin');
    }
    summary = {
      title: 'Sınıf Kaldırma Onayı',
      description: `${classRecord.branch} sınıfı kaldırılacak. Recover ile geri alınabilir.`,
      actionPath: `/admin/classes/${encodeURIComponent(classRecord.branch)}/delete`,
      fields: {}
    };
  } else if (action === 'start-new-year') {
    summary = {
      title: 'Yeni Seneye Geçiş Onayı',
      description: 'Mevcut aktif okul yılı arşivlenecek, öğrenciler mezun/arşiv durumuna alınacak ve yeni sınıf yılı açılacak.',
      actionPath: '/admin/school-years/start',
      fields: {
        next_year_label: stripHtml(req.query.next_year_label || ''),
        next_class_branches: stripHtml(req.query.next_class_branches || '')
      }
    };
  } else if (action === 'reset-teacher-categories') {
    const teacherCount = db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'teacher'").get().total;
    summary = {
      title: 'Öğretmen Kategorilerini Sıfırla',
      description: `${teacherCount} öğretmenin alt kategorisi toplu olarak "Öğretmen" yapılacak.`,
      actionPath: '/admin/teachers/reset-categories',
      fields: {}
    };
  } else {
    req.flash('error', 'Geçersiz onay isteği.');
    return res.redirect('/admin');
  }

  return res.render('admin/confirm', {
    title: summary.title,
    summary,
    backTo
  });
});

router.post('/admin/users/:id', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);

  if (!user) {
    req.flash('error', 'Kullanıcı bulunamadı.');
    return res.redirect('/admin');
  }

  const name = normalizeName(req.body.name);
  const studentNumber = stripHtml(req.body.student_number) || null;
  const classBranch = stripHtml(req.body.class_branch).toUpperCase() || null;
  const schoolId = Number(req.body.school_id || 0) || null;
  const birthDate = stripHtml(req.body.birth_date || '').slice(0, 10);
  const photoLocked = parseCheckboxYes(req.body.photo_locked) ? 1 : 0;
  const yearbookOptOut = parseCheckboxYes(req.body.yearbook_opt_out) ? 1 : 0;
  const isClassPresident = req.body.is_class_president === 'yes';
  const teacherCategory = normalizeTeacherCategory(req.body.teacher_category);

  if (!name) {
    req.flash('error', 'Ad alanı zorunludur.');
    return res.redirect(`/admin/users/${id}/edit`);
  }

  if (user.role === 'student' && (!studentNumber || !isValidClass(classBranch))) {
    req.flash('error', 'Öğrenciler için öğrenci numarası ve geçerli sınıf şubesi zorunludur.');
    return res.redirect(`/admin/users/${id}/edit`);
  }

  if (birthDate && !BIRTH_DATE_PATTERN.test(birthDate)) {
    req.flash('error', 'Doğum tarihi YYYY-AA-GG formatında olmalıdır.');
    return res.redirect(`/admin/users/${id}/edit`);
  }

  const shouldResetCode = req.body.reset_code === 'yes';
  if (shouldResetCode) {
    req.flash('error', 'Kod sıfırlama işlemi artık ayrı onay ekranı üzerinden yapılır.');
    return res.redirect(`/admin/users/${id}/edit`);
  }
  let newCode = null;

  db.prepare(
    `UPDATE users
     SET name = ?, student_number = ?, school_id = ?, class_branch = ?, teacher_category = ?, birth_date = ?, photo_locked = ?, yearbook_opt_out = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    name,
    user.role === 'student' ? studentNumber : null,
    schoolId,
    user.role === 'student' ? classBranch : null,
    user.role === 'teacher' ? teacherCategory : 'other',
    birthDate || null,
    photoLocked,
    yearbookOptOut,
    id
  );
  syncClassPresident(id, user.role, user.role === 'student' ? classBranch : null, isClassPresident, req.currentUser.id);

  const refreshed = db
    .prepare('SELECT id, name, student_number, login_identifier, role, school_id, class_branch, teacher_category, president_class_branch, photo_path, profile_cover_path, photo_locked, profile_cover_locked, birth_date, yearbook_opt_out FROM users WHERE id = ?')
    .get(id);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: shouldResetCode ? 'admin_user_update_and_reset_code' : 'admin_user_update',
    targetType: 'user',
    targetId: id,
    details: {
      role: refreshed.role,
      photoLocked,
      resetCode: shouldResetCode,
      isClassPresident: Boolean(refreshed.president_class_branch),
      birthDate: refreshed.birth_date || null
    }
  });

  return res.render('admin/edit-user', {
    title: 'Kullanıcı Düzenle',
    user: {
      ...refreshed,
      login_identifier: ensureLoginIdentifier(refreshed)
    },
    allowedClasses: getActiveClassBranches(),
    schools: getVisibleSchools(req.currentUser),
    teacherCategories: [
      { value: 'teacher', label: 'Öğretmen' },
      { value: 'principal', label: 'Müdür' },
      { value: 'vice_principal', label: 'Müdür Yardımcısı' },
      { value: 'head_vice_principal', label: 'Baş Müdür Yardımcısı' },
      { value: 'other', label: 'Diğer' }
    ],
    resetCode: newCode
  });
});

router.post('/admin/users/:id/reset-code', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT id, name, role, login_identifier, class_branch, teacher_category, president_class_branch, student_number, photo_path, profile_cover_path, photo_locked, profile_cover_locked FROM users WHERE id = ?').get(id);
  if (!user) {
    req.flash('error', 'Kullanıcı bulunamadı.');
    return res.redirect('/admin');
  }
  if (!requireAdminAccessCode(req)) {
    return res.redirect(`/admin/users/${id}/edit`);
  }

  const newCode = resetUserCode(id);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_user_reset_code',
    targetType: 'user',
    targetId: id,
    details: { role: user.role }
  });

  return res.render('admin/edit-user', {
    title: 'Kullanıcı Düzenle',
    user: {
      ...user,
      login_identifier: ensureLoginIdentifier(user)
    },
    allowedClasses: getActiveClassBranches(),
    schools: getVisibleSchools(req.currentUser),
    teacherCategories: [
      { value: 'teacher', label: 'Öğretmen' },
      { value: 'principal', label: 'Müdür' },
      { value: 'vice_principal', label: 'Müdür Yardımcısı' },
      { value: 'head_vice_principal', label: 'Baş Müdür Yardımcısı' },
      { value: 'other', label: 'Diğer' }
    ],
    resetCode: newCode
  });
});

router.post('/admin/users/:id/photo', requireAdmin, adminWriteLimiter, verifyCsrf, adminPhotoUpload.single('photo'), (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT id, photo_path, photo_locked FROM users WHERE id = ?').get(id);

  if (!user) {
    req.flash('error', 'Kullanıcı bulunamadı.');
    return res.redirect('/admin');
  }

  const photoLocked = parseCheckboxYes(req.body.photo_locked) ? 1 : 0;
  const nextPhotoPath = req.file ? `/uploads/photos/${req.file.filename}` : null;
  const shouldRemovePhoto = req.body.remove_photo === 'yes';

  if (shouldRemovePhoto) {
    if (req.file) {
      deleteFileIfExists(nextPhotoPath);
    }
    db.prepare('UPDATE users SET photo_path = NULL, photo_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(photoLocked, id);
    deleteFileIfExists(user.photo_path);
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'admin_photo_remove',
      targetType: 'user',
      targetId: id,
      details: { photoLocked }
    });
    req.flash('success', 'Profil fotoğrafı kaldırıldı.');
    return res.redirect(`/admin/users/${id}/edit`);
  }

  if (nextPhotoPath) {
    try {
      assertImageSignature(req.file);
    } catch (error) {
      deleteFileIfExists(nextPhotoPath);
      throw error;
    }
    db.prepare('UPDATE users SET photo_path = ?, photo_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextPhotoPath, photoLocked, id);
    deleteFileIfExists(user.photo_path);
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'admin_photo_replace',
      targetType: 'user',
      targetId: id,
      details: { photoLocked }
    });
    req.flash('success', 'Profil fotoğrafı yönetici tarafından güncellendi.');
  } else {
    db.prepare('UPDATE users SET photo_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(photoLocked, id);
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'admin_photo_lock_update',
      targetType: 'user',
      targetId: id,
      details: { photoLocked }
    });
    req.flash('success', 'Profil fotoğraf kilidi güncellendi.');
  }

  return res.redirect(`/admin/users/${id}/edit`);
});

router.post('/admin/users/:id/cover', requireAdmin, adminWriteLimiter, verifyCsrf, adminPhotoUpload.single('cover_photo'), (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT id, profile_cover_path, profile_cover_locked FROM users WHERE id = ?').get(id);

  if (!user) {
    req.flash('error', 'Kullanıcı bulunamadı.');
    return res.redirect('/admin');
  }

  const coverLocked = parseCheckboxYes(req.body.profile_cover_locked) ? 1 : 0;
  const nextCoverPath = req.file ? `/uploads/photos/${req.file.filename}` : null;
  const shouldRemoveCover = req.body.remove_cover === 'yes';

  if (shouldRemoveCover) {
    if (req.file) {
      deleteFileIfExists(nextCoverPath);
    }
    db.prepare('UPDATE users SET profile_cover_path = NULL, profile_cover_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(coverLocked, id);
    deleteFileIfExists(user.profile_cover_path);
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'admin_profile_cover_remove',
      targetType: 'user',
      targetId: id,
      details: { coverLocked }
    });
    req.flash('success', 'Profil kapağı kaldırıldı.');
    return res.redirect(`/admin/users/${id}/edit`);
  }

  if (nextCoverPath) {
    try {
      assertImageSignature(req.file);
    } catch (error) {
      deleteFileIfExists(nextCoverPath);
      throw error;
    }
    db.prepare('UPDATE users SET profile_cover_path = ?, profile_cover_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextCoverPath, coverLocked, id);
    deleteFileIfExists(user.profile_cover_path);
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'admin_profile_cover_replace',
      targetType: 'user',
      targetId: id,
      details: { coverLocked }
    });
    req.flash('success', 'Profil kapağı yönetici tarafından güncellendi.');
  } else {
    db.prepare('UPDATE users SET profile_cover_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(coverLocked, id);
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'admin_profile_cover_lock_update',
      targetType: 'user',
      targetId: id,
      details: { coverLocked }
    });
    req.flash('success', 'Profil kapak kilidi güncellendi.');
  }

  return res.redirect(`/admin/users/${id}/edit`);
});

router.post('/admin/users/:id/reset-kvkk', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.redirect('/admin');
  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(id);
  if (!user) {
    req.flash('error', 'Kullanıcı bulunamadı.');
    return res.redirect('/admin');
  }
  db.prepare('UPDATE users SET kvkk_approved_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_kvkk_consent_reset',
    targetType: 'user',
    targetId: id,
    details: { targetName: user.name }
  });
  req.flash('success', `${user.name} adlı kullanıcının KVKK onayı sıfırlandı. Bir sonraki girişte tekrar onay isteyecek.`);
  return res.redirect(`/admin/users/${id}/edit`);
});

router.post('/admin/export/users-codes', requireAdmin, adminExportLimiter, verifyCsrf, (req, res) => {
  if (!requireAdminAccessCode(req)) {
    return res.redirect('/admin');
  }
  const users = db
    .prepare(
      `SELECT id, name, student_number, login_identifier, role, class_branch
       FROM users
       ORDER BY role, class_branch, name`
    )
    .all();

  const usersWithCodes = [];
  const tx = db.transaction(() => {
    users.forEach((user) => {
      const accessCode = generateAccessCode();
      const loginIdentifier = ensureLoginIdentifier(user);
      db.prepare(
        `UPDATE users
         SET access_code_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(hashAccessCode(accessCode), user.id);
      usersWithCodes.push({
        ...user,
        login_identifier: loginIdentifier,
        access_code: accessCode,
        student_number: user.student_number || '',
        class_branch: user.class_branch || ''
      });
    });
  });
  tx();

  const buffer = buildUsersExport(usersWithCodes);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_export_user_codes',
    targetType: 'user_export',
    targetId: null,
    details: { exportedUsers: usersWithCodes.length }
  });
  const exportDate = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename=\"kullanicilar-erisim-kodlari-${exportDate}.xlsx\"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buffer);
});

router.post('/admin/backups/create', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  let backup;
  try {
    backup = runAdminMaintenanceWindow(
      req,
      {
        reason: 'backup_create',
        message: 'Yedek oluşturuluyor. Kısa süre sonra site tekrar açılacak.'
      },
      () => createBackup()
    );
  } catch (error) {
    req.flash('error', error.message || 'Yedek oluşturulamadı.');
    return res.redirect('/admin');
  }

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_backup_create',
    targetType: 'backup',
    targetId: null,
    details: { name: backup.name }
  });
  req.flash('success', `${backup.name} yedeği oluşturuldu.`);
  return res.redirect('/admin');
});

router.post('/admin/backups/import', requireAdmin, adminWriteLimiter, verifyCsrf, backupArchiveUpload.single('backup_archive'), (req, res) => {
  if (!req.file) {
    req.flash('error', 'Yüklemek için bir yedek arşivi seçin.');
    return res.redirect('/admin');
  }

  let backup;
  try {
    backup = runAdminMaintenanceWindow(
      req,
      {
        reason: 'backup_import',
        message: 'Yedek arşivi içeri aktarılıyor. Kısa süre sonra site tekrar açılacak.'
      },
      () => importBackupArchive(req.file.path)
    );
  } catch (error) {
    req.flash('error', error.message || 'Yedek arşivi içe aktarılamadı.');
    return res.redirect('/admin');
  }

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_backup_import',
    targetType: 'backup',
    targetId: null,
    details: { name: backup.name, originalFileName: req.file.originalname }
  });
  req.flash('success', `${backup.name} yedeği bilgisayardan içe aktarıldı.`);
  return res.redirect('/admin');
});

router.get('/admin/backups/:name/download', requireAdmin, (req, res) => {
  const name = stripHtml(req.params.name || '');
  const backupPath = getBackupPath(name);
  if (!fs.existsSync(backupPath)) {
    req.flash('error', 'Yedek bulunamadı.');
    return res.redirect('/admin');
  }
  let archivePath;
  try {
    archivePath = createBackupArchive(name);
  } catch (error) {
    req.flash('error', 'Yedek arşivi oluşturulamadı.');
    return res.redirect('/admin');
  }
  return res.download(archivePath, `${name}.tar.gz`);
});

router.post('/admin/backups/:name/restore', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const name = stripHtml(req.params.name || '');
  if (!requireAdminAccessCode(req)) {
    return res.redirect('/admin');
  }

  const backupPath = getBackupPath(name);
  if (!fs.existsSync(backupPath)) {
    req.flash('error', 'Yedek bulunamadı.');
    return res.redirect('/admin');
  }

  try {
    setMaintenanceState({
      source: 'admin',
      actorUserId: req.currentUser.id,
      reason: 'backup_restore',
      message: 'Yedek geri yükleniyor. Uygulama yeniden başlatılana kadar site bakım modunda kalacak.'
    });
  } catch (error) {
    req.flash('error', error.message || 'Bakım modu başlatılamadı.');
    return res.redirect('/admin');
  }

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_backup_restore',
    targetType: 'backup',
    targetId: null,
    details: { name }
  });

  try {
    closeDatabase();
    restoreBackup(name);
  } catch (error) {
    clearMaintenanceState();
    res.status(500).send(
      `<html lang="tr"><head><meta charset="utf-8"><title>Geri Yükleme Hatası</title></head><body><h1>Geri yükleme tamamlanamadı</h1><p>${error.message || 'Bilinmeyen hata.'}</p><p>Uygulama güvenli durum için kapatılacak. Supervisor yeniden başlatmalıdır.</p></body></html>`
    );
    res.on('finish', () => {
      process.exit(1);
    });
    return undefined;
  }

  clearMaintenanceState();
  res.status(200).send(
    `<html lang="tr"><head><meta charset="utf-8"><title>Geri Yükleme Tamamlandı</title></head><body><h1>Yedek geri yüklendi</h1><p>${name} geri yüklendi. Uygulama şimdi kapatılacak. Production ortamında supervisor tek process olarak uygulamayı yeniden başlatmalıdır.</p></body></html>`
  );
  res.on('finish', () => {
    process.exit(0);
  });
  return undefined;
});

router.post('/admin/backups/:name/delete', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const name = stripHtml(req.params.name || '');
  if (!requireAdminAccessCode(req)) {
    return res.redirect('/admin');
  }

  try {
    deleteBackup(name);
  } catch (error) {
    req.flash('error', error.message || 'Yedek silinemedi.');
    return res.redirect('/admin');
  }

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_backup_delete',
    targetType: 'backup',
    targetId: null,
    details: { name }
  });
  req.flash('success', `${name} yedeği silindi.`);
  return res.redirect('/admin');
});

router.post('/admin/logs/clear', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  if (!requireAdminAccessCode(req)) {
    return res.redirect('/admin');
  }

  db.prepare('DELETE FROM audit_logs').run();
  db.prepare('DELETE FROM login_attempts').run();

  const appLogPath = path.join(LOG_DIR, 'app.log');
  if (fs.existsSync(appLogPath)) {
    fs.writeFileSync(appLogPath, '');
  }

  req.flash('success', 'Tüm log kayıtları temizlendi.');
  return res.redirect('/admin');
});

router.post('/admin/maintenance/clear', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  clearMaintenanceState();
  req.flash('success', 'Bakım modu işareti temizlendi.');
  return res.redirect('/admin');
});

router.post('/admin/home-background', requireAdmin, adminWriteLimiter, verifyCsrf, adminPhotoUpload.single('home_background'), (req, res) => {
  if (!req.file) {
    req.flash('error', 'Lütfen bir arka plan görseli seçin.');
    return res.redirect('/admin');
  }

  try {
    assertImageSignature(req.file);
  } catch (error) {
    deleteFileIfExists(`/uploads/photos/${req.file.filename}`);
    throw error;
  }

  const current = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'home_background_path'")
    .get();
  const nextPath = `/uploads/photos/${req.file.filename}`;

  db.prepare(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES ('home_background_path', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key)
     DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`
  ).run(nextPath);

  if (current && current.setting_value) {
    deleteFileIfExists(current.setting_value);
  }

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_home_background_update',
    targetType: 'setting',
    targetId: null,
    details: { path: nextPath }
  });
  req.flash('success', 'Ana sayfa arka planı güncellendi.');
  return res.redirect('/admin');
});

router.post('/admin/home-background/delete', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const current = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'home_background_path'")
    .get();

  if (current && current.setting_value) {
    deleteFileIfExists(current.setting_value);
  }

  db.prepare("DELETE FROM app_settings WHERE setting_key = 'home_background_path'").run();

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_home_background_delete',
    targetType: 'setting',
    targetId: null,
    details: {}
  });
  req.flash('success', 'Ana sayfa arka planı kaldırıldı.');
  return res.redirect('/admin');
});

router.post('/admin/year-end-settings', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const graduationDate = stripHtml(req.body.graduation_date || '').slice(0, 10);
  const closingTitle = stripHtml(req.body.closing_title || '').slice(0, 120);
  const closingBody = stripHtml(req.body.closing_body || '').slice(0, 2000);
  const archivePublic = req.body.archive_public === 'yes' ? '1' : '0';

  const upsert = db.prepare(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value = excluded.setting_value,
       updated_at = CURRENT_TIMESTAMP`
  );

  upsert.run('graduation_date', graduationDate);
  upsert.run('closing_title', closingTitle);
  upsert.run('closing_body', closingBody);
  upsert.run('archive_public', archivePublic);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_year_end_settings_update',
    targetType: 'app_settings',
    targetId: null,
    details: { graduationDate, archivePublic: archivePublic === '1' }
  });
  req.flash('success', 'Yıl sonu ayarları güncellendi.');
  return res.redirect('/admin');
});

router.post('/admin/teachers/reset-categories', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  if (!requireAdminAccessCode(req)) {
    return res.redirect('/admin');
  }

  const result = db.prepare(
    `UPDATE users
     SET teacher_category = 'teacher', updated_at = CURRENT_TIMESTAMP
     WHERE role = 'teacher'`
  ).run();

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_teacher_categories_reset',
    targetType: 'user',
    targetId: null,
    details: { updatedTeachers: result.changes }
  });
  req.flash('success', `${result.changes} öğretmenin alt kategorisi "Öğretmen" olarak güncellendi.`);
  return res.redirect('/admin');
});

router.post('/admin/users/:id/delete', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    req.flash('error', 'Geçersiz kullanıcı numarası.');
    return res.redirect('/admin');
  }

  if (id === req.currentUser.id) {
    req.flash('error', 'Kendi yönetici hesabınızı silemezsiniz.');
    return res.redirect('/admin');
  }

  if (!requireAdminAccessCode(req)) {
    return res.redirect('/admin');
  }

  const targetUser = db.prepare('SELECT id, name, role, photo_path FROM users WHERE id = ?').get(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  deleteFileIfExists(targetUser && targetUser.photo_path);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_user_delete',
    targetType: 'user',
    targetId: id,
    details: targetUser || {}
  });
  req.flash('success', 'Kullanıcı silindi.');
  return res.redirect('/admin');
});

router.post('/admin/messages/:id/delete', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  const backToRaw = stripHtml(req.body.back_to || '');
  const backTo = backToRaw.startsWith('/profiles/') ? backToRaw : '/admin';
  if (!Number.isInteger(id) || id <= 0) {
    req.flash('error', 'Geçersiz mesaj numarası.');
    return res.redirect(backTo);
  }

  if (!requireAdminAccessCode(req)) {
    return res.redirect(backTo);
  }

  db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_message_delete',
    targetType: 'message',
    targetId: id,
    details: { backTo }
  });
  req.flash('success', 'Mesaj silindi.');
  return res.redirect(backTo);
});

router.get('/admin/import', requireAdmin, (req, res) => {
  return renderImportPage(req, res);
});

router.post('/admin/announcements/:id/toggle', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  const announcement = db.prepare('SELECT id, is_active, title FROM announcements WHERE id = ?').get(id);
  if (!announcement) {
    req.flash('error', 'Duyuru bulunamadı.');
    return res.redirect('/admin');
  }

  const nextValue = announcement.is_active ? 0 : 1;
  db.prepare('UPDATE announcements SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextValue, id);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_announcement_toggle',
    targetType: 'announcement',
    targetId: id,
    details: { title: announcement.title, isActive: nextValue === 1 }
  });
  req.flash('success', 'Duyuru durumu güncellendi.');
  return res.redirect('/admin');
});

router.post('/admin/announcements/:id/delete', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  const announcement = db.prepare('SELECT id, title FROM announcements WHERE id = ?').get(id);
  if (!announcement) {
    req.flash('error', 'Duyuru bulunamadı.');
    return res.redirect('/admin');
  }

  db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_announcement_delete',
    targetType: 'announcement',
    targetId: id,
    details: { title: announcement.title }
  });
  req.flash('success', 'Duyuru silindi.');
  return res.redirect('/admin');
});

router.post('/admin/flags/:id/:decision', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  const decision = stripHtml(req.params.decision || '');
  if (!['resolve', 'dismiss'].includes(decision)) {
    req.flash('error', 'Geçersiz moderasyon kararı.');
    return res.redirect('/admin');
  }

  const flag = db.prepare('SELECT id, message_id FROM message_flags WHERE id = ?').get(id);
  if (!flag) {
    req.flash('error', 'Bildirim bulunamadı.');
    return res.redirect('/admin');
  }

  db.prepare(
    `UPDATE message_flags
     SET status = ?, reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(decision === 'resolve' ? 'resolved' : 'dismissed', req.currentUser.id, id);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: decision === 'resolve' ? 'admin_flag_resolve' : 'admin_flag_dismiss',
    targetType: 'message_flag',
    targetId: id,
    details: { messageId: flag.message_id }
  });

  req.flash('success', 'Moderasyon kaydı güncellendi.');
  return res.redirect('/admin');
});

router.post('/admin/user-reports/:id/:decision', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const id = Number(req.params.id);
  const decision = stripHtml(req.params.decision || '');
  if (!['resolve', 'dismiss'].includes(decision)) {
    req.flash('error', 'Geçersiz moderasyon kararı.');
    return res.redirect('/admin');
  }

  const report = db.prepare('SELECT id, reported_user_id FROM user_reports WHERE id = ?').get(id);
  if (!report) {
    req.flash('error', 'Bildirim bulunamadı.');
    return res.redirect('/admin');
  }

  db.prepare(
    `UPDATE user_reports
     SET status = ?, reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(decision === 'resolve' ? 'resolved' : 'dismissed', req.currentUser.id, id);

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: decision === 'resolve' ? 'admin_user_report_resolve' : 'admin_user_report_dismiss',
    targetType: 'user_report',
    targetId: id,
    details: { reportedUserId: report.reported_user_id }
  });

  req.flash('success', 'Kullanıcı bildirimi güncellendi.');
  return res.redirect('/admin');
});

router.post('/admin/import/students', requireAdmin, adminWriteLimiter, verifyCsrf, excelUpload.single('excel'), (req, res) => {
  if (!req.file) {
    req.flash('error', 'Excel dosyası zorunludur.');
    return res.redirect('/admin/import');
  }
  const schoolId = Number(req.body.school_id || 0);
  if (!db.prepare('SELECT id FROM schools WHERE id = ? AND is_active = 1').get(schoolId) || !canManageSchool(req.currentUser, schoolId)) {
    req.flash('error', 'İçe aktarım için geçerli bir okul seçin.');
    return res.redirect('/admin/import');
  }

  let rows;
  try {
    rows = parseRowsFromExcel(req.file.buffer);
  } catch (error) {
    req.flash('error', error.message);
    return res.redirect('/admin/import');
  }

  const previewResult = buildImportPreview('students', rows, schoolId);
  return renderImportPage(req, res, { previewResult });
});

router.post('/admin/import/teachers', requireAdmin, adminWriteLimiter, verifyCsrf, excelUpload.single('excel'), (req, res) => {
  if (!req.file) {
    req.flash('error', 'Excel dosyası zorunludur.');
    return res.redirect('/admin/import');
  }
  const schoolId = Number(req.body.school_id || 0);
  if (!db.prepare('SELECT id FROM schools WHERE id = ? AND is_active = 1').get(schoolId) || !canManageSchool(req.currentUser, schoolId)) {
    req.flash('error', 'İçe aktarım için geçerli bir okul seçin.');
    return res.redirect('/admin/import');
  }

  let rows;
  try {
    rows = parseRowsFromExcel(req.file.buffer);
  } catch (error) {
    req.flash('error', error.message);
    return res.redirect('/admin/import');
  }

  const previewResult = buildImportPreview('teachers', rows, schoolId);
  return renderImportPage(req, res, { previewResult });
});

router.post('/admin/import/confirm', requireAdmin, adminWriteLimiter, verifyCsrf, (req, res) => {
  const payload = decodeImportPayload(req.body.preview_payload);
  if (!payload || !payload.validRows.length) {
    req.flash('error', 'Onaylanacak geçerli içe aktarma satırı bulunamadı.');
    return res.redirect('/admin/import');
  }
  if (!db.prepare('SELECT id FROM schools WHERE id = ? AND is_active = 1').get(Number(payload.schoolId || 0)) || !canManageSchool(req.currentUser, Number(payload.schoolId || 0))) {
    req.flash('error', 'Bu okul için içe aktarma yetkiniz yok.');
    return res.redirect('/admin/import');
  }

  try {
    const createdUsers = runAdminMaintenanceWindow(
      req,
      {
        reason: payload.kind === 'students' ? 'student_import' : 'teacher_import',
        message: 'Kullanıcı içe aktarma işlemi sürüyor. Kısa süre sonra site tekrar açılacak.'
      },
      () => {
        const nextUsers = [];
        const insertStudent = db.prepare(
          `INSERT INTO users (name, student_number, role, school_id, class_branch, access_code_hash)
           VALUES (?, ?, 'student', ?, ?, ?)`
        );
        const insertTeacher = db.prepare(
          `INSERT INTO users (name, student_number, role, school_id, class_branch, teacher_category, access_code_hash)
           VALUES (?, NULL, 'teacher', ?, NULL, 'teacher', ?)`
        );
        const tx = db.transaction(() => {
          payload.validRows.forEach((row) => {
            const accessCode = generateAccessCode();
            const result = payload.kind === 'students'
              ? insertStudent.run(row.name, row.student_number, Number(payload.schoolId), row.class_branch, hashAccessCode(accessCode))
              : insertTeacher.run(row.name, Number(payload.schoolId), hashAccessCode(accessCode));
            nextUsers.push({
              ...row,
              accessCode,
              login_identifier: ensureLoginIdentifier({
                id: Number(result.lastInsertRowid),
                role: row.role,
                name: row.name,
                login_identifier: null
              })
            });
          });
        });
        tx();
        return nextUsers;
      }
    );

    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: payload.kind === 'students' ? 'admin_import_students' : 'admin_import_teachers',
      targetType: 'user_import',
      targetId: null,
      details: { count: createdUsers.length, schoolId: Number(payload.schoolId) }
    });

    return renderImportPage(req, res, { importedUsers: createdUsers });
  } catch (error) {
    req.flash('error', `İçe aktarma başarısız: ${error.message}`);
    return res.redirect('/admin/import');
  }
});

router.post('/admin/import/preview-report.csv', requireAdmin, adminExportLimiter, verifyCsrf, (req, res) => {
  const payload = decodeImportPayload(req.body.preview_payload);
  const conflicts = parseJsonArray(req.body.conflict_rows || '[]');
  const errors = parseJsonArray(req.body.error_rows || '[]');
  if (!payload) {
    req.flash('error', 'Import önizleme raporu oluşturulamadı.');
    return res.redirect('/admin/import');
  }
  const rows = [
    ...payload.validRows.map((row) => ['oluşturulacak', row.rowNumber, row.name, row.student_number || '', row.class_branch || '', '']),
    ...conflicts.map((row) => ['çakışma', row.rowNumber, row.name || '', row.student_number || '', row.class_branch || '', row.reason || '']),
    ...errors.map((row) => ['hata', row.rowNumber, Array.isArray(row.values) ? row.values.join(' | ') : '', '', '', row.reason || ''])
  ];
  return sendCsv(res, 'import-onizleme-raporu.csv', [['Durum', 'Satır', 'Ad/Ham Değer', 'Öğrenci No', 'Sınıf', 'Neden'], ...rows]);
});

router.use((error, req, res, next) => {
  if (error && error.message) {
    req.flash('error', error.message);
    if (req.originalUrl.includes('/admin/users/') && req.originalUrl.includes('/photo')) {
      const userId = Number(req.params.id);
      if (Number.isInteger(userId) && userId > 0) {
        return res.redirect(`/admin/users/${userId}/edit`);
      }
    }
    return res.redirect('/admin/import');
  }
  return next(error);
});

router.post('/admin/compress-all-images', requireAdmin, verifyCsrf, async (req, res) => {
  const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
  const dirs = [UPLOAD_DIR, GALLERY_UPLOAD_DIR, CLASS_COVER_UPLOAD_DIR];
  let total = 0;
  let compressed = 0;
  let errors = 0;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => IMAGE_EXT.test(f));
    for (const file of files) {
      total++;
      const result = await compressImage(path.join(dir, file));
      if (result.compressed) compressed++;
      if (result.error) errors++;
    }
  }

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'admin_compress_all_images',
    targetType: 'system',
    targetId: null,
    details: { total, compressed, errors }
  });
  req.flash('success', `${total} resim tarandı, ${compressed} tanesi küçüldü.${errors ? ` ${errors} resim atlandı.` : ''}`);
  return res.redirect('/admin#admin-backups');
});

module.exports = router;
