require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

async function run() {
  try {
    const users = await pool.query('SELECT * FROM "tblUsers"');
    console.log('USERS:');
    console.log(users.rows);

    const characters = await pool.query('SELECT * FROM "tblCharacters"');
    console.log('CHARACTERS:');
    console.log(characters.rows);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
