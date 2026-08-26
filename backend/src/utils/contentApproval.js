const { stripHtml } = require('./sanitize');

const CONTENT_APPROVAL_SETTING_KEY = 'content_approval_enabled';
const REVIEWER_TEACHER_CATEGORIES = new Set(['principal', 'vice_principal', 'head_vice_principal']);

function isContentApprovalEnabled(db) {
  const row = db
    .prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?')
    .get(CONTENT_APPROVAL_SETTING_KEY);
  return row ? row.setting_value === '1' : false;
}

function setContentApprovalEnabled(db, enabled) {
  db.prepare(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value = excluded.setting_value,
       updated_at = CURRENT_TIMESTAMP`
  ).run(CONTENT_APPROVAL_SETTING_KEY, enabled ? '1' : '0');
}

function canReviewContent(user) {
  return Boolean(
    user &&
      (user.role === 'admin' ||
        (user.role === 'teacher' && REVIEWER_TEACHER_CATEGORIES.has(user.teacher_category || '')))
  );
}

function createApprovalRequest(db, request) {
  const result = db.prepare(
    `INSERT INTO content_approval_requests (
       item_type, actor_user_id, target_user_id, existing_item_id, payload_json
     ) VALUES (?, ?, ?, ?, ?)`
  ).run(
    request.itemType,
    request.actorUserId,
    request.targetUserId || null,
    request.existingItemId || null,
    JSON.stringify(request.payload || {})
  );
  return Number(result.lastInsertRowid);
}

function parsePayload(payloadJson) {
  try {
    return JSON.parse(payloadJson || '{}');
  } catch (error) {
    return {};
  }
}

function applyApprovalRequest(db, request) {
  const payload = parsePayload(request.payload_json);

  if (request.item_type === 'profile_message') {
    return db
      .prepare('INSERT INTO messages (from_user_id, to_user_id, message) VALUES (?, ?, ?)')
      .run(request.actor_user_id, request.target_user_id, stripHtml(payload.message || ''));
  }

  if (request.item_type === 'profile_message_edit') {
    return db
      .prepare('UPDATE messages SET message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND from_user_id = ?')
      .run(stripHtml(payload.message || ''), request.existing_item_id, request.actor_user_id);
  }

  if (request.item_type === 'profile_details') {
    return db
      .prepare(
        `UPDATE users
         SET slogan = ?, bio = ?, free_text = ?, favorite_memory = ?, favorite_quote = ?, birth_date = ?, profile_theme_color = ?,
             contact_phone = ?, contact_email = ?, contact_instagram = ?, contact_x = ?, contact_facebook = ?,
             contact_linkedin = ?, contact_nsocial = ?, custom_contacts_json = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(
        stripHtml(payload.slogan || ''),
        stripHtml(payload.bio || ''),
        stripHtml(payload.freeText || ''),
        stripHtml(payload.favoriteMemory || ''),
        stripHtml(payload.favoriteQuote || ''),
        payload.birthDate || null,
        stripHtml(payload.profileThemeColor || ''),
        stripHtml(payload.contactPhone || ''),
        stripHtml(payload.contactEmail || ''),
        stripHtml(payload.contactInstagram || ''),
        stripHtml(payload.contactX || ''),
        stripHtml(payload.contactFacebook || ''),
        stripHtml(payload.contactLinkedin || ''),
        stripHtml(payload.contactNsocial || ''),
        stripHtml(payload.customContactsJson || '[]'),
        request.actor_user_id
      );
  }

  if (request.item_type === 'profile_three_words') {
    return db
      .prepare(
        `INSERT INTO profile_three_words (profile_user_id, author_user_id, words)
         VALUES (?, ?, ?)
         ON CONFLICT(profile_user_id, author_user_id)
         DO UPDATE SET words = excluded.words, updated_at = CURRENT_TIMESTAMP`
      )
      .run(request.target_user_id, request.actor_user_id, stripHtml(payload.words || ''));
  }

  if (request.item_type === 'profile_guestbook') {
    return db
      .prepare('INSERT INTO profile_guestbook_entries (profile_user_id, author_user_id, body) VALUES (?, ?, ?)')
      .run(request.target_user_id, request.actor_user_id, stripHtml(payload.body || ''));
  }

  if (request.item_type === 'teacher_farewell') {
    return db
      .prepare('INSERT INTO teacher_farewell_messages (teacher_user_id, author_user_id, body) VALUES (?, ?, ?)')
      .run(request.actor_user_id, request.actor_user_id, stripHtml(payload.body || ''));
  }

  if (request.item_type === 'gallery_photo_comment') {
    return db
      .prepare('INSERT INTO gallery_photo_comments (photo_id, author_user_id, body) VALUES (?, ?, ?)')
      .run(request.existing_item_id, request.actor_user_id, stripHtml(payload.body || ''));
  }

  if (request.item_type === 'gallery_collage_comment') {
    return db
      .prepare('INSERT INTO gallery_collage_comments (group_id, author_user_id, body) VALUES (?, ?, ?)')
      .run(stripHtml(payload.groupId || ''), request.actor_user_id, stripHtml(payload.body || ''));
  }

  if (request.item_type === 'gallery_upload') {
    const files = Array.isArray(payload.files) ? payload.files : [];
    const insert = db.prepare(
      `INSERT INTO gallery_photos (
         uploader_user_id, section, class_branch, album_id, photo_path, group_id, group_index, sort_order, caption, date_stamp_text
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const tx = db.transaction(() => {
      files.forEach((file, index) => {
        insert.run(
          request.actor_user_id,
          'gallery',
          payload.classBranch || null,
          payload.albumId || null,
          stripHtml(file.photoPath || ''),
          payload.collageGroupId || null,
          payload.collageGroupId ? index : 0,
          index,
          stripHtml(payload.caption || ''),
          stripHtml(payload.dateStampText || '')
        );
      });
    });
    return tx();
  }

  if (request.item_type === 'anonymous_board_post') {
    return db
      .prepare('INSERT INTO anonymous_board_posts (author_user_id, approval_request_id, body) VALUES (?, ?, ?)')
      .run(request.actor_user_id, request.id, stripHtml(payload.body || ''));
  }

  throw new Error('Bilinmeyen onay kaydi turu.');
}

function getContentApprovalLabel(itemType) {
  const labels = {
    profile_message: 'Profil mesajı',
    profile_message_edit: 'Mesaj düzenleme',
    profile_details: 'Profil yazıları',
    profile_three_words: '3 kelime yorumu',
    profile_guestbook: 'Ziyaretçi defteri',
    teacher_farewell: 'Öğretmen veda mesajı',
    gallery_photo_comment: 'Fotoğraf yorumu',
    gallery_collage_comment: 'Kollaj yorumu',
    gallery_upload: 'Galeri fotoğraf yükleme',
    anonymous_board_post: 'Mantar pano notu'
  };
  return labels[itemType] || itemType;
}

module.exports = {
  CONTENT_APPROVAL_SETTING_KEY,
  REVIEWER_TEACHER_CATEGORIES,
  isContentApprovalEnabled,
  setContentApprovalEnabled,
  canReviewContent,
  createApprovalRequest,
  parsePayload,
  applyApprovalRequest,
  getContentApprovalLabel
};
