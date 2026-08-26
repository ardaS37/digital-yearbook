const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const MARKET_BASE_FOOD_PRICE = 10;
const INVESTMENT_PACKAGES = {
  1: { rate: 8, minAmount: 100, riskLevel: 'low', riskLabel: 'Düşük Risk', minMultiplier: 0.95, maxMultiplier: 1.08 },
  3: { rate: 18, minAmount: 500, riskLevel: 'medium', riskLabel: 'Orta Risk', minMultiplier: 0.8, maxMultiplier: 1.25 },
  7: { rate: 32, minAmount: 1000, riskLevel: 'high', riskLabel: 'Yüksek Risk', minMultiplier: 0.6, maxMultiplier: 1.6 }
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api', (req, res) => {
  res.redirect(req.baseUrl || '/');
});

// Veritabanı bağlantısı
const db = new sqlite3.Database(path.join(__dirname, 'game.db'), (err) => {
  if (err) {
    console.error('Veritabanı bağlantı hatası:', err.message);
  } else {
    console.log('Veritabanına bağlandı.');
    initializeDatabase();
  }
});

function clampInteger(value, min, max) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

const ADMIN_USERNAME = 'admin';

function isAdminUsername(username) {
  return String(username || '').trim().toLowerCase() === ADMIN_USERNAME;
}

function isAdminUser(user) {
  return !!user && isAdminUsername(user.username);
}

function calculateRiskedInvestmentReturn(amount, profitRate, riskLevel) {
  const packageConfig = Object.values(INVESTMENT_PACKAGES).find(pkg => pkg.riskLevel === riskLevel) || INVESTMENT_PACKAGES[1];
  const multiplier = packageConfig.minMultiplier + Math.random() * (packageConfig.maxMultiplier - packageConfig.minMultiplier);
  return Math.max(1, Math.floor(amount * (1 + profitRate / 100) * multiplier));
}

function getUserMarketTax(userId, callback) {
  db.get(`SELECT COALESCE(k.market_tax_rate, 0) as market_tax_rate
          FROM users u
          LEFT JOIN kingdoms k ON k.id = u.kingdom_id
          WHERE u.id = ?`, [userId], (err, row) => {
    if (err) return callback(err);
    callback(null, clampInteger(row?.market_tax_rate || 0, 0, 15));
  });
}

function sanitizeAuditValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);

  const redactedKeys = ['password', 'token', 'authorization', 'newPassword', 'oldPassword'];
  return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => {
    if (redactedKeys.includes(key)) return [key, '[REDACTED]'];
    return [key, sanitizeAuditValue(entryValue)];
  }));
}

function getAuditAction(req) {
  const path = req.path.replace(/^\/api/, '') || '/';
  if (path === '/login') return 'auth.login';
  if (path === '/register') return 'auth.register';
  if (path.startsWith('/admin/users')) return 'admin.user_update';
  if (path === '/admin/announcement') return 'admin.announcement';
  if (path === '/admin/audit-logs') return 'admin.audit_view';
  if (path.startsWith('/market/')) return `market.${path.split('/').pop()}`;
  if (path.startsWith('/war/')) return `war.${path.split('/').pop()}`;
  if (path.startsWith('/intrigue/')) return `intrigue.${path.split('/').pop()}`;
  if (path.includes('slave')) return 'slave.market';
  if (path.includes('marriage') || path.includes('proposal') || path.includes('divorce') || path.includes('child')) return 'family';
  if (path.includes('invest')) return 'investment';
  if (path === '/kingdom-policy') return 'kingdom.policy';
  if (path === '/assign-rank' || path === '/assign-king' || path === '/revolt') return 'kingdom.power';
  return `api.${req.method.toLowerCase()}`;
}

function shouldAuditRequest(req) {
  if (!req.path.startsWith('/')) return false;
  if (req.method !== 'GET') return true;
  return req.path.startsWith('/admin/');
}

function auditLogger(req, res, next) {
  if (!shouldAuditRequest(req)) {
    return next();
  }

  const startedAt = Date.now();
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  let tokenUser = null;
  if (token) {
    try {
      tokenUser = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      tokenUser = null;
    }
  }

  res.on('finish', () => {
    const bodyText = JSON.stringify({
      body: sanitizeAuditValue(req.body || {}),
      params: sanitizeAuditValue(req.params || {}),
      query: sanitizeAuditValue(req.query || {}),
      durationMs: Date.now() - startedAt
    }).slice(0, 4000);

    const userId = req.user?.id || tokenUser?.id || null;
    const username = req.user?.username || tokenUser?.username || req.body?.username || null;

    db.run(`INSERT INTO audit_logs
            (user_id, username, action, method, path, status_code, ip_address, user_agent, request_body)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        username,
        getAuditAction(req),
        req.method,
        req.originalUrl,
        res.statusCode,
        req.ip,
        req.get('user-agent') || '',
        bodyText
      ],
      (err) => {
        if (err) console.error('Audit log yazılamadı:', err.message);
      });
  });

  next();
}

// Veritabanı tablolarını oluştur
function initializeDatabase() {
  db.serialize(() => {
    // Krallıklar tablosu
    db.run(`CREATE TABLE IF NOT EXISTS kingdoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      king_id INTEGER,
      tax_rate INTEGER DEFAULT 10,
      market_tax_rate INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (king_id) REFERENCES users(id)
    )`);

    // Kullanıcılar tablosu
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      referral_code TEXT UNIQUE NOT NULL,
      referred_by TEXT,
      master_id INTEGER,
      kingdom_id INTEGER DEFAULT 1,
      rank TEXT DEFAULT 'Vatandaş',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      level INTEGER DEFAULT 1,
      experience INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 100,
      food INTEGER DEFAULT 100,
      material INTEGER DEFAULT 50,
      last_daily_reward DATE,
      gender TEXT,
      children_count INTEGER DEFAULT 0,
      wife_count INTEGER DEFAULT 0,
      FOREIGN KEY (master_id) REFERENCES users(id),
      FOREIGN KEY (kingdom_id) REFERENCES kingdoms(id)
    )`);
    
    // Marriages tablosu
    db.run(`CREATE TABLE IF NOT EXISTS marriages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      husband_id INTEGER NOT NULL,
      wife_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (husband_id) REFERENCES users(id),
      FOREIGN KEY (wife_id) REFERENCES users(id),
      UNIQUE(husband_id, wife_id)
    )`);

    // Binalar tablosu
    db.run(`CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      building_type TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, building_type)
    )`);

    // Araştırmalar tablosu
    db.run(`CREATE TABLE IF NOT EXISTS research (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      research_type TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, research_type)
    )`);

    // Savaşlar tablosu
    db.run(`CREATE TABLE IF NOT EXISTS wars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attacker_kingdom_id INTEGER NOT NULL,
      defender_kingdom_id INTEGER NOT NULL,
      war_start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      war_end_date DATETIME,
      status TEXT DEFAULT 'ongoing', -- 'ongoing', 'finished'
      winner_kingdom_id INTEGER,
      FOREIGN KEY (attacker_kingdom_id) REFERENCES kingdoms(id),
      FOREIGN KEY (defender_kingdom_id) REFERENCES kingdoms(id),
      FOREIGN KEY (winner_kingdom_id) REFERENCES kingdoms(id)
    )`);

    // Evlilik teklifleri tablosu
    db.run(`CREATE TABLE IF NOT EXISTS marriage_proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proposer_id INTEGER NOT NULL,
        proposee_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending', -- pending, accepted, rejected
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proposer_id) REFERENCES users(id),
        FOREIGN KEY (proposee_id) REFERENCES users(id)
    )`);

    // Köle satışları tablosu
    db.run(`CREATE TABLE IF NOT EXISTS slave_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slave_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      price INTEGER NOT NULL,
      kingdom_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sold_at DATETIME,
      buyer_id INTEGER,
      FOREIGN KEY (slave_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (kingdom_id) REFERENCES kingdoms(id)
    )`);

    // Seyahat geçmişi tablosu
    db.run(`CREATE TABLE IF NOT EXISTS travel_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      from_kingdom_id INTEGER,
      to_kingdom_id INTEGER NOT NULL,
      travel_cost INTEGER NOT NULL,
      traveled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (from_kingdom_id) REFERENCES kingdoms(id),
      FOREIGN KEY (to_kingdom_id) REFERENCES kingdoms(id)
    )`);

    // Yatırımlar tablosu
    db.run(`CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      profit_rate REAL NOT NULL,
      duration_days INTEGER NOT NULL,
      invested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      status TEXT DEFAULT 'active',
      total_return INTEGER,
      risk_level TEXT DEFAULT 'low',
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Gelen Kutusu Mesajları tablosu
    db.run(`CREATE TABLE IF NOT EXISTS inbox_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sender_username TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      request_body TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // İlk krallıkları oluştur
    db.get("SELECT COUNT(*) as count FROM kingdoms", (err, row) => {
      if (!err && row && row.count === 0) {
        const kingdoms = [
          { name: 'Babil', description: 'Mezopotamya\'nın kadim krallığı', x: 200, y: 180, king_id: null },
          { name: 'Asur', description: 'Güçlü Asur İmparatorluğu', x: 250, y: 120, king_id: null },
          { name: 'Mısır', description: 'Nil\'in bereketli toprakları', x: 180, y: 300, king_id: null },
          { name: 'Hitit', description: 'Anadolu\'nun güçlü krallığı', x: 120, y: 100, king_id: null },
          { name: 'Sümer', description: 'Uygarlığın beşiği', x: 180, y: 200, king_id: null },
          { name: 'Halep', description: 'Suriye\'nin önemli şehir devleti', x: 100, y: 150, king_id: null },
          { name: 'Mitanni', description: 'Hurri kökenli güçlü krallık', x: 220, y: 140, king_id: null },
          { name: 'Hurri', description: 'Dağlık bölgelerin savaşçı halkı', x: 200, y: 120, king_id: null },
          { name: 'Luvi', description: 'Anadolu\'nun batı halkları', x: 80, y: 120, king_id: null },
          { name: 'Kenan Ülkesi', description: 'Akdeniz kıyılarının bereketli toprakları', x: 50, y: 220, king_id: null },
          { name: 'Truva', description: 'Çanakkale\'nin efsanevi şehri', x: 60, y: 80, king_id: null }
        ];

        kingdoms.forEach(kingdom => {
          db.run(`INSERT INTO kingdoms (name, description, x, y) VALUES (?, ?, ?, ?)`,
            [kingdom.name, kingdom.description, kingdom.x, kingdom.y]);
        });
        console.log('İlk krallıklar oluşturuldu.');
      } else if (!err && row && row.count > 0 && row.count < 11) {
        // Eksik krallıkları ekle (migration)
        const existingKingdoms = [];
        db.all("SELECT name FROM kingdoms", (err, existing) => {
          if (!err && existing) {
            existingKingdoms.push(...existing.map(k => k.name));
            
            const allKingdoms = [
              { name: 'Babil', description: 'Mezopotamya\'nın kadim krallığı', x: 200, y: 180, king_id: null },
              { name: 'Asur', description: 'Güçlü Asur İmparatorluğu', x: 250, y: 120, king_id: null },
              { name: 'Mısır', description: 'Nil\'in bereketli toprakları', x: 180, y: 300, king_id: null },
              { name: 'Hitit', description: 'Anadolu\'nun güçlü krallığı', x: 120, y: 100, king_id: null },
              { name: 'Sümer', description: 'Uygarlığın beşiği', x: 180, y: 200, king_id: null },
              { name: 'Halep', description: 'Suriye\'nin önemli şehir devleti', x: 100, y: 150, king_id: null },
              { name: 'Mitanni', description: 'Hurri kökenli güçlü krallık', x: 220, y: 140, king_id: null },
              { name: 'Hurri', description: 'Dağlık bölgelerin savaşçı halkı', x: 200, y: 120, king_id: null },
              { name: 'Luvi', description: 'Anadolu\'nun batı halkları', x: 80, y: 120, king_id: null },
              { name: 'Kenan Ülkesi', description: 'Akdeniz kıyılarının bereketli toprakları', x: 50, y: 220, king_id: null },
              { name: 'Truva', description: 'Çanakkale\'nin efsanevi şehri', x: 60, y: 80, king_id: null }
            ];

            allKingdoms.forEach(kingdom => {
              if (!existingKingdoms.includes(kingdom.name)) {
                db.run(`INSERT INTO kingdoms (name, description, x, y) VALUES (?, ?, ?, ?)`,
                  [kingdom.name, kingdom.description, kingdom.x, kingdom.y], (err) => {
                    if (!err) {
                      console.log(`Krallık eklendi: ${kingdom.name}`);
                    }
                  });
              }
            });
          }
        });
      }
    });

    // Ülke isimlerindeki "ler" eklerini kaldır (migration)
    db.run(`UPDATE kingdoms SET name = 'Asur' WHERE name = 'Asurlular'`, (err) => {
      if (err) console.error('Asurlular güncelleme hatası:', err);
    });
    db.run(`UPDATE kingdoms SET name = 'Hitit' WHERE name = 'Hititler'`, (err) => {
      if (err) console.error('Hititler güncelleme hatası:', err);
    });
    db.run(`UPDATE kingdoms SET name = 'Mitanni' WHERE name = 'Mitanniler'`, (err) => {
      if (err) console.error('Mitanniler güncelleme hatası:', err);
    });
    db.run(`UPDATE kingdoms SET name = 'Hurri' WHERE name = 'Hurriler'`, (err) => {
      if (err) console.error('Hurriler güncelleme hatası:', err);
    });
    db.run(`UPDATE kingdoms SET name = 'Luvi' WHERE name = 'Luviler'`, (err) => {
      if (err) console.error('Luviler güncelleme hatası:', err);
    });

    db.run(`ALTER TABLE kingdoms ADD COLUMN tax_rate INTEGER DEFAULT 10`, (err) => {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
        console.error('Migration hatası (kingdoms.tax_rate):', err.message);
      }
    });

    db.run(`ALTER TABLE kingdoms ADD COLUMN market_tax_rate INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
        console.error('Migration hatası (kingdoms.market_tax_rate):', err.message);
      }
    });

    // Children tablosu
    db.run(`CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      child_name TEXT NOT NULL,
      child_gender TEXT NOT NULL,
      role TEXT DEFAULT 'Çocuk',
      age INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`ALTER TABLE users ADD COLUMN wife_count INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
            console.error('Migration hatası (wife_count):', err.message);
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN children_count INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
            console.error('Migration hatası (children_count):', err.message);
        }
    });

    db.run(`UPDATE users SET children_count = 0 WHERE children_count IS NULL`, (err) => {
        if (err) console.error('Kullanıcı children_count güncelleme hatası:', err);
    });

    db.run(`ALTER TABLE children ADD COLUMN role TEXT DEFAULT 'Çocuk'`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
            console.error('Migration hatası (children.role):', err.message);
        }
    });

    db.run(`ALTER TABLE children ADD COLUMN age INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
            console.error('Migration hatası (children.age):', err.message);
        }
    });

    db.run(`ALTER TABLE investments ADD COLUMN risk_level TEXT DEFAULT 'low'`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
            console.error('Migration hatası (investments.risk_level):', err.message);
        }
    });

    // Davetler tablosu
    db.run(`CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referral_code TEXT NOT NULL,
      used_by TEXT,
      used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referral_code) REFERENCES users(referral_code)
    )`);

    // Migration: Eksik sütunları ekle (mevcut veritabanları için)
    db.run(`ALTER TABLE users ADD COLUMN kingdom_id INTEGER DEFAULT 1`, (err) => {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
        console.error('Migration hatası (kingdom_id):', err.message);
      }
    });
    
    db.run(`ALTER TABLE users ADD COLUMN rank TEXT DEFAULT 'Vatandaş'`, (err) => {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
        console.error('Migration hatası (rank):', err.message);
      }
    });

    db.run(`ALTER TABLE users ADD COLUMN food INTEGER DEFAULT 100`, (err) => {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
        console.error('Migration hatası (food):', err.message);
      }
    });

    db.run(`ALTER TABLE users ADD COLUMN material INTEGER DEFAULT 50`, (err) => {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
        console.error('Migration hatası (material):', err.message);
      }
    });

    db.run(`ALTER TABLE users ADD COLUMN role TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
            console.error('Migration hatası (role):', err.message);
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN weapons INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
            console.error('Migration hatası (weapons):', err.message);
        }
    });

    // Üretim tablosu
    db.run(`CREATE TABLE IF NOT EXISTS productions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      production_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finish_at DATETIME NOT NULL,
      claimed BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    
    // Mevcut kullanıcıları güncelle
    db.run(`UPDATE users SET kingdom_id = 1 WHERE kingdom_id IS NULL`, (err) => {
      if (err) console.error('Kullanıcı kingdom_id güncelleme hatası:', err);
    });
    
    db.run(`UPDATE users SET rank = 'Vatandaş' WHERE rank IS NULL`, (err) => {
      if (err) console.error('Kullanıcı rank güncelleme hatası:', err);
    });

    db.run(`UPDATE users SET food = 100 WHERE food IS NULL`, (err) => {
      if (err) console.error('Kullanıcı food güncelleme hatası:', err);
    });

    db.run(`UPDATE users SET material = 50 WHERE material IS NULL`, (err) => {
      if (err) console.error('Kullanıcı material güncelleme hatası:', err);
    });
    
    // slave_sales tablosuna kingdom_id ekle
    db.run(`ALTER TABLE slave_sales ADD COLUMN kingdom_id INTEGER DEFAULT 1`, (err) => {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
        console.error('Migration hatası (slave_sales.kingdom_id):', err.message);
      } else {
        // Mevcut satış kayıtlarını güncelle
        db.run(`UPDATE slave_sales SET kingdom_id = (SELECT kingdom_id FROM users WHERE id = slave_sales.seller_id) WHERE kingdom_id IS NULL`, (err) => {
          if (err) console.error('Satış kayıtları kingdom_id güncelleme hatası:', err);
        });
      }
    });

    // İlk admin kullanıcıyı oluştur (referans kodu: ADMIN001)
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
      if (!row) {
        const adminCode = 'ADMIN001';
        db.get("SELECT id FROM kingdoms WHERE name = 'Kenan Ülkesi'", (err, kenanKingdom) => {
          const kingdomId = kenanKingdom ? kenanKingdom.id : 1; // Fallback: 1
          bcrypt.hash('admin123', 10, (err, hash) => {
            if (!err) {
              db.run(`INSERT INTO users (username, password, referral_code, master_id, kingdom_id, rank, gender) 
                      VALUES (?, ?, ?, NULL, ?, 'Vatandaş', 'male')`,
                      ['admin', hash, adminCode, kingdomId], (insertErr) => {
                if (!insertErr) {
                  console.log('Admin kullanıcı oluşturuldu. Referans kodu: ADMIN001');
                }
              });
            }
          });
        });
      } else {
        // Mevcut admin kullanıcısını oyun içi hiyerarşiden çıkar; sadece yönetim hesabı olarak kalsın.
        db.serialize(() => {
          db.run(`UPDATE users
                  SET gender = COALESCE(gender, 'male'),
                      master_id = NULL,
                      rank = 'Vatandaş'
                  WHERE username = 'admin'`);
          db.run(`UPDATE users SET master_id = NULL WHERE master_id = (SELECT id FROM users WHERE username = 'admin')`);
          db.run(`UPDATE kingdoms SET king_id = NULL WHERE king_id = (SELECT id FROM users WHERE username = 'admin')`);
          db.get("SELECT id FROM kingdoms WHERE name = 'Kenan Ülkesi'", (err, kenanKingdom) => {
            if (err) {
              console.error('Admin krallık uyarlama hatası:', err.message);
              return;
            }
            if (kenanKingdom) {
              db.run(`UPDATE users SET kingdom_id = ? WHERE username = 'admin'`, [kenanKingdom.id], (updateErr) => {
                if (!updateErr) {
                  console.log('Admin kullanıcı hazır. Oyun içi etkileşimlerden çıkarıldı.');
                }
              });
            } else {
              console.log('Admin kullanıcı hazır. Oyun içi etkileşimlerden çıkarıldı.');
            }
          });
        });
      }
    });
  });
}

