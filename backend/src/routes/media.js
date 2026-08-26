const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { db, getActiveClassBranches, isValidClassBranch } = require('../db');
const { requireLogin } = require('../middleware/auth');
const { verifyCsrf } = require('../middleware/csrf');
const { GALLERY_UPLOAD_DIR, MAX_UPLOAD_SIZE_BYTES, UPLOAD_DIR, CLASS_COVER_UPLOAD_DIR } = require('../config');
const { stripHtml } = require('../utils/sanitize');
const { deleteFileIfExists } = require('../utils/files');
const { assertImageSignature, getSafeImageExtension, isAllowedImageMime } = require('../utils/uploadValidation');
const { writeAuditLog } = require('../utils/auditLog');
const { isFeatureEnabled } = require('../utils/features');
const { compareTurkishText, compareUsersTurkish } = require('../utils/sort');
const { createInboxNotification } = require('../utils/inbox');
const { createApprovalRequest, isContentApprovalEnabled } = require('../utils/contentApproval');
const { validateContentText } = require('../utils/contentModeration');
const { compressImage } = require('../utils/imageCompress');

const router = express.Router();
const MAX_GALLERY_FILES = 100;
const MAX_COMMENT_LENGTH = 400;
const ALLOWED_REACTIONS = ['❤️', '👍', '👏', '😂', '😍'];

if (!fs.existsSync(GALLERY_UPLOAD_DIR)) {
  fs.mkdirSync(GALLERY_UPLOAD_DIR, { recursive: true });
}

const galleryStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, GALLERY_UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = getSafeImageExtension(file.mimetype);
    cb(null, `gallery-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});

const galleryUpload = multer({
  storage: galleryStorage,
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_, file, cb) => {
    if (!isAllowedImageMime(file.mimetype)) {
      return cb(new Error('Yalnızca görsel dosyaları yüklenebilir.'));
    }
    return cb(null, true);
  }
});

const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Çok fazla yükleme işlemi yapıldı. Lütfen daha sonra tekrar deneyin.'
});

function ensureGalleryUploadAllowed(req, res, next) {
  if (!['student', 'admin'].includes(req.currentUser.role)) {
    req.flash('error', 'Fotoğraf yükleme yetkisi yalnızca öğrenci ve yönetici kullanıcılar içindir.');
    return res.redirect(buildBackUrl('general'));
  }

  return next();
}

function buildBackUrl(classFilter) {
  const filter = classFilter && isValidClassBranch(classFilter) ? classFilter : 'general';
  return `/gallery?class=${encodeURIComponent(filter)}`;
}

function ensureColumn(table, column, definition) {
  try {
    db.prepare(`SELECT ${column} FROM ${table} LIMIT 1`).get();
  } catch (error) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    } catch (alterError) {
      if (!String(alterError.message || alterError).toLowerCase().includes('duplicate')) {
        throw alterError;
      }
    }
  }
}

function ensureGalleryAlbumScopeColumns() {
  ensureColumn('gallery_albums', 'school_id', 'school_id INTEGER');
  ensureColumn('gallery_albums', 'album_type', "album_type TEXT NOT NULL DEFAULT 'school'");
  db.prepare(
    `UPDATE gallery_albums
     SET school_id = COALESCE(
       (SELECT school_id FROM users WHERE users.id = gallery_albums.created_by_user_id),
       (SELECT CAST(setting_value AS INTEGER) FROM app_settings WHERE setting_key = 'current_school_id' LIMIT 1),
       (SELECT id FROM schools ORDER BY id LIMIT 1)
     )
     WHERE school_id IS NULL`
  ).run();
  db.prepare(
    `UPDATE gallery_albums
     SET album_type = CASE WHEN class_branch IS NULL OR trim(class_branch) = '' THEN 'school' ELSE 'class' END
     WHERE album_type IS NULL OR trim(album_type) = ''`
  ).run();
}

function getDefaultSchoolId() {
  const current = db.prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'current_school_id'").get();
  if (current && Number(current.setting_value || 0) > 0) {
    return Number(current.setting_value);
  }
  const first = db.prepare('SELECT id FROM schools WHERE is_active = 1 ORDER BY id LIMIT 1').get();
  return first ? Number(first.id) : null;
}

function getRequestSchoolId(user) {
  if (user && user.role !== 'admin' && user.school_id) {
    return Number(user.school_id);
  }
  return getDefaultSchoolId();
}

function isSchoolManager(user) {
  return Boolean(user && (
    user.role === 'admin' ||
    (user.role === 'teacher' && ['principal', 'vice_principal', 'head_vice_principal'].includes(user.teacher_category))
  ));
}

function canManageAlbum(user, album) {
  return Boolean(user && album && (
    user.role === 'admin' ||
    album.created_by_user_id === user.id ||
    (isSchoolManager(user) && Number(user.school_id || 0) === Number(album.school_id || 0))
  ));
}

ensureGalleryAlbumScopeColumns();

function parseSelectedPhotoIds(values) {
  const list = Array.isArray(values) ? values : [values];
  return [...new Set(list.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

function canManagePhoto(user, photo) {
  return Boolean(user && photo && (user.role === 'admin' || photo.uploader_user_id === user.id));
}

function requireFeature(req, res, key, redirectTo = '/', message = 'Bu özellik şu anda kapalı.') {
  if (isFeatureEnabled(req.featureFlags || {}, key)) {
    return true;
  }
  req.flash('error', message);
  res.redirect(redirectTo);
  return false;
}

function isAjaxRequest(req) {
  return req.get('x-requested-with') === 'XMLHttpRequest';
}

function respondMediaAction(req, res, classFilter, message, statusCode = 200) {
  if (isAjaxRequest(req)) {
    return res.status(statusCode).json({
      ok: statusCode < 400,
      message,
      redirectTo: buildBackUrl(classFilter)
    });
  }

  if (statusCode >= 400) {
    req.flash('error', message);
  } else {
    req.flash('success', message);
  }
  return res.redirect(buildBackUrl(classFilter));
}

router.use('/gallery', (req, res, next) => {
  if (!isFeatureEnabled(req.featureFlags || {}, 'gallery')) {
    req.flash('error', 'Galeri şu anda kapalı.');
    return res.redirect('/');
  }
  return next();
});

router.use('/media', (req, res, next) => {
  const isReactionRoute = req.path.includes('/react');
  const featureKey = isReactionRoute ? 'photo_reactions' : 'gallery';
  if (!isFeatureEnabled(req.featureFlags || {}, featureKey)) {
    req.flash('error', 'Bu özellik şu anda kapalı.');
    return res.redirect('/');
  }
  return next();
});

router.get('/uploads/:bucket/:filename', requireLogin, (req, res) => {
  const bucket = stripHtml(req.params.bucket || '');
  const filename = path.basename(req.params.filename || '');

  if (!['photos', 'gallery', 'class-covers'].includes(bucket) || !filename) {
    return res.status(404).end();
  }

  const absolutePath = bucket === 'photos'
    ? path.join(UPLOAD_DIR, filename)
    : bucket === 'gallery'
      ? path.join(GALLERY_UPLOAD_DIR, filename)
      : path.join(CLASS_COVER_UPLOAD_DIR, filename);
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).end();
  }

  return res.sendFile(absolutePath);
});

function renderMediaPage(req, res) {
  if (!isFeatureEnabled(req.featureFlags || {}, 'gallery')) {
    req.flash('error', 'Galeri şu anda kapalı.');
    return res.redirect('/');
  }
  const classQuery = stripHtml(req.query.class || '').toUpperCase();
  const allowedClasses = getActiveClassBranches();
  const classFilter = allowedClasses.includes(classQuery) ? classQuery : 'general';
  const dateFrom = stripHtml(req.query.date_from || '').slice(0, 20);
  const albumId = Number(req.query.album_id || 0);
  const sort = stripHtml(req.query.sort || '') === 'views' ? 'views' : 'recent';
  const schoolId = getRequestSchoolId(req.currentUser);

  const albums = db
    .prepare(
      `SELECT a.id, a.title, a.description, a.class_branch, a.school_id, a.album_type, a.created_by_user_id, a.created_at,
              a.cover_photo_id, cp.photo_path AS cover_photo_path
       FROM gallery_albums a
       LEFT JOIN gallery_photos cp ON cp.id = a.cover_photo_id
       WHERE a.school_id = ?
         AND ((? = 'general' AND (a.class_branch IS NULL OR a.album_type = 'school')) OR a.class_branch = ?)
       ORDER BY a.created_at DESC`
    )
    .all(schoolId, classFilter, classFilter);

  let photos;
  const filters = ["p.section = 'gallery'"];
  const params = [];
  if (classFilter === 'general') {
    filters.push('p.class_branch IS NULL');
  } else {
    filters.push('p.class_branch = ?');
    params.push(classFilter);
  }
  if (albumId > 0) {
    filters.push('p.album_id = ?');
    params.push(albumId);
  }
  if (dateFrom) {
    filters.push('date(p.created_at) >= date(?)');
    params.push(dateFrom);
  }

  photos = db
    .prepare(
      `SELECT p.id, p.photo_path, p.caption, p.date_stamp_text, p.class_branch, p.created_at, p.group_id, p.group_index,
              p.uploader_user_id, p.album_id, p.sort_order, p.view_count, u.name as uploader_name,
              a.title AS album_title
       FROM gallery_photos p
       JOIN users u ON u.id = p.uploader_user_id
       LEFT JOIN gallery_albums a ON a.id = p.album_id
       WHERE u.school_id = ? AND ${filters.join(' AND ')}
       ORDER BY ${sort === 'views' ? 'p.view_count DESC, p.created_at DESC' : albumId > 0 ? 'p.sort_order ASC, p.created_at DESC' : 'p.created_at DESC'}`
    )
    .all(schoolId, ...params);

  const galleryItems = [];
  const groups = new Map();

  photos.forEach((photo) => {
    if (photo.group_id) {
      let group = groups.get(photo.group_id);
      if (!group) {
        group = {
          type: 'collage',
          groupId: photo.group_id,
          photos: [],
          created_at: photo.created_at,
          uploader_user_id: photo.uploader_user_id,
          uploader_names: [],
          class_branch: photo.class_branch,
          album_id: photo.album_id,
          album_title: photo.album_title,
          caption: photo.caption,
          date_stamp_text: photo.date_stamp_text,
          view_count: photo.view_count || 0,
          tags: []
        };
        groups.set(photo.group_id, group);
        galleryItems.push(group);
      }
      group.photos.push(photo);
      if (!group.uploader_names.includes(photo.uploader_name)) {
        group.uploader_names.push(photo.uploader_name);
      }
      if (photo.created_at > group.created_at) {
        group.created_at = photo.created_at;
      }
      group.view_count += Number(photo.view_count || 0);
    } else {
      galleryItems.push({ type: 'single', photo, created_at: photo.created_at });
    }
  });

  galleryItems.forEach((item) => {
    if (item.type === 'collage') {
      item.photos.sort((a, b) => (a.group_index || 0) - (b.group_index || 0));
    }
  });

  galleryItems.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  const singlePhotoIds = galleryItems
    .filter((item) => item.type === 'single')
    .map((item) => item.photo.id);
  const allPhotoIds = photos.map((photo) => photo.id);
  const commentsByPhotoId = new Map();
  const commentsByGroupId = new Map();
  const tagsByPhotoId = new Map();
  const reactionsByPhotoId = new Map();
  const myReactionByPhotoId = new Map();
  const reactionsByGroupId = new Map();
  const myReactionByGroupId = new Map();

  if (allPhotoIds.length) {
    const placeholders = allPhotoIds.map(() => '?').join(', ');
    db.prepare(
      `SELECT c.id, c.photo_id, c.body, c.created_at, u.id AS author_id, u.name AS author_name
       FROM gallery_photo_comments c
       JOIN users u ON u.id = c.author_user_id
       WHERE c.photo_id IN (${placeholders})
       ORDER BY c.created_at DESC`
    )
      .all(...allPhotoIds)
      .forEach((comment) => {
        if (!commentsByPhotoId.has(comment.photo_id)) {
          commentsByPhotoId.set(comment.photo_id, []);
        }
        commentsByPhotoId.get(comment.photo_id).push(comment);
      });

    const groupIds = [...new Set(photos.map((photo) => photo.group_id).filter(Boolean))];
    if (groupIds.length) {
      const groupPlaceholders = groupIds.map(() => '?').join(', ');
      db.prepare(
        `SELECT c.id, c.group_id, c.body, c.created_at, u.id AS author_id, u.name AS author_name
         FROM gallery_collage_comments c
         JOIN users u ON u.id = c.author_user_id
         WHERE c.group_id IN (${groupPlaceholders})
         ORDER BY c.created_at DESC`
      )
        .all(...groupIds)
        .forEach((comment) => {
          if (!commentsByGroupId.has(comment.group_id)) {
            commentsByGroupId.set(comment.group_id, []);
          }
          commentsByGroupId.get(comment.group_id).push(comment);
        });

      db.prepare(
        `SELECT group_id, emoji, COUNT(*) AS total
         FROM gallery_collage_reactions
         WHERE group_id IN (${groupPlaceholders})
         GROUP BY group_id, emoji`
      )
        .all(...groupIds)
        .forEach((reaction) => {
          if (!reactionsByGroupId.has(reaction.group_id)) {
            reactionsByGroupId.set(reaction.group_id, []);
          }
          reactionsByGroupId.get(reaction.group_id).push(reaction);
        });

      db.prepare(
        `SELECT group_id, emoji
         FROM gallery_collage_reactions
         WHERE reactor_user_id = ? AND group_id IN (${groupPlaceholders})`
      )
        .all(req.currentUser.id, ...groupIds)
        .forEach((reaction) => {
          myReactionByGroupId.set(reaction.group_id, reaction.emoji);
        });
    }

    db.prepare(
      `SELECT t.photo_id, t.created_by_user_id, u.id AS tagged_user_id, u.name AS tagged_user_name
       FROM gallery_photo_user_tags t
       JOIN users u ON u.id = t.tagged_user_id
       WHERE t.photo_id IN (${placeholders})
       ORDER BY u.name`
    )
      .all(...allPhotoIds)
      .sort((a, b) => compareTurkishText(a.tagged_user_name, b.tagged_user_name))
      .forEach((tag) => {
        if (!tagsByPhotoId.has(tag.photo_id)) {
          tagsByPhotoId.set(tag.photo_id, []);
        }
        tagsByPhotoId.get(tag.photo_id).push(tag);
      });

    db.prepare(
      `SELECT photo_id, emoji, COUNT(*) AS total
       FROM gallery_photo_reactions
       WHERE photo_id IN (${placeholders})
       GROUP BY photo_id, emoji`
    )
      .all(...allPhotoIds)
      .forEach((reaction) => {
        if (!reactionsByPhotoId.has(reaction.photo_id)) {
          reactionsByPhotoId.set(reaction.photo_id, []);
        }
        reactionsByPhotoId.get(reaction.photo_id).push(reaction);
      });

    db.prepare(
      `SELECT photo_id, emoji
       FROM gallery_photo_reactions
       WHERE reactor_user_id = ? AND photo_id IN (${placeholders})`
    )
      .all(req.currentUser.id, ...allPhotoIds)
      .forEach((reaction) => {
        myReactionByPhotoId.set(reaction.photo_id, reaction.emoji);
      });
  }

  galleryItems.forEach((item) => {
    if (item.type !== 'collage') {
      return;
    }

    const seen = new Set();
    item.photos.forEach((photo) => {
      const tags = tagsByPhotoId.get(photo.id) || [];
      tags.forEach((tag) => {
        if (seen.has(tag.tagged_user_id)) {
          return;
        }
        seen.add(tag.tagged_user_id);
        item.tags.push(tag);
      });
    });
  });

  const topViewedPhotos = db
    .prepare(
      `SELECT p.id, p.photo_path, p.view_count
       FROM gallery_photos p
       JOIN users u ON u.id = p.uploader_user_id
       WHERE p.section = 'gallery'
         AND u.school_id = ?
         AND ((? = 'general' AND p.class_branch IS NULL) OR p.class_branch = ?)
       ORDER BY p.view_count DESC, p.created_at DESC
       LIMIT 6`
    )
    .all(schoolId, classFilter, classFilter);

  const taggableUsers = db
    .prepare(
      `SELECT id, name, role, class_branch
       FROM users
       WHERE school_id = ?
       ORDER BY role, class_branch, name
       LIMIT 300`
    )
    .all(schoolId)
    .sort(compareUsersTurkish);

  const selectedAlbum = albums.find((album) => album.id === albumId) || null;
  const selectedAlbumCanManage = Boolean(selectedAlbum && canManageAlbum(req.currentUser, selectedAlbum));
  const collages = galleryItems
    .filter((item) => item.type === 'collage')
    .map((item) => ({
      groupId: item.groupId,
      label: `${item.groupId.slice(0, 8)} - ${item.uploader_names.join(', ')}`
    }));

  return res.render('media', {
    title: 'Fotoğraf Galerisi',
    classFilter,
    galleryItems,
    albums,
    selectedAlbum,
    selectedAlbumCanManage,
    dateFrom,
    sort,
    topViewedPhotos,
    commentsByPhotoId,
    commentsByGroupId,
    tagsByPhotoId,
    taggableUsers,
    reactionsByPhotoId: isFeatureEnabled(req.featureFlags, 'photo_reactions') ? reactionsByPhotoId : new Map(),
    myReactionByPhotoId: isFeatureEnabled(req.featureFlags, 'photo_reactions') ? myReactionByPhotoId : new Map(),
    reactionsByGroupId: isFeatureEnabled(req.featureFlags, 'photo_reactions') ? reactionsByGroupId : new Map(),
    myReactionByGroupId: isFeatureEnabled(req.featureFlags, 'photo_reactions') ? myReactionByGroupId : new Map(),
    allowedReactions: ALLOWED_REACTIONS,
    collages,
    allowedClasses,
    schoolId
  });
}

router.get('/gallery', requireLogin, (req, res) => renderMediaPage(req, res));

router.get('/gallery/upload', requireLogin, (req, res) => {
  if (!requireFeature(req, res, 'gallery')) {
    return;
  }
  const classQuery = stripHtml(req.query.class || '').toUpperCase();
  const allowedClasses = getActiveClassBranches();
  const classFilter = allowedClasses.includes(classQuery) ? classQuery : 'general';
  const schoolId = getRequestSchoolId(req.currentUser);
  const albums = db
    .prepare(
      `SELECT id, title, description, class_branch, school_id, album_type
       FROM gallery_albums
       WHERE school_id = ?
         AND ((? = 'general' AND (class_branch IS NULL OR album_type = 'school')) OR class_branch = ?)
       ORDER BY created_at DESC`
    )
    .all(schoolId, classFilter, classFilter);

  return res.render('media-upload', {
    title: 'Fotoğraf Yükle',
    classFilter,
    albums,
    allowedClasses,
    schoolId
  });
});

router.post('/media/upload', requireLogin, uploadLimiter, verifyCsrf, ensureGalleryUploadAllowed, galleryUpload.array('photos', MAX_GALLERY_FILES), async (req, res) => {
  if (!requireFeature(req, res, 'gallery', '/')) {
    return;
  }
  const scope = stripHtml(req.body.scope || 'general');
  const classBranchInput = stripHtml(req.body.class_branch || '').toUpperCase();
  const caption = stripHtml(req.body.caption || '').slice(0, 2000);
  const albumId = Number(req.body.album_id || 0);
  const newAlbumTitle = stripHtml(req.body.new_album_title || '').slice(0, 120);
  const newAlbumDescription = stripHtml(req.body.new_album_description || '').slice(0, 300);
  const schoolId = getRequestSchoolId(req.currentUser);
  let dateStampText = stripHtml(req.body.date_stamp_text || '').slice(0, 2000);
  const isCollage = stripHtml(req.body.is_collage || '') === 'yes';

  if (!req.files || !req.files.length) {
    req.flash('error', 'En az 1 fotoğraf seçmelisiniz.');
    return res.redirect(buildBackUrl(scope === 'class' ? classBranchInput : 'general'));
  }

  let classBranch = null;
  if (scope === 'class') {
    if (!isValidClassBranch(classBranchInput)) {
      req.flash('error', 'Sınıf şubesi seçmelisiniz.');
      return res.redirect(buildBackUrl('general'));
    }
    classBranch = classBranchInput;
  }

  if (req.body.use_current_date === 'yes' && !dateStampText) {
    dateStampText = new Date().toLocaleDateString('tr-TR');
  }

  let targetAlbumId = null;
  if (newAlbumTitle) {
    const album = db.prepare(
      `INSERT INTO gallery_albums (title, description, class_branch, school_id, album_type, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(newAlbumTitle, newAlbumDescription, classBranch, schoolId, classBranch ? 'class' : 'school', req.currentUser.id);
    targetAlbumId = Number(album.lastInsertRowid);
  } else if (albumId > 0) {
    const existingAlbum = db.prepare('SELECT id, class_branch, school_id FROM gallery_albums WHERE id = ?').get(albumId);
    if (existingAlbum && Number(existingAlbum.school_id || 0) === Number(schoolId) && String(existingAlbum.class_branch || '') === String(classBranch || '')) {
      targetAlbumId = existingAlbum.id;
    }
  }

  const insert = db.prepare(
    `INSERT INTO gallery_photos (uploader_user_id, section, class_branch, album_id, photo_path, group_id, group_index, sort_order, caption, date_stamp_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const collageGroupId = isCollage && req.files.length > 1 ? crypto.randomBytes(12).toString('hex') : null;
  for (const file of req.files) {
    try {
      assertImageSignature(file);
    } catch (error) {
      deleteFileIfExists(`/uploads/gallery/${file.filename}`);
      throw error;
    }
    await compressImage(file.path);
  }

  if (isContentApprovalEnabled(db) && req.currentUser.role !== 'admin') {
    const files = req.files.map((file) => ({ photoPath: `/uploads/gallery/${file.filename}` }));
    createApprovalRequest(db, {
      itemType: 'gallery_upload',
      actorUserId: req.currentUser.id,
      targetUserId: null,
      payload: {
        files,
        classBranch,
        albumId: targetAlbumId,
        collageGroupId,
        caption,
        dateStampText
      }
    });
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'content_approval_request_create',
      targetType: 'gallery',
      targetId: null,
      details: { itemType: 'gallery_upload', count: req.files.length, classBranch, albumId: targetAlbumId, isCollage: Boolean(collageGroupId) }
    });
    req.flash('success', `${req.files.length} fotoğraf onaya gönderildi. Onaylanınca galeride yayınlanacak.`);
    return res.redirect(buildBackUrl(classBranch || 'general'));
  }

  const tx = db.transaction(() => {
    req.files.forEach((file, index) => {
      const photoPath = `/uploads/gallery/${file.filename}`;
      insert.run(
        req.currentUser.id,
        'gallery',
        classBranch,
        targetAlbumId,
        photoPath,
        collageGroupId,
        collageGroupId ? index : 0,
        index,
        caption,
        dateStampText
      );
    });
  });
  tx();

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'gallery_upload',
    targetType: 'gallery',
    targetId: null,
    details: { count: req.files.length, classBranch, albumId: targetAlbumId, isCollage: Boolean(collageGroupId) }
  });
  req.flash('success', `${req.files.length} fotoğraf yüklendi.`);
  return res.redirect(buildBackUrl(classBranch || 'general'));
});

router.post('/media/photos/:id/delete', requireLogin, verifyCsrf, (req, res) => {
  const photoId = Number(req.params.id);
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();

  if (req.currentUser.role === 'guest') {
    req.flash('error', 'Misafir profili yalnızca görüntüleme yapabilir.');
    return res.redirect(buildBackUrl(classFilter));
  }

  if (!Number.isInteger(photoId) || photoId <= 0) {
    req.flash('error', 'Geçersiz fotoğraf numarası.');
    return res.redirect('/gallery');
  }

  const photo = db
    .prepare('SELECT id, uploader_user_id, photo_path FROM gallery_photos WHERE id = ?')
    .get(photoId);

  if (!photo) {
    req.flash('error', 'Fotoğraf bulunamadı.');
    return res.redirect(buildBackUrl(classFilter));
  }

  if (photo.uploader_user_id !== req.currentUser.id && req.currentUser.role !== 'admin') {
    req.flash('error', 'Bu fotoğrafı silme yetkiniz yok.');
    return res.redirect(buildBackUrl(classFilter));
  }

  db.prepare('DELETE FROM gallery_photos WHERE id = ?').run(photoId);
  deleteFileIfExists(photo.photo_path);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'gallery_photo_delete',
    targetType: 'gallery_photo',
    targetId: photoId,
    details: {}
  });
  req.flash('success', 'Fotoğraf silindi.');
  return res.redirect(buildBackUrl(classFilter));
});

router.post('/media/collage/:groupId/delete', requireLogin, verifyCsrf, (req, res) => {
  const groupId = stripHtml(req.params.groupId || '');
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();

  if (req.currentUser.role === 'guest') {
    req.flash('error', 'Misafir profili yalnızca görüntüleme yapabilir.');
    return res.redirect(buildBackUrl(classFilter));
  }

  if (!groupId) {
    req.flash('error', 'Geçersiz kollaj numarası.');
    return res.redirect(buildBackUrl(classFilter));
  }

  const photos = db
    .prepare('SELECT id, uploader_user_id, photo_path FROM gallery_photos WHERE group_id = ?')
    .all(groupId);

  if (!photos.length) {
    req.flash('error', 'Kollaj bulunamadı.');
    return res.redirect(buildBackUrl(classFilter));
  }

  const isOwner = photos.every((photo) => photo.uploader_user_id === req.currentUser.id);
  if (!isOwner && req.currentUser.role !== 'admin') {
    req.flash('error', 'Bu kollajı silme yetkiniz yok.');
    return res.redirect(buildBackUrl(classFilter));
  }

  db.prepare('DELETE FROM gallery_photos WHERE group_id = ?').run(groupId);
  photos.forEach((photo) => deleteFileIfExists(photo.photo_path));
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'gallery_collage_delete',
    targetType: 'gallery_collage',
    targetId: null,
    details: { groupId, deletedPhotos: photos.length }
  });
  req.flash('success', 'Kollaj silindi.');
  return res.redirect(buildBackUrl(classFilter));
});

router.post('/media/collage/:groupId/unpack', requireLogin, verifyCsrf, (req, res) => {
  const groupId = stripHtml(req.params.groupId || '');
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();

  if (req.currentUser.role !== 'admin') {
    req.flash('error', 'Kollajı dağıtma yetkisi yalnızca yöneticiye açıktır.');
    return res.redirect(buildBackUrl(classFilter));
  }

  if (!groupId) {
    req.flash('error', 'Geçersiz kollaj numarası.');
    return res.redirect(buildBackUrl(classFilter));
  }

  const photos = db
    .prepare('SELECT id FROM gallery_photos WHERE group_id = ? ORDER BY group_index ASC, created_at ASC')
    .all(groupId);

  if (!photos.length) {
    req.flash('error', 'Kollaj bulunamadı.');
    return res.redirect(buildBackUrl(classFilter));
  }

  const update = db.prepare(
    `UPDATE gallery_photos
     SET group_id = NULL, group_index = 0, sort_order = ?
     WHERE id = ?`
  );
  const tx = db.transaction(() => {
    photos.forEach((photo, index) => {
      update.run(index, photo.id);
    });
  });
  tx();

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'gallery_collage_unpack',
    targetType: 'gallery_collage',
    targetId: null,
    details: { groupId, photoCount: photos.length }
  });
  req.flash('success', 'Kollaj dağıtıldı, fotoğraflar tekli hale getirildi.');
  return res.redirect(buildBackUrl(classFilter));
});

router.post('/media/photos/:id/caption', requireLogin, verifyCsrf, (req, res) => {
  const photoId = Number(req.params.id);
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();
  const caption = stripHtml(req.body.caption || '').slice(0, 2000);

  const photo = db
    .prepare('SELECT id, uploader_user_id FROM gallery_photos WHERE id = ?')
    .get(photoId);

  if (!photo) {
    return respondMediaAction(req, res, classFilter, 'Fotoğraf bulunamadı.', 404);
  }
  if (!canManagePhoto(req.currentUser, photo)) {
    return respondMediaAction(req, res, classFilter, 'Bu fotoğrafın açıklamasını düzenleme yetkiniz yok.', 403);
  }

  db.prepare('UPDATE gallery_photos SET caption = ? WHERE id = ?').run(caption, photoId);
  return respondMediaAction(req, res, classFilter, 'Fotoğraf açıklaması güncellendi.');
});

router.post('/media/collage/:groupId/caption', requireLogin, verifyCsrf, (req, res) => {
  const groupId = stripHtml(req.params.groupId || '');
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();
  const caption = stripHtml(req.body.caption || '').slice(0, 2000);

  const photos = db
    .prepare('SELECT id, uploader_user_id FROM gallery_photos WHERE group_id = ?')
    .all(groupId);

  if (!photos.length) {
    return respondMediaAction(req, res, classFilter, 'Kollaj bulunamadı.', 404);
  }
  if (!photos.every((photo) => canManagePhoto(req.currentUser, photo))) {
    return respondMediaAction(req, res, classFilter, 'Bu kollajın açıklamasını düzenleme yetkiniz yok.', 403);
  }

  db.prepare('UPDATE gallery_photos SET caption = ? WHERE group_id = ?').run(caption, groupId);
  return respondMediaAction(req, res, classFilter, 'Kollaj açıklaması güncellendi.');
});

router.post('/media/photos/:id/comment', requireLogin, verifyCsrf, (req, res) => {
  const photoId = Number(req.params.id);
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();
  const body = stripHtml(req.body.body || '').slice(0, MAX_COMMENT_LENGTH);

  if (req.currentUser.role === 'guest') {
    return respondMediaAction(req, res, classFilter, 'Misafir profili yalnızca görüntüleme yapabilir.', 403);
  }
  if (!Number.isInteger(photoId) || photoId <= 0 || !body) {
    return respondMediaAction(req, res, classFilter, 'Yorum metni zorunludur.', 400);
  }
  const moderation = validateContentText(db, body, { minLength: 5 });
  if (!moderation.ok) {
    return respondMediaAction(req, res, classFilter, moderation.message, 400);
  }

  const photo = db.prepare('SELECT id, uploader_user_id FROM gallery_photos WHERE id = ?').get(photoId);
  if (!photo) {
    return respondMediaAction(req, res, classFilter, 'Fotoğraf bulunamadı.', 404);
  }

  if (isContentApprovalEnabled(db)) {
    createApprovalRequest(db, {
      itemType: 'gallery_photo_comment',
      actorUserId: req.currentUser.id,
      targetUserId: photo.uploader_user_id,
      existingItemId: photoId,
      payload: { body, classFilter }
    });
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'content_approval_request_create',
      targetType: 'gallery_photo_comment',
      targetId: null,
      details: { itemType: 'gallery_photo_comment', photoId }
    });
    return respondMediaAction(req, res, classFilter, 'Fotoğraf yorumu onaya gönderildi.');
  }

  db.prepare(
    `INSERT INTO gallery_photo_comments (photo_id, author_user_id, body)
     VALUES (?, ?, ?)`
  ).run(photoId, req.currentUser.id, body);
  createInboxNotification({
    userId: photo.uploader_user_id,
    actorUserId: req.currentUser.id,
    kind: 'gallery_photo_comment',
    title: 'Fotografina yorum geldi',
    body: `${req.currentUser.name} galerideki fotografindan birine yorum yazdi.`,
    linkPath: buildBackUrl(classFilter)
  });
  return respondMediaAction(req, res, classFilter, 'Fotoğrafa yorum eklendi.');
});

router.post('/media/collage/:groupId/comment', requireLogin, verifyCsrf, (req, res) => {
  const groupId = stripHtml(req.params.groupId || '');
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();
  const body = stripHtml(req.body.body || '').slice(0, MAX_COMMENT_LENGTH);

  if (req.currentUser.role === 'guest') {
    return respondMediaAction(req, res, classFilter, 'Misafir profili yalnızca görüntüleme yapabilir.', 403);
  }
  if (!groupId || !body) {
    return respondMediaAction(req, res, classFilter, 'Kollaj yorumu zorunludur.', 400);
  }
  const moderation = validateContentText(db, body, { minLength: 5 });
  if (!moderation.ok) {
    return respondMediaAction(req, res, classFilter, moderation.message, 400);
  }

  const collage = db.prepare('SELECT id FROM gallery_photos WHERE group_id = ? LIMIT 1').get(groupId);
  if (!collage) {
    return respondMediaAction(req, res, classFilter, 'Kollaj bulunamadı.', 404);
  }

  if (isContentApprovalEnabled(db)) {
    createApprovalRequest(db, {
      itemType: 'gallery_collage_comment',
      actorUserId: req.currentUser.id,
      targetUserId: null,
      payload: { groupId, body, classFilter }
    });
    writeAuditLog({
      actorUserId: req.currentUser.id,
      action: 'content_approval_request_create',
      targetType: 'gallery_collage_comment',
      targetId: null,
      details: { itemType: 'gallery_collage_comment', groupId }
    });
    return respondMediaAction(req, res, classFilter, 'Kollaj yorumu onaya gönderildi.');
  }

  db.prepare(
    `INSERT INTO gallery_collage_comments (group_id, author_user_id, body)
     VALUES (?, ?, ?)`
  ).run(groupId, req.currentUser.id, body);
  db.prepare('SELECT DISTINCT uploader_user_id FROM gallery_photos WHERE group_id = ?')
    .all(groupId)
    .forEach((row) => {
      createInboxNotification({
        userId: row.uploader_user_id,
        actorUserId: req.currentUser.id,
        kind: 'gallery_collage_comment',
        title: 'Kollajina yorum geldi',
        body: `${req.currentUser.name} galerideki kollajina yorum yazdi.`,
        linkPath: buildBackUrl(classFilter)
      });
    });
  return respondMediaAction(req, res, classFilter, 'Kollaja yorum eklendi.');
});

router.post('/media/photos/:photoId/comments/:commentId/delete', requireLogin, verifyCsrf, (req, res) => {
  const photoId = Number(req.params.photoId);
  const commentId = Number(req.params.commentId);
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();

  const comment = db
    .prepare('SELECT id, author_user_id FROM gallery_photo_comments WHERE id = ? AND photo_id = ?')
    .get(commentId, photoId);

  if (!comment) {
    return respondMediaAction(req, res, classFilter, 'Fotoğraf yorumu bulunamadı.', 404);
  }
  if (req.currentUser.role !== 'admin' && comment.author_user_id !== req.currentUser.id) {
    return respondMediaAction(req, res, classFilter, 'Bu yorumu silme yetkiniz yok.', 403);
  }

  db.prepare('DELETE FROM gallery_photo_comments WHERE id = ?').run(commentId);
  return respondMediaAction(req, res, classFilter, 'Fotoğraf yorumu silindi.');
});

router.post('/media/collage/:groupId/comments/:commentId/delete', requireLogin, verifyCsrf, (req, res) => {
  const groupId = stripHtml(req.params.groupId || '');
  const commentId = Number(req.params.commentId);
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();

  const comment = db
    .prepare('SELECT id, author_user_id FROM gallery_collage_comments WHERE id = ? AND group_id = ?')
    .get(commentId, groupId);

  if (!comment) {
    return respondMediaAction(req, res, classFilter, 'Kollaj yorumu bulunamadı.', 404);
  }
  if (req.currentUser.role !== 'admin' && comment.author_user_id !== req.currentUser.id) {
    return respondMediaAction(req, res, classFilter, 'Bu yorumu silme yetkiniz yok.', 403);
  }

  db.prepare('DELETE FROM gallery_collage_comments WHERE id = ?').run(commentId);
  return respondMediaAction(req, res, classFilter, 'Kollaj yorumu silindi.');
});

router.post('/media/photos/:id/tag', requireLogin, verifyCsrf, (req, res) => {
  const photoId = Number(req.params.id);
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();
  const taggedUserId = Number(req.body.tagged_user_id || 0);

  if (req.currentUser.role === 'guest') {
    return respondMediaAction(req, res, classFilter, 'Misafir profili yalnızca görüntüleme yapabilir.', 403);
  }
  if (!Number.isInteger(photoId) || photoId <= 0 || !Number.isInteger(taggedUserId) || taggedUserId <= 0) {
    return respondMediaAction(req, res, classFilter, 'Geçersiz etiketleme isteği.', 400);
  }

  const taggedUser = db.prepare('SELECT id FROM users WHERE id = ?').get(taggedUserId);
  if (!taggedUser) {
    return respondMediaAction(req, res, classFilter, 'Etiketlenecek kullanıcı bulunamadı.', 404);
  }

  db.prepare(
    `INSERT OR IGNORE INTO gallery_photo_user_tags (photo_id, tagged_user_id, created_by_user_id)
     VALUES (?, ?, ?)`
  ).run(photoId, taggedUserId, req.currentUser.id);
  return respondMediaAction(req, res, classFilter, 'Fotoğraf etiketi kaydedildi.');
});

router.post('/media/photos/:id/tags/:taggedUserId/delete', requireLogin, verifyCsrf, (req, res) => {
  const photoId = Number(req.params.id);
  const taggedUserId = Number(req.params.taggedUserId);
  const classFilter = stripHtml(req.body.class_filter || 'general');

  if (!Number.isInteger(photoId) || photoId <= 0 || !Number.isInteger(taggedUserId) || taggedUserId <= 0) {
    return respondMediaAction(req, res, classFilter, 'Etiket kaydı bulunamadı.', 400);
  }

  const tagRecord = db.prepare(
    `SELECT t.id, t.created_by_user_id, p.uploader_user_id
     FROM gallery_photo_user_tags t
     JOIN gallery_photos p ON p.id = t.photo_id
     WHERE t.photo_id = ? AND t.tagged_user_id = ?`
  ).get(photoId, taggedUserId);

  if (!tagRecord) {
    return respondMediaAction(req, res, classFilter, 'Etiket bulunamadı.', 404);
  }

  if (![tagRecord.created_by_user_id, tagRecord.uploader_user_id].includes(req.currentUser.id) && req.currentUser.role !== 'admin') {
    return respondMediaAction(req, res, classFilter, 'Bu etiketi kaldırma yetkiniz yok.', 403);
  }

  db.prepare('DELETE FROM gallery_photo_user_tags WHERE photo_id = ? AND tagged_user_id = ?').run(photoId, taggedUserId);
  return respondMediaAction(req, res, classFilter, 'Fotoğraf etiketi kaldırıldı.');
});

router.post('/media/collage/:groupId/tag', requireLogin, verifyCsrf, (req, res) => {
  const groupId = stripHtml(req.params.groupId || '');
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();
  const taggedUserId = Number(req.body.tagged_user_id || 0);

  if (req.currentUser.role === 'guest') {
    return respondMediaAction(req, res, classFilter, 'Misafir profili yalnızca görüntüleme yapabilir.', 403);
  }
  if (!groupId || !Number.isInteger(taggedUserId) || taggedUserId <= 0) {
    return respondMediaAction(req, res, classFilter, 'Geçersiz kollaj etiketleme isteği.', 400);
  }

  const taggedUser = db.prepare('SELECT id FROM users WHERE id = ?').get(taggedUserId);
  const photos = db
    .prepare('SELECT id FROM gallery_photos WHERE group_id = ?')
    .all(groupId);

  if (!taggedUser || !photos.length) {
    return respondMediaAction(req, res, classFilter, 'Kollaj veya kullanıcı bulunamadı.', 404);
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO gallery_photo_user_tags (photo_id, tagged_user_id, created_by_user_id)
     VALUES (?, ?, ?)`
  );
  const tx = db.transaction(() => {
    photos.forEach((photo) => {
      insert.run(photo.id, taggedUserId, req.currentUser.id);
    });
  });
  tx();

  return respondMediaAction(req, res, classFilter, 'Kollaj etiketleri kaydedildi.');
});

