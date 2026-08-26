const { getMaintenanceState } = require('../utils/maintenance');

function attachMaintenanceState(req, res, next) {
  const maintenanceState = getMaintenanceState();
  req.maintenanceState = maintenanceState;
  res.locals.maintenanceState = maintenanceState;
  next();
}

function shouldBypassMaintenance(req) {
  const path = req.path || '';
  return (
    path === '/login' ||
    path === '/logout' ||
    path === '/logged-out' ||
    path === '/cookie-policy' ||
    path.startsWith('/public/')
  );
}

function enforceMaintenanceMode(req, res, next) {
  if (!req.maintenanceState) {
    return next();
  }

  if (req.currentUser && req.currentUser.role === 'admin') {
    return next();
  }

  if (shouldBypassMaintenance(req)) {
    return next();
  }

  return res.status(503).render('maintenance', {
    title: 'Bakım Modu',
    maintenanceState: req.maintenanceState
  });
}

module.exports = {
  attachMaintenanceState,
  enforceMaintenanceMode
};
