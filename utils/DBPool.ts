const fs = require('fs');
const cert = fs.readFileSync("./vol/ca-certificate.crt")
const path = require('path')
const dotenv = require('dotenv').config({ path: path.resolve(__dirname, '../vol/.env') })
const Pool = require('pg').Pool

var pgp = require('pg-promise')({
  capSQL: true 
});

var pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    ca: cert,
    rejectUnauthorized: true,
  }
})

const cn = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    ca: cert,
    rejectUnauthorized: true,
  }
};

var db = pgp(cn);

module.exports = {pool, db};
