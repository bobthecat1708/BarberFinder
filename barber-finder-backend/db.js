// Import the Pool class from the 'pg' library
const { Pool } = require('pg');

// Create a new Pool instance.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- ADDED ERROR HANDLING ---
// This is crucial for long-running applications. The connection pool
// will emit an 'error' event if a client becomes idle for too long
// or if a network error occurs. This listener prevents the app from crashing.
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client in pool', err);
  // The pool will automatically try to reconnect, so we just log the error.
});

// We export a query function that will be used by our routes.
module.exports = {
  query: (text, params) => pool.query(text, params),
};
