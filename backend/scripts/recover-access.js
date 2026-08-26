const { db, initializeSchema } = require('../src/db');
const { normalizeName } = require('../src/utils/sanitize');
const { generateAccessCode, hashAccessCode } = require('../src/utils/accessCode');
const { ensureLoginIdentifier } = require('../src/utils/loginIdentifier');

initializeSchema();

const args = process.argv.slice(2);

function hasFlag(flag) {
  return args.includes(flag);
}

function getFlagValue(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) {
    return null;
  }
  return args[idx + 1] || null;
}

function printUsage() {
  console.log('Kullanım:');
  console.log('  node scripts/recover-access.js --list');
  console.log('  node scripts/recover-access.js --reset-id <id>');
  console.log('  node scripts/recover-access.js --reset-name "<ad soyad>" [--role student|teacher|admin|guest]');
  console.log('  node scripts/recover-access.js --reset-unknown');
  console.log('  node scripts/recover-access.js --reset-all');
  console.log('  node scripts/recover-access.js --create-admin ["Ad Soyad"]');
}

function listUsers() {
  const users = db
    .prepare(
      `SELECT id, name, role, student_number, class_branch, login_identifier
       FROM users
       ORDER BY role, class_branch, name`
    )
    .all();

  if (!users.length) {
    console.log('Hiç kullanıcı yok.');
    return;
  }

  console.log('ID | Rol | Giris Kimligi | Sınıf | Öğrenci No | Ad');
  users.forEach((user) => {
    const loginIdentifier = ensureLoginIdentifier(user);
    console.log(
      `${user.id} | ${user.role} | ${loginIdentifier} | ${user.class_branch || '-'} | ${user.student_number || '-'} | ${user.name}`
    );
  });
}

function resetUserById(id) {
  const user = db
    .prepare('SELECT id, name, role, student_number, class_branch, login_identifier FROM users WHERE id = ?')
    .get(id);

  if (!user) {
    console.error(`Kullanıcı bulunamadı (id=${id}).`);
    process.exit(1);
  }

  const code = generateAccessCode();
  db.prepare(
    `UPDATE users
     SET access_code_hash = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(hashAccessCode(code), id);

  console.log('Kullanıcı kodu yenilendi.');
  console.log(`ID: ${user.id}`);
  console.log(`Ad: ${user.name}`);
  console.log(`Rol: ${user.role}`);
  console.log(`Giriş Kimliği: ${ensureLoginIdentifier(user)}`);
  if (user.student_number) {
    console.log(`Öğrenci No: ${user.student_number}`);
  }
  if (user.class_branch) {
    console.log(`Sınıf: ${user.class_branch}`);
  }
  console.log(`Yeni Erişim Kodu: ${code}`);
}

function resetUserByName(rawName, rawRole) {
  const name = normalizeName(rawName);
  if (!name) {
    console.error('Geçerli bir ad soyad girin.');
    process.exit(1);
  }

  const role = rawRole || null;
  if (role && !['student', 'teacher', 'admin', 'guest'].includes(role)) {
    console.error('Rol sadece student|teacher|admin|guest olabilir.');
    process.exit(1);
  }

  const users = db
    .prepare('SELECT id, name, role FROM users WHERE name = ?')
    .all(name)
    .filter((user) => (role ? user.role === role : true));

  if (!users.length) {
    console.error(`Kullanıcı bulunamadı: ${name}${role ? ` (rol=${role})` : ''}`);
    process.exit(1);
  }

  if (users.length > 1) {
    console.error('Birden fazla kullanıcı bulundu. Lütfen --reset-id ile hedef kullanıcıyı seçin:');
    users.forEach((user) => console.error(`  id=${user.id} | role=${user.role} | name=${user.name}`));
    process.exit(1);
  }

  resetUserById(users[0].id);
}

function resetUnknownCodes() {
  const users = db
    .prepare('SELECT id, access_code_hash FROM users ORDER BY role, class_branch, name')
    .all();
  const targets = users.filter((user) => {
    const storedHash = String(user.access_code_hash || '').trim();
    return !storedHash || !storedHash.includes(':');
  });

  if (!targets.length) {
    console.log('Eksik/eski formatta erişim kodu bulunamadı.');
    return;
  }

  const updated = [];
  const tx = db.transaction(() => {
    targets.forEach((user) => {
      const code = generateAccessCode();
      db.prepare(
        `UPDATE users
         SET access_code_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(hashAccessCode(code), user.id);
      updated.push({ id: user.id, accessCode: code });
    });
  });
  tx();

  console.log(`${updated.length} kullanıcı için erişim kodu yenilendi.`);
  console.log('Yeni kodlar yalnızca bu çıktıdan alınabilir; güvenli biçimde saklayın.');
  updated.forEach((user) => console.log(`id=${user.id} | yeni_kod=${user.accessCode}`));
}

