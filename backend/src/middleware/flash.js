function flashMiddleware(req, res, next) {
  const pendingFlash = res.locals.flash || null;

  req.flash = (type, message) => {
    const payload = { type, message };
    if (req.session) {
      req.session.flash = payload;
    } else {
      res.locals.flash = payload;
    }
  };

  if (req.session) {
    res.locals.flash = req.session.flash || pendingFlash;
    delete req.session.flash;
  } else {
    res.locals.flash = pendingFlash;
  }

  next();
}

module.exports = flashMiddleware;
