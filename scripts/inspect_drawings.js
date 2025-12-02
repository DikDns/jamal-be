const { Client } = require('pg');
require('dotenv').config({ path: ['.env', '.env.local', '.env.production'] });
(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set in environment.');
    process.exit(1);
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const cols = await client.query(`SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_name='drawings' ORDER BY ordinal_position`);
    console.log('COLUMNS:\n', JSON.stringify(cols.rows, null, 2));
    const rows = await client.query('SELECT * FROM drawings ORDER BY created_at DESC LIMIT 3');
    console.log('SAMPLE ROWS:\n', JSON.stringify(rows.rows, null, 2));
  } catch (err) {
    console.error('Error querying DB:', err);
    process.exit(2);
  } finally {
    await client.end();
  }
})();