function resetPlayer(userId, callback) {
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    // Reset user stats
    db.run(`UPDATE users 
            SET level = 1, 
                experience = 0, 
                coins = 100, 
                food = 100, 
                material = 50, 
                weapons = 0, 
                master_id = NULL, 
                rank = 'Vatandaş',
                children_count = 0,
                wife_count = 0
            WHERE id = ?`, [userId]);

    // Get all marriages to update wife_count
    db.all("SELECT husband_id FROM marriages WHERE wife_id = ?", [userId], (err, rows) => {
        if (!err && rows) {
            rows.forEach(row => {
                db.run("UPDATE users SET wife_count = wife_count - 1 WHERE id = ?", [row.husband_id]);
            });
        }

        // Delete children
        db.run(`DELETE FROM children WHERE user_id = ?`, [userId]);
        // Also delete children if user is the mother
        db.all("SELECT id FROM marriages WHERE husband_id = ?", [userId], (err, rows) => {
            if (!err && rows) {
                rows.forEach(row => {
                    db.run(`DELETE FROM children WHERE user_id = ?`, [row.id]);
                });
            }
        });


        // Delete marriages
        db.run(`DELETE FROM marriages WHERE husband_id = ? OR wife_id = ?`, [userId, userId]);

        // Delete pending marriage proposals
        db.run(`DELETE FROM marriage_proposals WHERE proposer_id = ? OR proposee_id = ?`, [userId, userId]);
        
        // If the user was a king, remove them from the kingdom
        db.run(`UPDATE kingdoms SET king_id = NULL WHERE king_id = ?`, [userId]);

        db.run("COMMIT", (err) => {
          if (err) {
            db.run("ROLLBACK");
            console.error(`Player reset failed for user ${userId}:`, err);
            if (callback) callback(err);
          } else {
            console.log(`Player ${userId} has been reset.`);
            if (callback) callback(null);
          }
        });
    });
  });
}


// JWT token doğrulama middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token bulunamadı' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Geçersiz token' });
    }
    req.user = user;
    next();
  });
}

app.use('/api', auditLogger);

// API Routes

// Referans kodu ile kayıt
app.post('/api/register', async (req, res) => {
  const { username, password, referralCode, gender } = req.body;

  if (!username || !password || !referralCode || !gender) {
    return res.status(400).json({ error: 'Tüm alanlar doldurulmalı: kullanıcı adı, şifre, referans kodu, cinsiyet' });
  }

  if (gender !== 'male' && gender !== 'female') {
    return res.status(400).json({ error: 'Cinsiyet "male" ya da "female" olmalıdır.' });
  }

  // Referans kodunu kontrol et
  db.get("SELECT * FROM users WHERE referral_code = ?", [referralCode], async (err, referrer) => {
    if (err) {
      return res.status(500).json({ error: 'Veritabanı hatası' });
    }

    if (!referrer) {
      return res.status(400).json({ error: 'Geçersiz referans kodu' });
    }

    // Kullanıcı adı kontrolü
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, existingUser) => {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }

      if (existingUser) {
        return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
      }

      // Şifreyi hashle
      const hashedPassword = await bcrypt.hash(password, 10);
      const newReferansKodu = uuidv4().substring(0, 8).toUpperCase();

      // Referrer'ın kingdom_id'sini al (köle sahibi ile aynı krallıkta başlasın)
      const referrerKingdomId = referrer.kingdom_id || 1;

      // Yeni kullanıcı oluştur (referrer'ın kölesi olarak, aynı krallıkta)
      db.run(`INSERT INTO users (username, password, referral_code, referred_by, master_id, kingdom_id, gender) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [username, hashedPassword, newReferansKodu, referrer.username, referrer.id, referrerKingdomId, gender],
        function(err) {
          if (err) {
            console.error('Kullanıcı oluşturma hatası:', err); // Hata detayını logla
            return res.status(500).json({ error: 'Kullanıcı oluşturulamadı' });
          }

          // Köle sahibine +10 deneyim ver
          db.get("SELECT experience, level FROM users WHERE id = ?", [referrer.id], (err, master) => {
            if (!err && master) {
              const newExperience = (master.experience || 0) + 10;
              const nextLevelExp = master.level * 100;
              let newLevel = master.level;
              
              // Seviye kontrolü
              if (newExperience >= nextLevelExp) {
                newLevel = master.level + 1;
              }

              db.run(`UPDATE users SET experience = ?, level = ? WHERE id = ?`,
                [newExperience, newLevel, referrer.id], (err) => {
                  if (err) {
                    console.error('Köle sahibi deneyim güncellenemedi:', err);
                  }
                });
            }
          });

          // Davet kaydı oluştur
          db.run(`INSERT INTO invitations (referral_code, used_by) VALUES (?, ?)`,
            [referralCode, username], (err) => {
              if (err) {
                console.error('Davet kaydı oluşturulamadı:', err);
              }
            });

          // Token oluştur
          const token = jwt.sign(
            { id: this.lastID, username: username },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          res.json({
            message: 'Kayıt başarılı',
            token: token,
            user: {
              id: this.lastID,
              username: username,
              referralCode: newReferansKodu,
              master: referrer.username
            }
          });
        });
    });
  });
});

// Giriş yap
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
  }

  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Veritabanı hatası' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Giriş başarılı',
      token: token,
      user: {
        id: user.id,
        username: user.username,
        referralCode: user.referral_code,
        level: user.level,
        experience: user.experience,
        coins: user.coins
      }
    });
  });
});

app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(`SELECT u.id, u.username, u.referral_code, u.level, u.experience, u.coins, 
                           u.food, u.material, u.weapons, u.referred_by, u.master_id, u.kingdom_id, 
                           u.rank, u.gender, u.role, u.children_count, u.wife_count,
                           m.username as master_username,
                           k.name as kingdom_name, k.description as kingdom_description,
                           ruled_k.name as ruled_kingdom_name,
                           (SELECT COUNT(*) FROM users WHERE master_id = u.id) as slave_count
                    FROM users u
                    LEFT JOIN users m ON u.master_id = m.id
                    LEFT JOIN kingdoms k ON u.kingdom_id = k.id
                    LEFT JOIN kingdoms ruled_k ON ruled_k.king_id = u.id
                    WHERE u.id = ?`, [req.user.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }

        if (user.gender === 'male') {
            const wives = await new Promise((resolve, reject) => {
                db.all(`SELECT u.id, u.username 
                        FROM marriages m 
                        JOIN users u ON m.wife_id = u.id 
                        WHERE m.husband_id = ?`, [user.id], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            });
            user.wives = wives;
            user.spouse_username = wives.length > 0 ? wives.map(wife => wife.username).join(', ') : null;
        } else { // female
            const husband = await new Promise((resolve, reject) => {
                db.get(`SELECT u.id, u.username 
                       FROM marriages m 
                       JOIN users u ON m.husband_id = u.id 
                       WHERE m.wife_id = ?`, [user.id], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            user.husband = husband;
            user.spouse_username = husband ? husband.username : null;
        }

        res.json(user);

    } catch (err) {
        console.error('Error fetching user data:', err);
        res.status(500).json({ error: 'Veritabanı hatası' });
    }
});

// Komut çalıştır
app.post('/api/command', authenticateToken, (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Komut gerekli' });
  }

  const cmd = command.trim().toLowerCase();
  const parts = cmd.split(' ');

  // Komutları işle
  switch (parts[0]) {
    case 'help':
      res.json({
        output: `Mevcut Komutlar:
- help: Bu yardım mesajını gösterir
- stats: Karakter istatistiklerini gösterir
- referral: Referans kodunu gösterir
- daily: Günlük ödülünü al (köleler için)
- slaves: Sahip olduğun köleleri listele
- masters: Köle sahiplerini göster (hiyerarşi)
- work: Çalış ve para kazan
- level: Seviye bilgilerini gösterir
- clear: Ekranı temizle`
      });
      break;

    case 'stats':
      db.get(`SELECT u.*, m.username as master_username,
              (SELECT COUNT(*) FROM users WHERE master_id = u.id) as slave_count
              FROM users u
              LEFT JOIN users m ON u.master_id = m.id
              WHERE u.id = ?`, [req.user.id], (err, user) => {
        if (err || !user) {
          return res.status(500).json({ error: 'Kullanıcı bilgileri alınamadı' });
        }
        res.json({
          output: `=== KARAKTER İSTATİSTİKLERİ ===
Kullanıcı Adı: ${user.username}
Seviye: ${user.level}
Deneyim: ${user.experience} / ${user.level * 100}
Altın: ${user.coins}
Referans Kodu: ${user.referral_code}
Köle Sahibi: ${user.master_username || 'Yok (Özgürsün)'}
Sahip Olduğun Köleler: ${user.slave_count || 0}`
        });
      });
      break;

    case 'referral':
      db.get(`SELECT u.referral_code, 
              (SELECT COUNT(*) FROM users WHERE master_id = u.id) as slave_count
              FROM users u WHERE u.id = ?`, [req.user.id], (err, user) => {
        if (err || !user) {
          return res.status(500).json({ error: 'Kullanıcı bilgileri alınamadı' });
        }
        const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
        const proto = forwardedProto || req.protocol || 'http';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
        const basePath = req.baseUrl || (req.originalUrl.startsWith('/games/kenan/play') ? '/games/kenan/play' : '');
        const inviteLink = `${proto}://${host}${basePath || ''}/?ref=${encodeURIComponent(user.referral_code)}`;
        res.json({
          output: `=== REFERANS BİLGİLERİ ===
Referans Kodunuz: ${user.referral_code}
Davet Linkiniz: ${inviteLink}
Mevcut Köle Sayınız: ${user.slave_count || 0}

Bu kodu veya linki paylaşarak başkalarını oyuna davet edebilirsiniz.
Davet ettiğiniz kişiler sizin köleniz olacak ve onlar günlük ödül aldıkça siz de kazanacaksınız!`
        });
      });
      break;

    case 'work':
      db.get("SELECT * FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err || !user) {
          return res.status(500).json({ error: 'Kullanıcı bilgileri alınamadı' });
        }

        const earned = Math.floor(Math.random() * 50) + 10;
        const expGained = Math.floor(Math.random() * 10) + 5;
        const newCoins = user.coins + earned;
        const newExp = user.experience + expGained;
        
        let newLevel = user.level;
        if (newExp >= newLevel * 100) {
          newLevel++;
        }

        db.run(`UPDATE users SET coins = ?, experience = ?, level = ? WHERE id = ?`,
          [newCoins, newExp, newLevel, req.user.id], (err) => {
            if (err) {
              return res.status(500).json({ error: 'Güncelleme hatası' });
            }

            let levelUpMsg = '';
            if (newLevel > user.level) {
              levelUpMsg = `\n🎉 TEBRİKLER! Seviye ${newLevel}'e yükseldiniz!`;
            }

            res.json({
              output: `Çalıştınız ve ${earned} altın kazandınız!
${expGained} deneyim puanı kazandınız.${levelUpMsg}
Yeni bakiyeniz: ${newCoins} altın`
            });
          });
      });
      break;

    case 'level':
      db.get("SELECT level, experience FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err || !user) {
          return res.status(500).json({ error: 'Kullanıcı bilgileri alınamadı' });
        }
        const nextLevelExp = user.level * 100;
        const remaining = nextLevelExp - user.experience;
        res.json({
          output: `Seviye: ${user.level}
Deneyim: ${user.experience} / ${nextLevelExp}
Bir sonraki seviyeye: ${remaining} deneyim puanı kaldı`
        });
      });
      break;

    case 'daily':
      db.get(`SELECT u.*, 
              (SELECT COUNT(*) FROM users WHERE master_id = u.id) as slave_count,
              (SELECT COUNT(*) FROM users WHERE master_id = u.id AND role = 'farmer') as farmer_slave_count,
              (SELECT COUNT(*) FROM children WHERE user_id = u.id) as children_count
              FROM users u WHERE u.id = ?`, [req.user.id], async (err, user) => {
        if (err || !user) {
          return res.status(500).json({ error: 'Kullanıcı bilgileri alınamadı' });
        }

        const today = new Date().toISOString().split('T')[0];
        const lastReward = user.last_daily_reward;

        if (lastReward === today) {
          return res.json({
            output: 'Bugün zaten günlük ödülünü aldın! Yarın tekrar dene.'
          });
        }
        
        // Günlük yiyecek tüketimi
        const childrenFoodCost = (user.children_count || 0) * 5;
        const totalFoodCost = 5 + childrenFoodCost;
        const newFood = user.food - totalFoodCost;

        if (newFood <= 0) {
            resetPlayer(req.user.id, () => {
                return res.json({
                    output: `Yiyeceğin bittiği için öldün! (${totalFoodCost} yiyecek tüketildi). Tüm ilerlemen sıfırlandı.`
                });
            });
            return;
        }

        const slaveCount = user.slave_count || 0;
        const farmerSlaveCount = user.farmer_slave_count || 0;
        const childrenCount = user.children_count || 0;
        
        let isMarried = false;
        if (user.gender === 'male') {
            const wives = await new Promise((resolve, reject) => {
                db.all("SELECT id FROM marriages WHERE husband_id = ?", [user.id], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            });
            isMarried = wives.length > 0;
            user.wife_count = wives.length;
        } else {
            const husband = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM marriages WHERE wife_id = ?", [user.id], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            isMarried = !!husband;
        }

        let dailyReward;
        let rewardMessage;
        
        const marriageBonus = user.gender === 'male' ? Math.min((user.wife_count || 0) * 100, 300) : (isMarried ? 100 : 0);
        const childrenBonus = Math.min(childrenCount * 5, 250);

        if (user.master_id) {
          // Köle günlük ödülü
          dailyReward = Math.floor(Math.random() * 51) + 50 + marriageBonus + childrenBonus;
          let bonusDetails = [];
          if (marriageBonus > 0) bonusDetails.push(`${marriageBonus} altın (evlilik bonusu)`);
          if (childrenBonus > 0) bonusDetails.push(`${childrenBonus} altın (${childrenCount} çocuk bonusu)`);
          rewardMessage = `Köle olarak günlük ödülünü aldın! ${dailyReward - marriageBonus - childrenBonus} altın (temel) ${bonusDetails.length > 0 ? '+ ' + bonusDetails.join(' + ') : ''} = ${dailyReward} altın kazandın.`;
        } else {
          // Sahip günlük ödülü
          const baseReward = Math.floor(Math.random() * 51) + 100;
          const slaveBonus = slaveCount > 0 ? Math.min(slaveCount * (Math.floor(Math.random() * 16) + 20), 500) : 0;
          const farmerBonus = farmerSlaveCount > 0 ? Math.min(farmerSlaveCount * 15, 300) : 0; // Her çiftçi için 15 altın
          dailyReward = baseReward + slaveBonus + farmerBonus + marriageBonus + childrenBonus;
          
          let bonusDetails = [];
          if (slaveBonus > 0) bonusDetails.push(`${slaveBonus} altın (${slaveCount} köle bonusu)`);
          if (farmerBonus > 0) bonusDetails.push(`${farmerBonus} altın (${farmerSlaveCount} çiftçi bonusu)`);
          if (marriageBonus > 0) bonusDetails.push(`${marriageBonus} altın (evlilik bonusu)`);
          if (childrenBonus > 0) bonusDetails.push(`${childrenBonus} altın (${childrenCount} çocuk bonusu)`);

          if (bonusDetails.length > 0) {
            rewardMessage = `Sahip olarak günlük ödülünü aldın! ${baseReward} altın (temel) + ${bonusDetails.join(' + ')} = ${dailyReward} altın kazandın.`;
          } else {
            rewardMessage = `Günlük ödülünü aldın! ${dailyReward} altın kazandın.`;
          }
        }
        
        rewardMessage += `\nGünlük tüketim: ${totalFoodCost} yiyecek.`;

        const newCoins = user.coins + dailyReward;

        db.run(`UPDATE users SET coins = ?, food = ?, last_daily_reward = ? WHERE id = ?`,
          [newCoins, newFood, today, req.user.id], (err) => {
            if (err) {
              return res.status(500).json({ error: 'Güncelleme hatası' });
            }

            // Köle sahibine de ödül ver
            if (user.master_id) {
              db.get("SELECT coins FROM users WHERE id = ?", [user.master_id], (err, master) => {
                if (!err && master) {
                  const masterReward = Math.floor(Math.random() * 11) + 10;
                  const newMasterCoins = master.coins + masterReward;
                  db.run(`UPDATE users SET coins = ? WHERE id = ?`,
                    [newMasterCoins, user.master_id], (err) => {
                      if (err) {
                        console.error('Sahip ödülü güncellenemedi:', err);
                      }
                    });
                }
              });
            }

            // Kral ve Vezir vergisi
            const kingdomId = user.kingdom_id || 1;
            db.get(`SELECT k.king_id, COALESCE(k.tax_rate, 10) as tax_rate, u.username as king_username 
                    FROM kingdoms k 
                    LEFT JOIN users u ON k.king_id = u.id 
                    WHERE k.id = ?`, [kingdomId], (err, kingdom) => {
              
              db.get(`SELECT id, username FROM users WHERE kingdom_id = ? AND rank = 'Vezir'`, [kingdomId], (err, vezir) => {
                let taxedCoins = newCoins;
                let taxMessages = [];

                // Kral vergisi
                if (!err && kingdom && kingdom.king_id && kingdom.king_id !== req.user.id) {
                  const kingTaxRate = clampInteger(kingdom.tax_rate, 0, 25);
                  const kingTax = Math.min(Math.floor(dailyReward * kingTaxRate / 100), 1000);
                  if (kingTax > 0 && taxedCoins >= kingTax) {
                    taxedCoins -= kingTax;
                    taxMessages.push(`Kral ${kingdom.king_username} tarafından %${kingTaxRate} vergi (${kingTax} altın) alındı.`);
                    db.get("SELECT coins FROM users WHERE id = ?", [kingdom.king_id], (err, king) => {
                      if (!err && king) {
                        const newKingCoins = king.coins + kingTax;
                        db.run(`UPDATE users SET coins = ? WHERE id = ?`, [newKingCoins, kingdom.king_id]);
                      }
                    });
                  }
                }

                // Vezir vergisi
                if (!err && vezir && vezir.id !== req.user.id) {
                  const vezirTax = Math.floor(Math.min(dailyReward * 0.03, 250));
                  if (vezirTax > 0 && taxedCoins >= vezirTax) {
                    taxedCoins -= vezirTax;
                    taxMessages.push(`Vezir ${vezir.username} tarafından ${vezirTax} altın vergi alındı.`);
                    db.get("SELECT coins FROM users WHERE id = ?", [vezir.id], (err, v) => {
                      if (!err && v) {
                        const newVezirCoins = v.coins + vezirTax;
                        db.run(`UPDATE users SET coins = ? WHERE id = ?`, [newVezirCoins, vezir.id]);
                      }
                    });
                  }
                }

                // Kullanıcının parasını güncelle
                db.run(`UPDATE users SET coins = ? WHERE id = ?`, [taxedCoins, req.user.id], (err) => {
                  if (err) {
                    // Hata durumunda bile en azından temel ödül mesajını gönder
                    res.json({
                      output: `${rewardMessage}\nYeni bakiyeniz: ${newCoins} altın\n${user.master_id ? '(Sahibin de köle başına ödül aldı!)' : ''}`
                    });
                    return;
                  }
                  
                  let finalMessage = `${rewardMessage}\n${taxMessages.join('\n')}`;
                  finalMessage += `\nYeni bakiyeniz: ${taxedCoins} altın\n${user.master_id ? '(Sahibin de köle başına ödül aldı!)' : ''}`;

                  res.json({
                    output: finalMessage
                  });
                });
              });
            });
          });
      });
      break;

    case 'slaves':
      db.all(`SELECT u.id, u.username, u.level, u.coins, u.food, u.material, u.created_at,
              (SELECT COUNT(*) FROM users sub WHERE sub.master_id = u.id) as sub_slaves
              FROM users u WHERE u.master_id = ? ORDER BY u.created_at DESC`,
        [req.user.id], (err, slaves) => {
          if (err) {
            return res.status(500).json({ error: 'Veritabanı hatası' });
          }

          if (slaves.length === 0) {
            return res.json({
              output: 'Henüz hiç kölen yok. Referans kodunu paylaşarak köle kazan!'
            });
          }

          // Tüm kölelerin alt kölelerini al
          const slaveIds = slaves.map(s => s.id);
          const placeholders = slaveIds.map(() => '?').join(',');

          db.all(`SELECT id, username, level, coins, master_id FROM users 
                  WHERE master_id IN (${placeholders}) ORDER BY master_id, created_at DESC`,
            slaveIds, (err, allSubSlaves) => {
              if (err) {
                return res.status(500).json({ error: 'Veritabanı hatası' });
              }

              // Alt köleleri master_id'ye göre grupla
              const subSlavesByMaster = {};
              if (allSubSlaves) {
                allSubSlaves.forEach(subSlave => {
                  if (!subSlavesByMaster[subSlave.master_id]) {
                    subSlavesByMaster[subSlave.master_id] = [];
                  }
                  subSlavesByMaster[subSlave.master_id].push(subSlave);
                });
              }

              let output = `=== SAHİP OLDUĞUN KÖLELER (${slaves.length}) ===\n\n`;
              slaves.forEach((slave, index) => {
                output += `${index + 1}. ${slave.username}\n`;
                output += `   Seviye: ${slave.level}\n`;
                output += `   Altın: ${slave.coins || 0} altın\n`;
                output += `   Gıda: ${slave.food || 0}\n`;
                output += `   Malzeme: ${slave.material || 0}\n`;
                output += `   Alt köleleri: ${slave.sub_slaves || 0}\n`;

                // Alt köleleri göster
                const subSlaves = subSlavesByMaster[slave.id] || [];
                if (subSlaves.length > 0) {
                  output += `   └─ Alt Köleler:\n`;
                  subSlaves.forEach((subSlave, subIndex) => {
                    output += `      ${subIndex + 1}. ${subSlave.username} (Seviye: ${subSlave.level}, Altın: ${subSlave.coins || 0})\n`;
                  });
                }
                output += `\n`;
              });

              output += `Toplam köle sayısı: ${slaves.length}`;
              res.json({ output });
            });
        });
      break;

    case 'masters':
      // Hiyerarşik yapıyı göster (yukarı doğru)
      const masters = [];
      let currentUserId = req.user.id;
      const visited = new Set();
      const maxDepth = 100; // Sonsuz döngü koruması

      function getMasters(callback) {
        if (visited.has(currentUserId) || masters.length >= maxDepth) {
          return callback();
        }
        visited.add(currentUserId);

        db.get(`SELECT u.id, u.username, u.master_id, m.username as master_username
                FROM users u
                LEFT JOIN users m ON u.master_id = m.id
                WHERE u.id = ?`, [currentUserId], (err, user) => {
          if (err || !user) {
            return callback();
          }

          if (user.master_username && user.master_id) {
            masters.push({ username: user.master_username, id: user.master_id });
            currentUserId = user.master_id;
            getMasters(callback);
          } else {
            callback();
          }
        });
      }

      getMasters(() => {
        if (masters.length === 0) {
          return res.json({
            output: 'Köle sahibin yok. Özgürsün!'
          });
        }

        let output = '=== KÖLE SAHİPLERİN (HİYERARŞİ) ===\n';
        masters.forEach((master, index) => {
          const level = index + 1;
          const indent = '  '.repeat(level - 1);
          output += `${indent}${level}. ${master.username}\n`;
        });
        output += `\nToplam seviye: ${masters.length}`;

        res.json({ output });
      });
      break;

    case 'clear':
      res.json({ output: 'clear' });
      break;

    default:
      res.json({
        output: `Bilinmeyen komut: ${parts[0]}
'help' yazarak mevcut komutları görebilirsiniz.`
      });
  }
});

