const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { DB_PATH, ROOT_DIR, SQLITE_BUSY_TIMEOUT_MS } = require('./config');

const db = new Database(DB_PATH);

function configureDatabaseConnection() {
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma(`busy_timeout = ${Math.max(0, SQLITE_BUSY_TIMEOUT_MS)}`);
}

configureDatabaseConnection();
const DEFAULT_CLASS_BRANCHES = ['12-A', '12-B', '12-C', '12-D', '12-E'];

function columnExists(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((col) => col.name === columnName);
}

function buildLoginIdentifier(role, name, userId) {
  const base = String(name || '')
    .toLocaleLowerCase('tr')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'user';
  return `${role}-${base}-${userId}`;
}

function tableSqlIncludes(tableName, fragment) {
  const tableSqlRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return Boolean(tableSqlRow && tableSqlRow.sql && tableSqlRow.sql.includes(fragment));
}

function rebuildTable(tableName, createSql, insertSql, extraSql = []) {
  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN TRANSACTION');
  try {
    db.exec(`DROP TABLE IF EXISTS ${tableName}_new;`);
    db.exec(createSql);
    db.exec(insertSql);
    db.exec(`DROP TABLE ${tableName};`);
    db.exec(`ALTER TABLE ${tableName}_new RENAME TO ${tableName};`);
    extraSql.forEach((statement) => db.exec(statement));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function ensureSchoolModelSeeded() {
  db.prepare(
    `INSERT INTO school_years (label, is_current, is_archived)
     SELECT ?, 1, 0
     WHERE NOT EXISTS (SELECT 1 FROM school_years WHERE is_current = 1)`
  ).run('2025-2026');

  const currentYear = db.prepare('SELECT id FROM school_years WHERE is_current = 1 ORDER BY id DESC LIMIT 1').get();
  const classBranches = new Set(DEFAULT_CLASS_BRANCHES);

  [
    'SELECT DISTINCT class_branch AS branch FROM users WHERE class_branch IS NOT NULL AND trim(class_branch) <> \'\'',
    'SELECT DISTINCT president_class_branch AS branch FROM users WHERE president_class_branch IS NOT NULL AND trim(president_class_branch) <> \'\'',
    'SELECT DISTINCT class_branch AS branch FROM class_pages WHERE class_branch IS NOT NULL AND trim(class_branch) <> \'\'',
    'SELECT DISTINCT class_branch AS branch FROM class_timeline_entries WHERE class_branch IS NOT NULL AND trim(class_branch) <> \'\'',
    'SELECT DISTINCT class_branch AS branch FROM class_memories WHERE class_branch IS NOT NULL AND trim(class_branch) <> \'\'',
    'SELECT DISTINCT class_branch AS branch FROM gallery_albums WHERE class_branch IS NOT NULL AND trim(class_branch) <> \'\'',
    'SELECT DISTINCT class_branch AS branch FROM gallery_photos WHERE class_branch IS NOT NULL AND trim(class_branch) <> \'\''
  ].forEach((query) => {
    db.prepare(query)
      .all()
      .forEach((row) => classBranches.add(row.branch));
  });

  const insertClass = db.prepare(
    `INSERT INTO classes (branch, school_year_id, is_active, is_archived)
     VALUES (?, ?, 1, 0)
     ON CONFLICT(branch) DO UPDATE SET
       school_year_id = COALESCE(classes.school_year_id, excluded.school_year_id),
       is_active = 1,
       updated_at = CURRENT_TIMESTAMP`
  );

  Array.from(classBranches)
    .filter(Boolean)
    .sort()
    .forEach((branch) => {
      insertClass.run(branch, currentYear ? currentYear.id : null);
    });
}

function ensureArchiveYearClassesSeeded() {
  const insertArchiveClass = db.prepare(
    `INSERT INTO archive_year_classes (school_year_id, branch, theme_color, cover_photo_path, class_slogan, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(school_year_id, branch) DO UPDATE SET
       theme_color = COALESCE(NULLIF(excluded.theme_color, ''), archive_year_classes.theme_color),
       cover_photo_path = COALESCE(excluded.cover_photo_path, archive_year_classes.cover_photo_path),
       class_slogan = COALESCE(NULLIF(excluded.class_slogan, ''), archive_year_classes.class_slogan),
       updated_at = CURRENT_TIMESTAMP`
  );

  const archivedClasses = db
    .prepare(
      `SELECT c.school_year_id, c.branch, c.theme_color, cp.cover_photo_path, cp.class_slogan
       FROM classes c
       LEFT JOIN class_pages cp ON cp.class_branch = c.branch
       WHERE c.is_archived = 1 AND c.deleted_at IS NULL AND c.school_year_id IS NOT NULL`
    )
    .all();
  archivedClasses.forEach((item) => {
    insertArchiveClass.run(
      item.school_year_id,
      item.branch,
      item.theme_color || '',
      item.cover_photo_path || null,
      item.class_slogan || ''
    );
  });

  const archivedUserBranches = db
    .prepare(
      `SELECT archived_school_year_id AS school_year_id, archived_class_branch AS branch
       FROM users
       WHERE archived_school_year_id IS NOT NULL
         AND archived_class_branch IS NOT NULL
         AND trim(archived_class_branch) <> ''
       GROUP BY archived_school_year_id, archived_class_branch`
    )
    .all();
  archivedUserBranches.forEach((item) => {
    insertArchiveClass.run(item.school_year_id, item.branch, '', null, '');
  });
}

function migrateUsersTableForDynamicClassesIfNeeded() {
  if (!tableSqlIncludes('users', "class_branch TEXT CHECK") && !tableSqlIncludes('users', "president_class_branch TEXT CHECK")) {
    return;
  }

  rebuildTable(
    'users',
    `
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        student_number TEXT UNIQUE,
        login_identifier TEXT UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'guest', 'other')),
        class_branch TEXT,
        teacher_category TEXT DEFAULT 'teacher',
        president_class_branch TEXT,
        access_code_hash TEXT NOT NULL,
        photo_path TEXT,
        profile_cover_path TEXT,
        profile_cover_locked INTEGER NOT NULL DEFAULT 0 CHECK (profile_cover_locked IN (0, 1)),
        photo_locked INTEGER NOT NULL DEFAULT 0 CHECK (photo_locked IN (0, 1)),
        slogan TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        favorite_memory TEXT DEFAULT '',
        favorite_quote TEXT DEFAULT '',
        profile_visit_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      INSERT INTO users_new (
        id, name, student_number, login_identifier, role, class_branch, president_class_branch,
        teacher_category, access_code_hash, photo_path, profile_cover_path, profile_cover_locked, photo_locked, slogan, bio,
        favorite_memory, favorite_quote, profile_visit_count, created_at, updated_at
      )
      SELECT
        id, name, student_number, login_identifier, role, class_branch, president_class_branch,
        ${columnExists('users', 'teacher_category') ? "CASE WHEN teacher_category IS NULL OR trim(teacher_category) = '' THEN 'teacher' ELSE teacher_category END" : "'teacher'"},
        access_code_hash, photo_path,
        ${columnExists('users', 'profile_cover_path') ? 'profile_cover_path' : 'NULL'},
        ${columnExists('users', 'profile_cover_locked') ? 'profile_cover_locked' : '0'},
        ${columnExists('users', 'photo_locked') ? 'photo_locked' : '0'},
        COALESCE(slogan, ''),
        ${columnExists('users', 'bio') ? 'COALESCE(bio, \'\')' : '\'\''},
        ${columnExists('users', 'favorite_memory') ? 'COALESCE(favorite_memory, \'\')' : '\'\''},
        ${columnExists('users', 'favorite_quote') ? 'COALESCE(favorite_quote, \'\')' : '\'\''},
        ${columnExists('users', 'profile_visit_count') ? 'profile_visit_count' : '0'},
        created_at,
        ${columnExists('users', 'updated_at') ? 'updated_at' : 'created_at'}
      FROM users;
    `,
    [
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_identifier ON users(login_identifier);',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_president_class_branch ON users(president_class_branch) WHERE president_class_branch IS NOT NULL;',
      'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);',
      'CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);',
      'CREATE INDEX IF NOT EXISTS idx_users_name_nocase ON users(name COLLATE NOCASE);',
      'CREATE INDEX IF NOT EXISTS idx_users_student_number ON users(student_number);',
      'CREATE INDEX IF NOT EXISTS idx_users_class_branch ON users(class_branch);'
    ]
  );
}

function migrateClassLinkedTablesForDynamicClassesIfNeeded() {
  if (tableSqlIncludes('class_pages', 'CHECK (class_branch IN')) {
    rebuildTable(
      'class_pages',
      `
        CREATE TABLE class_pages_new (
          class_branch TEXT PRIMARY KEY,
          cover_photo_path TEXT,
          class_slogan TEXT DEFAULT '',
          updated_by_user_id INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );
      `,
      `
        INSERT INTO class_pages_new (class_branch, cover_photo_path, class_slogan, updated_by_user_id, created_at, updated_at)
        SELECT class_branch, cover_photo_path, COALESCE(class_slogan, ''), updated_by_user_id, created_at, updated_at
        FROM class_pages;
      `
    );
  }

  if (tableSqlIncludes('gallery_photos', 'class_branch TEXT CHECK')) {
    rebuildTable(
      'gallery_photos',
      `
        CREATE TABLE gallery_photos_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uploader_user_id INTEGER NOT NULL,
          section TEXT NOT NULL CHECK (section IN ('gallery', 'events')),
          class_branch TEXT,
          album_id INTEGER,
          photo_path TEXT NOT NULL,
          group_id TEXT,
          group_index INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          view_count INTEGER NOT NULL DEFAULT 0,
          caption TEXT DEFAULT '',
          date_stamp_text TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (uploader_user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (album_id) REFERENCES gallery_albums(id) ON DELETE SET NULL
        );
      `,
      `
        INSERT INTO gallery_photos_new (
          id, uploader_user_id, section, class_branch, album_id, photo_path, group_id,
          group_index, sort_order, view_count, caption, date_stamp_text, created_at
        )
        SELECT
          id, uploader_user_id, section, class_branch,
          ${columnExists('gallery_photos', 'album_id') ? 'album_id' : 'NULL'},
          photo_path,
          ${columnExists('gallery_photos', 'group_id') ? 'group_id' : 'NULL'},
          ${columnExists('gallery_photos', 'group_index') ? 'group_index' : '0'},
          ${columnExists('gallery_photos', 'sort_order') ? 'sort_order' : '0'},
          ${columnExists('gallery_photos', 'view_count') ? 'view_count' : '0'},
          COALESCE(caption, ''),
          ${columnExists('gallery_photos', 'date_stamp_text') ? 'COALESCE(date_stamp_text, \'\')' : '\'\''},
          created_at
        FROM gallery_photos;
      `,
      [
        'CREATE INDEX IF NOT EXISTS idx_gallery_photos_section ON gallery_photos(section);',
        'CREATE INDEX IF NOT EXISTS idx_gallery_photos_class_branch ON gallery_photos(class_branch);',
        'CREATE INDEX IF NOT EXISTS idx_gallery_photos_group_id ON gallery_photos(group_id);',
        'CREATE INDEX IF NOT EXISTS idx_gallery_photos_album_id ON gallery_photos(album_id, sort_order);',
        'CREATE INDEX IF NOT EXISTS idx_gallery_photos_view_count ON gallery_photos(view_count DESC, created_at DESC);'
      ]
    );
  }

  if (tableSqlIncludes('class_timeline_entries', 'CHECK (class_branch IN')) {
    rebuildTable(
      'class_timeline_entries',
      `
        CREATE TABLE class_timeline_entries_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          class_branch TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          happened_on TEXT,
          created_by_user_id INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `,
      `
        INSERT INTO class_timeline_entries_new (id, class_branch, title, body, happened_on, created_by_user_id, created_at, updated_at)
        SELECT id, class_branch, title, body, happened_on, created_by_user_id, created_at, updated_at
        FROM class_timeline_entries;
      `,
      ['CREATE INDEX IF NOT EXISTS idx_class_timeline_entries_branch ON class_timeline_entries(class_branch, happened_on, created_at);']
    );
  }

  if (tableSqlIncludes('class_memories', 'CHECK (class_branch IN')) {
    rebuildTable(
      'class_memories',
      `
        CREATE TABLE class_memories_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          class_branch TEXT NOT NULL,
          body TEXT NOT NULL,
          created_by_user_id INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `,
      `
        INSERT INTO class_memories_new (id, class_branch, body, created_by_user_id, created_at)
        SELECT id, class_branch, body, created_by_user_id, created_at
        FROM class_memories;
      `,
      ['CREATE INDEX IF NOT EXISTS idx_class_memories_branch ON class_memories(class_branch, created_at);']
    );
  }

  if (tableSqlIncludes('gallery_albums', 'class_branch TEXT CHECK')) {
    rebuildTable(
      'gallery_albums',
      `
        CREATE TABLE gallery_albums_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          class_branch TEXT,
          created_by_user_id INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `,
      `
        INSERT INTO gallery_albums_new (id, title, description, class_branch, created_by_user_id, created_at, updated_at)
        SELECT id, title, COALESCE(description, ''), class_branch, created_by_user_id, created_at, updated_at
        FROM gallery_albums;
      `,
      ['CREATE INDEX IF NOT EXISTS idx_gallery_albums_class_branch ON gallery_albums(class_branch, created_at);']
    );
  }
}

function migrateMessagesTableIfNeeded() {
  const tableSqlRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'messages'")
    .get();

  if (!tableSqlRow || !tableSqlRow.sql) {
    return;
  }

  const hasOldLengthCheck = tableSqlRow.sql.includes('BETWEEN 1 AND 600');
  const hasUpdatedAt = columnExists('messages', 'updated_at');

  if (!hasOldLengthCheck && hasUpdatedAt) {
    return;
  }

  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN TRANSACTION');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT unique_sender_receiver UNIQUE (from_user_id, to_user_id),
        CHECK (length(message) BETWEEN 1 AND 2000),
        CHECK (from_user_id <> to_user_id)
      );
    `);

    if (hasUpdatedAt) {
      db.exec(`
        INSERT INTO messages_new (id, from_user_id, to_user_id, message, created_at, updated_at)
        SELECT id, from_user_id, to_user_id, message, created_at, updated_at
        FROM messages;
      `);
    } else {
      db.exec(`
        INSERT INTO messages_new (id, from_user_id, to_user_id, message, created_at, updated_at)
        SELECT id, from_user_id, to_user_id, message, created_at, created_at
        FROM messages;
      `);
    }

    db.exec('DROP TABLE messages;');
    db.exec('ALTER TABLE messages_new RENAME TO messages;');
    db.exec('CREATE INDEX IF NOT EXISTS idx_messages_to_user_id ON messages(to_user_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function migrateUsersTableForGuestRoleIfNeeded() {
  const tableSqlRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get();

  if (!tableSqlRow || !tableSqlRow.sql) {
    return;
  }

  if (tableSqlRow.sql.includes("'guest'")) {
    return;
  }

  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN TRANSACTION');
  try {
    const loginIdentifierSelect = columnExists('users', 'login_identifier') ? 'login_identifier' : 'NULL';
    const presidentClassSelect = columnExists('users', 'president_class_branch') ? 'president_class_branch' : 'NULL';
    db.exec('DROP TABLE IF EXISTS users_new;');
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        student_number TEXT UNIQUE,
        login_identifier TEXT UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'guest', 'other')),
        class_branch TEXT,
        president_class_branch TEXT,
        access_code_hash TEXT NOT NULL,
        photo_path TEXT,
        photo_locked INTEGER NOT NULL DEFAULT 0 CHECK (photo_locked IN (0, 1)),
        slogan TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.exec(`
      INSERT INTO users_new (id, name, student_number, login_identifier, role, class_branch, president_class_branch, access_code_hash, photo_path, photo_locked, slogan, created_at, updated_at)
      SELECT id, name, student_number, ${loginIdentifierSelect}, role, class_branch, ${presidentClassSelect}, access_code_hash, photo_path, photo_locked, slogan, created_at, updated_at
      FROM users;
    `);

    db.exec('DROP TABLE users;');
    db.exec('ALTER TABLE users_new RENAME TO users;');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_identifier ON users(login_identifier);');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_president_class_branch ON users(president_class_branch) WHERE president_class_branch IS NOT NULL;');
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_name_nocase ON users(name COLLATE NOCASE);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_student_number ON users(student_number);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_users_class_branch ON users(class_branch);');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function migrateGalleryPhotosForCollageIfNeeded() {
  if (!columnExists('gallery_photos', 'group_id')) {
    db.exec('ALTER TABLE gallery_photos ADD COLUMN group_id TEXT;');
  }
  if (!columnExists('gallery_photos', 'group_index')) {
    db.exec('ALTER TABLE gallery_photos ADD COLUMN group_index INTEGER NOT NULL DEFAULT 0;');
  }
  if (!columnExists('gallery_photos', 'album_id')) {
    db.exec('ALTER TABLE gallery_photos ADD COLUMN album_id INTEGER;');
  }
  if (!columnExists('gallery_photos', 'sort_order')) {
    db.exec('ALTER TABLE gallery_photos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;');
  }
  if (!columnExists('gallery_photos', 'view_count')) {
    db.exec('ALTER TABLE gallery_photos ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_gallery_photos_group_id ON gallery_photos(group_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_gallery_photos_album_id ON gallery_photos(album_id, sort_order);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_gallery_photos_view_count ON gallery_photos(view_count DESC, created_at DESC);');
}

function migrateUsersTableForInactiveStatusIfNeeded() {
  if (tableSqlIncludes('users', "'inactive'")) {
    return;
  }

  rebuildTable(
    'users',
    `
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        student_number TEXT UNIQUE,
        login_identifier TEXT UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'guest', 'other')),
        class_branch TEXT,
        teacher_category TEXT DEFAULT 'teacher',
        president_class_branch TEXT,
        access_code_hash TEXT NOT NULL,
        photo_path TEXT,
        profile_cover_path TEXT,
        profile_theme_color TEXT DEFAULT '',
        profile_cover_locked INTEGER NOT NULL DEFAULT 0 CHECK (profile_cover_locked IN (0, 1)),
        photo_locked INTEGER NOT NULL DEFAULT 0 CHECK (photo_locked IN (0, 1)),
        slogan TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        favorite_memory TEXT DEFAULT '',
        favorite_quote TEXT DEFAULT '',
        birth_date TEXT,
        featured_message_id INTEGER,
        last_active_at TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'archived')),
        archived_school_year_id INTEGER,
        archived_class_branch TEXT,
        graduated_at TEXT,
        profile_visit_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      INSERT INTO users_new (
        id, name, student_number, login_identifier, role, class_branch, teacher_category, president_class_branch,
        access_code_hash, photo_path, profile_cover_path, profile_theme_color, profile_cover_locked, photo_locked, slogan, bio,
        favorite_memory, favorite_quote, birth_date, featured_message_id, last_active_at, status,
        archived_school_year_id, archived_class_branch, graduated_at, profile_visit_count, created_at, updated_at
      )
      SELECT
        id,
        name,
        student_number,
        ${columnExists('users', 'login_identifier') ? 'login_identifier' : 'NULL'},
        role,
        class_branch,
        ${columnExists('users', 'teacher_category') ? "CASE WHEN teacher_category IS NULL OR trim(teacher_category) = '' THEN 'teacher' ELSE teacher_category END" : "'teacher'"},
        ${columnExists('users', 'president_class_branch') ? 'president_class_branch' : 'NULL'},
        access_code_hash,
        photo_path,
        ${columnExists('users', 'profile_cover_path') ? 'profile_cover_path' : 'NULL'},
        ${columnExists('users', 'profile_theme_color') ? "COALESCE(profile_theme_color, '')" : "''"},
        ${columnExists('users', 'profile_cover_locked') ? 'profile_cover_locked' : '0'},
        ${columnExists('users', 'photo_locked') ? 'photo_locked' : '0'},
        COALESCE(slogan, ''),
        ${columnExists('users', 'bio') ? "COALESCE(bio, '')" : "''"},
        ${columnExists('users', 'favorite_memory') ? "COALESCE(favorite_memory, '')" : "''"},
        ${columnExists('users', 'favorite_quote') ? "COALESCE(favorite_quote, '')" : "''"},
        ${columnExists('users', 'birth_date') ? 'birth_date' : 'NULL'},
        ${columnExists('users', 'featured_message_id') ? 'featured_message_id' : 'NULL'},
        ${columnExists('users', 'last_active_at') ? 'last_active_at' : 'NULL'},
        CASE
          WHEN ${columnExists('users', 'status') ? 'status' : "'active'"} IN ('active', 'inactive', 'graduated', 'archived')
            THEN ${columnExists('users', 'status') ? 'status' : "'active'"}
          ELSE 'active'
        END,
        ${columnExists('users', 'archived_school_year_id') ? 'archived_school_year_id' : 'NULL'},
        ${columnExists('users', 'archived_class_branch') ? 'archived_class_branch' : 'NULL'},
        ${columnExists('users', 'graduated_at') ? 'graduated_at' : 'NULL'},
        ${columnExists('users', 'profile_visit_count') ? 'profile_visit_count' : '0'},
        created_at,
        ${columnExists('users', 'updated_at') ? 'updated_at' : 'created_at'}
      FROM users;
    `,
    [
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_identifier ON users(login_identifier);',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_president_class_branch ON users(president_class_branch) WHERE president_class_branch IS NOT NULL;',
      'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);',
      'CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);',
      'CREATE INDEX IF NOT EXISTS idx_users_name_nocase ON users(name COLLATE NOCASE);',
      'CREATE INDEX IF NOT EXISTS idx_users_student_number ON users(student_number);',
      'CREATE INDEX IF NOT EXISTS idx_users_class_branch ON users(class_branch);'
    ]
  );
}

function migrateUsersTableForOtherRoleIfNeeded() {
  if (tableSqlIncludes('users', "'other'")) {
    return;
  }

  rebuildTable(
    'users',
    `
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        student_number TEXT UNIQUE,
        login_identifier TEXT UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin', 'guest', 'other')),
        school_id INTEGER,
        class_branch TEXT,
        teacher_category TEXT DEFAULT 'teacher',
        president_class_branch TEXT,
        access_code_hash TEXT NOT NULL,
        photo_path TEXT,
        profile_cover_path TEXT,
        profile_theme_color TEXT DEFAULT '',
        profile_cover_locked INTEGER NOT NULL DEFAULT 0 CHECK (profile_cover_locked IN (0, 1)),
        photo_locked INTEGER NOT NULL DEFAULT 0 CHECK (photo_locked IN (0, 1)),
        slogan TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        favorite_memory TEXT DEFAULT '',
        favorite_quote TEXT DEFAULT '',
        birth_date TEXT,
        featured_message_id INTEGER,
        last_active_at TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'archived')),
        archived_school_year_id INTEGER,
        archived_class_branch TEXT,
        graduated_at TEXT,
        profile_visit_count INTEGER NOT NULL DEFAULT 0,
        kvkk_approved_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    `
      INSERT INTO users_new (
        id, name, student_number, login_identifier, role, school_id, class_branch, teacher_category,
        president_class_branch, access_code_hash, photo_path, profile_cover_path, profile_theme_color,
        profile_cover_locked, photo_locked, slogan, bio, favorite_memory, favorite_quote, birth_date, featured_message_id,
        last_active_at, status, archived_school_year_id, archived_class_branch, graduated_at,
        profile_visit_count, kvkk_approved_at, created_at, updated_at
      )
      SELECT
        id, name, student_number, login_identifier, role,
        ${columnExists('users', 'school_id') ? 'school_id' : 'NULL'},
        class_branch, teacher_category, president_class_branch, access_code_hash, photo_path,
        profile_cover_path, COALESCE(profile_theme_color, ''),
        ${columnExists('users', 'profile_cover_locked') ? 'profile_cover_locked' : '0'},
        photo_locked, COALESCE(slogan, ''),
        COALESCE(bio, ''), COALESCE(favorite_memory, ''), COALESCE(favorite_quote, ''),
        birth_date, featured_message_id, last_active_at, status, archived_school_year_id,
        archived_class_branch, graduated_at, profile_visit_count,
        ${columnExists('users', 'kvkk_approved_at') ? 'kvkk_approved_at' : 'NULL'},
        created_at, updated_at
      FROM users;
    `
  );
}

