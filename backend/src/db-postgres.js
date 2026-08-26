const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL zorunlu. PostgreSQL modu için bağlantı dizesi girin.');
}

const PG_WORKER = `
const fs = require('fs');
const { createRequire } = require('module');
const { parentPort, workerData } = require('worker_threads');
const requireFromApp = createRequire(workerData.requireFrom);
const { Pool } = requireFromApp('pg');
const pool = new Pool({ connectionString: workerData.databaseUrl, max: 4 });

parentPort.on('message', async (message) => {
  const signal = new Int32Array(message.sharedBuffer);
  try {
    const result = await pool.query(message.sqlText, message.params || []);
    fs.writeFileSync(message.responsePath, JSON.stringify({
      ok: true,
      rows: result.rows,
      rowCount: result.rowCount
    }));
  } catch (error) {
    fs.writeFileSync(message.responsePath, JSON.stringify({
      ok: false,
      error: String(error && error.stack ? error.stack : error)
    }));
  } finally {
    Atomics.store(signal, 0, 1);
    Atomics.notify(signal, 0);
  }
});
`;

const queryWorker = new Worker(PG_WORKER, {
  eval: true,
  workerData: {
    databaseUrl: DATABASE_URL,
    requireFrom: path.join(__dirname, '..', 'package.json')
  }
});

let workerFailure = null;
queryWorker.on('error', (error) => {
  workerFailure = error;
});
queryWorker.on('exit', (code) => {
  if (code !== 0 && !workerFailure) {
    workerFailure = new Error(`PostgreSQL worker exited with code ${code}`);
  }
});