// Köle özgürlük satın alma
app.post('/api/buy-freedom', authenticateToken, (req, res) => {
  db.get(`SELECT u.id, u.username, u.coins, u.level, u.master_id, m.username as master_username, m.id as master_id_val
          FROM users u
          LEFT JOIN users m ON u.master_id = m.id
          WHERE u.id = ?`, [req.user.id], (err, slave) => {
    if (err) {
      return res.status(500).json({ error: 'Veritabanı hatası' });
    }

    if (!slave) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    if (!slave.master_id) {
      return res.status(400).json({ error: 'Zaten özgürsünüz!' });
    }

    // Özgürlük bedeli: Seviye * 5000 altın
    const freedomPrice = slave.level * 5000;

    if (slave.coins < freedomPrice) {
      return res.status(400).json({ 
        error: `Yeterli altınınız yok! Özgürlük bedeli: ${freedomPrice} altın, Mevcut altınınız: ${slave.coins} altın` 
      });
    }

    // Kölenin alt köleleri, hiyerarşide bir üst sahibine devredilir.
    const newSlaveCoins = slave.coins - freedomPrice;

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run(`UPDATE users SET master_id = ? WHERE master_id = ?`, [slave.master_id_val, req.user.id], (reparentErr) => {
        if (reparentErr) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Alt köleler devredilemedi' });
        }

        db.run(`UPDATE users SET coins = ?, master_id = NULL WHERE id = ?`, [newSlaveCoins, req.user.id], (freeErr) => {
          if (freeErr) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Güncelleme hatası' });
          }

          db.run(`UPDATE users SET coins = coins + ? WHERE id = ?`, [freedomPrice, slave.master_id_val], (masterErr) => {
            if (masterErr) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Sahip altın güncellenemedi' });
            }

            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Özgürlük işlemi tamamlanamadı' });
              }
              res.json({
                message: 'Tebrikler! Özgürlüğünü satın aldın! Alt kölelerin eski sahibine devredildi.',
                newBalance: newSlaveCoins,
                paidAmount: freedomPrice,
                newMasterIdForSubSlaves: slave.master_id_val
              });
            });
          });
        });
      });
    });
  });
});

// Köle pazarı - Satışta olan köleleri listele
app.get('/api/slave-market', authenticateToken, (req, res) => {
  // Kullanıcının kölelerini getir (sahip olanlar satabilir)
  db.all(`SELECT u.id, u.username, u.level, u.coins, u.food, u.material, u.created_at,
          (SELECT COUNT(*) FROM users sub WHERE sub.master_id = u.id) as sub_slaves
          FROM users u
          WHERE u.master_id = ?
          ORDER BY u.level DESC, u.created_at DESC`,
    [req.user.id], (err, mySlaves) => {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }

      // Satışta olan köleleri getir (başkalarının satışa çıkardığı)
      db.all(`SELECT s.id, s.slave_id, s.seller_id, s.price, s.created_at,
              u.username as slave_username, u.level as slave_level,
              seller.username as seller_username
              FROM slave_sales s
              JOIN users u ON s.slave_id = u.id
              JOIN users seller ON s.seller_id = seller.id
              WHERE s.buyer_id IS NULL
              ORDER BY s.created_at DESC`,
        (err, marketSlaves) => {
          if (err) {
            return res.status(500).json({ error: 'Veritabanı hatası' });
          }

          res.json({
            mySlaves: mySlaves || [],
            marketSlaves: marketSlaves || []
          });
        });
    });
});

// Köle satın al (pazardan)
app.post('/api/buy-slave', authenticateToken, (req, res) => {
  const { saleId } = req.body;

  if (!saleId) {
    return res.status(400).json({ error: 'Satış ID gerekli' });
  }

  // Satış kaydını getir
  db.get(`SELECT s.id, s.slave_id, s.seller_id, s.price,
          u.username as slave_username, u.level as slave_level
          FROM slave_sales s
          JOIN users u ON s.slave_id = u.id
          WHERE s.id = ? AND s.buyer_id IS NULL`,
    [saleId], (err, sale) => {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }

      if (!sale) {
        return res.status(404).json({ error: 'Satış bulunamadı veya zaten satıldı' });
      }

      // Kendi köleni satın alamazsın
      if (sale.seller_id === req.user.id) {
        return res.status(400).json({ error: 'Kendi kölenizi satın alamazsınız' });
      }
      if (isAdminUsername(sale.slave_username)) {
        return res.status(400).json({ error: 'Admin hesabı satın alınamaz.' });
      }

      // Alıcının yeterli altını var mı?
      db.get("SELECT coins FROM users WHERE id = ?", [req.user.id], (err, buyer) => {
        if (err || !buyer) {
          return res.status(500).json({ error: 'Alıcı bulunamadı' });
        }
        if (isAdminUsername(req.user.username)) {
          return res.status(400).json({ error: 'Admin hesabı oyun içi etkileşimlerden muaftır.' });
        }

        if (buyer.coins < sale.price) {
          return res.status(400).json({ error: 'Yeterli altınınız yok' });
        }

        // Alıcının altınını azalt
        const newBuyerCoins = buyer.coins - sale.price;
        db.run(`UPDATE users SET coins = ? WHERE id = ?`,
          [newBuyerCoins, req.user.id], (err) => {
            if (err) {
              return res.status(500).json({ error: 'Alıcı güncelleme hatası' });
            }

            // Satıcının altınını artır
            db.get("SELECT coins FROM users WHERE id = ?", [sale.seller_id], (err, seller) => {
              if (!err && seller) {
                const newSellerCoins = seller.coins + sale.price;
                db.run(`UPDATE users SET coins = ? WHERE id = ?`,
                  [newSellerCoins, sale.seller_id], (err) => {
                    if (err) {
                      console.error('Satıcı güncelleme hatası:', err);
                    }
                  });
              }
            });

            // Kölenin sahibini değiştir
            db.run(`UPDATE users SET master_id = ? WHERE id = ?`,
              [req.user.id, sale.slave_id], (err) => {
                if (err) {
                  return res.status(500).json({ error: 'Köle sahibi güncelleme hatası' });
                }

                // Satış kaydını güncelle
                db.run(`UPDATE slave_sales SET buyer_id = ?, sold_at = CURRENT_TIMESTAMP WHERE id = ?`,
                  [req.user.id, saleId], (err) => {
                    if (err) {
                      console.error('Satış kaydı güncelleme hatası:', err);
                    }
                  });

                res.json({
                  message: `Köle başarıyla satın alındı!`,
                  slave: {
                    id: sale.slave_id,
                    username: sale.slave_username,
                    level: sale.slave_level
                  },
                  newBalance: newBuyerCoins
                });
              });
          });
      });
    });
});

// Özgürlük satın alma bilgilerini getir
app.get('/api/buy-freedom-info', authenticateToken, (req, res) => {
  db.get(`SELECT u.id, u.username, u.coins, u.level, u.master_id, m.username as master_username
          FROM users u
          LEFT JOIN users m ON u.master_id = m.id
          WHERE u.id = ?`, [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Veritabanı hatası' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    if (isAdminUser(user)) {
      return res.status(400).json({ error: 'Admin hesabı özgürleştirilecek bir köle değildir.' });
    }

    const freedomPrice = user.level * 5000;
    const canAfford = user.coins >= freedomPrice;

    res.json({
      isSlave: !!user.master_id,
      masterUsername: user.master_username,
      currentCoins: user.coins,
      freedomPrice: freedomPrice,
      canAfford: canAfford,
      level: user.level
    });
  });
});

// Krallıkları listele
app.get('/api/kingdoms', authenticateToken, (req, res) => {
  db.all(`SELECT k.id, k.name, k.description, k.x, k.y, k.king_id,
          u.username as king_name,
          (SELECT COUNT(*) FROM users WHERE kingdom_id = k.id) as population
          FROM kingdoms k
          LEFT JOIN users u ON k.king_id = u.id
          ORDER BY k.name`, (err, kingdoms) => {
    if (err) {
      return res.status(500).json({ error: 'Veritabanı hatası' });
    }
    res.json(kingdoms || []);
  });
});

// Harita bilgilerini getir
app.get('/api/map', authenticateToken, (req, res) => {
  db.get(`SELECT u.kingdom_id, k.name as current_kingdom FROM users u
          LEFT JOIN kingdoms k ON u.kingdom_id = k.id
          WHERE u.id = ?`, [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Veritabanı hatası' });
    }

    db.all(`SELECT k.id, k.name, k.description, k.x, k.y, k.king_id,
            u.username as king_name,
            (SELECT COUNT(*) FROM users WHERE kingdom_id = k.id) as population
            FROM kingdoms k
            LEFT JOIN users u ON k.king_id = u.id
            ORDER BY k.name`, (err, kingdoms) => {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }

      res.json({
        currentKingdom: user ? user.current_kingdom : null,
        kingdoms: kingdoms || []
      });
    });
  });
});

