const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { initializeSchema } = require('./db');
const { ROOT_DIR, SESSION_SECRET, NODE_ENV, SESSION_DB_DIR } = require('./config');
const { db } = require('./db');
const flashMiddleware = require('./middleware/flash');
const { attachCurrentUser } = require('./middleware/auth');
const { ensureCsrfToken } = require('./middleware/csrf');
const { attachMaintenanceState, enforceMaintenanceMode } = require('./middleware/maintenance');
const { logError } = require('./utils/logger');
const { buildFeatureFlags } = require('./utils/features');
const { canReviewContent, isContentApprovalEnabled } = require('./utils/contentApproval');
const { getYearbookLockState } = require('./utils/yearbookLock');
const { isSchoolManager } = require('./utils/schoolScope');

/* MIDI pool — 60 saniyelik cache ile klasörü okur */
let _bgmCache = null, _bgmCacheTime = 0;
function getBgmFiles() {
  const now = Date.now();
  if (_bgmCache && now - _bgmCacheTime < 60000) return _bgmCache;
  try {
    const dir = path.join(ROOT_DIR, 'frontend', 'public', 'audio', 'midi');
    _bgmCache = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.mid')).sort();
  } catch (e) { _bgmCache = []; }
  _bgmCacheTime = now;
  return _bgmCache;
}

const authRoutes = require('./routes/auth');
const homeRoutes = require('./routes/home');
const profileRoutes = require('./routes/profiles');
const anonymousRoutes = require('./routes/anonymous');
const adminRoutes = require('./routes/admin');
const mediaRoutes = require('./routes/media');
const kenanGameApp = require(path.join(ROOT_DIR, 'games', 'Kenan', 'server'));
const reversiGameApp = require(path.join(ROOT_DIR, 'games', 'Reversi', 'server'));
const boardGamesApp = require(path.join(ROOT_DIR, 'games', 'BoardGames', 'server'));
const mangalaGameApp = require(path.join(ROOT_DIR, 'games', 'Mangala', 'server'));
const kuyulamacGameApp = require(path.join(ROOT_DIR, 'games', 'Kuyulamac', 'server'));
const altiGameApp = require(path.join(ROOT_DIR, 'games', 'Alti', 'server'));
const okeyGameApp = require(path.join(ROOT_DIR, 'games', 'Okey', 'server'));
const okey101GameApp = require(path.join(ROOT_DIR, 'games', 'Okey101', 'server'));
const naneOkeyGameApp = require(path.join(ROOT_DIR, 'games', 'NaneOkey', 'server'));
const batakGameApp = require(path.join(ROOT_DIR, 'games', 'Batak', 'server'));
const unoGameApp = require(path.join(ROOT_DIR, 'games', 'Uno', 'server'));
const scrabbleGameApp = require(path.join(ROOT_DIR, 'games', 'Scrabble', 'server'));
const lingoGameApp = require(path.join(ROOT_DIR, 'games', 'Lingo', 'server'));
const sudokuGameApp = require(path.join(ROOT_DIR, 'games', 'Sudoku', 'server'));
const kakuroGameApp = require(path.join(ROOT_DIR, 'games', 'Kakuro', 'server'));
const kareKaralaGameApp = require(path.join(ROOT_DIR, 'games', 'KareKarala', 'server'));
const damaGameApp = require(path.join(ROOT_DIR, 'games', 'Dama', 'server'));
const satrancGameApp = require(path.join(ROOT_DIR, 'games', 'Satranc', 'server'));
const dortluBirlestirGameApp = require(path.join(ROOT_DIR, 'games', 'DortluBirlestir', 'server'));
const mastermindGameApp = require(path.join(ROOT_DIR, 'games', 'Mastermind', 'server'));
const xoxGameApp = require(path.join(ROOT_DIR, 'games', 'XOX', 'server'));
const sosGameApp = require(path.join(ROOT_DIR, 'games', 'SOS', 'server'));
const kutuDoldurmacaGameApp = require(path.join(ROOT_DIR, 'games', 'KutuDoldurmaca', 'server'));
const yilanlarVeMerdivenlerGameApp = require(path.join(ROOT_DIR, 'games', 'YilanlarVeMerdivenler', 'server'));
const dokuzTasGameApp = require(path.join(ROOT_DIR, 'games', 'DokuzTas', 'server'));
const ucTasGameApp = require(path.join(ROOT_DIR, 'games', 'UcTas', 'server'));
const abaloneGameApp = require(path.join(ROOT_DIR, 'games', 'Abalone', 'server'));
const tavlaGameApp = require(path.join(ROOT_DIR, 'games', 'Tavla', 'server'));
const koridorGameApp = require(path.join(ROOT_DIR, 'games', 'Koridor', 'server'));
const dominoGameApp = require(path.join(ROOT_DIR, 'games', 'Domino', 'server'));
const goGameApp = require(path.join(ROOT_DIR, 'games', 'Go', 'server'));
const kizmaBiraderGameApp = require(path.join(ROOT_DIR, 'games', 'KizmaBirader', 'server'));
const koiKoiGameApp = require(path.join(ROOT_DIR, 'games', 'KoiKoi', 'server'));
const siselerGameApp = require(path.join(ROOT_DIR, 'games', 'Siseler', 'server'));
const otoparkRedWoodGameApp = require(path.join(ROOT_DIR, 'games', 'OtoparkRedWood', 'server'));

