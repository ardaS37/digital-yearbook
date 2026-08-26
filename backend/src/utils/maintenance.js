const fs = require('fs');
const path = require('path');
const { MAINTENANCE_STATE_PATH } = require('../config');

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function getMaintenanceState() {
  if (!fs.existsSync(MAINTENANCE_STATE_PATH)) {
    return null;
  }

  const state = readJsonFile(MAINTENANCE_STATE_PATH);
  if (!state || typeof state !== 'object') {
    return {
      active: true,
      reason: 'unknown',
      message: 'Bakım işlemi devam ediyor.'
    };
  }

  return {
    active: true,
    reason: state.reason || 'unknown',
    source: state.source || 'runtime',
    actorUserId: state.actorUserId || null,
    startedAt: state.startedAt || null,
    message: state.message || 'Bakım işlemi devam ediyor.'
  };
}

function setMaintenanceState(details = {}) {
  if (getMaintenanceState()) {
    throw new Error('Bakım modu zaten aktif. Lütfen mevcut işlemin tamamlanmasını bekleyin.');
  }

  fs.mkdirSync(path.dirname(MAINTENANCE_STATE_PATH), { recursive: true });
  const nextState = {
    reason: details.reason || 'maintenance',
    source: details.source || 'runtime',
    actorUserId: details.actorUserId || null,
    startedAt: new Date().toISOString(),
    message: details.message || 'Bakım işlemi devam ediyor.'
  };

  fs.writeFileSync(MAINTENANCE_STATE_PATH, JSON.stringify(nextState, null, 2));
  return nextState;
}

function clearMaintenanceState() {
  fs.rmSync(MAINTENANCE_STATE_PATH, { force: true });
}

function withMaintenanceState(details, operation) {
  setMaintenanceState(details);
  try {
    return operation();
  } finally {
    clearMaintenanceState();
  }
}

module.exports = {
  getMaintenanceState,
  setMaintenanceState,
  clearMaintenanceState,
  withMaintenanceState
};
