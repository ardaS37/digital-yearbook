const app = require('./app');
const { PORT, HOST } = require('./config');

if (process.env.NODE_UNIQUE_ID) {
  console.warn('SQLite with cluster workers is not supported for this app. Run a single process.');
}

app.listen(PORT, HOST, () => {
  console.log(`Yearbook app listening on ${HOST}:${PORT}`);
});