initializeSchema();

function canManageSchools(user) {
  return isSchoolManager(user);
}

function buildSessionStore(sessionLib) {
  if (process.env.DATABASE_URL) {
    const PgSession = require('connect-pg-simple')(sessionLib);
    return new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: 'user_sessions'
    });
  }

  const SQLiteStoreFactory = require('connect-sqlite3');
  const SQLiteStore = SQLiteStoreFactory(sessionLib);
  return new SQLiteStore({
    db: 'sessions.db',
    dir: SESSION_DB_DIR
  });
}

const app = express();

app.set('trust proxy', NODE_ENV === 'production' ? 1 : false);
app.set('view engine', 'ejs');
app.set('views', path.join(ROOT_DIR, 'frontend', 'views'));

app.use((req, res, next) => {
  if (req.originalUrl === '/games/kenan/play') {
    return res.redirect('/games/kenan/play/');
  }
  if (req.originalUrl === '/games/reversi/play') {
    return res.redirect('/games/reversi/play/');
  }
  if (req.originalUrl === '/games/mangala/play') {
    return res.redirect('/games/mangala/play/');
  }
  if (req.originalUrl === '/games/kuyulamac/play') {
    return res.redirect('/games/kuyulamac/play/');
  }
  if (req.originalUrl === '/games/alti/play') {
    return res.redirect('/games/alti/play/');
  }
  if (req.originalUrl === '/games/okey/play') {
    return res.redirect('/games/okey/play/');
  }
  if (req.originalUrl === '/games/101-okey/play') {
    return res.redirect('/games/101-okey/play/');
  }
  if (req.originalUrl === '/games/nane-okey/play') {
    return res.redirect('/games/nane-okey/play/');
  }
  if (req.originalUrl === '/games/batak/play') {
    return res.redirect('/games/batak/play/');
  }
  if (req.originalUrl === '/games/uno/play') {
    return res.redirect('/games/uno/play/');
  }
  if (req.originalUrl === '/games/otopark/play') {
    return res.redirect('/games/otopark/play/');
  }
  if (req.originalUrl === '/games/scrabble/play') {
    return res.redirect('/games/scrabble/play/');
  }
  if (req.originalUrl === '/games/lingo/play') {
    return res.redirect('/games/lingo/play/');
  }
  if (req.originalUrl === '/games/sudoku/play') {
    return res.redirect('/games/sudoku/play/');
  }
  if (req.originalUrl === '/games/kakuro/play') {
    return res.redirect('/games/kakuro/play/');
  }
  if (req.originalUrl === '/games/kare-karala/play') {
    return res.redirect('/games/kare-karala/play/');
  }
  if (req.originalUrl === '/games/dama/play') {
    return res.redirect('/games/dama/play/');
  }
  if (req.originalUrl === '/games/capraz-dama/play') {
    return res.redirect('/games/capraz-dama/play/');
  }
  if (req.originalUrl === '/games/satranc/play') {
    return res.redirect('/games/satranc/play/');
  }
  if (req.originalUrl === '/games/dortlu-birlestir/play') {
    return res.redirect('/games/dortlu-birlestir/play/');
  }
  if (req.originalUrl === '/games/mastermind/play') {
    return res.redirect('/games/mastermind/play/');
  }
  if (req.originalUrl === '/games/xox/play') {
    return res.redirect('/games/xox/play/');
  }
  if (req.originalUrl === '/games/sos/play') {
    return res.redirect('/games/sos/play/');
  }
  if (req.originalUrl === '/games/kutu-doldurmaca/play') {
    return res.redirect('/games/kutu-doldurmaca/play/');
  }
  if (req.originalUrl === '/games/yilanlar-ve-merdivenler/play') {
    return res.redirect('/games/yilanlar-ve-merdivenler/play/');
  }
  if (req.originalUrl === '/games/9-tas/play') {
    return res.redirect('/games/9-tas/play/');
  }
  if (req.originalUrl === '/games/3-tas/play') {
    return res.redirect('/games/3-tas/play/');
  }
  if (req.originalUrl === '/games/abalone/play') {
    return res.redirect('/games/abalone/play/');
  }
  if (req.originalUrl === '/games/tavla/play') {
    return res.redirect('/games/tavla/play/');
  }
  if (req.originalUrl === '/games/koridor/play') {
    return res.redirect('/games/koridor/play/');
  }
  if (req.originalUrl === '/games/domino/play') {
    return res.redirect('/games/domino/play/');
  }
  if (req.originalUrl === '/games/go/play') {
    return res.redirect('/games/go/play/');
  }
  if (req.originalUrl === '/games/kizma-birader/play') {
    return res.redirect('/games/kizma-birader/play/');
  }
  if (req.originalUrl === '/games/koi-koi/play') {
    return res.redirect('/games/koi-koi/play/');
  }
  if (req.originalUrl === '/games/siseler/play') {
    return res.redirect('/games/siseler/play/');
  }
  if (req.originalUrl === '/games/board/play') {
    return res.redirect('/games/board/play/');
  }
  return next();
});
app.use('/games/kenan/play', kenanGameApp);

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use((req, res, next) => {
  const cookieHeader = String(req.headers.cookie || '');
  const cookies = cookieHeader.split(';').reduce((acc, part) => {
    const [name, ...rest] = part.trim().split('=');
    if (!name) {
      return acc;
    }
    acc[name] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});

  req.cookieConsent = cookies.yearbook_cookie_consent || '';
  res.locals.cookieConsent = req.cookieConsent;
  return next();
});

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`, "'wasm-unsafe-eval'"],
        styleSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`, "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    }
  })
);
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '200kb' }));