// Krallıklar arası seyahat
app.post('/api/travel', authenticateToken, (req, res) => {
  const { kingdomId } = req.body;

  if (!kingdomId) {
    return res.status(400).json({ error: 'Krallık ID gerekli' });
  }

  db.get(`SELECT u.id, u.coins, u.kingdom_id, k.name as current_kingdom
          FROM users u
          LEFT JOIN kingdoms k ON u.kingdom_id = k.id
          WHERE u.id = ?`, [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'Kullanıcı bulunamadı' });
    }
    if (isAdminUser(user)) {
      return res.status(400).json({ error: 'Admin hesabı seyahat edemez.' });
    }

    if (user.kingdom_id === kingdomId) {
      return res.status(400).json({ error: 'Zaten bu krallıktasınız' });
    }

    // Hedef krallığı kontrol et
    db.get("SELECT id, name FROM kingdoms WHERE id = ?", [kingdomId], (err, targetKingdom) => {
      if (err || !targetKingdom) {
        return res.status(404).json({ error: 'Krallık bulunamadı' });
      }

      // Seyahat maliyeti: 100 altın (sabit) + kral giriş ücreti (10 altın)
      const baseTravelCost = 100;
      const entryFee = 10; // Krala ödenecek giriş ücreti
      
      // Hedef krallığın kralını kontrol et
      db.get(`SELECT k.king_id, u.username as king_username 
              FROM kingdoms k 
              LEFT JOIN users u ON k.king_id = u.id 
              WHERE k.id = ?`, [kingdomId], (err, targetKingdomInfo) => {
        if (err) {
          return res.status(500).json({ error: 'Krallık bilgisi alınamadı' });
        }

        const totalTravelCost = baseTravelCost + (targetKingdomInfo && targetKingdomInfo.king_id ? entryFee : 0);

        if (user.coins < totalTravelCost) {
          return res.status(400).json({ 
            error: `Yeterli altınınız yok! Seyahat maliyeti: ${totalTravelCost} altın (100 seyahat + ${entryFee} giriş ücreti), Mevcut: ${user.coins} altın` 
          });
        }

        const newCoins = user.coins - totalTravelCost;

        // Kullanıcının krallığını güncelle
        db.run(`UPDATE users SET kingdom_id = ?, coins = ? WHERE id = ?`,
          [kingdomId, newCoins, req.user.id], (err) => {
            if (err) {
              return res.status(500).json({ error: 'Güncelleme hatası' });
            }

            // Krala giriş ücreti öde (varsa)
            if (targetKingdomInfo && targetKingdomInfo.king_id) {
              db.get("SELECT coins FROM users WHERE id = ?", [targetKingdomInfo.king_id], (err, king) => {
                if (!err && king) {
                  const newKingCoins = king.coins + entryFee;
                  db.run(`UPDATE users SET coins = ? WHERE id = ?`, [newKingCoins, targetKingdomInfo.king_id], (err) => {
                    if (err) {
                      console.error('Kral giriş ücreti güncellenemedi:', err);
                    }
                  });
                }
              });
            }

            // Seyahat geçmişine ekle
            db.run(`INSERT INTO travel_history (user_id, from_kingdom_id, to_kingdom_id, travel_cost) 
                    VALUES (?, ?, ?, ?)`,
              [req.user.id, user.kingdom_id || 1, kingdomId, totalTravelCost], (err) => {
                if (err) {
                  console.error('Seyahat geçmişi kaydedilemedi:', err);
                }
              });

            const message = targetKingdomInfo && targetKingdomInfo.king_id 
              ? `${targetKingdom.name} krallığına seyahat ettiniz! Kral ${targetKingdomInfo.king_username}'a ${entryFee} altın giriş ücreti ödendi.`
              : `${targetKingdom.name} krallığına seyahat ettiniz!`;

            res.json({
              message: message,
              newKingdom: targetKingdom.name,
              travelCost: totalTravelCost,
              newBalance: newCoins
            });
          });
      });
    });
  });
});

// Krallık bazlı köle pazarı
app.get('/api/kingdom-slave-market', authenticateToken, (req, res) => {
  db.get(`SELECT u.kingdom_id, k.name as kingdom_name 
          FROM users u
          LEFT JOIN kingdoms k ON u.kingdom_id = k.id
          WHERE u.id = ?`, [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'Kullanıcı bulunamadı' });
    }

    const kingdomId = user.kingdom_id || 1;
    const kingdomName = user.kingdom_name || 'Bilinmeyen Krallık';

    // Kullanıcının kölelerini getir (aynı krallıkta)
    db.all(`SELECT u.id, u.username, u.level, u.coins, u.food, u.material, u.created_at,
            (SELECT COUNT(*) FROM users sub WHERE sub.master_id = u.id) as sub_slaves
            FROM users u
            WHERE u.master_id = ? AND u.kingdom_id = ?
            ORDER BY u.created_at DESC`,
      [req.user.id, kingdomId], (err, mySlaves) => {
        if (err) {
          return res.status(500).json({ error: 'Veritabanı hatası' });
        }

        // Bu krallıktaki satışta olan köleleri getir
        db.all(`SELECT s.id, s.slave_id, s.seller_id, s.price, s.created_at,
                u.username as slave_username, u.level as slave_level,
                seller.username as seller_username
                FROM slave_sales s
                JOIN users u ON s.slave_id = u.id
                JOIN users seller ON s.seller_id = seller.id
                WHERE s.buyer_id IS NULL AND s.kingdom_id = ?
                ORDER BY s.created_at DESC`,
          [kingdomId], (err, marketSlaves) => {
            if (err) {
              return res.status(500).json({ error: 'Veritabanı hatası' });
            }

            res.json({
              kingdomId: kingdomId,
              kingdomName: kingdomName,
              mySlaves: mySlaves || [],
              marketSlaves: marketSlaves || []
            });
          });
      });
  });
});

// Köle satışa çıkar (krallık bazlı)
app.post('/api/sell-slave', authenticateToken, (req, res) => {
  const { slaveId, price } = req.body;

  if (!slaveId || !price || price < 1) {
    return res.status(400).json({ error: 'Geçersiz parametreler' });
  }

  // Kölenin gerçekten bu kullanıcıya ait olduğunu ve aynı krallıkta olduğunu kontrol et
  db.get(`SELECT u.id, u.username, u.level, u.kingdom_id FROM users u
          WHERE u.id = ? AND u.master_id = ?`,
    [slaveId, req.user.id], (err, slave) => {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }

      if (!slave) {
        return res.status(404).json({ error: 'Köle bulunamadı veya size ait değil' });
      }
      if (isAdminUsername(slave.username)) {
        return res.status(400).json({ error: 'Admin hesabı satışa çıkarılamaz.' });
      }

      // Kullanıcının krallığını kontrol et
      db.get("SELECT kingdom_id FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err || !user) {
          return res.status(500).json({ error: 'Kullanıcı bulunamadı' });
        }
        if (isAdminUsername(req.user.username)) {
          return res.status(400).json({ error: 'Admin hesabı oyun içi etkileşimlerden muaftır.' });
        }

        const slaveKingdomId = slave.kingdom_id || 1;
        const userKingdomId = user.kingdom_id || 1;
        if (slaveKingdomId !== userKingdomId) {
          return res.status(400).json({ error: 'Köle farklı bir krallıkta, önce seyahat etmelisiniz' });
        }

        // Zaten satışta mı kontrol et
        db.get(`SELECT id FROM slave_sales WHERE slave_id = ? AND buyer_id IS NULL`,
          [slaveId], (err, existingSale) => {
            if (err) {
              return res.status(500).json({ error: 'Veritabanı hatası' });
            }

            if (existingSale) {
              return res.status(400).json({ error: 'Bu köle zaten satışta' });
            }

            // Satış kaydı oluştur
            db.run(`INSERT INTO slave_sales (slave_id, seller_id, price, kingdom_id) VALUES (?, ?, ?, ?)`,
              [slaveId, req.user.id, price, user.kingdom_id || 1], function(err) {
                if (err) {
                  return res.status(500).json({ error: 'Satış kaydı oluşturulamadı' });
                }

                res.json({
                  message: 'Köle satışa çıkarıldı',
                  slave: {
                    id: slave.id,
                    username: slave.username,
                    level: slave.level,
                    price: price
                  }
                });
              });
          });
      });
    });
});

app.post('/api/cancel-slave-sale', authenticateToken, (req, res) => {
  const { saleId } = req.body;

  if (!saleId) {
    return res.status(400).json({ error: 'Satış ID gerekli' });
  }

  db.get(`SELECT id FROM slave_sales WHERE id = ? AND seller_id = ? AND buyer_id IS NULL`,
    [saleId, req.user.id], (err, sale) => {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }

      if (isAdminUsername(req.user.username)) {
        return res.status(400).json({ error: 'Admin hesabı oyun içi etkileşimlerden muaftır.' });
      }

      if (!sale) {
        return res.status(404).json({ error: 'Satış bulunamadı veya size ait değil' });
      }

      db.run(`DELETE FROM slave_sales WHERE id = ?`, [saleId], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Satış kaldırılamadı' });
        }

        res.json({ message: 'Köle satıştan kaldırıldı' });
      });
    });
});

// Rütbe hiyerarşisi
const RANK_HIERARCHY = {
  'Kral': 5,
  'Vezir': 4,
  'Komutan': 3,
  'Asilzade': 2,
  'Vatandaş': 1
};

// Rütbe atama yetkisi kontrolü
function canAssignRank(assignerRank, targetRank) {
  const assignerLevel = RANK_HIERARCHY[assignerRank] || 0;
  const targetLevel = RANK_HIERARCHY[targetRank] || 0;
  return assignerLevel > targetLevel;
}

// Entrika Endpoint'leri

// Hırsızlık
app.post('/api/intrigue/steal', authenticateToken, (req, res) => {
    const { targetUsername } = req.body;
    const attackerId = req.user.id;

    if (!targetUsername) {
        return res.status(400).json({ message: 'Hedef kullanıcı adı gerekli.' });
    }

    const stealCost = 25;

    db.get(`SELECT * FROM users WHERE id = ?`, [attackerId], (err, attacker) => {
        if (err || !attacker) return res.status(500).json({ message: 'Saldıran kullanıcı bulunamadı.' });
        if (isAdminUser(attacker)) return res.status(400).json({ message: 'Admin hesabı oyun içi etkileşimlerden muaftır.' });
        if (attacker.coins < stealCost) return res.status(400).json({ message: `Hırsızlık denemesi için yeterli altınınız yok. Gereken: ${stealCost} altın.` });

        db.get(`SELECT * FROM users WHERE username = ?`, [targetUsername], (err, target) => {
            if (err || !target) return res.status(404).json({ message: 'Hedef kullanıcı bulunamadı.' });
            if (target.id === attackerId) return res.status(400).json({ message: 'Kendinizi soyamazsınız.' });
            if (isAdminUser(target)) return res.status(400).json({ message: 'Admin hesabı soyulamaz.' });

            // Saldıranın altınını azalt
            const newAttackerCoins = attacker.coins - stealCost;
            db.run(`UPDATE users SET coins = ? WHERE id = ?`, [newAttackerCoins, attackerId]);

            // Başarı şansını hesapla (seviye farkına göre)
            const levelDifference = attacker.level - target.level;
            let successChance = 50 + (levelDifference * 5); // Temel %50, her seviye farkı için +/- %5
            if (successChance > 95) successChance = 95;
            if (successChance < 5) successChance = 5;

            const roll = Math.random() * 100;
            if (roll < successChance) {
                // Başarılı hırsızlık
                const stolenAmount = Math.floor(target.coins * (Math.random() * 0.10)); // Hedefin altınının %10'una kadar çal
                if (stolenAmount > 0) {
                    const newTargetCoins = target.coins - stolenAmount;
                    const finalAttackerCoins = newAttackerCoins + stolenAmount;
                    db.run(`UPDATE users SET coins = ? WHERE id = ?`, [newTargetCoins, target.id]);
                    db.run(`UPDATE users SET coins = ? WHERE id = ?`, [finalAttackerCoins, attackerId]);
                    res.json({ message: `Başarılı! ${target.username} kullanıcısından ${stolenAmount} altın çaldınız.` });
                } else {
                    res.json({ message: `${target.username} kullanıcısının hiç altını yokmuş!` });
                }
            } else {
                // Başarısız hırsızlık
                res.status(400).json({ message: `Başarısız! ${target.username} soygunu fark etti ve kaçtı.` });
            }
        });
    });
});

// Süikast
app.post('/api/intrigue/assassinate', authenticateToken, (req, res) => {
    const { targetUsername } = req.body;
    const attackerId = req.user.id;

    if (!targetUsername) {
        return res.status(400).json({ message: 'Hedef kralın adı gerekli.' });
    }

    const assassinationCost = 5000;

    db.get(`SELECT * FROM users WHERE id = ?`, [attackerId], (err, attacker) => {
        if (err || !attacker) return res.status(500).json({ message: 'Saldıran kullanıcı bulunamadı.' });
        if (isAdminUser(attacker)) return res.status(400).json({ message: 'Admin hesabı oyun içi etkileşimlerden muaftır.' });
        if (attacker.coins < assassinationCost) return res.status(400).json({ message: `Süikast için yeterli altınınız yok. Gereken: ${assassinationCost} altın.` });
        
        db.get(`SELECT * FROM users WHERE username = ?`, [targetUsername], (err, target) => {
            if (err || !target) return res.status(404).json({ message: 'Hedef kullanıcı bulunamadı.' });
            if (target.rank !== 'Kral') return res.status(400).json({ message: 'Sadece krallara süikast düzenlenebilir.' });
            if (target.id === attackerId) return res.status(400).json({ message: 'Kendinize süikast düzenleyemezsiniz.' });
            if (isAdminUser(target)) return res.status(400).json({ message: 'Admin hesabına süikast düzenlenemez.' });

            // Saldıranın altınını azalt
            const newAttackerCoins = attacker.coins - assassinationCost;
            db.run(`UPDATE users SET coins = ? WHERE id = ?`, [newAttackerCoins, attackerId]);

            // Başarı şansı (çok düşük)
            const successChance = 5; // %5
            const roll = Math.random() * 100;

            if (roll < successChance) {
                // Başarılı süikast
                const stolenAmount = target.coins;
                const finalAttackerCoins = newAttackerCoins + stolenAmount;
                const targetKingdomId = target.kingdom_id;

                resetPlayer(target.id, () => {
                    db.serialize(() => {
                        db.run("BEGIN TRANSACTION");
                        
                        // 1. Saldıranın altınını artır, yeni kral yap
                        db.run(`UPDATE users SET coins = ?, rank = 'Kral' WHERE id = ?`, [finalAttackerCoins, attackerId]);

                        // 2. Krallık tablosunda kralı güncelle
                        db.run(`UPDATE kingdoms SET king_id = ? WHERE id = ?`, [attackerId, targetKingdomId]);

                        db.run("COMMIT", (err) => {
                            if (err) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ message: 'Süikast sırasında bir hata oluştu.'});
                            }
                            res.json({ message: `Süikast başarılı! ${target.username} öldürüldü ve krallığı artık senin! Bütün hazinesi olan ${stolenAmount} altın da sana geçti!` });
                        });
                    });
                });

            } else {
                // Başarısız süikast
                res.status(400).json({ message: `Süikast başarısız! ${target.username} saldırıdan kurtuldu ve kimliğiniz açığa çıktı.` });
            }
        });
    });
});


// Rütbe atama
app.post('/api/assign-rank', authenticateToken, (req, res) => {
  const { userId, rank } = req.body;

  if (!userId || !rank) {
    return res.status(400).json({ error: 'Kullanıcı ID ve rütbe gerekli' });
  }

  if (!RANK_HIERARCHY[rank]) {
    return res.status(400).json({ error: 'Geçersiz rütbe' });
  }

  // Atayan kişinin bilgilerini al
  db.get(`SELECT id, username, rank, kingdom_id FROM users WHERE id = ?`,
    [req.user.id], (err, assigner) => {
      if (err || !assigner) {
        return res.status(500).json({ error: 'Atayan kullanıcı bulunamadı' });
      }

      // Rütbe atama yetkisi var mı?
      if (!canAssignRank(assigner.rank, rank)) {
        return res.status(403).json({ 
          error: `Bu rütbeyi atamak için yetkiniz yok. Mevcut rütbeniz: ${assigner.rank}` 
        });
      }

      // Hedef kullanıcıyı al
      db.get(`SELECT id, username, rank, kingdom_id FROM users WHERE id = ?`,
        [userId], (err, target) => {
          if (err || !target) {
            return res.status(404).json({ error: 'Hedef kullanıcı bulunamadı' });
          }
          if (isAdminUser(target)) {
            return res.status(400).json({ error: 'Admin hesabına rütbe atanamaz.' });
          }

          // Aynı krallıkta mı?
          if (target.kingdom_id !== assigner.kingdom_id) {
            return res.status(400).json({ error: 'Sadece aynı krallıktaki kullanıcılara rütbe atayabilirsiniz' });
          }

          // Hedef kullanıcının mevcut rütbesi kontrolü
          if (!canAssignRank(assigner.rank, target.rank)) {
            return res.status(403).json({ 
              error: `Bu kullanıcıya rütbe atayamazsınız. Mevcut rütbesi: ${target.rank}` 
            });
          }

          // Rütbeyi ata
          db.run(`UPDATE users SET rank = ? WHERE id = ?`,
            [rank, userId], (err) => {
              if (err) {
                return res.status(500).json({ error: 'Rütbe atama hatası' });
              }

              res.json({
                message: `${target.username} kullanıcısına ${rank} rütbesi atandı`,
                user: {
                  id: target.id,
                  username: target.username,
                  newRank: rank
                }
              });
            });
        });
    });
});