router.post('/media/collage/:groupId/tags/:taggedUserId/delete', requireLogin, verifyCsrf, (req, res) => {
  const groupId = stripHtml(req.params.groupId || '').slice(0, 64);
  const taggedUserId = Number(req.params.taggedUserId);
  const classFilter = stripHtml(req.body.class_filter || 'general');

  if (!groupId || !Number.isInteger(taggedUserId) || taggedUserId <= 0) {
    return respondMediaAction(req, res, classFilter, 'Etiket kaydı bulunamadı.', 400);
  }

  const photos = db.prepare(
    `SELECT id, uploader_user_id
     FROM gallery_photos
     WHERE group_id = ?`
  ).all(groupId);

  if (!photos.length) {
    return respondMediaAction(req, res, classFilter, 'Kollaj bulunamadı.', 404);
  }

  const photoIds = photos.map((photo) => photo.id);
  const placeholders = photoIds.map(() => '?').join(', ');
  const tagRows = db.prepare(
    `SELECT created_by_user_id
     FROM gallery_photo_user_tags
     WHERE tagged_user_id = ? AND photo_id IN (${placeholders})`
  ).all(taggedUserId, ...photoIds);

  if (!tagRows.length) {
    return respondMediaAction(req, res, classFilter, 'Etiket bulunamadı.', 404);
  }

  const canManage = req.currentUser.role === 'admin' ||
    photos.some((photo) => photo.uploader_user_id === req.currentUser.id) ||
    tagRows.some((row) => row.created_by_user_id === req.currentUser.id);

  if (!canManage) {
    return respondMediaAction(req, res, classFilter, 'Bu etiketi kaldırma yetkiniz yok.', 403);
  }

  db.prepare(
    `DELETE FROM gallery_photo_user_tags
     WHERE tagged_user_id = ? AND photo_id IN (${placeholders})`
  ).run(taggedUserId, ...photoIds);

  return respondMediaAction(req, res, classFilter, 'Kollaj etiketi kaldırıldı.');
});

