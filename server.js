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
app.get("/myhome", (req, res) =>
  res.send("Hello World! This is a webhook server at /home route!")
);

function parseDate(input) {
  const parts = input.split("-");
  const year = `20${parts[2]}`;
  return `${year}-${parts[1]}-${parts[0]}`;
}

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

// webhook for price-history-cards
app.post("/price-history-cards", async (req, res) => {
  console.log("Received price-history-cards webhook:", req.body);

  // Check if the payload is a test payload
  if (
    typeof req.body.data === "string" &&
    req.body.data === "json_stringify_data"
  ) {
    console.log("Received test payload");
    return res.sendStatus(200); // respond with 200 OK to acknowledge the test payload
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const query = `INSERT INTO price_history_cards (Date, url, ebay_number, price, title) VALUES (?, ?, ?, ?, ?)`;

    const date = parseDate(req.body.Date); // Use the updated parseDate function
    const price = parseFloat(req.body.price) || 0; // ensure price is a number

    const values = [
      date,
      req.body.url,
      req.body.ebay_number,
      price,
      req.body.title,
    ];

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
