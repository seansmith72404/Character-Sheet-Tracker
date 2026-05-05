require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

async function run() {
  try {
    await pool.query('ALTER TABLE "tblCampaigns" ADD COLUMN IF NOT EXISTS banned_users JSONB NOT NULL DEFAULT \'[]\'::jsonb');
    console.log('Column added');
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