router.post('/media/photos/:id/view', requireLogin, verifyCsrf, (req, res) => {
  const photoId = Number(req.params.id);
  if (Number.isInteger(photoId) && photoId > 0) {
    db.prepare('UPDATE gallery_photos SET view_count = view_count + 1 WHERE id = ?').run(photoId);
  }
  return res.json({ ok: true });
});

router.post('/media/albums/:id/order', requireLogin, verifyCsrf, (req, res) => {
  const albumId = Number(req.params.id);
  const orderedIds = String(req.body.photo_order || '')
    .split(',')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  const album = db.prepare('SELECT id, school_id, created_by_user_id, title FROM gallery_albums WHERE id = ?').get(albumId);
  if (!album || !canManageAlbum(req.currentUser, album)) {
    req.flash('error', 'Bu albümü sıralama yetkiniz yok.');
    return res.redirect('/gallery');
  }

  const update = db.prepare('UPDATE gallery_photos SET sort_order = ? WHERE id = ? AND album_id = ?');
  const tx = db.transaction(() => {
    orderedIds.forEach((photoId, index) => {
      update.run(index, photoId, albumId);
    });
  });
  tx();
  req.flash('success', 'Albüm sıralaması güncellendi.');
  return res.redirect(`/gallery?class=${encodeURIComponent(stripHtml(req.body.class_filter || 'general'))}&album_id=${albumId}`);
});

