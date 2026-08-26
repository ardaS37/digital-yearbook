const fs = require('fs');
const path = require('path');
const { LOG_DIR } = require('../config');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLog(level, message, extra) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    extra: extra || null
  };
  fs.appendFileSync(path.join(LOG_DIR, 'app.log'), `${JSON.stringify(entry)}\n`);
}

function logError(error, extra) {
  writeLog('error', error && error.message ? error.message : 'Unknown error', {
    stack: error && error.stack ? error.stack : null,
    ...(extra || {})
  });
}

function logInfo(message, extra) {
  writeLog('info', message, extra);
}

module.exports = {
  logError,
  logInfo
};
