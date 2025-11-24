const { Client } = require('pg');

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    console.log('Altering drawings table (add room_id if missing)');
    // Add column if missing (nullable), then add a unique index if missing
    await client.query(`ALTER TABLE IF EXISTS drawings ADD COLUMN IF NOT EXISTS room_id text`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_drawings_room_id ON drawings(room_id)`);
    console.log('Migration applied: room_id column ensured (nullable) and index created');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(2);
  } finally {
    await client.end();
  }
}

run();