router.post('/media/collage/create', requireLogin, verifyCsrf, (req, res) => {
  if (req.currentUser.role !== 'admin') {
    req.flash('error', 'Bu işlem yalnızca yönetici için açıktır.');
    return res.redirect('/gallery');
  }

  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();
  const selectedPhotoIds = parseSelectedPhotoIds(req.body.photo_ids);
  const targetGroupId = stripHtml(req.body.group_id || '');

  if ((!targetGroupId && selectedPhotoIds.length < 2) || (targetGroupId && selectedPhotoIds.length < 1)) {
    req.flash('error', targetGroupId ? 'Mevcut kollaja eklemek için en az 1 tekil fotoğraf seçmelisiniz.' : 'Kollaj işlemi için en az 2 tekil fotoğraf seçmelisiniz.');
    return res.redirect(buildBackUrl(classFilter));
  }

  const placeholders = selectedPhotoIds.map(() => '?').join(', ');
  const photos = db
    .prepare(
      `SELECT id, class_branch, section, group_id
       FROM gallery_photos
       WHERE id IN (${placeholders})
       ORDER BY created_at ASC, id ASC`
    )
    .all(...selectedPhotoIds);

  if (photos.length !== selectedPhotoIds.length) {
    req.flash('error', 'Seçilen fotoğraflardan bazıları bulunamadı.');
    return res.redirect(buildBackUrl(classFilter));
  }

  if (photos.some((photo) => photo.group_id)) {
    req.flash('error', 'Zaten kollaj içinde olan fotoğraflar tekrar seçilemez.');
    return res.redirect(buildBackUrl(classFilter));
  }

  const reference = photos[0];
  const sameScope = photos.every((photo) => photo.section === reference.section && String(photo.class_branch || '') === String(reference.class_branch || ''));
  if (!sameScope) {
    req.flash('error', 'Aynı kollaja alınacak fotoğraflar aynı galeri alanında olmalıdır.');
    return res.redirect(buildBackUrl(classFilter));
  }

  let groupId = crypto.randomBytes(12).toString('hex');
  let startIndex = 0;
  if (targetGroupId) {
    const targetCollagePhotos = db
      .prepare(
        `SELECT id, class_branch, section, group_index
         FROM gallery_photos
         WHERE group_id = ?
         ORDER BY group_index ASC`
      )
      .all(targetGroupId);

    if (!targetCollagePhotos.length) {
      req.flash('error', 'İşaretlenen kollaj bulunamadı.');
      return res.redirect(buildBackUrl(classFilter));
    }

    const reference = targetCollagePhotos[0];
    const sameScope = photos.every(
      (photo) =>
        photo.section === reference.section &&
        String(photo.class_branch || '') === String(reference.class_branch || '')
    );
    if (!sameScope) {
      req.flash('error', 'Sadece aynı galeri alanındaki fotoğraflar işaretlenen kollaja eklenebilir.');
      return res.redirect(buildBackUrl(classFilter));
    }

    groupId = targetGroupId;
    startIndex = targetCollagePhotos.length;
  }

  const update = db.prepare(
    `UPDATE gallery_photos
     SET group_id = ?, group_index = ?
     WHERE id = ?`
  );
  const tx = db.transaction(() => {
    photos.forEach((photo, index) => {
      update.run(groupId, startIndex + index, photo.id);
    });
  });
  tx();

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: targetGroupId ? 'gallery_collage_add_existing' : 'gallery_collage_create_from_selection',
    targetType: 'gallery_collage',
    targetId: null,
    details: { groupId, photoIds: selectedPhotoIds }
  });
  req.flash('success', targetGroupId ? `${selectedPhotoIds.length} fotoğraf işaretlenen kollaja eklendi.` : `${selectedPhotoIds.length} fotoğraf yeni kollaj olarak gruplandı.`);
  return res.redirect(buildBackUrl(reference.class_branch || 'general'));
});