function migrateLoginAttemptsTableIfNeeded() {
  const tableSqlRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'login_attempts'")
    .get();

  if (!tableSqlRow || !tableSqlRow.sql) {
    return;
  }

  const hasSuccessStatus = tableSqlRow.sql.includes("'success'");
  const hasResolvedUserId = columnExists('login_attempts', 'resolved_user_id');
  const hasRequestHeadersJson = columnExists('login_attempts', 'request_headers_json');

  if (hasSuccessStatus && hasResolvedUserId && hasRequestHeadersJson) {
    return;
  }

  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN TRANSACTION');
  try {
    const resolvedUserSelect = columnExists('login_attempts', 'resolved_user_id') ? 'resolved_user_id' : 'NULL';
    const ipChainSelect = columnExists('login_attempts', 'ip_chain') ? 'ip_chain' : 'NULL';
    const browserNameSelect = columnExists('login_attempts', 'browser_name') ? 'browser_name' : 'NULL';
    const browserVersionSelect = columnExists('login_attempts', 'browser_version') ? 'browser_version' : 'NULL';
    const osNameSelect = columnExists('login_attempts', 'os_name') ? 'os_name' : 'NULL';
    const osVersionSelect = columnExists('login_attempts', 'os_version') ? 'os_version' : 'NULL';
    const deviceTypeSelect = columnExists('login_attempts', 'device_type') ? 'device_type' : 'NULL';
    const deviceVendorSelect = columnExists('login_attempts', 'device_vendor') ? 'device_vendor' : 'NULL';
    const deviceModelSelect = columnExists('login_attempts', 'device_model') ? 'device_model' : 'NULL';
    const acceptLanguageSelect = columnExists('login_attempts', 'accept_language') ? 'accept_language' : "''";
    const requestHeadersSelect = columnExists('login_attempts', 'request_headers_json') ? 'request_headers_json' : "'{}'";
    const attemptedIdentifiersSelect = columnExists('login_attempts', 'attempted_identifiers_json') ? 'attempted_identifiers_json' : "'[]'";

    db.exec('DROP TABLE IF EXISTS login_attempts_new;');
    db.exec(`
      CREATE TABLE login_attempts_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT,
        identifier TEXT NOT NULL,
        resolved_user_id INTEGER,
        ip_address TEXT,
        ip_chain TEXT,
        user_agent TEXT,
        browser_name TEXT,
        browser_version TEXT,
        os_name TEXT,
        os_version TEXT,
        device_type TEXT,
        device_vendor TEXT,
        device_model TEXT,
        accept_language TEXT,
        request_headers_json TEXT NOT NULL DEFAULT '{}',
        attempted_identifiers_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL CHECK (status IN ('failed', 'blocked', 'success', 'success_suspicious')),
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (resolved_user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    db.exec(`
      INSERT INTO login_attempts_new (
        id, role, identifier, resolved_user_id, ip_address, ip_chain, user_agent,
        browser_name, browser_version, os_name, os_version, device_type, device_vendor, device_model,
        accept_language, request_headers_json, attempted_identifiers_json, status, reason, created_at
      )
      SELECT
        id, role, identifier, ${resolvedUserSelect}, ip_address, ${ipChainSelect}, user_agent,
        ${browserNameSelect}, ${browserVersionSelect}, ${osNameSelect}, ${osVersionSelect}, ${deviceTypeSelect}, ${deviceVendorSelect}, ${deviceModelSelect},
        ${acceptLanguageSelect}, ${requestHeadersSelect}, ${attemptedIdentifiersSelect},
        CASE WHEN status IN ('failed', 'blocked', 'success', 'success_suspicious') THEN status ELSE 'failed' END,
        reason, created_at
      FROM login_attempts;
    `);

    db.exec('DROP TABLE login_attempts;');
    db.exec('ALTER TABLE login_attempts_new RENAME TO login_attempts;');
    db.exec('CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_login_attempts_status ON login_attempts(status, created_at);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_login_attempts_resolved_user_id ON login_attempts(resolved_user_id, created_at);');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function migrateSignupRequestsTableForOtherRoleIfNeeded() {
  const tableSqlRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'signup_requests'")
    .get();
  if (!tableSqlRow || !tableSqlRow.sql || tableSqlRow.sql.includes("'other'")) {
    return;
  }

  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN TRANSACTION');
  try {
    db.exec('DROP TABLE IF EXISTS signup_requests_new;');
    db.exec(`
      CREATE TABLE signup_requests_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_id INTEGER,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'other')),
        student_number TEXT,
        class_branch TEXT,
        teacher_category TEXT DEFAULT 'teacher',
        note TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        reviewed_by_user_id INTEGER,
        reviewed_at TEXT,
        created_user_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
        FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    db.exec(`
      INSERT INTO signup_requests_new (
        id, school_id, name, role, student_number, class_branch, teacher_category, note,
        status, reviewed_by_user_id, reviewed_at, created_user_id, created_at, updated_at
      )
      SELECT
        id, school_id, name, role, student_number, class_branch, teacher_category, note,
        status, reviewed_by_user_id, reviewed_at, created_user_id, created_at, updated_at
      FROM signup_requests;
    `);
    db.exec('DROP TABLE signup_requests;');
    db.exec('ALTER TABLE signup_requests_new RENAME TO signup_requests;');
    db.exec('CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON signup_requests(status, created_at);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_signup_requests_school_status ON signup_requests(school_id, status, created_at);');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function runMigrations() {
  migrateGalleryPhotosForCollageIfNeeded();
  migrateUsersTableForGuestRoleIfNeeded();
  migrateUsersTableForDynamicClassesIfNeeded();
  migrateUsersTableForInactiveStatusIfNeeded();
  migrateUsersTableForOtherRoleIfNeeded();
  migrateClassLinkedTablesForDynamicClassesIfNeeded();
  migrateMessagesTableIfNeeded();
  migrateLoginAttemptsTableIfNeeded();
  migrateSignupRequestsTableForOtherRoleIfNeeded();

  if (!columnExists('users', 'photo_locked')) {
    db.exec('ALTER TABLE users ADD COLUMN photo_locked INTEGER NOT NULL DEFAULT 0 CHECK (photo_locked IN (0, 1));');
  }

  if (!columnExists('users', 'login_identifier')) {
    db.exec('ALTER TABLE users ADD COLUMN login_identifier TEXT;');
  }

  if (!columnExists('users', 'president_class_branch')) {
    db.exec('ALTER TABLE users ADD COLUMN president_class_branch TEXT;');
  }
  if (!columnExists('users', 'profile_cover_path')) {
    db.exec('ALTER TABLE users ADD COLUMN profile_cover_path TEXT;');
  }
  if (!columnExists('users', 'profile_cover_locked')) {
    db.exec('ALTER TABLE users ADD COLUMN profile_cover_locked INTEGER NOT NULL DEFAULT 0 CHECK (profile_cover_locked IN (0, 1));');
  }
  if (!columnExists('users', 'profile_theme_color')) {
    db.exec("ALTER TABLE users ADD COLUMN profile_theme_color TEXT DEFAULT '';");
  }
  if (!columnExists('users', 'teacher_category')) {
    db.exec("ALTER TABLE users ADD COLUMN teacher_category TEXT DEFAULT 'teacher';");
  }
  if (!columnExists('users', 'bio')) {
    db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';");
  }
  if (!columnExists('users', 'free_text')) {
    db.exec("ALTER TABLE users ADD COLUMN free_text TEXT DEFAULT '';");
  }
  if (!columnExists('users', 'custom_contacts_json')) {
    db.exec("ALTER TABLE users ADD COLUMN custom_contacts_json TEXT DEFAULT '[]';");
  }
  if (!columnExists('users', 'favorite_memory')) {
    db.exec("ALTER TABLE users ADD COLUMN favorite_memory TEXT DEFAULT '';");
  }
  if (!columnExists('users', 'favorite_quote')) {
    db.exec("ALTER TABLE users ADD COLUMN favorite_quote TEXT DEFAULT '';");
  }
  if (!columnExists('users', 'profile_visit_count')) {
    db.exec('ALTER TABLE users ADD COLUMN profile_visit_count INTEGER NOT NULL DEFAULT 0;');
  }
  if (!columnExists('users', 'birth_date')) {
    db.exec('ALTER TABLE users ADD COLUMN birth_date TEXT;');
  }
  if (!columnExists('users', 'featured_message_id')) {
    db.exec('ALTER TABLE users ADD COLUMN featured_message_id INTEGER;');
  }
  if (!columnExists('users', 'last_active_at')) {
    db.exec('ALTER TABLE users ADD COLUMN last_active_at TEXT;');
  }
  if (!columnExists('users', 'status')) {
    db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';");
  }
  if (!columnExists('users', 'archived_school_year_id')) {
    db.exec('ALTER TABLE users ADD COLUMN archived_school_year_id INTEGER;');
  }
  if (!columnExists('users', 'archived_class_branch')) {
    db.exec('ALTER TABLE users ADD COLUMN archived_class_branch TEXT;');
  }
  if (!columnExists('users', 'graduated_at')) {
    db.exec('ALTER TABLE users ADD COLUMN graduated_at TEXT;');
  }
  if (!columnExists('users', 'kvkk_approved_at')) {
    db.exec('ALTER TABLE users ADD COLUMN kvkk_approved_at TEXT;');
  }
  if (!columnExists('messages', 'is_export_priority')) {
    db.exec('ALTER TABLE messages ADD COLUMN is_export_priority INTEGER NOT NULL DEFAULT 0;');
  }
  if (!columnExists('users', 'yearbook_opt_out')) {
    db.exec('ALTER TABLE users ADD COLUMN yearbook_opt_out INTEGER NOT NULL DEFAULT 0;');
  }
  if (!columnExists('users', 'initial_access_code')) {
    db.exec('ALTER TABLE users ADD COLUMN initial_access_code TEXT;');
  }
  if (!columnExists('users', 'initial_access_code_revealed_at')) {
    db.exec('ALTER TABLE users ADD COLUMN initial_access_code_revealed_at TEXT;');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      theme_color TEXT DEFAULT '',
      background_wallpaper_path TEXT DEFAULT '',
      background_wallpaper_enabled INTEGER NOT NULL DEFAULT 0 CHECK (background_wallpaper_enabled IN (0, 1)),
      background_gradient_enabled INTEGER NOT NULL DEFAULT 1 CHECK (background_gradient_enabled IN (0, 1)),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  if (!columnExists('schools', 'theme_color')) {
    db.exec("ALTER TABLE schools ADD COLUMN theme_color TEXT DEFAULT '';");
  }
  if (!columnExists('schools', 'background_wallpaper_path')) {
    db.exec("ALTER TABLE schools ADD COLUMN background_wallpaper_path TEXT DEFAULT '';");
  }
  if (!columnExists('schools', 'background_wallpaper_enabled')) {
    db.exec("ALTER TABLE schools ADD COLUMN background_wallpaper_enabled INTEGER NOT NULL DEFAULT 0 CHECK (background_wallpaper_enabled IN (0, 1));");
  }
  if (!columnExists('schools', 'background_gradient_enabled')) {
    db.exec("ALTER TABLE schools ADD COLUMN background_gradient_enabled INTEGER NOT NULL DEFAULT 1 CHECK (background_gradient_enabled IN (0, 1));");
  }
  if (!columnExists('users', 'school_id')) {
    db.exec('ALTER TABLE users ADD COLUMN school_id INTEGER;');
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS signup_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'other')),
      student_number TEXT,
      class_branch TEXT,
      teacher_category TEXT DEFAULT 'teacher',
      note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      reviewed_by_user_id INTEGER,
      reviewed_at TEXT,
      created_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
      FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);
  migrateSignupRequestsTableForOtherRoleIfNeeded();
  const defaultSchool = db.prepare('SELECT id FROM schools ORDER BY id ASC LIMIT 1').get();
  const defaultSchoolId = defaultSchool
    ? defaultSchool.id
    : db.prepare("INSERT INTO schools (name, slug) VALUES ('ISDFL', 'isdfl')").run().lastInsertRowid;
  db.prepare('UPDATE users SET school_id = ? WHERE school_id IS NULL').run(defaultSchoolId);
  if (!columnExists('gallery_albums', 'cover_photo_id')) {
    db.exec('ALTER TABLE gallery_albums ADD COLUMN cover_photo_id INTEGER;');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS gallery_collage_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      reactor_user_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reactor_user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, reactor_user_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reported_user_id INTEGER NOT NULL,
      reporter_user_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
      reviewed_by_user_id INTEGER,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(reported_user_id, reporter_user_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_unique_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_user_id INTEGER NOT NULL,
      visitor_user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (visitor_user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(profile_user_id, visitor_user_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS content_approval_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL CHECK (item_type IN (
        'profile_message',
        'profile_message_edit',
        'profile_details',
        'profile_three_words',
        'profile_guestbook',
        'teacher_farewell',
        'gallery_photo_comment',
        'gallery_collage_comment'
      )),
      actor_user_id INTEGER NOT NULL,
      target_user_id INTEGER,
      existing_item_id INTEGER,
      payload_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      reviewed_by_user_id INTEGER,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);
  const contentApprovalTable = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'content_approval_requests'")
    .get();
  if (contentApprovalTable && contentApprovalTable.sql && !contentApprovalTable.sql.includes('gallery_photo_comment')) {
    rebuildTable(
      'content_approval_requests',
      `
        CREATE TABLE content_approval_requests_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_type TEXT NOT NULL CHECK (item_type IN (
            'profile_message',
            'profile_message_edit',
            'profile_details',
            'profile_three_words',
            'profile_guestbook',
            'teacher_farewell',
            'gallery_photo_comment',
            'gallery_collage_comment'
          )),
          actor_user_id INTEGER NOT NULL,
          target_user_id INTEGER,
          existing_item_id INTEGER,
          payload_json TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
          reviewed_by_user_id INTEGER,
          reviewed_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );
      `,
      `
        INSERT INTO content_approval_requests_new (
          id, item_type, actor_user_id, target_user_id, existing_item_id, payload_json,
          status, reviewed_by_user_id, reviewed_at, created_at, updated_at
        )
        SELECT id, item_type, actor_user_id, target_user_id, existing_item_id, payload_json,
               status, reviewed_by_user_id, reviewed_at, created_at, updated_at
        FROM content_approval_requests;
      `
    );
  }

  if (!columnExists('login_attempts', 'resolved_user_id')) {
    db.exec('ALTER TABLE login_attempts ADD COLUMN resolved_user_id INTEGER;');
  }
  if (!columnExists('login_attempts', 'ip_chain')) {
    db.exec('ALTER TABLE login_attempts ADD COLUMN ip_chain TEXT;');
  }
  if (!columnExists('login_attempts', 'browser_name')) {
    db.exec('ALTER TABLE login_attempts ADD COLUMN browser_name TEXT;');
  }
  if (!columnExists('login_attempts', 'browser_version')) {
    db.exec('ALTER TABLE login_attempts ADD COLUMN browser_version TEXT;');
  }
  if (!columnExists('login_attempts', 'os_name')) {
    db.exec('ALTER TABLE login_attempts ADD COLUMN os_name TEXT;');
  }
  if (!columnExists('login_attempts', 'os_version')) {
    db.exec('ALTER TABLE login_attempts ADD COLUMN os_version TEXT;');
  }
  if (!columnExists('login_attempts', 'device_type')) {
    db.exec('ALTER TABLE login_attempts ADD COLUMN device_type TEXT;');
  }
  if (!columnExists('login_attempts', 'device_vendor')) {
    db.exec('ALTER TABLE login_attempts ADD COLUMN device_vendor TEXT;');
  }
  if (!columnExists('login_attempts', 'device_model')) {
    db.exec('ALTER TABLE login_attempts ADD COLUMN device_model TEXT;');
  }
  if (!columnExists('login_attempts', 'accept_language')) {
    db.exec('ALTER TABLE login_attempts ADD COLUMN accept_language TEXT;');
  }
  if (!columnExists('login_attempts', 'request_headers_json')) {
    db.exec("ALTER TABLE login_attempts ADD COLUMN request_headers_json TEXT NOT NULL DEFAULT '{}';");
  }
  if (!columnExists('login_attempts', 'attempted_identifiers_json')) {
    db.exec("ALTER TABLE login_attempts ADD COLUMN attempted_identifiers_json TEXT NOT NULL DEFAULT '[]';");
  }

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_identifier ON users(login_identifier);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id, role, class_branch);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_signup_requests_status ON signup_requests(status, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_signup_requests_school_status ON signup_requests(school_id, status, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_schools_active ON schools(is_active, name);');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_president_class_branch ON users(president_class_branch) WHERE president_class_branch IS NOT NULL;');
  db.exec('CREATE INDEX IF NOT EXISTS idx_login_attempts_resolved_user_id ON login_attempts(resolved_user_id, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_message_drafts_from_to ON message_drafts(from_user_id, to_user_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_profile_unique_visits_profile_user_id ON profile_unique_visits(profile_user_id, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_class_timeline_entries_branch ON class_timeline_entries(class_branch, happened_on, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_class_memories_branch ON class_memories(class_branch, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_gallery_albums_class_branch ON gallery_albums(class_branch, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_gallery_albums_cover_photo_id ON gallery_albums(cover_photo_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_gallery_photo_comments_photo_id ON gallery_photo_comments(photo_id, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_gallery_collage_comments_group_id ON gallery_collage_comments(group_id, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_gallery_photo_user_tags_photo_id ON gallery_photo_user_tags(photo_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_gallery_photo_reactions_photo_id ON gallery_photo_reactions(photo_id, emoji, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_gallery_collage_reactions_group_id ON gallery_collage_reactions(group_id, emoji, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_inbox_notifications_user_created_at ON inbox_notifications(user_id, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_profile_three_words_profile_id ON profile_three_words(profile_user_id, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_profile_guestbook_profile_id ON profile_guestbook_entries(profile_user_id, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_teacher_farewell_teacher_id ON teacher_farewell_messages(teacher_user_id, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_content_approval_status ON content_approval_requests(status, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_content_approval_actor_target ON content_approval_requests(actor_user_id, target_user_id, item_type, status);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_class_president_history_branch ON class_president_history(class_branch, created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_year_transitions_created_at ON year_transitions(created_at);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_classes_branch ON classes(branch);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_classes_active ON classes(is_active, is_archived, branch);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_school_years_current ON school_years(is_current, is_archived);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_archive_year_classes_year_branch ON archive_year_classes(school_year_id, branch);');

  const usersMissingIdentifier = db
    .prepare('SELECT id, role, name FROM users WHERE login_identifier IS NULL OR trim(login_identifier) = \'\'')
    .all();
  const updateIdentifier = db.prepare(
    `UPDATE users
     SET login_identifier = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  );
  usersMissingIdentifier.forEach((user) => {
    updateIdentifier.run(buildLoginIdentifier(user.role, user.name, user.id), user.id);
  });

  db.prepare(
    `UPDATE users
     SET last_active_at = COALESCE(last_active_at, updated_at, created_at)
     WHERE last_active_at IS NULL`
  ).run();

  ensureSchoolModelSeeded();
  ensureArchiveYearClassesSeeded();
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

function initializeSchema() {
  const schemaPath = path.join(ROOT_DIR, 'database', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);
  runMigrations();
}

function checkpointDatabase(mode = 'TRUNCATE') {
  db.pragma(`wal_checkpoint(${mode})`);
}

function closeDatabase() {
  if (db.open) {
    db.close();
  }
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
