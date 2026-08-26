const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { once } = require('events');

function clearBackendModules() {
  Object.keys(require.cache).forEach((key) => {
    if (key.includes(`${path.sep}backend${path.sep}src${path.sep}`)) {
      delete require.cache[key];
    }
  });
}

function mergeSetCookie(existing, setCookieHeaders) {
  const jar = new Map(existing);
  (setCookieHeaders || []).forEach((header) => {
    const firstPart = String(header).split(';')[0];
    const separatorIndex = firstPart.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }
    const key = firstPart.slice(0, separatorIndex);
    const value = firstPart.slice(separatorIndex + 1);
    jar.set(key, value);
  });
  return jar;
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }

  const header = response.headers.get('set-cookie');
  return header ? [header] : [];
}

function toCookieHeader(cookieJar) {
  return Array.from(cookieJar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function extractCsrfToken(html) {
  const match = String(html).match(/name="_csrf"\s+value="([^"]+)"/);
  return match ? match[1] : null;
}

async function setupApp(t) {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    SESSION_SECRET: process.env.SESSION_SECRET,
    DB_PATH: process.env.DB_PATH,
    UPLOAD_DIR: process.env.UPLOAD_DIR,
    GALLERY_UPLOAD_DIR: process.env.GALLERY_UPLOAD_DIR,
    SESSION_DB_DIR: process.env.SESSION_DB_DIR,
    MAINTENANCE_STATE_PATH: process.env.MAINTENANCE_STATE_PATH,
    BACKUP_DIR: process.env.BACKUP_DIR,
    LOG_DIR: process.env.LOG_DIR
  };

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yearbook-test-'));
  const uploadDir = path.join(tempRoot, 'photos');
  const galleryDir = path.join(tempRoot, 'gallery');
  const sessionDir = path.join(tempRoot, 'sessions');
  const backupDir = path.join(tempRoot, 'backups');
  const logDir = path.join(tempRoot, 'logs');
  const maintenancePath = path.join(tempRoot, 'maintenance.json');
  const dbPath = path.join(tempRoot, 'yearbook.db');

  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(galleryDir, { recursive: true });
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  process.env.NODE_ENV = 'development';
  process.env.SESSION_SECRET = 'test-session-secret';
  process.env.DB_PATH = dbPath;
  process.env.UPLOAD_DIR = uploadDir;
  process.env.GALLERY_UPLOAD_DIR = galleryDir;
  process.env.SESSION_DB_DIR = sessionDir;
  process.env.MAINTENANCE_STATE_PATH = maintenancePath;
  process.env.BACKUP_DIR = backupDir;
  process.env.LOG_DIR = logDir;

  clearBackendModules();

  const { db } = require('../src/db');
  const { hashAccessCode } = require('../src/utils/accessCode');
  const app = require('../src/app');
  const school = db.prepare('SELECT id FROM schools WHERE is_active = 1 ORDER BY id ASC LIMIT 1').get();
  const schoolId = school ? school.id : null;

  const adminInsert = db.prepare(
    `INSERT INTO users (name, login_identifier, role, class_branch, access_code_hash, school_id, kvkk_approved_at)
     VALUES (?, ?, 'admin', NULL, ?, ?, CURRENT_TIMESTAMP)`
  );
  const teacherInsert = db.prepare(
    `INSERT INTO users (name, login_identifier, role, class_branch, access_code_hash, school_id, kvkk_approved_at)
     VALUES (?, ?, 'teacher', NULL, ?, ?, CURRENT_TIMESTAMP)`
  );
  const studentInsert = db.prepare(
    `INSERT INTO users (name, student_number, login_identifier, role, class_branch, access_code_hash, school_id, kvkk_approved_at)
     VALUES (?, ?, ?, 'student', ?, ?, ?, CURRENT_TIMESTAMP)`
  );

  adminInsert.run('Admin User', 'admin-admin-user-1', hashAccessCode('AdminCode123'), schoolId);
  teacherInsert.run('Fatma Kaya', 'teacher-fatma-kaya-2', hashAccessCode('TeacherCode123'), schoolId);
  const studentResult = studentInsert.run('Ali Veli', '1001', 'student-ali-veli-3', '12-A', hashAccessCode('StudentCode123'), schoolId);
  const studentId = Number(studentResult.lastInsertRowid);

  const server = app.listen(0);
  await once(server, 'listening');

  t.after(() => {
    server.close();
    db.close();
    clearBackendModules();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    uploadDir,
    studentId,
    db,
    schoolId
  };
}

async function fetchWithCookies(url, options, cookieJar) {
  const headers = new Headers(options && options.headers ? options.headers : {});
  const cookieHeader = toCookieHeader(cookieJar);
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: 'manual'
  });

  const nextJar = mergeSetCookie(cookieJar, getSetCookieHeaders(response));
  return { response, cookieJar: nextJar };
}