// Kral atama
app.post('/api/assign-king', authenticateToken, (req, res) => {
  const { userId, kingdomId } = req.body;

  if (!userId || !kingdomId) {
    return res.status(400).json({ error: 'Kullanıcı ID ve krallık ID gerekli' });
  }

  // Atayan kişinin Kral olup olmadığını kontrol et
  db.get(`SELECT id, username, rank, kingdom_id FROM users WHERE id = ?`,
    [req.user.id], (err, assigner) => {
      if (err || !assigner) {
        return res.status(500).json({ error: 'Kullanıcı bulunamadı' });
      }

      if (assigner.rank !== 'Kral') {
        return res.status(403).json({ error: 'Sadece Kral yeni kral atayabilir' });
      }

      // Hedef kullanıcıyı al
      db.get(`SELECT id, username, kingdom_id FROM users WHERE id = ?`,
        [userId], (err, target) => {
          if (err || !target) {
            return res.status(404).json({ error: 'Hedef kullanıcı bulunamadı' });
          }
          if (isAdminUser(target)) {
            return res.status(400).json({ error: 'Admin hesabı kral yapılamaz.' });
          }

          // Aynı krallıkta mı?
          if (target.kingdom_id !== kingdomId) {
            return res.status(400).json({ error: 'Kullanıcı farklı bir krallıkta' });
          }

          // Eski kralı Vezir yap
          db.get(`SELECT id FROM users WHERE kingdom_id = ? AND rank = 'Kral'`,
            [kingdomId], (err, oldKing) => {
              if (!err && oldKing && oldKing.id !== userId) {
                db.run(`UPDATE users SET rank = 'Vezir' WHERE id = ?`, [oldKing.id]);
              }

              // Yeni kralı ata
              db.run(`UPDATE users SET rank = 'Kral' WHERE id = ?`,
                [userId], (err) => {
                  if (err) {
                    return res.status(500).json({ error: 'Kral atama hatası' });
                  }

                  // Krallık tablosunu güncelle
                  db.run(`UPDATE kingdoms SET king_id = ? WHERE id = ?`,
                    [userId, kingdomId], (err) => {
                      if (err) {
                        console.error('Krallık güncelleme hatası:', err);
                      }

                      res.json({
                        message: `${target.username} ${kingdomId} numaralı krallığın yeni kralı oldu!`,
                        user: {
                          id: target.id,
                          username: target.username,
                          newRank: 'Kral'
                        }
                      });
                    });
                });
            });
        });
    });
});

// İsyan çıkar (krallığı ele geçir)
app.post('/api/revolt', authenticateToken, (req, res) => {
  const { kingdomId } = req.body;

  if (!kingdomId) {
    return res.status(400).json({ error: 'Krallık ID gerekli' });
  }

  // Kullanıcı bilgilerini al
  db.get(`SELECT u.id, u.username, u.coins, u.kingdom_id, u.rank,
          (SELECT COUNT(*) FROM users WHERE master_id = u.id) as slave_count
          FROM users u WHERE u.id = ?`, [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'Kullanıcı bulunamadı' });
    }
    if (isAdminUser(user)) {
      return res.status(400).json({ error: 'Admin hesabı isyan çıkaramaz.' });
    }

    // En az 10 köle sahibi olmalı
    const slaveCount = user.slave_count || 0;
    if (slaveCount < 10) {
      return res.status(400).json({ 
        error: `İsyan çıkarmak için en az 10 köle sahibi olmalısınız. Mevcut köle sayınız: ${slaveCount}` 
      });
    }

    // 1000 altın gerekli
    const revoltCost = 1000;
    if (user.coins < revoltCost) {
      return res.status(400).json({ 
        error: `Yeterli altınınız yok! İsyan maliyeti: ${revoltCost} altın, Mevcut: ${user.coins} altın` 
      });
    }

    // Aynı krallıkta olmalı
    if (user.kingdom_id !== kingdomId) {
      return res.status(400).json({ error: 'Sadece bulunduğunuz krallıkta isyan çıkarabilirsiniz' });
    }

    // Zaten kral mı?
    if (user.rank === 'Kral') {
      return res.status(400).json({ error: 'Zaten kralsınız!' });
    }

    // Krallığı kontrol et
    db.get(`SELECT k.id, k.name, k.king_id, oldKing.username as old_king_username
            FROM kingdoms k
            LEFT JOIN users oldKing ON k.king_id = oldKing.id
            WHERE k.id = ?`, [kingdomId], (err, kingdom) => {
      if (err || !kingdom) {
        return res.status(404).json({ error: 'Krallık bulunamadı' });
      }

      // Altını azalt
      const newCoins = user.coins - revoltCost;

      // Eski kralı Vezir yap (varsa)
      if (kingdom.king_id && kingdom.king_id !== req.user.id) {
        db.run(`UPDATE users SET rank = 'Vezir' WHERE id = ?`, [kingdom.king_id]);
      }

      // Yeni kralı ata
      db.run(`UPDATE users SET coins = ?, rank = 'Kral' WHERE id = ?`,
        [newCoins, req.user.id], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Kral atama hatası' });
          }

          // Krallık tablosunu güncelle
          db.run(`UPDATE kingdoms SET king_id = ? WHERE id = ?`,
            [req.user.id, kingdomId], (err) => {
              if (err) {
                return res.status(500).json({ error: 'Krallık güncelleme hatası' });
              }

              res.json({
                message: `🎉 İsyan başarılı! ${kingdom.name} krallığının yeni kralı oldunuz!`,
                kingdom: {
                  id: kingdom.id,
                  name: kingdom.name
                },
                newBalance: newCoins,
                newRank: 'Kral'
              });
            });
        });
    });
  });
});

// İsyan bilgilerini getir
app.get('/api/revolt-info', authenticateToken, (req, res) => {
  db.get(`SELECT u.id, u.username, u.coins, u.kingdom_id, u.rank,
          (SELECT COUNT(*) FROM users WHERE master_id = u.id) as slave_count
          FROM users u WHERE u.id = ?`, [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'Kullanıcı bulunamadı' });
    }

    const kingdomId = user.kingdom_id || 1;
    const slaveCount = user.slave_count || 0;
    const revoltCost = 1000;
    const canRevolt = slaveCount >= 10 && user.coins >= revoltCost && user.rank !== 'Kral';

    // Krallık bilgisi
    db.get(`SELECT k.id, k.name, k.king_id, u.username as king_username
            FROM kingdoms k
            LEFT JOIN users u ON k.king_id = u.id
            WHERE k.id = ?`, [kingdomId], (err, kingdom) => {
      if (err) {
        return res.status(500).json({ error: 'Krallık bilgisi alınamadı' });
      }

      res.json({
        canRevolt: canRevolt,
        slaveCount: slaveCount,
        requiredSlaves: 10,
        currentCoins: user.coins,
        requiredCoins: revoltCost,
        isKing: user.rank === 'Kral',
        kingdom: kingdom || null
      });
    });
  });
});

// Malzeme Pazarı - Malzeme satın al
app.post('/api/market/buy-material', authenticateToken, (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Geçerli bir miktar girin.' });
    }

    getUserMarketTax(req.user.id, (taxErr, marketTaxRate) => {
      if (taxErr) {
        return res.status(500).json({ error: 'Pazar vergisi alınamadı.' });
      }

      const materialPrice = Math.ceil(10 * (1 + marketTaxRate / 100));
      const totalCost = amount * materialPrice;

      db.get("SELECT coins, material FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err || !user) {
            return res.status(500).json({ error: 'Kullanıcı bulunamadı.' });
        }

        if (user.coins < totalCost) {
            return res.status(400).json({ error: 'Yeterli altınınız yok.' });
        }

        const newCoins = user.coins - totalCost;
        const newMaterial = user.material + amount;

        db.run(`UPDATE users SET coins = ?, material = ? WHERE id = ?`, 
            [newCoins, newMaterial, req.user.id], function(err) {
            if (err) {
                return res.status(500).json({ error: 'İşlem sırasında bir hata oluştu.' });
            }
            res.json({
                message: `${amount} adet malzeme başarıyla satın alındı. Pazar vergisi: %${marketTaxRate}.`,
                newBalance: newCoins,
                newMaterial: newMaterial
            });
        });
      });
    });
});

// Yemek al
app.post('/api/market/buy-food', authenticateToken, (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Geçerli bir miktar girin.' });
    }

    getUserMarketTax(req.user.id, (taxErr, marketTaxRate) => {
      if (taxErr) {
        return res.status(500).json({ error: 'Pazar vergisi alınamadı.' });
      }

      const foodPrice = Math.ceil(MARKET_BASE_FOOD_PRICE * (1 + marketTaxRate / 100));
      const totalCost = amount * foodPrice;

      db.get("SELECT coins, food FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err || !user) {
            return res.status(500).json({ error: 'Kullanıcı bulunamadı.' });
        }

        if (user.coins < totalCost) {
            return res.status(400).json({ error: 'Yeterli altınınız yok.' });
        }

        const newCoins = user.coins - totalCost;
        const newFood = user.food + amount;

        db.run(`UPDATE users SET coins = ?, food = ? WHERE id = ?`, 
            [newCoins, newFood, req.user.id], function(err) {
            if (err) {
                return res.status(500).json({ error: 'İşlem sırasında bir hata oluştu.' });
            }
            res.json({
                message: `${amount} adet gıda başarıyla satın alındı. Pazar vergisi: %${marketTaxRate}.`,
                newBalance: newCoins,
                newFood: newFood
            });
        });
      });
    });
});

// Yemek sat
app.post('/api/market/sell-food', authenticateToken, (req, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Geçerli bir miktar girin.' });
    }

    getUserMarketTax(req.user.id, (taxErr, marketTaxRate) => {
      if (taxErr) {
        return res.status(500).json({ error: 'Pazar vergisi alınamadı.' });
      }

      const foodPrice = Math.max(1, Math.floor(MARKET_BASE_FOOD_PRICE * (1 - marketTaxRate / 100)));
      const totalReturn = amount * foodPrice;

      db.get("SELECT coins, food FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err || !user) {
            return res.status(500).json({ error: 'Kullanıcı bulunamadı.' });
        }

        if (user.food < amount) {
            return res.status(400).json({ error: 'Yeterli gıdanız yok.' });
        }

        const newCoins = user.coins + totalReturn;
        const newFood = user.food - amount;

        db.run(`UPDATE users SET coins = ?, food = ? WHERE id = ?`, 
            [newCoins, newFood, req.user.id], function(err) {
            if (err) {
                return res.status(500).json({ error: 'İşlem sırasında bir hata oluştu.' });
            }
            res.json({
                message: `${amount} adet gıda başarıyla satıldı. Pazar vergisi: %${marketTaxRate}.`,
                newBalance: newCoins,
                newFood: newFood
            });
        });
      });
    });
});



// Üretim başlat
app.post('/api/produce', authenticateToken, (req, res) => {
    const { productionType, amount } = req.body; // productionType: 'food' or 'weapon'

    const parsedAmount = parseInt(amount);
    if (!['food', 'weapon'].includes(productionType) || !parsedAmount || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Geçersiz üretim isteği.' });
    }

    // Production costs and times might vary
    let cost = {};
    let productionTime = 0; // in seconds

    if (productionType === 'food') {
        cost = { material: parsedAmount * 1 }; // 1 food = 1 material
        productionTime = parsedAmount * 60; // 1 food = 60 seconds
    } else if (productionType === 'weapon') {
        cost = { material: parsedAmount * 10 }; // 1 weapon = 10 material
        productionTime = parsedAmount * 300; // 1 weapon = 5 minutes
    }

    db.get("SELECT material FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err || !user) {
            return res.status(500).json({ error: 'Kullanıcı bulunamadı.' });
        }

        if (user.material < cost.material) {
            return res.status(400).json({ error: 'Yeterli malzemeniz yok.' });
        }

        const finishAt = new Date();
        finishAt.setSeconds(finishAt.getSeconds() + productionTime);

        db.run(`UPDATE users SET material = material - ? WHERE id = ?`, [cost.material, req.user.id], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Malzeme azaltma hatası.' });
            }

            db.run(`INSERT INTO productions (user_id, production_type, amount, finish_at) VALUES (?, ?, ?, ?)`,
                [req.user.id, productionType, parsedAmount, finishAt.toISOString()], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Üretim kaydı oluşturulamadı.' });
                }
                res.json({
                    message: `${parsedAmount} adet ${productionType} üretimi başladı.`,
                    productionId: this.lastID,
                    finishAt: finishAt.toISOString()
                });
            });
        });
    });
});

// Aktif üretimleri getir
app.get('/api/productions', authenticateToken, (req, res) => {
    db.all("SELECT * FROM productions WHERE user_id = ? AND claimed = 0 ORDER BY finish_at ASC", [req.user.id], (err, productions) => {
        if (err) {
            return res.status(500).json({ error: 'Veritabanı hatası.' });
        }
        res.json(productions || []);
    });
});

// Üretimi tamamla
app.post('/api/productions/claim', authenticateToken, (req, res) => {
    const { productionId } = req.body;

    if (!productionId) {
        return res.status(400).json({ error: 'Üretim ID gerekli.' });
    }

    db.get("SELECT * FROM productions WHERE id = ? AND user_id = ?", [productionId, req.user.id], (err, production) => {
        if (err || !production) {
            return res.status(404).json({ error: 'Üretim bulunamadı.' });
        }

        if (production.claimed) {
            return res.status(400).json({ error: 'Bu üretim zaten tamamlanmış.' });
        }
        
        const now = new Date();
        const finishAt = new Date(production.finish_at);

        if (now < finishAt) {
            return res.status(400).json({ error: 'Üretim henüz tamamlanmadı.' });
        }

        let updateQuery = '';
        if (production.production_type === 'food') {
            updateQuery = `UPDATE users SET food = food + ? WHERE id = ?`;
        } else if (production.production_type === 'weapon') {
            updateQuery = `UPDATE users SET weapons = weapons + ? WHERE id = ?`;
        } else {
            return res.status(500).json({ error: 'Bilinmeyen üretim tipi.' });
        }

        db.run(updateQuery, [production.amount, req.user.id], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Kaynak ekleme hatası.' });
            }

            db.run(`UPDATE productions SET claimed = 1 WHERE id = ?`, [productionId], (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Üretim güncelleme hatası.' });
                }
                res.json({ message: `${production.amount} adet ${production.production_type} envanterinize eklendi.` });
            });
        });
    });
});

// Yatırımları listele
app.get('/api/investments', authenticateToken, (req, res) => {
  db.all(`SELECT id, amount, profit_rate, duration_days, invested_at, completed_at, status, total_return, COALESCE(risk_level, 'low') as risk_level
          FROM investments
          WHERE user_id = ?
          ORDER BY invested_at DESC`,
    [req.user.id], (err, investments) => {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }

      // Aktif yatırımları kontrol et ve tamamlananları işaretle
      const now = new Date();
      investments.forEach(inv => {
        if (inv.status === 'active') {
          const investedDate = new Date(inv.invested_at);
          const completionDate = new Date(investedDate.getTime() + inv.duration_days * 24 * 60 * 60 * 1000);
          
          if (now >= completionDate) {
            // Yatırım tamamlandı
            const totalReturn = calculateRiskedInvestmentReturn(inv.amount, inv.profit_rate, inv.risk_level);
            db.run(`UPDATE investments SET status = 'completed', completed_at = CURRENT_TIMESTAMP, total_return = ? WHERE id = ?`,
              [totalReturn, inv.id]);
            inv.status = 'completed';
            inv.completed_at = completionDate.toISOString();
            inv.total_return = totalReturn;
          }
        }
      });

      res.json({
        investments: investments || []
      });
    });
});

