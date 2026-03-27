const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

client.connect()
    .then(() => console.log("Connected to Neon Postgres!"))
    .catch(err => console.error("Connection error", err.stack));

module.exports = client;