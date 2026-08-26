const crypto = require('crypto');

function ensureCsrfToken(req, res, next) {
  if (!req.session) {
    res.locals.csrfToken = '';
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  return next();
}

function extractCsrfToken(req) {
  const raw = req.body?._csrf || req.query?._csrf || req.get('x-csrf-token');
  return Array.isArray(raw) ? raw[0] : raw;
}

function isAjaxRequest(req) {
  return req.get('x-requested-with') === 'XMLHttpRequest';
}

function verifyCsrf(req, res, next) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  const token = extractCsrfToken(req);
  if (!req.session || !token || token !== req.session.csrfToken) {
    if (req.sessionExpired) {
      if (isAjaxRequest(req)) {
        return res.status(440).json({ ok: false, message: 'Oturum süresi doldu.', redirectTo: '/logged-out?reason=expired' });
      }
      return res.redirect('/logged-out?reason=expired');
    }
    if (isAjaxRequest(req)) {
      return res.status(403).json({ ok: false, message: 'Geçersiz CSRF belirteci.' });
    }
    req.flash('error', 'Geçersiz CSRF belirteci.');
    return res.redirect(req.get('Referrer') || '/');
  }

  return next();
}

module.exports = {
  ensureCsrfToken,
  verifyCsrf,
  extractCsrfToken
};