async function login(baseUrl, role, identifier, accessCode, schoolId = '1') {
  let cookieJar = new Map();
  let result = await fetchWithCookies(`${baseUrl}/login`, { method: 'GET' }, cookieJar);
  cookieJar = result.cookieJar;
  const html = await result.response.text();
  const csrfToken = extractCsrfToken(html);
  assert.ok(csrfToken, 'csrf token should exist on login page');

  result = await fetchWithCookies(
    `${baseUrl}/login`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        _csrf: csrfToken,
        role,
        school_id: role === 'admin' ? '' : String(schoolId),
        identifier,
        access_code: accessCode
      }).toString()
    },
    cookieJar
  );

  return result;
}

test('protected uploads require authentication', async (t) => {
  const { baseUrl } = await setupApp(t);
  const response = await fetch(`${baseUrl}/uploads/photos/example.jpg`, {
    redirect: 'manual'
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/login');
});

test('teacher login requires login identifier instead of display name', async (t) => {
  const { baseUrl } = await setupApp(t);

  const failed = await login(baseUrl, 'teacher', 'Fatma Kaya', 'TeacherCode123');
  assert.equal(failed.response.status, 302);
  assert.equal(failed.response.headers.get('location'), '/login');

  const success = await login(baseUrl, 'teacher', 'teacher-fatma-kaya-2', 'TeacherCode123');
  assert.equal(success.response.status, 302);
  assert.equal(success.response.headers.get('location'), '/');
});

test('health endpoint is available to admins', async (t) => {
  const { baseUrl } = await setupApp(t);
  const loginResult = await login(baseUrl, 'admin', 'admin-admin-user-1', 'AdminCode123');
  assert.equal(loginResult.response.status, 302);
  assert.equal(loginResult.response.headers.get('location'), '/');

  const healthResult = await fetchWithCookies(`${baseUrl}/health`, { method: 'GET' }, loginResult.cookieJar);
  assert.equal(healthResult.response.status, 200);
  const payload = await healthResult.response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.database, true);
});

test('invalid csrf upload does not write profile photo files', async (t) => {
  const { baseUrl, uploadDir, studentId } = await setupApp(t);
  const loginResult = await login(baseUrl, 'student', '1001', 'StudentCode123');
  assert.equal(loginResult.response.status, 302);
  assert.equal(loginResult.response.headers.get('location'), '/');

  const beforeCount = fs.readdirSync(uploadDir).length;
  const form = new FormData();
  form.append('photo', new Blob(['fake-image'], { type: 'image/png' }), 'avatar.png');

  const uploadResult = await fetchWithCookies(
    `${baseUrl}/profiles/me/photo?_csrf=invalid-token`,
    {
      method: 'POST',
      body: form
    },
    loginResult.cookieJar
  );

  assert.equal(uploadResult.response.status, 302);
  assert.equal(fs.readdirSync(uploadDir).length, beforeCount);

  const profileResponse = await fetchWithCookies(`${baseUrl}/profiles/${studentId}`, { method: 'GET' }, uploadResult.cookieJar);
  const profileHtml = await profileResponse.response.text();
  assert.match(profileHtml, /default-avatar\.svg/);
});

test('failed login attempts are recorded', async (t) => {
  const { baseUrl, db } = await setupApp(t);
  const result = await login(baseUrl, 'admin', 'admin-admin-user-1', 'WrongCode');
  assert.equal(result.response.status, 302);
  assert.equal(result.response.headers.get('location'), '/login');

  const attempt = db.prepare('SELECT status, reason FROM login_attempts ORDER BY id DESC LIMIT 1').get();
  assert.equal(attempt.status, 'failed');
  assert.equal(attempt.reason, 'invalid_credentials');
});

test('maintenance mode blocks non-admin login and public pages', async (t) => {
  const { baseUrl } = await setupApp(t);
  fs.writeFileSync(
    process.env.MAINTENANCE_STATE_PATH,
    JSON.stringify({
      reason: 'student_import',
      source: 'test',
      startedAt: new Date().toISOString(),
      message: 'Bakim testi'
    })
  );

  const blockedLogin = await login(baseUrl, 'student', '1001', 'StudentCode123');
  assert.equal(blockedLogin.response.status, 302);
  assert.equal(blockedLogin.response.headers.get('location'), '/login');

  const adminLogin = await login(baseUrl, 'admin', 'admin-admin-user-1', 'AdminCode123');
  assert.equal(adminLogin.response.status, 302);
  assert.equal(adminLogin.response.headers.get('location'), '/');

  const blockedPage = await fetch(`${baseUrl}/`, { redirect: 'manual' });
  assert.equal(blockedPage.status, 503);
  const blockedHtml = await blockedPage.text();
  assert.match(blockedHtml, /Sistem Bakım Modunda/);
});

test('flash middleware does not crash after session destruction', async () => {
  const flashMiddleware = require('../src/middleware/flash');

  const req = {};
  const res = { locals: {} };
  let nextCalled = false;

  flashMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  req.flash('error', 'session missing');
  assert.deepEqual(res.locals.flash, { type: 'error', message: 'session missing' });
});