// Yatırım yap
app.post('/api/invest', authenticateToken, (req, res) => {
  const { amount, durationDays } = req.body;

  if (!amount || !durationDays || amount < 100) {
    return res.status(400).json({ error: 'Minimum yatırım tutarı 100 altındır' });
  }

  const package = INVESTMENT_PACKAGES[durationDays];
  if (!package) {
    return res.status(400).json({ error: 'Geçersiz yatırım süresi. 1, 3 veya 7 gün seçebilirsiniz.' });
  }

  if (amount < package.minAmount) {
    return res.status(400).json({ error: `${durationDays} günlük yatırım için minimum tutar ${package.minAmount} altındır` });
  }

  // Kullanıcının bakiyesini kontrol et
  db.get("SELECT coins FROM users WHERE id = ?", [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'Kullanıcı bulunamadı' });
    }

    if (user.coins < amount) {
      return res.status(400).json({ error: 'Yeterli bakiyeniz yok' });
    }

    // Bakiyeyi azalt
    const newBalance = user.coins - amount;
    db.run(`UPDATE users SET coins = ? WHERE id = ?`, [newBalance, req.user.id], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Bakiye güncelleme hatası' });
      }

      // Yatırım kaydı oluştur
      const estimatedReturn = Math.floor(amount * (1 + package.rate / 100));
      db.run(`INSERT INTO investments (user_id, amount, profit_rate, duration_days, total_return, risk_level)
              VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, amount, package.rate, durationDays, estimatedReturn, package.riskLevel], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Yatırım kaydı oluşturulamadı' });
          }

          res.json({
            message: `Yatırım başarılı! ${durationDays} gün sonra tahmini ${estimatedReturn} altın alacaksınız. Paket: ${package.riskLabel}.`,
            investment: {
              amount: amount,
              durationDays: durationDays,
              profitRate: package.rate,
              riskLevel: package.riskLevel,
              totalReturn: estimatedReturn
            },
            newBalance: newBalance
          });
        });
    });
  });
});

// Savaş ilan et
app.post('/api/war/declare', authenticateToken, (req, res) => {
    const { defender_kingdom_id } = req.body;
    const attacker_id = req.user.id;

    // 1. Kullanıcının kral olup olmadığını ve kaynaklarını kontrol et
    db.get(`SELECT u.coins, u.weapons, k.id as kingdom_id 
            FROM users u JOIN kingdoms k ON k.king_id = u.id 
            WHERE u.id = ?`, 
        [attacker_id], (err, attacker) => {
        
        if (err || !attacker) {
            return res.status(403).json({ error: 'Sadece krallar savaş ilan edebilir.' });
        }

        const attacker_kingdom_id = attacker.kingdom_id;
        const warGoldCost = 10000;
        const warWeaponCost = 500;

        if (attacker.coins < warGoldCost) {
            return res.status(400).json({ error: `Savaş ilan etmek için yeterli altınınız yok. Gereken: ${warGoldCost} altın.` });
        }
        if (attacker.weapons < warWeaponCost) {
            return res.status(400).json({ error: `Savaş ilan etmek için yeterli silahınız yok. Gereken: ${warWeaponCost} silah.` });
        }

        // Savaş için minimum krallık silahı kontrolü
        const MIN_WEAPONS_FOR_WAR = 100;
        db.get(`SELECT SUM(weapons) as total_weapons FROM users WHERE kingdom_id = ?`, [attacker_kingdom_id], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Krallık silah gücü hesaplanamadı.' });
            }

            const totalWeapons = result.total_weapons || 0;
            if (totalWeapons < MIN_WEAPONS_FOR_WAR) {
                return res.status(400).json({ error: `Savaş ilan etmek için yeterli krallık silahı yok. Gereken: ${MIN_WEAPONS_FOR_WAR}, Mevcut: ${totalWeapons}` });
            }

            if (attacker_kingdom_id === defender_kingdom_id) {
                return res.status(400).json({ error: 'Kendi krallığınıza savaş açamazsınız.' });
            }

            // Mevcut savaş var mı kontrol et
            db.get(`SELECT id FROM wars WHERE (attacker_kingdom_id = ? OR defender_kingdom_id = ?) AND status = 'ongoing'`, 
                [attacker_kingdom_id, attacker_kingdom_id], (err, existingWar) => {
                if (existingWar) {
                    return res.status(400).json({ error: 'Krallığınız zaten bir savaşta.' });
                }
                
                db.get(`SELECT id FROM wars WHERE (attacker_kingdom_id = ? OR defender_kingdom_id = ?) AND status = 'ongoing'`,
                    [defender_kingdom_id, defender_kingdom_id], (err, existingWar) => {
                    if (existingWar) {
                        return res.status(400).json({ error: 'Hedef krallık zaten bir savaşta.' });
                    }

                    // Savaş ilan et
                    const newCoins = attacker.coins - warGoldCost;
                    const newWeapons = attacker.weapons - warWeaponCost;
                    const warEndDate = new Date();
                    warEndDate.setHours(warEndDate.getHours() + 24); // Savaş 24 saat sürer

                    db.run(`UPDATE users SET coins = ?, weapons = ? WHERE id = ?`, [newCoins, newWeapons, attacker_id], (err) => {
                        if (err) { return res.status(500).json({ error: "Bakiye güncellenemedi."}) }

                        db.run(`INSERT INTO wars (attacker_kingdom_id, defender_kingdom_id, war_end_date) VALUES (?, ?, ?)`,
                            [attacker_kingdom_id, defender_kingdom_id, warEndDate.toISOString()], function(err) {
                                if (err) {
                                    return res.status(500).json({ error: 'Savaş ilanı sırasında hata oluştu.' });
                                }
                                res.json({ message: `Savaş başarıyla ilan edildi! Savaş 24 saat sonra sona erecek. Maliyet: ${warGoldCost} altın ve ${warWeaponCost} silah.` });
                            });
                    });
                });
            });
        });
    });
});

// Aktif savaşları listele
app.get('/api/wars', authenticateToken, (req, res) => {
    db.all(`SELECT w.id, w.war_end_date,
            ak.name as attacker_kingdom_name, 
            dk.name as defender_kingdom_name,
            au.username as attacker_king,
            du.username as defender_king
            FROM wars w
            JOIN kingdoms ak ON w.attacker_kingdom_id = ak.id
            JOIN kingdoms dk ON w.defender_kingdom_id = dk.id
            LEFT JOIN users au ON ak.king_id = au.id
            LEFT JOIN users du ON dk.king_id = du.id
            WHERE w.status = 'ongoing'`, (err, wars) => {
        if (err) {
            return res.status(500).json({ error: 'Savaşlar listelenirken bir hata oluştu.' });
        }
        res.json(wars || []);
    });
});

app.post('/api/war/resolve/:id', authenticateToken, (req, res) => {
    const warId = req.params.id;

    db.get("SELECT * FROM wars WHERE id = ?", [warId], (err, war) => {
        if (err || !war) {
            return res.status(404).json({ error: 'Savaş bulunamadı.' });
        }
        if (war.status !== 'ongoing') {
            return res.status(400).json({ error: 'Bu savaş zaten bitti.' });
        }
        if (new Date() < new Date(war.war_end_date)) {
            return res.status(400).json({ error: 'Savaş daha bitmedi.' });
        }

        const getKingdomPower = (kingdomId, isDefender, callback) => {
            db.get(`SELECT 
                       SUM(level) as total_level,
                       SUM(weapons) as total_weapons,
                       SUM(food) as total_food,
                       SUM(CASE rank
                            WHEN 'Kral' THEN 150
                            WHEN 'Vezir' THEN 80
                            WHEN 'Komutan' THEN 120
                            WHEN 'Asilzade' THEN 40
                            ELSE 0
                           END) as rank_power
                    FROM users WHERE kingdom_id = ?`, [kingdomId], (err, result) => {
                if (err) {
                    return callback(err, 0);
                }
                const logisticsPower = Math.floor((result.total_food || 0) / 20);
                const defenseBonus = isDefender ? 150 : 0;
                const power = (result.total_level || 0) + ((result.total_weapons || 0) * 10) + (result.rank_power || 0) + logisticsPower + defenseBonus;
                callback(null, power);
            });
        };

        getKingdomPower(war.attacker_kingdom_id, false, (err, attackerPower) => {
            if (err) return res.status(500).json({ error: 'Saldıran gücü hesaplanamadı.' });

            getKingdomPower(war.defender_kingdom_id, true, (err, defenderPower) => {
                if (err) return res.status(500).json({ error: 'Savunan gücü hesaplanamadı.' });

                let winner_kingdom_id, loser_kingdom_id;
                if (attackerPower > defenderPower) {
                    winner_kingdom_id = war.attacker_kingdom_id;
                    loser_kingdom_id = war.defender_kingdom_id;
                } else if (defenderPower > attackerPower) {
                    winner_kingdom_id = war.defender_kingdom_id;
                    loser_kingdom_id = war.attacker_kingdom_id;
                } else { // Draw
                    db.run("UPDATE wars SET status = 'finished' WHERE id = ?", [warId]);
                    return res.json({ message: 'Savaş berabere bitti! Herkes kendi krallığında kalır.' });
                }

                db.get("SELECT king_id FROM kingdoms WHERE id = ?", [winner_kingdom_id], (err, winnerKingdom) => {
                    if(err || !winnerKingdom) return res.status(500).json({error: 'Kazanan kral bulunamadı'});
                    
                    const winnerKingId = winnerKingdom.king_id;

                    db.serialize(() => {
                        db.run("BEGIN TRANSACTION");
                        db.run("UPDATE kingdoms SET king_id = ? WHERE id = ?", [winnerKingId, loser_kingdom_id]);
                        db.run("UPDATE wars SET status = 'finished', winner_kingdom_id = ? WHERE id = ?", [winner_kingdom_id, warId]);
                        db.run("COMMIT", (err) => {
                             if (err) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ message: 'Savaş sonucu işlenirken bir hata oluştu.'});
                             }
                             res.json({ 
                                message: `Savaş bitti! Kazanan: ${winner_kingdom_id === war.attacker_kingdom_id ? 'Saldıran' : 'Savunan'} taraf. Saldıran güç: ${attackerPower}, savunan güç: ${defenderPower}.`,
                                attackerPower,
                                defenderPower,
                                winnerKingdomId: winner_kingdom_id
                             });
                        });
                    });
                });
            });
        });
    });
});

// Evlilik Adaylarını Getir
app.get('/api/marriage/candidates', authenticateToken, (req, res) => {
    db.get("SELECT gender, kingdom_id FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }
        const oppositeGender = user.gender === 'male' ? 'female' : 'male';
        const availabilityFilter = user.gender === 'male'
            ? `AND NOT EXISTS (SELECT 1 FROM marriages m WHERE m.wife_id = users.id)`
            : '';
        // Sadece aynı krallıktaki ve karşı cinsten adayları listele. Kadın adaylar tek eşli tutulur.
        db.all(`SELECT id, username, level, rank FROM users
                WHERE gender = ? ${availabilityFilter} AND kingdom_id = ? AND id != ?`,
            [oppositeGender, user.kingdom_id, req.user.id], (err, candidates) => {
            if (err) {
                return res.status(500).json({ error: 'Adaylar listelenirken bir hata oluştu.' });
            }
            res.json(candidates);
        });
    });
});

// Teklife Cevap Ver
app.post('/api/marriage/respond', authenticateToken, (req, res) => {
    const { proposalId, response } = req.body; // response: 'accept' or 'reject'
    const userId = req.user.id;

    if (!['accept', 'reject'].includes(response)) {
        return res.status(400).json({ error: 'Geçersiz yanıt.' });
    }

    db.get("SELECT * FROM marriage_proposals WHERE id = ? AND proposee_id = ?", [proposalId, userId], (err, proposal) => {
        if (err || !proposal) return res.status(404).json({ error: 'Teklif bulunamadı.' });
        if (proposal.status !== 'pending') return res.status(400).json({ error: 'Bu teklif zaten yanıtlanmış.' });

        if (response === 'reject') {
            db.run("UPDATE marriage_proposals SET status = 'rejected' WHERE id = ?", [proposalId], () => {
                res.json({ message: 'Teklif reddedildi.' });
            });
        } else { // accept
            db.get(`SELECT id, gender, master_id FROM users WHERE id = ?`, [proposal.proposer_id], (err, proposer) => {
                if (err || !proposer) return res.status(500).json({ error: 'Teklif eden kullanıcı bulunamadı.' });

                db.get(`SELECT id, gender, master_id FROM users WHERE id = ?`, [proposal.proposee_id], (err, proposee) => {
                    if (err || !proposee) return res.status(500).json({ error: 'Teklif edilen kullanıcı bulunamadı.' });

                    const husband = proposer.gender === 'male' ? proposer : proposee;
                    const wife = proposer.gender === 'female' ? proposer : proposee;

                    db.get("SELECT id FROM marriages WHERE wife_id = ?", [wife.id], (err, wifeMarriage) => {
                        if (err) return res.status(500).json({ error: 'Veritabanı hatası.' });
                        if (wifeMarriage) {
                            db.run("UPDATE marriage_proposals SET status = 'rejected' WHERE id = ?", [proposalId]);
                            return res.status(400).json({ error: 'Teklif artık geçerli değil, kadın kullanıcı başka biriyle evli.' });
                        }

                        if (husband.master_id && wife.master_id && husband.master_id !== wife.master_id) {
                            return res.status(403).json({ error: 'Köleler sadece aynı efendiye hizmet ediyorlarsa evlenebilirler.' });
                        }

                        db.serialize(() => {
                            db.run("BEGIN TRANSACTION");
                            db.run("INSERT INTO marriages (husband_id, wife_id) VALUES (?, ?)", [husband.id, wife.id], function(err) {
                                if (err) {
                                    db.run("ROLLBACK");
                                    return res.status(500).json({ error: 'Evlilik oluşturulamadı.' });
                                }

                                db.run("UPDATE users SET wife_count = wife_count + 1 WHERE id = ?", [husband.id]);
                                if (wife.master_id && husband.id === wife.master_id) {
                                    db.run("UPDATE users SET master_id = NULL WHERE id = ?", [wife.id]);
                                }
                                db.run("UPDATE marriage_proposals SET status = 'accepted' WHERE id = ?", [proposalId]);
                                db.run(`DELETE FROM marriage_proposals
                                        WHERE (proposer_id = ? OR proposee_id = ? OR proposer_id = ? OR proposee_id = ?)
                                        AND status = 'pending'`,
                                    [proposal.proposer_id, proposal.proposer_id, proposal.proposee_id, proposal.proposee_id]);

                                db.run("COMMIT", (err) => {
                                    if (err) {
                                        db.run("ROLLBACK");
                                        return res.status(500).json({ error: 'Evlilik işlenirken bir hata oluştu.' });
                                    }
                                    res.json({ message: 'Teklif kabul edildi. Tebrikler!' });
                                });
                            });
                        });
                    });
                });
            });
        }
    });
});

// Yatırımı geri çek
app.post('/api/withdraw-investment', authenticateToken, (req, res) => {
  const { investmentId } = req.body;
  if (!investmentId) {
    return res.status(400).json({ error: 'Yatırım ID gerekli' });
  }

  // Yatırımı kontrol et
  db.get(`SELECT id, user_id, amount, total_return, status, completed_at
          FROM investments
          WHERE id = ? AND user_id = ?`,
    [investmentId, req.user.id], (err, investment) => {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }

      if (!investment) {
        return res.status(404).json({ error: 'Yatırım bulunamadı' });
      }

      // Kullanıcının bakiyesini artır
      db.get("SELECT coins FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err || !user) {
          return res.status(500).json({ error: 'Kullanıcı bulunamadı' });
        }

        const isEarlyWithdrawal = investment.status !== 'completed';
        const withdrawnAmount = isEarlyWithdrawal
          ? Math.floor(investment.amount * 0.8)
          : investment.total_return;
        const newBalance = user.coins + withdrawnAmount;
        db.run(`UPDATE users SET coins = ? WHERE id = ?`, [newBalance, req.user.id], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Bakiye güncelleme hatası' });
          }

          // Yatırımı sil (veya withdrawn olarak işaretle)
          db.run(`DELETE FROM investments WHERE id = ?`, [investmentId], (err) => {
            if (err) {
              console.error('Yatırım silme hatası:', err);
            }

            res.json({
              message: isEarlyWithdrawal
                ? `Yatırım erken bozuldu. %20 ceza sonrası ${withdrawnAmount} altın hesabınıza eklendi.`
                : `Yatırım geri çekildi! ${withdrawnAmount} altın hesabınıza eklendi.`,
              withdrawnAmount: withdrawnAmount,
              newBalance: newBalance
            });
          });
        });
      });
    });
});

// Krallık üyelerini listele (rütbe yönetimi için)
app.get('/api/kingdom-members', authenticateToken, (req, res) => {
  db.get(`SELECT kingdom_id, rank FROM users WHERE id = ?`,
    [req.user.id], (err, user) => {
      if (err || !user) {
        return res.status(500).json({ error: 'Kullanıcı bulunamadı' });
      }

      db.all(`SELECT u.id, u.username, u.rank, u.level, u.coins,
              (SELECT COUNT(*) FROM users WHERE master_id = u.id) as slave_count
              FROM users u
              WHERE u.kingdom_id = ? AND u.username != 'admin'
              ORDER BY 
                CASE u.rank
                  WHEN 'Kral' THEN 5
                  WHEN 'Vezir' THEN 4
                  WHEN 'Komutan' THEN 3
                  WHEN 'Asilzade' THEN 2
                  WHEN 'Vatandaş' THEN 1
                  ELSE 0
                END DESC,
                u.level DESC`,
        [user.kingdom_id], (err, members) => {
          if (err) {
            return res.status(500).json({ error: 'Veritabanı hatası' });
          }

          res.json({
            members: members || [],
            userRank: user.rank
          });
        });
    });
});

app.get('/api/kingdom-policy', authenticateToken, (req, res) => {
  db.get(`SELECT u.id as user_id, u.kingdom_id, u.rank, k.name as kingdom_name, k.king_id,
          COALESCE(k.tax_rate, 10) as tax_rate,
          COALESCE(k.market_tax_rate, 0) as market_tax_rate
          FROM users u
          LEFT JOIN kingdoms k ON k.id = u.kingdom_id
          WHERE u.id = ?`, [req.user.id], (err, row) => {
    if (err || !row) {
      return res.status(500).json({ error: 'Krallık politikası alınamadı' });
    }

    res.json({
      kingdomId: row.kingdom_id,
      kingdomName: row.kingdom_name,
      taxRate: row.tax_rate,
      marketTaxRate: row.market_tax_rate,
      canEdit: row.rank === 'Kral' && row.king_id === row.user_id
    });
  });
});

app.put('/api/kingdom-policy', authenticateToken, (req, res) => {
  const taxRate = clampInteger(req.body.taxRate, 0, 25);
  const marketTaxRate = clampInteger(req.body.marketTaxRate, 0, 15);

  db.get(`SELECT u.id, u.kingdom_id, u.rank, k.king_id
          FROM users u
          LEFT JOIN kingdoms k ON k.id = u.kingdom_id
          WHERE u.id = ?`, [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(500).json({ error: 'Kullanıcı bulunamadı' });
    }

    if (user.rank !== 'Kral' || user.king_id !== user.id) {
      return res.status(403).json({ error: 'Bu ayarları yalnızca krallığın kralı değiştirebilir' });
    }

    db.run(`UPDATE kingdoms SET tax_rate = ?, market_tax_rate = ? WHERE id = ?`,
      [taxRate, marketTaxRate, user.kingdom_id], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Krallık politikası güncellenemedi' });
        }

        res.json({
          message: `Krallık politikası güncellendi. Günlük vergi: %${taxRate}, pazar vergisi: %${marketTaxRate}.`,
          taxRate,
          marketTaxRate
        });
      });
  });
});

// Çocuk yapma
app.post('/api/have-child', authenticateToken, (req, res) => {
    const { wifeId } = req.body;
    const userId = req.user.id;

    db.get(`SELECT id, coins, gender FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) return res.status(500).json({ error: 'Veritabanı hatası: Kullanıcı bulunamadı.' });
        if (!user) return res.status(404).json({ error: 'Kullanıcı oturumu bulunamadı.' });

        const childCost = 1000;
        if (user.coins < childCost) {
            return res.status(400).json({ error: `Çocuk yapmak için yeterli altınınız yok. Gereken: ${childCost} altın.` });
        }

        const createChild = (motherId, fatherId) => {
            const childGender = Math.random() < 0.5 ? 'male' : 'female';
            const maleNames = [
                'Lugal', 'Enki', 'Gilgamesh', 'Sargon', 'Ur-Nammu', 'Gudea',
                'Ramesses', 'Thutmose', 'Amenhotep', 'Seti', 'Akhenaten', 'Tutankhamun', 'Imhotep', 'Khufu',
                'Abraham', 'Isaac', 'Jacob', 'Moses', 'David', 'Solomon', 'Aaron', 'Elijah', 'Daniel', 'Noah',
                'Mohammed', 'Ali', 'Omar', 'Khalid', 'Tariq', 'Yusuf', 'Ibrahim', 'Hassan', 'Hussein', 'Saladin'
            ];
            const femaleNames = [
                'Inanna', 'Ereshkigal', 'Ninsun', 'Tiamat', 'Shala', 'Kubaba',
                'Cleopatra', 'Nefertiti', 'Hatshepsut', 'Ankhesenamun', 'Meritaten', 'Neith', 'Isis', 'Hathor',
                'Sarah', 'Rebecca', 'Rachel', 'Leah', 'Miriam', 'Deborah', 'Esther', 'Ruth', 'Judith', 'Tamar',
                'Fatima', 'Aisha', 'Khadija', 'Zainab', 'Amina', 'Layla', 'Samira', 'Nadia', 'Farah', 'Zahra'
            ];
            const names = childGender === 'male' ? maleNames : femaleNames;
            const childName = names[Math.floor(Math.random() * names.length)];
            const childRoles = childGender === 'male'
                ? ['Çırak Asker', 'Çiftçi', 'Tüccar Adayı', 'Katip']
                : ['Şifacı Adayı', 'Çiftçi', 'Tüccar Adayı', 'Katip'];
            const childRole = childRoles[Math.floor(Math.random() * childRoles.length)];

            db.run("BEGIN TRANSACTION", (err) => {
                if (err) return res.status(500).json({ error: 'Veritabanı işlemi başlatılamadı.' });

                db.run(`UPDATE users SET coins = coins - ? WHERE id = ?`, [childCost, userId], function(err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: 'Maliyet düşülemedi.' });
                    }

                    db.run(`INSERT INTO children (user_id, child_name, child_gender, role, age) VALUES (?, ?, ?, ?, 0)`, [motherId, childName, childGender, childRole], function(err) {
                        if (err) {
                            db.run("ROLLBACK");
                            return res.status(500).json({ error: 'Çocuk kaydı oluşturulamadı.' });
                        }

                        db.run(`UPDATE users SET children_count = children_count + 1 WHERE id = ? OR id = ?`, [motherId, fatherId], function(err) {
                            if (err) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ error: 'Çocuk sayısı güncellenemedi.' });
                            }

                            db.run("COMMIT", (err) => {
                                if (err) {
                                    db.run("ROLLBACK");
                                    return res.status(500).json({ error: 'İşlem tamamlanamadı.' });
                                }
                                res.json({ message: `Tebrikler! ${childCost} altın karşılığında ${childName} adında bir ${childGender === 'male' ? 'oğlunuz' : 'kızınız'} oldu! Rol: ${childRole}.` });
                            });
                        });
                    });
                });
            });
        };

        if (user.gender === 'male') {
            if (!wifeId) return res.status(400).json({ error: 'Çocuk yapmak için bir eş seçmelisiniz.' });
            db.get("SELECT wife_id FROM marriages WHERE husband_id = ? AND wife_id = ?", [userId, wifeId], (err, marriage) => {
                if (err) return res.status(500).json({ error: 'Veritabanı hatası.' });
                if (!marriage) return res.status(400).json({ error: 'Seçilen kullanıcı eşiniz değil.' });
                createChild(wifeId, userId);
            });
        } else {
            db.get("SELECT husband_id FROM marriages WHERE wife_id = ?", [userId], (err, marriage) => {
                if (err) return res.status(500).json({ error: 'Veritabanı hatası.' });
                if (!marriage) return res.status(400).json({ error: 'Bu işlemi yapmak için evli olmalısınız.' });
                createChild(userId, marriage.husband_id);
            });
        }
    });
});

