if (process.env.DATABASE_URL) {
  module.exports = require('./db-postgres');
} else {
  module.exports = require('./db-sqlite');
}
