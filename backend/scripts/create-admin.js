const { db, initializeSchema } = require('../src/db');
const { normalizeName } = require('../src/utils/sanitize');
const { generateAccessCode, hashAccessCode } = require('../src/utils/accessCode');
const { ensureLoginIdentifier } = require('../src/utils/loginIdentifier');

initializeSchema();

const adminName = normalizeName(process.env.ADMIN_NAME || 'System Admin');
const existing = db.prepare("SELECT id, name FROM users WHERE role = 'admin' AND name = ?").get(adminName);

if (existing) {
  console.log(`Admin already exists: ${existing.name} (id=${existing.id})`);
  process.exit(0);
}

const accessCode = generateAccessCode();
const accessCodeHash = hashAccessCode(accessCode);

const result = db
  .prepare(
    `INSERT INTO users (name, student_number, role, class_branch, access_code_hash)
     VALUES (?, NULL, 'admin', NULL, ?)`
  )
  .run(adminName, accessCodeHash);

const loginIdentifier = ensureLoginIdentifier({
  id: Number(result.lastInsertRowid),
  role: 'admin',
  name: adminName,
  login_identifier: null
});

console.log('Admin created successfully.');
console.log(`Admin ID: ${result.lastInsertRowid}`);
console.log(`Admin Name: ${adminName}`);
console.log(`Login Identifier: ${loginIdentifier}`);
console.log(`Access Code (save now): ${accessCode}`);