// Çocukları getir
app.get('/api/children', authenticateToken, (req, res) => {
    db.get(`SELECT id, gender FROM users WHERE id = ?`, [req.user.id], (err, user) => {
        if (err || !user) {
            return res.status(500).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const query = user.gender === 'female'
            ? `SELECT child_name, child_gender, COALESCE(role, 'Çocuk') as role, COALESCE(age, 0) as age FROM children WHERE user_id = ? ORDER BY created_at DESC`
            : `SELECT c.child_name, c.child_gender, COALESCE(c.role, 'Çocuk') as role, COALESCE(c.age, 0) as age
               FROM children c
               JOIN marriages m ON m.wife_id = c.user_id
               WHERE m.husband_id = ?
               ORDER BY c.created_at DESC`;

        db.all(query, [user.id], (err, children) => {
            if (err) {
                return res.status(500).json({ error: 'Çocuklar alınamadı.' });
            }
            res.json(children || []);
        });
    });
});

// Evlilik Endpoint'leri

// Evlilik teklifi yap
app.post('/api/propose-marriage', authenticateToken, (req, res) => {
    const { proposedUsername } = req.body;
    const proposerId = req.user.id;

    db.get(`SELECT * FROM users WHERE id = ?`, [proposerId], async (err, proposer) => {
        if (err || !proposer) return res.status(500).json({ error: 'Teklif eden kullanıcı bulunamadı.' });
        if (!proposer.gender) return res.status(400).json({ error: 'Cinsiyet bilginiz ayarlanmamış.' });

        const proposed = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE username = ?`, [proposedUsername], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!proposed) return res.status(404).json({ error: 'Teklif edilen kullanıcı bulunamadı.' });
        if (proposed.id === proposerId) return res.status(400).json({ error: 'Kendinize evlilik teklif edemezsiniz.' });
        if (!proposed.gender) return res.status(400).json({ error: 'Teklif edilen kullanıcının cinsiyet bilgisi yok.' });
        if (proposed.gender === proposer.gender) return res.status(400).json({ error: 'Sadece karşı cinsten biriyle evlenebilirsiniz.' });

        if (proposer.gender === 'male') {
            const existingMarriage = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM marriages WHERE husband_id = ? AND wife_id = ?", [proposerId, proposed.id], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (existingMarriage) return res.status(400).json({ error: 'Bu kullanıcı ile zaten evlisiniz.' });
            
            const proposedUserMarriage = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM marriages WHERE wife_id = ?", [proposed.id], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (proposedUserMarriage) return res.status(400).json({ error: `${proposedUsername} zaten başka biriyle evli.` });

        } else { // Proposer is female
            const existingMarriage = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM marriages WHERE wife_id = ?", [proposerId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (existingMarriage) return res.status(400).json({ error: 'Zaten evlisiniz.' });
        }

        // Köle evlilik kuralı
        const proposerIsSlave = !!proposer.master_id;
        const proposedIsSlave = !!proposed.master_id;

        if (proposerIsSlave && !proposedIsSlave) {
            return res.status(400).json({ error: 'Bir köle olarak özgür birine evlenme teklif edemezsiniz.' });
        }

        // Efendi kölesine evlenme teklif edebilir.
        if (!proposerIsSlave && proposedIsSlave) {
            if (proposed.master_id !== proposer.id) {
                return res.status(400).json({ error: 'Özgür bir birey olarak sadece kendi kölenizle evlenebilirsiniz.' });
            }
        }

        db.get(`SELECT id FROM marriage_proposals WHERE ((proposer_id = ? AND proposee_id = ?) OR (proposer_id = ? AND proposee_id = ?)) AND status = 'pending'`, 
            [proposerId, proposed.id, proposed.id, proposerId], (err, existing) => {
            if (err) {
                console.error('Marriage proposal check error:', err);
                return res.status(500).json({ error: 'Veritabanı hatası.' });
            }
            if (existing) return res.status(400).json({ error: 'Bu kullanıcıya zaten gönderilmiş veya ondan alınmış bekleyen bir teklif var.' });

            db.run(`INSERT INTO marriage_proposals (proposer_id, proposee_id) VALUES (?, ?)`, [proposerId, proposed.id], function(err) {
                if (err) {
                    console.error('Marriage proposal creation error:', err);
                    return res.status(500).json({ error: 'Teklif oluşturulamadı.' });
                }
                res.status(201).json({ message: `${proposedUsername} kullanıcısına evlilik teklifi gönderildi.` });
            });
        });
    });
});

// Bekleyen teklifleri gör
app.get('/api/proposals', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const response = {
        incoming: [],
        outgoing: []
    };

    db.all(`SELECT p.id, u.username as proposer_username FROM marriage_proposals p JOIN users u ON p.proposer_id = u.id WHERE p.proposee_id = ? AND p.status = 'pending'`, 
        [userId], (err, incoming) => {
        if (err) return res.status(500).json({ error: 'Gelen teklifler alınamadı.' });
        response.incoming = incoming;

        db.all(`SELECT p.id, u.username as proposee_username FROM marriage_proposals p JOIN users u ON p.proposee_id = u.id WHERE p.proposer_id = ? AND p.status = 'pending'`,
            [userId], (err, outgoing) => {
            if (err) return res.status(500).json({ error: 'Giden teklifler alınamadı.' });
            response.outgoing = outgoing;
            res.json(response);
        });
    });
});

// Teklifi kabul et
app.post('/api/accept-proposal', authenticateToken, (req, res) => {
    const { proposalId } = req.body;
    const userId = req.user.id;

    // 1. Teklifi bul
    db.get(`SELECT * FROM marriage_proposals WHERE id = ? AND proposee_id = ? AND status = 'pending'`, [proposalId, userId], (err, proposal) => {
        if (err) {
            console.error("Accept proposal - Step 1: Find proposal failed", err);
            return res.status(500).json({ error: 'Veritabanı hatası (1).' });
        }
        if (!proposal) {
            return res.status(404).json({ error: 'Geçerli bir teklif bulunamadı.' });
        }
        
        const proposerId = proposal.proposer_id;
        const proposeeId = proposal.proposee_id;

        // 2. Teklif edeni ve edileni bul
        db.get(`SELECT id, gender, master_id FROM users WHERE id = ?`, [proposerId], (err, proposer) => {
            if (err) return res.status(500).json({ error: 'Veritabanı hatası (2).' });
            
            db.get(`SELECT id, gender, master_id FROM users WHERE id = ?`, [proposeeId], (err, proposee) => {
                if (err) return res.status(500).json({ error: 'Veritabanı hatası (3).' });

                const husband = proposer.gender === 'male' ? proposer : proposee;
                const wife = proposer.gender === 'female' ? proposer : proposee;

                // 3. Evlilik kontrolleri
                db.get("SELECT id FROM marriages WHERE wife_id = ?", [wife.id], (err, wifeMarriage) => {
                    if (err) return res.status(500).json({ error: 'Veritabanı hatası (4).' });
                    if (wifeMarriage) {
                        // Kadın zaten evliyse teklifi reddet
                        db.run(`UPDATE marriage_proposals SET status = 'rejected' WHERE id = ?`, [proposalId]);
                        return res.status(400).json({ error: 'Teklif artık geçerli değil, teklif eden veya edilen başka biriyle evlenmiş.' });
                    }
                    
                    // 4. Tüm kontrollerden geçti, şimdi işlemi yap
                    db.serialize(() => {
                        db.run("BEGIN TRANSACTION");

                        // Köle evliliklerinde sahip izni kontrolü
                        if (husband.master_id && wife.master_id && husband.master_id !== wife.master_id) {
                            db.run("ROLLBACK");
                            return res.status(403).json({ error: 'Köleler sadece aynı efendiye hizmet ediyorlarsa evlenebilirler.' });
                        }

                        // Evliliği gerçekleştir
                        db.run(`INSERT INTO marriages (husband_id, wife_id) VALUES (?, ?)`, [husband.id, wife.id], function(err) {
                            if (err) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ error: 'Evlilik oluşturulamadı.' });
                            }
                            
                            // Kocanın eş sayısını artır
                            db.run(`UPDATE users SET wife_count = wife_count + 1 WHERE id = ?`, [husband.id]);

                            // Eğer efendi kölesiyle evleniyorsa, köleyi özgür bırak
                            if (wife.master_id && husband.id === wife.master_id) {
                                db.run(`UPDATE users SET master_id = NULL WHERE id = ?`, [wife.id]);
                            }

                            // Teklifi kabul et
                            db.run(`UPDATE marriage_proposals SET status = 'accepted' WHERE id = ?`, [proposalId]);
                            // Her iki kullanıcının diğer tüm bekleyen tekliflerini sil
                            db.run(`DELETE FROM marriage_proposals WHERE (proposer_id = ? OR proposee_id = ? OR proposer_id = ? OR proposee_id = ?) AND status = 'pending'`,
                                [proposerId, proposerId, proposeeId, proposeeId]);
                            
                            db.run("COMMIT", (commitErr) => {
                                if (commitErr) {
                                    db.run("ROLLBACK");
                                    console.error("Accept proposal - Step 4: Commit failed", commitErr);
                                    return res.status(500).json({ error: 'Evlilik işlemi başarısız oldu.' });
                                }
                                res.json({ message: 'Tebrikler! Evlendiniz.' });
                            });
                        });
                    });
                });
            });
        });
    });
});

// Teklifi reddet
app.post('/api/decline-proposal', authenticateToken, (req, res) => {
    const { proposalId } = req.body;
    db.run(`UPDATE marriage_proposals SET status = 'declined' WHERE id = ? AND proposee_id = ?`, [proposalId, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: 'Teklif reddedilemedi.' });
        if (this.changes === 0) return res.status(404).json({ error: 'Teklif bulunamadı.' });
        res.json({ message: 'Teklif reddedildi.' });
    });
});

// Gönderilen teklifi iptal et
app.post('/api/cancel-proposal', authenticateToken, (req, res) => {
    const { proposalId } = req.body;
    db.run(`DELETE FROM marriage_proposals WHERE id = ? AND proposer_id = ? AND status = 'pending'`, [proposalId, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: 'Teklif iptal edilemedi.' });
        if (this.changes === 0) return res.status(404).json({ error: 'İptal edilecek teklif bulunamadı.' });
        res.json({ message: 'Teklif iptal edildi.' });
    });
});

// Boşanma
app.post('/api/divorce', authenticateToken, (req, res) => {
    const { wifeId } = req.body; // Sadece erkekler için dolu olacak
    const userId = req.user.id;

    db.get(`SELECT id, gender FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err || !user) return res.status(500).json({ error: 'Kullanıcı bulunamadı.' });

        if (user.gender === 'male') {
            if (!wifeId) {
                return res.status(400).json({ error: 'Boşanmak için bir eş seçmelisiniz.' });
            }
            db.get("SELECT id, husband_id FROM marriages WHERE husband_id = ? AND wife_id = ?", [userId, wifeId], (err, marriage) => {
                if (err) return res.status(500).json({ error: 'Veritabanı hatası.' });
                if (!marriage) return res.status(404).json({ error: 'Evlilik bulunamadı.' });

                db.run("DELETE FROM marriages WHERE id = ?", [marriage.id], function(err) {
                    if (err) return res.status(500).json({ error: 'Boşanma işlemi başarısız oldu.' });
                    db.run("UPDATE users SET wife_count = wife_count - 1 WHERE id = ?", [marriage.husband_id]);
                    res.json({ message: 'Boşanma işlemi tamamlandı.' });
                });
            });
        } else { // female
            db.get("SELECT id, husband_id FROM marriages WHERE wife_id = ?", [userId], (err, marriage) => {
                if (err) return res.status(500).json({ error: 'Veritabanı hatası.' });
                if (!marriage) return res.status(400).json({ error: 'Zaten evli değilsiniz.' });

                db.run("DELETE FROM marriages WHERE id = ?", [marriage.id], function(err) {
                    if (err) return res.status(500).json({ error: 'Boşanma işlemi başarısız oldu.' });
                     db.run("UPDATE users SET wife_count = wife_count - 1 WHERE id = ?", [marriage.husband_id]);
                    res.json({ message: 'Boşanma işlemi tamamlandı.' });
                });
            });
        }
    });
});

// Gelen Kutusu Endpoint'leri
app.get('/api/inbox', authenticateToken, (req, res) => {
    db.all(`SELECT id, sender_username, title, is_read, created_at FROM inbox_messages WHERE user_id = ? ORDER BY created_at DESC`, 
        [req.user.id], (err, messages) => {
        if (err) {
            return res.status(500).json({ error: 'Mesajlar alınamadı.' });
        }
        res.json(messages || []);
    });
});

app.get('/api/inbox/:id', authenticateToken, (req, res) => {
    const messageId = req.params.id;
    db.get(`SELECT * FROM inbox_messages WHERE id = ? AND user_id = ?`, [messageId, req.user.id], (err, message) => {
        if (err) {
            return res.status(500).json({ error: 'Mesaj alınamadı.' });
        }
        if (!message) {
            return res.status(404).json({ error: 'Mesaj bulunamadı.' });
        }
        res.json(message);
    });
});