function runQuerySync(sqlText, params = []) {
  if (workerFailure) {
    throw workerFailure;
  }

  const sharedBuffer = new SharedArrayBuffer(4);
  const signal = new Int32Array(sharedBuffer);
  Atomics.store(signal, 0, 0);
  const responsePath = path.join(
    '/tmp',
    `yearbook-pg-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
  );

  queryWorker.postMessage({ sqlText, params, sharedBuffer, responsePath });
  const result = Atomics.wait(signal, 0, 0, 30000);
  if (workerFailure) {
    throw workerFailure;
  }
  if (result === 'timed-out') {
    throw new Error(`PostgreSQL query timed out: ${sqlText.slice(0, 200)}`);
  }
  if (Atomics.load(signal, 0) !== 1) {
    throw new Error(`PostgreSQL worker did not complete query: ${sqlText.slice(0, 200)}`);
  }
  if (!fs.existsSync(responsePath)) {
    throw new Error(`PostgreSQL worker response missing: ${sqlText.slice(0, 200)}`);
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(responsePath, 'utf8'));
  } finally {
    fs.rmSync(responsePath, { force: true });
  }
  if (!payload.ok) {
    throw new Error(payload.error || 'PostgreSQL query failed.');
  }
  return { rows: payload.rows || [], rowCount: payload.rowCount || 0 };
}

function transformSql(sql) {
  let transformed = String(sql || '');
  transformed = transformed.replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT');
  transformed = transformed.replace(/\s+COLLATE\s+NOCASE/gi, '');
  transformed = transformed.replace(/strftime\('%m-%d',\s*birth_date\)/gi, "to_char(birth_date::timestamp, 'MM-DD')");
  transformed = transformed.replace(/strftime\('%m-%d',\s*'now',\s*'localtime'\)/gi, "to_char(NOW(), 'MM-DD')");
  transformed = transformed.replace(/datetime\('now',\s*'-([0-9]+)\s+minutes'\)/gi, "NOW() - INTERVAL '$1 minutes'");
  transformed = transformed.replace(/datetime\('now',\s*'-([0-9]+)\s+hours'\)/gi, "NOW() - INTERVAL '$1 hours'");
  transformed = transformed.replace(/datetime\('now',\s*'-([0-9]+)\s+days'\)/gi, "NOW() - INTERVAL '$1 days'");
  transformed = transformed.replace(/datetime\('now'\)/gi, 'NOW()');
  transformed = transformed.replace(/date\(([^)]+)\)/gi, 'DATE($1)');
  transformed = transformed.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*_at)\s*(>=|>|<=|<)\s*NOW\(\)/gi, '$1::timestamp $2 NOW()');
  transformed = transformed.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*_at)\s*(>=|>|<=|<)\s*\(NOW\(\)/gi, '$1::timestamp $2 (NOW()');
  transformed = transformed.replace(
    /\b(([a-zA-Z_][a-zA-Z0-9_]*\.)?[a-zA-Z_][a-zA-Z0-9_]*_at)\s+(ASC|DESC)\b/gi,
    '$1::timestamp $3'
  );
  let paramIndex = 0;
  transformed = transformed.replace(/\?/g, () => {
    paramIndex += 1;
    return `$${paramIndex}`;
  });
  if (!/^\s*INSERT\b[\s\S]*\bON\s+CONFLICT\b/i.test(transformed) && /INSERT\b/i.test(sql) && /OR\s+IGNORE/i.test(sql)) {
    transformed += ' ON CONFLICT DO NOTHING';
  }
  return transformed;
}

function buildStatement(sql) {
  const text = transformSql(sql);
  return {
    get(...params) {
      const result = runQuerySync(text, params);
      return result.rows[0];
    },
    all(...params) {
      const result = runQuerySync(text, params);
      return result.rows;
    },
    run(...params) {
      let runText = text;
      if (/^\s*insert\b/i.test(runText) && !/\breturning\b/i.test(runText)) {
        runText = `${runText} RETURNING *`;
      }
      const result = runQuerySync(runText, params);
      return {
        changes: result.rowCount || 0,
        lastInsertRowid: result.rows[0] && Object.prototype.hasOwnProperty.call(result.rows[0], 'id') ? result.rows[0].id : undefined
      };
    }
  };
}

const db = {
  prepare(sql) {
    return buildStatement(sql);
  },
  exec(sql) {
    runQuerySync(String(sql || ''), []);
  },
  pragma() {
    return null;
  },
  transaction(fn) {
    return (...args) => fn(...args);
  },
  close() {},
  open: true
};

function initializeSchema() {
  runQuerySync(
    `ALTER TABLE IF EXISTS messages
       ADD COLUMN IF NOT EXISTS is_export_priority INTEGER NOT NULL DEFAULT 0`,
    []
  );
  runQuerySync(
    `ALTER TABLE IF EXISTS users
       ADD COLUMN IF NOT EXISTS yearbook_opt_out INTEGER NOT NULL DEFAULT 0`,
    []
  );
  runQuerySync(
    `ALTER TABLE IF EXISTS schools
       ADD COLUMN IF NOT EXISTS background_wallpaper_path TEXT DEFAULT ''`,
    []
  );
  runQuerySync(
    `ALTER TABLE IF EXISTS schools
       ADD COLUMN IF NOT EXISTS background_wallpaper_enabled INTEGER NOT NULL DEFAULT 0`,
    []
  );
  runQuerySync(
    `ALTER TABLE IF EXISTS schools
       ADD COLUMN IF NOT EXISTS background_gradient_enabled INTEGER NOT NULL DEFAULT 1`,
    []
  );
}

function checkpointDatabase() {}

function closeDatabase() {
  db.close();
  queryWorker.terminate();
}

function getActiveClassBranches() {
  return db
    .prepare(
      `SELECT branch
       FROM classes
       WHERE is_active = 1 AND is_archived = 0 AND deleted_at IS NULL
       ORDER BY branch`
    )
    .all()
    .map((row) => row.branch);
}

function getAllClassBranches() {
  return db
    .prepare(
      `SELECT branch
       FROM classes
       WHERE deleted_at IS NULL
       ORDER BY is_archived ASC, is_active DESC, branch`
    )
    .all()
    .map((row) => row.branch);
}

function isValidClassBranch(branch, options = {}) {
  if (!branch) {
    return false;
  }

  const includeArchived = Boolean(options.includeArchived);
  const row = includeArchived
    ? db.prepare('SELECT 1 FROM classes WHERE branch = ? AND deleted_at IS NULL').get(branch)
    : db
        .prepare('SELECT 1 FROM classes WHERE branch = ? AND is_active = 1 AND is_archived = 0 AND deleted_at IS NULL')
        .get(branch);
  return Boolean(row);
}

module.exports = {
  db,
  initializeSchema,
  checkpointDatabase,
  closeDatabase,
  getActiveClassBranches,
  getAllClassBranches,
  isValidClassBranch
};
