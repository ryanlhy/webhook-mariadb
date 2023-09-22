// Require the 'dotenv' module and configure it
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const mariadb = require("mariadb");

const app = express();
const port = 3000;

// Use process.env to access environment variables
const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

app.use(bodyParser.json());
app.get("/", (req, res) => res.send("Hello World! This is a webhook server"));
app.post("/webhook", async (req, res) => {
  console.log("Received webhook:", req.body);

  let conn;
  try {
    conn = await pool.getConnection();

    // Adjust the table name, column names, and values based on your actual schema
    const query = `INSERT INTO my_table (key_num, value) VALUES (?, ?)`;
    const values = [req.body.key_num, req.body.value];

    const result = await conn.query(query, values);
    console.log("Data inserted, ID:", result.insertId);

    res.sendStatus(200);
  } catch (err) {
    console.log("Error occurred:", err);
    res.status(500).send(err);
  } finally {
    if (conn) conn.release();
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