app.use(
  session({
    store: buildSessionStore(session),
    name: 'yearbook.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);

app.use(flashMiddleware);
app.use(attachCurrentUser);
app.use(ensureCsrfToken);
app.use(attachMaintenanceState);
app.use((req, res, next) => {
  const featureFlags = buildFeatureFlags(db);
  req.featureFlags = featureFlags;
  res.locals.featureFlags = featureFlags;
  res.locals.currentPath = req.path;
  res.locals.canReviewContent = canReviewContent(req.currentUser);
  res.locals.canManageSchools = canManageSchools(req.currentUser);
  res.locals.contentApprovalEnabled = isContentApprovalEnabled(db);
  res.locals.contentApprovalPendingCount = res.locals.canReviewContent
    ? db.prepare("SELECT COUNT(*) AS total FROM content_approval_requests WHERE status = 'pending'").get().total
    : 0;
  res.locals.signupRequestsPendingCount = 0;
  if (res.locals.canManageSchools) {
    res.locals.signupRequestsPendingCount = req.currentUser.role === 'admin'
      ? db.prepare("SELECT COUNT(*) AS total FROM signup_requests WHERE status = 'pending'").get().total
      : req.currentUser.school_id
        ? db.prepare("SELECT COUNT(*) AS total FROM signup_requests WHERE status = 'pending' AND school_id = ?").get(req.currentUser.school_id).total
        : 0;
  }
  const currentSchoolSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'current_school_id'")
    .get();
  const scopedSchoolId = req.currentUser
    ? req.currentUser.role === 'admin'
      ? Number(currentSchoolSetting && currentSchoolSetting.setting_value ? currentSchoolSetting.setting_value : 0)
      : Number(req.currentUser.school_id || 0)
    : 0;
  const selectedSchool = scopedSchoolId
    ? db.prepare(
        `SELECT id, name, theme_color, background_wallpaper_path, background_wallpaper_enabled, background_gradient_enabled
         FROM schools
         WHERE id = ? AND is_active = 1`
      ).get(scopedSchoolId)
    : null;
  res.locals.currentSchool = selectedSchool || null;
  res.locals.pageThemeColor = selectedSchool && selectedSchool.theme_color ? selectedSchool.theme_color : '';
  const archivePublicSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'archive_public'")
    .get();
  const archivePublic = archivePublicSetting ? archivePublicSetting.setting_value === '1' : false;
  req.archivePublic = archivePublic;
  res.locals.archivePublic = archivePublic;
  const profilePhotoEditModeSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'profile_photo_edit_mode'")
    .get();
  const profilePhotoEditMode =
    profilePhotoEditModeSetting && profilePhotoEditModeSetting.setting_value === 'admin_only' ? 'admin_only' : 'self';
  req.profilePhotoEditMode = profilePhotoEditMode;
  res.locals.profilePhotoEditMode = profilePhotoEditMode;
  const liquidGlassSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'liquid_glass_enabled'")
    .get();
  const liquidGlassEnabled = liquidGlassSetting ? liquidGlassSetting.setting_value === '1' : false;
  const liquidGlassPresetSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'liquid_glass_preset'")
    .get();
  const liquidGlassPreset = ['soft', 'vivid', 'mist', 'gradient'].includes(liquidGlassPresetSetting && liquidGlassPresetSetting.setting_value)
    ? liquidGlassPresetSetting.setting_value
    : 'soft';
  const liquidGlassStyleSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'liquid_glass_style'")
    .get();
  const liquidGlassStyle = ['solid', 'clear', 'v2', 'v3'].includes(liquidGlassStyleSetting && liquidGlassStyleSetting.setting_value)
    ? liquidGlassStyleSetting.setting_value
    : 'clear';
  req.liquidGlassEnabled = liquidGlassEnabled;
  req.liquidGlassPreset = liquidGlassPreset;
  req.liquidGlassStyle = liquidGlassStyle;
  res.locals.liquidGlassEnabled = liquidGlassEnabled;
  res.locals.liquidGlassPreset = liquidGlassPreset;
  res.locals.liquidGlassStyle = liquidGlassStyle;
  const userAccentModeSetting = db
    .prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'user_accent_mode'")
    .get();
  res.locals.userAccentMode = (userAccentModeSetting && userAccentModeSetting.setting_value === 'default') ? 'default' : 'random';
  res.locals.loginAccentColor = (req.session && req.session.loginAccentColor) ? req.session.loginAccentColor : '';
  res.locals.bgmFiles = getBgmFiles();
  res.locals.freshBgm = !!(req.session && req.session.freshBgm);
  if (req.session && req.session.freshBgm) delete req.session.freshBgm;
  const yearbookLockState = getYearbookLockState(db);
  req.yearbookLockState = yearbookLockState;
  res.locals.yearbookLockState = yearbookLockState;
  // Gelen kutusu bildirim sayısı (nav badge için)
  const profileInboxEnabled = featureFlags.profile_inbox !== false;
  res.locals.inboxUnreadCount = req.currentUser && profileInboxEnabled
    ? (db.prepare('SELECT COUNT(*) AS total FROM inbox_notifications WHERE user_id = ?').get(req.currentUser.id) || { total: 0 }).total
    : 0;
  return next();
});
app.use(enforceMaintenanceMode);

app.use('/public', express.static(path.join(ROOT_DIR, 'frontend', 'public')));

function isKvkkExemptPath(pathname) {
  return pathname === '/login' || pathname === '/signup' || pathname === '/logged-out' || pathname === '/first-access-code' || pathname === '/kvkk-onay' || pathname === '/kvkk-aydinlatma-metni' || pathname === '/gizlilik-sozlesmesi' || pathname === '/acik-riza-metni';
}

app.use((req, res, next) => {
  if (!req.currentUser) {
    return next();
  }

  if (req.currentUser.kvkk_approved_at) {
    return next();
  }

  if (isKvkkExemptPath(req.path) || req.path.startsWith('/public/')) {
    return next();
  }

  return res.redirect('/kvkk-onay');
});

app.use((req, res, next) => {
  if (!req.currentUser || !req.yearbookLockState || !req.yearbookLockState.locked) {
    return next();
  }
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }
  if (isSchoolManager(req.currentUser)) {
    return next();
  }
  if (
    req.path === '/logout' ||
    req.path === '/cookie-consent' ||
    req.path === '/kvkk-onay' ||
    req.path.startsWith('/admin') ||
    req.path.startsWith('/public/')
  ) {
    return next();
  }
  req.flash('error', req.yearbookLockState.message || 'Yıllık kilitli. İçerikler yalnızca okunabilir.');
  return res.redirect(req.get('referer') || '/');
});

app.use('/games/reversi/play', reversiGameApp);
app.use('/games/mangala/play', mangalaGameApp);
app.use('/games/kuyulamac/play', kuyulamacGameApp);
app.use('/games/alti/play', altiGameApp);
app.use('/games/okey/play', okeyGameApp);
app.use('/games/101-okey/play', okey101GameApp);
app.use('/games/nane-okey/play', naneOkeyGameApp);
app.use('/games/batak/play', batakGameApp);
app.use('/games/uno/play', unoGameApp);
app.use('/games/scrabble/play', scrabbleGameApp);
app.use('/games/lingo/play', lingoGameApp);
app.use('/games/sudoku/play', sudokuGameApp);
app.use('/games/kakuro/play', kakuroGameApp);
app.use('/games/kare-karala/play', kareKaralaGameApp);
app.use('/games/dama/play', damaGameApp);
app.use('/games/capraz-dama/play', damaGameApp);
app.use('/games/satranc/play', satrancGameApp);
app.use('/games/dortlu-birlestir/play', dortluBirlestirGameApp);
app.use('/games/mastermind/play', mastermindGameApp);
app.use('/games/xox/play', xoxGameApp);
app.use('/games/sos/play', sosGameApp);
app.use('/games/kutu-doldurmaca/play', kutuDoldurmacaGameApp);
app.use('/games/yilanlar-ve-merdivenler/play', yilanlarVeMerdivenlerGameApp);
app.use('/games/9-tas/play', dokuzTasGameApp);
app.use('/games/3-tas/play', ucTasGameApp);
app.use('/games/abalone/play', abaloneGameApp);
app.use('/games/tavla/play', tavlaGameApp);
app.use('/games/koridor/play', koridorGameApp);
app.use('/games/domino/play', dominoGameApp);
app.use('/games/go/play', goGameApp);
app.use('/games/kizma-birader/play', kizmaBiraderGameApp);
app.use('/games/koi-koi/play', koiKoiGameApp);
app.use('/games/siseler/play', siselerGameApp);
app.use('/games/otopark/play', otoparkRedWoodGameApp);
app.use('/games/board/play', boardGamesApp);

app.use(authRoutes);
app.use(homeRoutes);
app.use(profileRoutes);
app.use(anonymousRoutes);
app.use(adminRoutes);
app.use(mediaRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Sayfa Bulunamadı' });
});

app.use((error, req, res, next) => {
  // eslint-disable-next-line no-unused-vars
  console.error(error);
  logError(error, {
    path: req.originalUrl,
    method: req.method,
    userId: req.currentUser ? req.currentUser.id : null
  });
  if (res.headersSent) {
    return next(error);
  }
  if (req.get('x-requested-with') === 'XMLHttpRequest') {
    if (req.sessionExpired) {
      return res.status(440).json({ ok: false, message: 'Oturum süresi doldu.', redirectTo: '/logged-out?reason=expired' });
    }
    return res.status(500).json({ ok: false, message: 'Beklenmeyen bir hata oluştu.' });
  }
  if (typeof req.flash === 'function') {
    req.flash('error', 'Beklenmeyen bir hata oluştu.');
  }
  if (req.sessionExpired) {
    return res.redirect('/logged-out?reason=expired');
  }
  return res.status(500).render('500', { title: 'Sunucu Hatası' });
});

module.exports = app;
