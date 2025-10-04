require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

(async function(){
  const sql = neon(process.env.DATABASE_URL);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS items (
      id serial PRIMARY KEY,
      name text NOT NULL,
      description text,
      created_at timestamptz DEFAULT now()
    );
  `);
  console.log('items table ensured');
  process.exit(0);
})();