router.post('/media/albums/assign', requireLogin, verifyCsrf, (req, res) => {
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();
  const selectedPhotoIds = parseSelectedPhotoIds(req.body.photo_ids);
  const selectedGroupIds = [...new Set((Array.isArray(req.body.group_ids) ? req.body.group_ids : [req.body.group_ids])
    .map((value) => stripHtml(value || ''))
    .filter(Boolean))];
  const albumId = Number(req.body.album_id || 0);
  const newAlbumTitle = stripHtml(req.body.new_album_title || '').slice(0, 120);
  const newAlbumDescription = stripHtml(req.body.new_album_description || '').slice(0, 300);

  if (!selectedPhotoIds.length && !selectedGroupIds.length) {
    req.flash('error', 'Albüme eklemek için en az 1 fotoğraf seçmelisiniz.');
    return res.redirect(buildBackUrl(classFilter));
  }

  let photos = [];
  if (selectedPhotoIds.length) {
    const placeholders = selectedPhotoIds.map(() => '?').join(', ');
    photos = photos.concat(
      db.prepare(
        `SELECT p.id, p.uploader_user_id, p.class_branch, p.album_id, p.group_id
         FROM gallery_photos p
         JOIN users u ON u.id = p.uploader_user_id
         WHERE u.school_id = ? AND p.id IN (${placeholders})`
      ).all(schoolId, ...selectedPhotoIds)
    );
  }

  if (selectedGroupIds.length) {
    const groupPlaceholders = selectedGroupIds.map(() => '?').join(', ');
    photos = photos.concat(
      db.prepare(
        `SELECT p.id, p.uploader_user_id, p.class_branch, p.album_id, p.group_id
         FROM gallery_photos p
         JOIN users u ON u.id = p.uploader_user_id
         WHERE u.school_id = ? AND p.group_id IN (${groupPlaceholders})`
      ).all(schoolId, ...selectedGroupIds)
    );
  }

  const uniquePhotos = new Map();
  photos.forEach((photo) => {
    uniquePhotos.set(photo.id, photo);
  });
  photos = [...uniquePhotos.values()];

  if (!photos.length || (selectedPhotoIds.length && photos.filter((photo) => !photo.group_id).length < selectedPhotoIds.length)) {
    req.flash('error', 'Seçilen fotoğraflardan bazıları bulunamadı.');
    return res.redirect(buildBackUrl(classFilter));
  }

  if (selectedGroupIds.length) {
    const foundGroupIds = new Set(photos.map((photo) => photo.group_id).filter(Boolean));
    if (foundGroupIds.size < selectedGroupIds.length) {
      req.flash('error', 'Seçilen kollajlardan bazıları bulunamadı.');
      return res.redirect(buildBackUrl(classFilter));
    }
  }

  const unauthorized = photos.some((photo) => req.currentUser.role !== 'admin' && photo.uploader_user_id !== req.currentUser.id);
  if (unauthorized) {
    req.flash('error', 'Sadece kendi yüklediğiniz fotoğraf veya kollajları albüme ekleyebilirsiniz.');
    return res.redirect(buildBackUrl(classFilter));
  }

  const branchKey = String(photos[0].class_branch || '');
  const sameBranch = photos.every((photo) => String(photo.class_branch || '') === branchKey);
  if (!sameBranch) {
    req.flash('error', 'Aynı işlemde sadece aynı galeri alanındaki fotoğraflar seçilebilir.');
    return res.redirect(buildBackUrl(classFilter));
  }

  let targetAlbumId = null;
  if (newAlbumTitle) {
    const created = db.prepare(
      `INSERT INTO gallery_albums (title, description, class_branch, school_id, album_type, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(newAlbumTitle, newAlbumDescription, photos[0].class_branch || null, schoolId, photos[0].class_branch ? 'class' : 'school', req.currentUser.id);
    targetAlbumId = Number(created.lastInsertRowid);
  } else if (albumId > 0) {
    const album = db.prepare('SELECT id, class_branch, school_id, created_by_user_id, title FROM gallery_albums WHERE id = ?').get(albumId);
    if (!album) {
      req.flash('error', 'Albüm bulunamadı.');
      return res.redirect(buildBackUrl(classFilter));
    }
    if (Number(album.school_id || 0) !== Number(schoolId)) {
      req.flash('error', 'Seçilen albüm bu okula ait değil.');
      return res.redirect(buildBackUrl(classFilter));
    }
    if (String(album.class_branch || '') !== branchKey) {
      req.flash('error', 'Seçilen albüm ile fotoğrafların alanı uyuşmuyor.');
      return res.redirect(buildBackUrl(classFilter));
    }
    if (!canManageAlbum(req.currentUser, album)) {
      req.flash('error', 'Bu albümü kullanma yetkiniz yok.');
      return res.redirect(buildBackUrl(classFilter));
    }
    targetAlbumId = album.id;
  } else {
    req.flash('error', 'Bir albüm seçin veya yeni albüm adı girin.');
    return res.redirect(buildBackUrl(classFilter));
  }

  const update = db.prepare(
    `UPDATE gallery_photos
     SET album_id = ?
     WHERE id = ?`
  );
  const tx = db.transaction(() => {
    photos.forEach((photo) => {
      update.run(targetAlbumId, photo.id);
    });
  });
  tx();

  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'gallery_album_assign_existing',
    targetType: 'gallery_album',
    targetId: targetAlbumId,
    details: { photoIds: photos.map((photo) => photo.id), groupIds: selectedGroupIds }
  });
  req.flash('success', `${photos.length} fotoğraf albüme eklendi.`);
  return res.redirect(`/gallery?class=${encodeURIComponent(photos[0].class_branch || 'general')}&album_id=${targetAlbumId}`);
});

router.post('/media/albums/:id/update', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'gallery', '/')) {
    return;
  }
  const albumId = Number(req.params.id);
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();
  const title = stripHtml(req.body.title || '').slice(0, 120);
  const description = stripHtml(req.body.description || '').slice(0, 300);
  const album = db.prepare('SELECT id, title, school_id, class_branch, created_by_user_id FROM gallery_albums WHERE id = ?').get(albumId);
  if (!album || !canManageAlbum(req.currentUser, album)) {
    req.flash('error', 'Bu albümü düzenleme yetkiniz yok.');
    return res.redirect(buildBackUrl(classFilter));
  }
  if (!title) {
    req.flash('error', 'Albüm adı boş olamaz.');
    return res.redirect(`/gallery?class=${encodeURIComponent(classFilter)}&album_id=${albumId}`);
  }
  db.prepare('UPDATE gallery_albums SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(title, description, albumId);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'gallery_album_update',
    targetType: 'gallery_album',
    targetId: albumId,
    details: { oldTitle: album.title, title }
  });
  req.flash('success', 'Albüm bilgileri güncellendi.');
  return res.redirect(`/gallery?class=${encodeURIComponent(classFilter)}&album_id=${albumId}`);
});

router.post('/media/albums/:id/delete', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'gallery', '/')) {
    return;
  }
  const albumId = Number(req.params.id);
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();
  const album = db.prepare('SELECT id, title, school_id, class_branch, created_by_user_id FROM gallery_albums WHERE id = ?').get(albumId);
  if (!album || !canManageAlbum(req.currentUser, album)) {
    req.flash('error', 'Bu albümü silme yetkiniz yok.');
    return res.redirect(buildBackUrl(classFilter));
  }
  const count = db.prepare('SELECT COUNT(*) AS total FROM gallery_photos WHERE album_id = ?').get(albumId).total;
  db.prepare('UPDATE gallery_photos SET album_id = NULL WHERE album_id = ?').run(albumId);
  db.prepare('DELETE FROM gallery_albums WHERE id = ?').run(albumId);
  writeAuditLog({
    actorUserId: req.currentUser.id,
    action: 'gallery_album_delete',
    targetType: 'gallery_album',
    targetId: albumId,
    details: { title: album.title, detachedPhotos: Number(count || 0) }
  });
  req.flash('success', `Albüm silindi. ${Number(count || 0)} fotoğraf galeride kaldı, albüm bağlantısı kaldırıldı.`);
  return res.redirect(buildBackUrl(classFilter));
});

router.post('/media/albums/:id/cover', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'gallery', '/')) {
    return;
  }
  const albumId = Number(req.params.id);
  const photoId = Number(req.body.photo_id || 0);
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();

  const album = db.prepare('SELECT id, school_id, created_by_user_id FROM gallery_albums WHERE id = ?').get(albumId);
  if (!album || !canManageAlbum(req.currentUser, album)) {
    req.flash('error', 'Bu albüm kapağını değiştirme yetkiniz yok.');
    return res.redirect(buildBackUrl(classFilter));
  }

  if (photoId > 0) {
    const photo = db.prepare('SELECT id FROM gallery_photos WHERE id = ? AND album_id = ?').get(photoId, albumId);
    if (!photo) {
      req.flash('error', 'Albüm kapağı olarak seçilecek fotoğraf bulunamadı.');
      return res.redirect(buildBackUrl(classFilter));
    }
    db.prepare('UPDATE gallery_albums SET cover_photo_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(photoId, albumId);
    req.flash('success', 'Albüm kapağı güncellendi.');
  } else {
    db.prepare('UPDATE gallery_albums SET cover_photo_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(albumId);
    req.flash('success', 'Albüm kapağı kaldırıldı.');
  }

  return res.redirect(`/gallery?class=${encodeURIComponent(classFilter)}&album_id=${albumId}`);
});

router.post('/media/photos/:id/react', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'photo_reactions', '/gallery')) {
    return;
  }
  const photoId = Number(req.params.id);
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();
  const emoji = stripHtml(req.body.emoji || '').slice(0, 8);

  if (req.currentUser.role === 'guest') {
    return respondMediaAction(req, res, classFilter, 'Misafir profili yalnızca görüntüleme yapabilir.', 403);
  }
  if (!Number.isInteger(photoId) || photoId <= 0 || !ALLOWED_REACTIONS.includes(emoji)) {
    return respondMediaAction(req, res, classFilter, 'Geçersiz emoji tepkisi.', 400);
  }

  const photo = db.prepare('SELECT id, uploader_user_id FROM gallery_photos WHERE id = ?').get(photoId);
  if (!photo) {
    return respondMediaAction(req, res, classFilter, 'Fotoğraf bulunamadı.', 404);
  }

  const existing = db
    .prepare('SELECT id, emoji FROM gallery_photo_reactions WHERE photo_id = ? AND reactor_user_id = ?')
    .get(photoId, req.currentUser.id);

  if (existing && existing.emoji === emoji) {
    db.prepare('DELETE FROM gallery_photo_reactions WHERE id = ?').run(existing.id);
    return respondMediaAction(req, res, classFilter, 'Emoji tepkisi kaldırıldı.');
  }

  db.prepare(
    `INSERT INTO gallery_photo_reactions (photo_id, reactor_user_id, emoji)
     VALUES (?, ?, ?)
     ON CONFLICT(photo_id, reactor_user_id)
     DO UPDATE SET emoji = excluded.emoji`
  ).run(photoId, req.currentUser.id, emoji);
  createInboxNotification({
    userId: photo.uploader_user_id,
    actorUserId: req.currentUser.id,
    kind: 'gallery_photo_reaction',
    title: 'Fotografina tepki geldi',
    body: `${req.currentUser.name} fotografinda ${emoji} tepkisi birakti.`,
    linkPath: buildBackUrl(classFilter)
  });

  return respondMediaAction(req, res, classFilter, 'Emoji tepkisi kaydedildi.');
});

router.post('/media/collage/:groupId/react', requireLogin, verifyCsrf, (req, res) => {
  if (!requireFeature(req, res, 'photo_reactions', '/gallery')) {
    return;
  }
  const groupId = stripHtml(req.params.groupId || '');
  const classFilter = stripHtml(req.body.class_filter || 'general').toUpperCase();
  const emoji = stripHtml(req.body.emoji || '').slice(0, 8);

  if (req.currentUser.role === 'guest') {
    return respondMediaAction(req, res, classFilter, 'Misafir profili yalnızca görüntüleme yapabilir.', 403);
  }
  if (!groupId || !ALLOWED_REACTIONS.includes(emoji)) {
    return respondMediaAction(req, res, classFilter, 'Geçersiz emoji tepkisi.', 400);
  }

  const collagePhotos = db
    .prepare('SELECT DISTINCT uploader_user_id FROM gallery_photos WHERE group_id = ?')
    .all(groupId);
  if (!collagePhotos.length) {
    return respondMediaAction(req, res, classFilter, 'Kollaj bulunamadı.', 404);
  }

  const existing = db
    .prepare('SELECT id, emoji FROM gallery_collage_reactions WHERE group_id = ? AND reactor_user_id = ?')
    .get(groupId, req.currentUser.id);

  if (existing && existing.emoji === emoji) {
    db.prepare('DELETE FROM gallery_collage_reactions WHERE id = ?').run(existing.id);
    return respondMediaAction(req, res, classFilter, 'Emoji tepkisi kaldırıldı.');
  }

  db.prepare(
    `INSERT INTO gallery_collage_reactions (group_id, reactor_user_id, emoji)
     VALUES (?, ?, ?)
     ON CONFLICT(group_id, reactor_user_id)
     DO UPDATE SET emoji = excluded.emoji`
  ).run(groupId, req.currentUser.id, emoji);

  collagePhotos.forEach((row) => {
    createInboxNotification({
      userId: row.uploader_user_id,
      actorUserId: req.currentUser.id,
      kind: 'gallery_collage_reaction',
      title: 'Kollajina tepki geldi',
      body: `${req.currentUser.name} kollajinda ${emoji} tepkisi birakti.`,
      linkPath: buildBackUrl(classFilter)
    });
  });

  return respondMediaAction(req, res, classFilter, 'Emoji tepkisi kaydedildi.');
});

router.use((error, req, res, next) => {
  if (error && error.message) {
    if (isAjaxRequest(req)) {
      return res.status(400).json({ ok: false, message: error.message, redirectTo: '/gallery' });
    }
    req.flash('error', error.message);
    if (req.originalUrl.includes('/uploads/')) {
      return res.status(400).end();
    }
    return res.redirect('/gallery');
  }
  return next(error);
});

module.exports = router;