function resetAllCodes() {
  const users = db
    .prepare(
      `SELECT id, name, role, student_number, class_branch, login_identifier
       FROM users
       ORDER BY role, class_branch, name`
    )
    .all();

  if (!users.length) {
    console.log('Kullanıcı bulunamadı.');
    return;
  }

  const updated = [];
  const tx = db.transaction(() => {
    users.forEach((user) => {
      const code = generateAccessCode();
      const loginIdentifier = ensureLoginIdentifier(user);
      db.prepare(
        `UPDATE users
         SET access_code_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(hashAccessCode(code), user.id);
      updated.push({ ...user, loginIdentifier, accessCode: code });
    });
  });
  tx();

  console.log(`${updated.length} kullanıcı için erişim kodu yenilendi.`);
  console.log('ID | Rol | Giris Kimligi | Sınıf | Öğrenci No | Ad | Yeni Kod');
  updated.forEach((user) => {
    console.log(
      `${user.id} | ${user.role} | ${user.loginIdentifier} | ${user.class_branch || '-'} | ${user.student_number || '-'} | ${user.name} | ${user.accessCode}`
    );
  });
}

function createAdmin(rawName) {
  const adminName = normalizeName(rawName || 'System Recovery Admin');
  const code = generateAccessCode();
  const result = db.prepare(
    `INSERT INTO users (name, student_number, role, class_branch, access_code_hash)
     VALUES (?, NULL, 'admin', NULL, ?)`
  ).run(adminName, hashAccessCode(code));

  const created = db
    .prepare('SELECT id, name, role, login_identifier FROM users WHERE id = ?')
    .get(Number(result.lastInsertRowid));
  const loginIdentifier = ensureLoginIdentifier(created);
  console.log('Acil admin oluşturuldu.');
  console.log(`ID: ${created.id}`);
  console.log(`Ad: ${created.name}`);
  console.log(`Giriş Kimliği: ${loginIdentifier}`);
  console.log(`Erişim Kodu: ${code}`);
}

if (!args.length || hasFlag('--help') || hasFlag('-h')) {
  printUsage();
  process.exit(0);
}

let executedAction = false;

if (hasFlag('--list')) {
  executedAction = true;
  listUsers();
}

if (hasFlag('--reset-id')) {
  executedAction = true;
  const id = Number(getFlagValue('--reset-id'));
  if (!Number.isInteger(id) || id <= 0) {
    console.error('Geçerli bir id girin: --reset-id <pozitif tamsayı>');
    process.exit(1);
  }
  resetUserById(id);
}

if (hasFlag('--reset-name')) {
  executedAction = true;
  resetUserByName(getFlagValue('--reset-name'), getFlagValue('--role'));
}

if (hasFlag('--reset-unknown')) {
  executedAction = true;
  resetUnknownCodes();
}

if (hasFlag('--reset-all')) {
  executedAction = true;
  resetAllCodes();
}

if (hasFlag('--create-admin')) {
  executedAction = true;
  createAdmin(getFlagValue('--create-admin'));
}

if (!executedAction) {
  printUsage();
  process.exit(1);
}
