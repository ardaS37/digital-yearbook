const express = require('express');
const rateLimit = require('express-rate-limit');

function randomAccentHex() {
  const h = Math.floor(Math.random() * 360);
  const s = 0.62, l = 0.44;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}
const { db } = require('../db');
const { verifyCsrf } = require('../middleware/csrf');
const { verifyAccessCode, hashAccessCode } = require('../utils/accessCode');
const { stripHtml, normalizeTurkishSearchText } = require('../utils/sanitize');
const { ensureLoginIdentifier } = require('../utils/loginIdentifier');
const { writeAuditLog } = require('../utils/auditLog');
const { collectRequestContext } = require('../utils/requestContext');
const { getMaintenanceState } = require('../utils/maintenance');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

function hasApprovedKvkk(user) {
  return Boolean(user && user.kvkk_approved_at);
}

function recordLoginAttempt(req, { role, identifier, status, reason, resolvedUserId = null, attemptedIdentifiers = [] }) {
  const context = collectRequestContext(req);
  db.prepare(
    `INSERT INTO login_attempts (
       role, identifier, resolved_user_id, ip_address, ip_chain, user_agent,
       browser_name, browser_version, os_name, os_version, device_type, device_vendor, device_model,
       accept_language, request_headers_json, attempted_identifiers_json, status, reason
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    role || null,
    identifier || '',
    resolvedUserId,
    context.ipAddress,
    context.ipChain,
    context.userAgent,
    context.browserName,
    context.browserVersion,
    context.osName,
    context.osVersion,
    context.deviceType,
    context.deviceVendor,
    context.deviceModel,
    context.acceptLanguage,
    JSON.stringify(context.requestHeaders),
    JSON.stringify(attemptedIdentifiers),
    status,
    reason
  );
}

function getRecentFailedAttempts(req) {
  const context = collectRequestContext(req);
  const rows = db
    .prepare(
      `SELECT id, identifier, role
       FROM login_attempts
       WHERE status IN ('failed', 'blocked')
         AND ip_address = ?
         AND user_agent = ?
         AND created_at >= datetime('now', '-30 minutes')
       ORDER BY created_at DESC
       LIMIT 10`
    )
    .all(context.ipAddress, context.userAgent);

  return rows;
}

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    recordLoginAttempt(req, {
      role: stripHtml(req.body.role),
      identifier: stripHtml(req.body.identifier),
      status: 'blocked',
      reason: 'rate_limit'
    });
    req.flash('error', 'Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.');
    return res.redirect('/login');
  }
});

function normalizeLoginText(value) {
  return normalizeTurkishSearchText(value);
}

function repairLegacyPlaintextHash(userId, accessCode) {
  db.prepare(
    `UPDATE users
     SET access_code_hash = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(hashAccessCode(accessCode), userId);
}

function verifyAndRepairAccessCode(user, accessCode) {
  if (verifyAccessCode(accessCode, user.access_code_hash)) {
    return true;
  }

  const legacyHashField = String(user.access_code_hash || '').trim();
  if (legacyHashField && !legacyHashField.includes(':') && legacyHashField === accessCode) {
    repairLegacyPlaintextHash(user.id, accessCode);
    return true;
  }

  return false;
}

function hasPendingInitialAccessCode(user) {
  return Boolean(user && user.initial_access_code && !user.initial_access_code_revealed_at);
}

function findFirstLoginUserByNameOrIdentifier({ role, identifier, schoolId }) {
  const normalizedIdentifier = normalizeLoginText(identifier);
  const candidates = db
    .prepare(
      `SELECT *
       FROM users
       WHERE role = ?
         AND school_id = ?
         AND initial_access_code IS NOT NULL
         AND initial_access_code_revealed_at IS NULL`
    )
    .all(role, schoolId)
    .filter((candidate) => {
      const loginIdentifier = normalizeLoginText(candidate.login_identifier || '');
      const name = normalizeLoginText(candidate.name || '');
      return loginIdentifier === normalizedIdentifier || name === normalizedIdentifier;
    });

  return candidates.length === 1 ? candidates[0] : null;
}

function findReferencedUserByIdentifier(identifier) {
  const normalizedIdentifier = normalizeLoginText(identifier);

  const direct = db
    .prepare(
      `SELECT id, name, role
       FROM users
       WHERE login_identifier = ?
          OR student_number = ?
       LIMIT 1`
    )
    .get(normalizedIdentifier, identifier);

  if (direct) {
    return direct;
  }

  const nameMatches = db
    .prepare(
      `SELECT id, name, role
       FROM users
       WHERE role = 'student'`
    )
    .all()
    .filter((candidate) => normalizeLoginText(candidate.name) === normalizedIdentifier);

  return nameMatches.length === 1 ? nameMatches[0] : null;
}

router.get('/login', (req, res) => {
  if (req.currentUser) {
    return res.redirect('/');
  }
  const schools = db
    .prepare('SELECT id, name FROM schools WHERE is_active = 1 ORDER BY name COLLATE NOCASE ASC')
    .all();
  const defaultLoginSchool = schools.find((s) =>
    s.name.trim().toUpperCase().replace(/İ/g, 'I').replace(/ı/g, 'I').replace(/Ş/g, 'S') === 'ISDFL'
  );
  return res.render('login', { title: 'Giriş', schools, defaultSchoolId: defaultLoginSchool ? defaultLoginSchool.id : null });
});

router.get('/signup', (req, res) => {
  if (req.currentUser) {
    return res.redirect('/');
  }
  const schools = db
    .prepare('SELECT id, name FROM schools WHERE is_active = 1 ORDER BY name COLLATE NOCASE ASC')
    .all();
  const classes = db
    .prepare("SELECT branch FROM classes WHERE is_active = 1 AND is_archived = 0 AND deleted_at IS NULL ORDER BY branch")
    .all()
    .map((row) => row.branch);
  const defaultSchool = schools.find((s) =>
    s.name.trim().toUpperCase().replace(/İ/g, 'I').replace(/Ş/g, 'S') === 'ISDFL'
  );
  return res.render('signup', {
    title: 'Hesap Oluştur',
    schools,
    classes,
    defaultSchoolId: defaultSchool ? defaultSchool.id : null
  });
});

router.post('/signup', verifyCsrf, (req, res) => {
  const schoolId = Number(req.body.school_id || 0);
  const role = stripHtml(req.body.role || '');
  const name = stripHtml(req.body.name || '').slice(0, 120);
  const studentNumber = stripHtml(req.body.student_number || '').slice(0, 50);
  const classBranch = stripHtml(req.body.class_branch || '').toUpperCase().slice(0, 20);
  const note = stripHtml(req.body.note || '').slice(0, 500);

  const school = db.prepare('SELECT id FROM schools WHERE id = ? AND is_active = 1').get(schoolId);
  if (!school) {
    req.flash('error', 'Lütfen okul seçin.');
    return res.redirect('/signup');
  }
  if (!['student', 'teacher', 'other'].includes(role) || !name) {
    req.flash('error', 'Ad soyad ve hesap türü zorunludur.');
    return res.redirect('/signup');
  }
  if (role === 'student' && (!studentNumber || !classBranch)) {
    req.flash('error', 'Öğrenci hesabı için öğrenci numarası ve sınıf zorunludur.');
    return res.redirect('/signup');
  }

  db.prepare(
    `INSERT INTO signup_requests (school_id, name, role, student_number, class_branch, note)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(schoolId, name, role, role === 'student' ? studentNumber : null, role === 'student' ? classBranch : null, note);
  writeAuditLog({
    actorUserId: null,
    action: 'signup_request_create',
    targetType: 'signup_request',
    targetId: null,
    details: { schoolId, role, studentNumber: role === 'student' ? studentNumber : null }
  });
  req.flash('success', 'Hesap oluşturma isteğiniz yönetime gönderildi. Onaylanınca erişim bilgileri okul yönetimi tarafından paylaşılacak.');
  return res.redirect('/login');
});

router.get('/logged-out', (req, res) => {
  const reason = stripHtml(req.query.reason || '');
  const isExpired = reason === 'expired';
  const isInactive = reason === 'inactive';
  return res.render('logged-out', {
    title: 'Oturum Kapandı',
    isExpired,
    isInactive
  });
});

router.get('/kvkk-onay', requireLogin, (req, res) => {
  if (hasApprovedKvkk(req.currentUser)) {
    return res.redirect('/');
  }

  return res.render('kvkk-consent', { title: 'KVKK Aydınlatma ve Açık Rıza' });
});

router.get('/kvkk-aydinlatma-metni', (req, res) => {
  return res.render('kvkk-illumination', { title: 'KVKK Aydınlatma Metni' });
});

router.get('/gizlilik-sozlesmesi', (req, res) => {
  return res.render('kvkk-privacy-policy', { title: 'Gizlilik Sözleşmesi' });
});

router.get('/acik-riza-metni', (req, res) => {
  return res.render('kvkk-explicit-consent', { title: 'Açık Rıza Metni' });
});

router.post('/kvkk-onay', requireLogin, verifyCsrf, (req, res) => {
  const kvkkConsent = stripHtml(req.body.kvkk_consent || '');
  const privacyConsent = stripHtml(req.body.privacy_consent || '');
  const explicitConsent = stripHtml(req.body.explicit_consent || '');
  const cookieConsent = stripHtml(req.body.cookie_consent || '');

  if (
    kvkkConsent !== 'onayliyorum' ||
    privacyConsent !== 'okudum_kabul_ediyorum' ||
    explicitConsent !== 'acik_riza_veriyorum' ||
    cookieConsent !== 'cerezleri_kabul_ediyorum'
  ) {
    req.flash('error', 'Devam etmek için tüm onay kutularını işaretlemeniz gerekir.');
    return res.redirect('/kvkk-onay');
  }

  db.prepare('UPDATE users SET kvkk_approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.currentUser.id);
  return res.redirect('/tercihler');
});


router.post('/login', loginLimiter, verifyCsrf, (req, res) => {
  const role = stripHtml(req.body.role);
  const identifier = stripHtml(req.body.identifier);
  const accessCode = stripHtml(req.body.access_code);
  const schoolId = Number(req.body.school_id || 0);
  const maintenanceState = getMaintenanceState();

  if (!role || !identifier || (role === 'admin' && !accessCode) || (role !== 'admin' && schoolId <= 0)) {
    req.flash('error', 'Okul, rol, kimlik bilgisi ve erişim kodu zorunludur.');
    return res.redirect('/login');
  }

  if (maintenanceState && role !== 'admin') {
    recordLoginAttempt(req, {
      role,
      identifier,
      status: 'blocked',
      reason: 'maintenance_mode'
    });
    req.flash('error', maintenanceState.message || 'Sistem bakım modunda. Lütfen daha sonra tekrar deneyin.');
    return res.redirect('/login');
  }

  let user = null;
  if (role === 'student') {
    const normalizedIdentifier = normalizeLoginText(identifier);
    const candidates = db.prepare("SELECT * FROM users WHERE role = 'student' AND school_id = ?").all(schoolId);
    const matched = candidates.filter((candidate) => {
      const isStudentNumber = candidate.student_number && String(candidate.student_number).trim() === identifier;
      const isExactName = normalizeLoginText(candidate.name) === normalizedIdentifier;
      return isStudentNumber || isExactName;
    });

    const verifiedMatches = accessCode
      ? matched.filter((candidate) => verifyAndRepairAccessCode(candidate, accessCode))
      : matched.filter((candidate) => hasPendingInitialAccessCode(candidate));
    if (verifiedMatches.length === 1) {
      user = verifiedMatches[0];
    } else if (verifiedMatches.length > 1) {
      recordLoginAttempt(req, {
        role,
        identifier,
        status: 'failed',
        reason: 'duplicate_student_name'
      });
      req.flash('error', 'Aynı isimde birden fazla öğrenci bulundu. Öğrenci numarası ile giriş yapın.');
      return res.redirect('/login');
    }
  } else if (role === 'teacher' || role === 'admin' || role === 'guest' || role === 'other') {
    const normalizedIdentifier = normalizeLoginText(identifier);
    user = role === 'admin'
      ? db.prepare('SELECT * FROM users WHERE role = ? AND login_identifier = ?').get(role, normalizedIdentifier)
      : db.prepare('SELECT * FROM users WHERE role = ? AND login_identifier = ? AND school_id = ?').get(role, normalizedIdentifier, schoolId);

    if (!accessCode && role !== 'admin' && !user) {
      user = findFirstLoginUserByNameOrIdentifier({ role, identifier, schoolId });
    }
    if (user && (accessCode ? !verifyAndRepairAccessCode(user, accessCode) : !hasPendingInitialAccessCode(user))) {
      user = null;
    }
  } else {
    recordLoginAttempt(req, {
      role,
      identifier,
      status: 'failed',
      reason: 'invalid_role'
    });
    req.flash('error', 'Geçersiz rol.');
    return res.redirect('/login');
  }

  if (!user) {
    const referencedUser = findReferencedUserByIdentifier(identifier);
    recordLoginAttempt(req, {
      role,
      identifier,
      resolvedUserId: referencedUser ? referencedUser.id : null,
      status: 'failed',
      reason: 'invalid_credentials'
    });
    req.flash('error', 'Kimlik bilgileri hatalı.');
    return res.redirect('/login');
  }

  if (user.status === 'inactive') {
    recordLoginAttempt(req, {
      role: user.role,
      identifier: ensureLoginIdentifier(user),
      resolvedUserId: user.id,
      status: 'blocked',
      reason: 'inactive_account'
    });
    req.flash('error', 'Hesap pasif. Lütfen yönetici ile iletişime geçin.');
    return res.redirect('/login');
  }

  return req.session.regenerate((error) => {
    if (error) {
      console.error(error);
      req.flash('error', 'Oturum başlatılamadı.');
      return res.redirect('/login');
    }
    req.session.userId = user.id;
    req.session.createdAt = Date.now();
    req.session.lastSeenAt = Date.now();
    req.session.freshBgm = true;
    ensureLoginIdentifier(user);
    const recentFailedAttempts = getRecentFailedAttempts(req);
    const attemptedIdentifiers = recentFailedAttempts.map((entry) => ({
      role: entry.role,
      identifier: entry.identifier
    }));
    recordLoginAttempt(req, {
      role: user.role,
      identifier: ensureLoginIdentifier(user),
      resolvedUserId: user.id,
      attemptedIdentifiers,
      status: attemptedIdentifiers.length ? 'success_suspicious' : 'success',
      reason: attemptedIdentifiers.length ? 'previous_failed_attempts' : 'login_ok'
    });
    const loginContext = collectRequestContext(req);
    writeAuditLog({
      actorUserId: user.id,
      action: 'login',
      targetType: 'session',
      targetId: null,
      details: {
        role: user.role,
        suspicious: attemptedIdentifiers.length > 0,
        ip: loginContext.ipAddress,
        browser: loginContext.browserName + (loginContext.browserVersion ? ' ' + loginContext.browserVersion : ''),
        os: loginContext.osName + (loginContext.osVersion ? ' ' + loginContext.osVersion : ''),
        device: loginContext.deviceType
      }
    });
    req.session.loginAccentColor = randomAccentHex();
    req.flash('success', `Hoş geldiniz, ${user.name}.`);
    if (hasPendingInitialAccessCode(user)) {
      return res.redirect('/first-access-code');
    }
    if (!hasApprovedKvkk(user)) {
      return res.redirect('/kvkk-onay');
    }
    return res.redirect(user.role === 'admin' ? '/admin' : '/');
  });
});

router.get('/tercihler', requireLogin, (req, res) => {
  return res.render('preferences', { title: 'Görünüm Tercihleri' });
});

router.get('/first-access-code', requireLogin, (req, res) => {
  const user = db
    .prepare('SELECT id, name, role, login_identifier, student_number, initial_access_code, initial_access_code_revealed_at FROM users WHERE id = ?')
    .get(req.currentUser.id);
  if (!hasPendingInitialAccessCode(user)) {
    return res.redirect(hasApprovedKvkk(req.currentUser) ? '/' : '/kvkk-onay');
  }
  return res.render('first-access-code', {
    title: 'Erişim Kodun',
    user,
    loginIdentifier: ensureLoginIdentifier(user)
  });
});

router.post('/first-access-code', requireLogin, verifyCsrf, (req, res) => {
  const user = db
    .prepare('SELECT id, initial_access_code, initial_access_code_revealed_at FROM users WHERE id = ?')
    .get(req.currentUser.id);
  if (hasPendingInitialAccessCode(user)) {
    db.prepare(
      `UPDATE users
       SET initial_access_code = NULL,
           initial_access_code_revealed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(req.currentUser.id);
  }
  return res.redirect(hasApprovedKvkk(req.currentUser) ? '/' : '/kvkk-onay');
});

router.get('/hesabim/girisler', requireLogin, (req, res) => {
  const attempts = db
    .prepare(
      `SELECT ip_address, browser_name, browser_version, os_name, os_version,
              device_type, device_model, status, reason, created_at
       FROM login_attempts
       WHERE resolved_user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all(req.currentUser.id);
  return res.render('my-login-history', { title: 'Ayarlar', attempts });
});

router.post('/logout', verifyCsrf, (req, res) => {
  const userId = req.session && req.session.userId ? req.session.userId : null;
  const logoutContext = collectRequestContext(req);
  req.session.destroy(() => {
    if (userId) {
      try {
        writeAuditLog({
          actorUserId: userId,
          action: 'logout',
          targetType: 'session',
          targetId: null,
          details: {
            ip: logoutContext.ipAddress,
            browser: logoutContext.browserName + (logoutContext.browserVersion ? ' ' + logoutContext.browserVersion : ''),
            os: logoutContext.osName + (logoutContext.osVersion ? ' ' + logoutContext.osVersion : ''),
            device: logoutContext.deviceType
          }
        });
      } catch (_) {}
    }
    res.redirect('/logged-out?reason=manual');
  });
});

module.exports = router;