app.put('/api/inbox/read/:id', authenticateToken, (req, res) => {
    const messageId = req.params.id;
    db.run(`UPDATE inbox_messages SET is_read = 1 WHERE id = ? AND user_id = ?`, [messageId, req.user.id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Mesaj güncellenemedi.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Mesaj bulunamadı.' });
        }
        res.json({ message: 'Mesaj okundu olarak işaretlendi.' });
    });
});

function requireAdmin(req, res, next) {
    db.get(`SELECT username, rank FROM users WHERE id = ?`, [req.user.id], (err, user) => {
        if (err || !user) {
            return res.status(500).json({ error: 'Kullanıcı bulunamadı.' });
        }
        if (user.username !== 'admin') {
            return res.status(403).json({ error: 'Bu işlem sadece admin hesabı ile yapılabilir.' });
        }
        req.adminUser = user;
        next();
    });
}

function wouldCreateMasterCycle(users, userId, candidateMasterId) {
    if (!candidateMasterId) return false;
    if (userId === candidateMasterId) return true;

    const masterByUser = new Map(users.map(user => [Number(user.id), user.master_id ? Number(user.master_id) : null]));
    let cursor = Number(candidateMasterId);
    const seen = new Set();

    while (cursor) {
        if (cursor === Number(userId)) return true;
        if (seen.has(cursor)) return true;
        seen.add(cursor);
        cursor = masterByUser.get(cursor);
    }

    return false;
}

app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    db.all(`SELECT u.id, u.username, u.rank, u.level, u.experience, u.coins, u.food, u.material, u.weapons,
                   u.gender, u.kingdom_id, u.master_id, k.name as kingdom_name, m.username as master_username,
                   (SELECT COUNT(*) FROM users s WHERE s.master_id = u.id) as slave_count,
                   u.created_at
            FROM users u
            LEFT JOIN kingdoms k ON k.id = u.kingdom_id
            LEFT JOIN users m ON m.id = u.master_id
            WHERE u.username != 'admin'
            ORDER BY u.created_at DESC`, (err, users) => {
        if (err) return res.status(500).json({ error: 'Kullanıcılar alınamadı.' });
        res.json(users || []);
    });
});

app.get('/api/admin/kingdoms', authenticateToken, requireAdmin, (req, res) => {
    db.all(`SELECT k.id, k.name, k.description, k.x, k.y, k.king_id,
                   COALESCE(k.tax_rate, 10) as tax_rate,
                   COALESCE(k.market_tax_rate, 0) as market_tax_rate,
                   u.username as king_username,
                   (SELECT COUNT(*) FROM users WHERE kingdom_id = k.id) as population,
                   (SELECT COUNT(*) FROM users WHERE kingdom_id = k.id AND rank = 'Kral') as king_count,
                   (SELECT COUNT(*) FROM users WHERE kingdom_id = k.id AND rank = 'Vezir') as vezir_count
            FROM kingdoms k
            LEFT JOIN users u ON u.id = k.king_id
            ORDER BY k.name`, (err, kingdoms) => {
        if (err) return res.status(500).json({ error: 'Krallıklar alınamadı.' });
        res.json(kingdoms || []);
    });
});

app.put('/api/admin/kingdoms/:id', authenticateToken, requireAdmin, (req, res) => {
    const kingdomId = parseInt(req.params.id, 10);
    const {
        name,
        description,
        x,
        y,
        tax_rate,
        market_tax_rate,
        king_user_id,
        clear_king
    } = req.body;

    if (!kingdomId) {
        return res.status(400).json({ error: 'Geçersiz krallık ID.' });
    }

    const safeName = String(name || '').trim();
    const safeDescription = String(description || '').trim();
    const safeX = Number.isFinite(Number(x)) ? clampInteger(x, 0, 9999) : null;
    const safeY = Number.isFinite(Number(y)) ? clampInteger(y, 0, 9999) : null;
    const safeTaxRate = clampInteger(tax_rate, 0, 25);
    const safeMarketTaxRate = clampInteger(market_tax_rate, 0, 15);
    const targetKingId = clear_king ? null : (king_user_id ? parseInt(king_user_id, 10) : null);

    db.get(`SELECT id, name, king_id FROM kingdoms WHERE id = ?`, [kingdomId], (kingdomErr, kingdom) => {
        if (kingdomErr) return res.status(500).json({ error: 'Krallık alınamadı.' });
        if (!kingdom) return res.status(404).json({ error: 'Krallık bulunamadı.' });

        const nextName = safeName || kingdom.name;
        db.all(`SELECT id, username, kingdom_id, rank FROM users WHERE kingdom_id = ? OR id = ?`, [kingdomId, targetKingId || 0], (usersErr, users) => {
            if (usersErr) return res.status(500).json({ error: 'Kullanıcılar alınamadı.' });
            const targetKing = targetKingId ? users.find((user) => Number(user.id) === Number(targetKingId)) : null;
            if (targetKingId && !targetKing) {
                return res.status(400).json({ error: 'Seçilen kral bu krallıkta bulunamadı.' });
            }
            if (targetKing && isAdminUsername(targetKing.username)) {
                return res.status(400).json({ error: 'Admin hesabı kral yapılamaz.' });
            }
            const hasExistingKing = Boolean(kingdom.king_id);

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run(
                    `UPDATE kingdoms
                     SET name = ?, description = ?, x = COALESCE(?, x), y = COALESCE(?, y),
                         tax_rate = ?, market_tax_rate = ?
                     WHERE id = ?`,
                    [nextName, safeDescription || kingdom.description, safeX, safeY, safeTaxRate, safeMarketTaxRate, kingdomId],
                    function(updateErr) {
                        if (updateErr) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Krallık güncellenemedi.' });
                        }

                        const finish = () => {
                            db.run('COMMIT', (commitErr) => {
                                if (commitErr) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Krallık güncellenemedi.' });
                                }
                                res.json({
                                    message: 'Krallık güncellendi.',
                                    kingdomId,
                                    values: {
                                        name: nextName,
                                        description: safeDescription || kingdom.description,
                                        x: safeX,
                                        y: safeY,
                                        tax_rate: safeTaxRate,
                                        market_tax_rate: safeMarketTaxRate,
                                        king_user_id: targetKingId
                                    }
                                });
                            });
                        };

                        if (clear_king) {
                            db.run(`UPDATE users SET rank = 'Vezir' WHERE id = ?`, [kingdom.king_id], (clearOldErr) => {
                                if (clearOldErr) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Eski kral kaldırılamadı.' });
                                }
                                db.run(`UPDATE kingdoms SET king_id = NULL WHERE id = ?`, [kingdomId], (clearKingErr) => {
                                    if (clearKingErr) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: 'Kral bilgisi temizlenemedi.' });
                                    }
                                    finish();
                                });
                            });
                            return;
                        }

                        if (!targetKingId) {
                            if (!hasExistingKing) {
                                db.run(`UPDATE kingdoms SET king_id = NULL WHERE id = ?`, [kingdomId], (clearKingErr) => {
                                    if (clearKingErr) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: 'Kral bilgisi temizlenemedi.' });
                                    }
                                    finish();
                                });
                                return;
                            }
                            finish();
                            return;
                        }

                        if (Number(kingdom.king_id) && Number(kingdom.king_id) !== targetKingId) {
                            db.run(`UPDATE users SET rank = 'Vezir' WHERE id = ?`, [kingdom.king_id], (oldKingErr) => {
                                if (oldKingErr) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Eski kral rütbesi değiştirilemedi.' });
                                }
                                db.run(`UPDATE users SET kingdom_id = ?, rank = 'Kral' WHERE id = ?`, [kingdomId, targetKingId], (assignErr) => {
                                    if (assignErr) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: 'Kral kullanıcıya atanamadı.' });
                                    }
                                    db.run(`UPDATE kingdoms SET king_id = ? WHERE id = ?`, [targetKingId, kingdomId], (setKingErr) => {
                                        if (setKingErr) {
                                            db.run('ROLLBACK');
                                            return res.status(500).json({ error: 'Kral atanamadı.' });
                                        }
                                        finish();
                                    });
                                });
                            });
                            return;
                        }

                        db.run(`UPDATE users SET kingdom_id = ?, rank = 'Kral' WHERE id = ?`, [kingdomId, targetKingId], (assignErr) => {
                            if (assignErr) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Kral kullanıcıya atanamadı.' });
                            }

                            db.run(`UPDATE kingdoms SET king_id = ? WHERE id = ?`, [targetKingId, kingdomId], (setKingErr) => {
                                if (setKingErr) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Kral atanamadı.' });
                                }
                                finish();
                            });
                        });
                    }
                );
            });
        });
    });
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const allowedRanks = ['Kral', 'Vezir', 'Komutan', 'Asilzade', 'Vatandaş'];
    const { coins, food, material, weapons, rank, level, experience, kingdom_id, master_id } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'Geçersiz kullanıcı ID.' });
    }
    if (rank && !allowedRanks.includes(rank)) {
        return res.status(400).json({ error: 'Geçersiz rütbe.' });
    }

    const values = {
        coins: Math.max(0, parseInt(coins ?? 0, 10) || 0),
        food: Math.max(0, parseInt(food ?? 0, 10) || 0),
        material: Math.max(0, parseInt(material ?? 0, 10) || 0),
        weapons: Math.max(0, parseInt(weapons ?? 0, 10) || 0),
        level: Math.max(1, parseInt(level ?? 1, 10) || 1),
        experience: Math.max(0, parseInt(experience ?? 0, 10) || 0),
        kingdomId: Math.max(1, parseInt(kingdom_id ?? 1, 10) || 1),
        masterId: master_id ? Math.max(1, parseInt(master_id, 10) || 0) : null,
        rank: rank || 'Vatandaş'
    };

    db.all(`SELECT id, username, master_id FROM users`, (usersErr, allUsers) => {
        if (usersErr) return res.status(500).json({ error: 'Kullanıcılar alınamadı.' });
        const target = allUsers.find(user => Number(user.id) === userId);
        if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        if (target.username === 'admin') return res.status(400).json({ error: 'Admin hesabı düzenlenemez.' });
        const effectiveMasterId = values.rank === 'Kral' ? null : values.masterId;
        if (effectiveMasterId && !allUsers.some(user => Number(user.id) === effectiveMasterId && user.username !== 'admin')) {
            return res.status(400).json({ error: 'Seçilen sahip bulunamadı.' });
        }
        if (wouldCreateMasterCycle(allUsers, userId, effectiveMasterId)) {
            return res.status(400).json({ error: 'Bu sahip seçimi hiyerarşide döngü oluşturur.' });
        }

        db.get(`SELECT id FROM kingdoms WHERE id = ?`, [values.kingdomId], (kingdomErr, kingdom) => {
            if (kingdomErr) return res.status(500).json({ error: 'Krallık kontrol edilemedi.' });
            if (!kingdom) return res.status(400).json({ error: 'Seçilen krallık bulunamadı.' });

            const finalRank = effectiveMasterId ? 'Vatandaş' : values.rank;
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                const updateTargetUser = () => db.run(`UPDATE users
                                SET coins = ?, food = ?, material = ?, weapons = ?, level = ?, experience = ?,
                                    rank = ?, kingdom_id = ?, master_id = ?
                                WHERE id = ?`,
                            [
                                values.coins, values.food, values.material, values.weapons, values.level, values.experience,
                                finalRank, values.kingdomId, effectiveMasterId, userId
                            ],
                            afterTargetUpdate);

                const afterTargetUpdate = function(updateErr) {
                        if (updateErr) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Kullanıcı güncellenemedi.' });
                        }
                        if (this.changes === 0) {
                            db.run('ROLLBACK');
                            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
                        }

                        db.run(`UPDATE kingdoms SET king_id = NULL WHERE king_id = ?`, [userId], (clearKingErr) => {
                            if (clearKingErr) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Eski kral bilgisi temizlenemedi.' });
                            }

                            const finish = () => {
                                db.run('COMMIT', (commitErr) => {
                                    if (commitErr) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: 'Kullanıcı güncellenemedi.' });
                                    }
                                    res.json({ message: 'Kullanıcı güncellendi.', userId, values: { ...values, masterId: effectiveMasterId, rank: finalRank } });
                                });
                            };

                            if (finalRank !== 'Kral') {
                                finish();
                                return;
                            }

                            db.run(`UPDATE users SET rank = 'Vezir' WHERE id = (SELECT king_id FROM kingdoms WHERE id = ?) AND id != ?`,
                                [values.kingdomId, userId], (oldKingErr) => {
                                if (oldKingErr) {
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Eski kral rütbesi güncellenemedi.' });
                                }
                                db.run(`UPDATE kingdoms SET king_id = ? WHERE id = ?`, [userId, values.kingdomId], (kingErr) => {
                                    if (kingErr) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: 'Kral atanamadı.' });
                                    }
                                    finish();
                                });
                            });
                        });
                    };

                if (target.master_id && !effectiveMasterId) {
                    db.run(`UPDATE users SET master_id = ? WHERE master_id = ?`, [target.master_id, userId], (reparentErr) => {
                        if (reparentErr) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Alt köleler devredilemedi.' });
                        }
                        updateTargetUser();
                    });
                    return;
                }

                updateTargetUser();
            });
        });
    });
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const userId = parseInt(req.params.id, 10);

    if (!userId) {
        return res.status(400).json({ error: 'Geçersiz kullanıcı ID.' });
    }

    db.get(`SELECT id, username, referral_code FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err) return res.status(500).json({ error: 'Kullanıcı alınamadı.' });
        if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        if (user.username === 'admin') {
            return res.status(400).json({ error: 'Admin hesabı silinemez.' });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('UPDATE users SET master_id = NULL WHERE master_id = ?', [userId]);
            db.run('UPDATE kingdoms SET king_id = NULL WHERE king_id = ?', [userId]);
            db.run('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?', [userId]);
            db.run('DELETE FROM buildings WHERE user_id = ?', [userId]);
            db.run('DELETE FROM research WHERE user_id = ?', [userId]);
            db.run('DELETE FROM travel_history WHERE user_id = ?', [userId]);
            db.run('DELETE FROM investments WHERE user_id = ?', [userId]);
            db.run('DELETE FROM productions WHERE user_id = ?', [userId]);
            db.run('DELETE FROM inbox_messages WHERE user_id = ?', [userId]);
            db.run('DELETE FROM children WHERE user_id = ?', [userId]);
            db.run('DELETE FROM marriages WHERE husband_id = ? OR wife_id = ?', [userId, userId]);
            db.run('DELETE FROM marriage_proposals WHERE proposer_id = ? OR proposee_id = ?', [userId, userId]);
            db.run('DELETE FROM slave_sales WHERE slave_id = ? OR seller_id = ? OR buyer_id = ?', [userId, userId, userId]);
            if (user.referral_code) {
                db.run('DELETE FROM invitations WHERE referral_code = ?', [user.referral_code]);
            }
            db.run('DELETE FROM users WHERE id = ?', [userId], function(deleteErr) {
                if (deleteErr) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Kullanıcı silinemedi.' });
                }
                if (this.changes === 0) {
                    db.run('ROLLBACK');
                    return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
                }
                db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Kullanıcı silinemedi.' });
                    }
                    res.json({ message: `${user.username} silindi.`, userId });
                });
            });
        });
    });
});

app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 300);
    db.all(`SELECT id, user_id, username, action, method, path, status_code,
                   ip_address, user_agent, request_body, created_at
            FROM audit_logs
            ORDER BY created_at DESC, id DESC
            LIMIT ?`, [limit], (err, logs) => {
        if (err) return res.status(500).json({ error: 'Audit log kayıtları alınamadı.' });
        res.json(logs || []);
    });
});

app.post('/api/admin/announcement', authenticateToken, requireAdmin, (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Başlık ve içerik gerekli.' });
    }

    db.all(`SELECT id FROM users`, [], (err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Kullanıcılar alınamadı.' });
        }

        const stmt = db.prepare(`INSERT INTO inbox_messages (user_id, sender_username, title, content) VALUES (?, ?, ?, ?)`);
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            users.forEach(user => {
                stmt.run(user.id, req.adminUser.username, title, content);
            });
            db.run("COMMIT", (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: 'Duyuru gönderilemedi.' });
                }
                stmt.finalize();
                res.json({ message: 'Duyuru tüm kullanıcılara başarıyla gönderildi.' });
            });
        });
    });
});

// Küresel Sıralamalar
app.get('/api/rankings', authenticateToken, (req, res) => {
    const rankings = {
        byLevel: [],
        byCoins: [],
        bySlaves: []
    };
    const limit = 10; // Her sıralama için top 10

    // Seviyeye göre sıralama
    db.all(`SELECT username, level FROM users ORDER BY level DESC, experience DESC LIMIT ?`, [limit], (err, byLevel) => {
        if (err) return res.status(500).json({ error: 'Sıralamalar alınamadı.' });
        rankings.byLevel = byLevel;

        // Altına göre sıralama
        db.all(`SELECT username, coins FROM users ORDER BY coins DESC LIMIT ?`, [limit], (err, byCoins) => {
            if (err) return res.status(500).json({ error: 'Sıralamalar alınamadı.' });
            rankings.byCoins = byCoins;

            // Köle sayısına göre sıralama
            db.all(`SELECT u.username, (SELECT COUNT(*) FROM users s WHERE s.master_id = u.id) as slave_count 
                    FROM users u ORDER BY slave_count DESC LIMIT ?`, [limit], (err, bySlaves) => {
                if (err) return res.status(500).json({ error: 'Sıralamalar alınamadı.' });
                rankings.bySlaves = bySlaves;
                res.json(rankings);
            });
        });
    });
});

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Sunucuyu başlat
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Sunucu http://${HOST}:${PORT} adresinde çalışıyor`);
  });
}

module.exports = app;

