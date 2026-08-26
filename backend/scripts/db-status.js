#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function maskDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return '<invalid DATABASE_URL>';
  }
}

function printSqliteStatus() {
  const { DB_PATH } = require('../src/config');
  const resolvedPath = path.resolve(DB_PATH);
  const exists = fs.existsSync(resolvedPath);

  console.log('DB_MODE=sqlite');
  console.log(`DB_PATH=${resolvedPath}`);
  console.log(`DB_FILE_EXISTS=${exists ? 'yes' : 'no'}`);

  if (!exists) {
    return;
  }

  const Database = require('better-sqlite3');
  const db = new Database(resolvedPath, { readonly: true });
  try {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    console.log(`USERS_TABLE=${row ? 'present' : 'missing'}`);
  } finally {
    db.close();
  }
}

async function printPostgresStatus() {
  const { Client } = require('pg');
  const databaseUrl = process.env.DATABASE_URL;

  console.log('DB_MODE=postgres');
  console.log(`DATABASE_URL=${maskDatabaseUrl(databaseUrl)}`);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query('SELECT current_database() AS db, current_user AS user_name');
    const row = result.rows[0] || {};
    console.log(`PG_DATABASE=${row.db || ''}`);
    console.log(`PG_USER=${row.user_name || ''}`);
  } finally {
    await client.end();
  }
}

(async () => {
  if (process.env.DATABASE_URL) {
    await printPostgresStatus();
  } else {
    printSqliteStatus();
  }
})().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
