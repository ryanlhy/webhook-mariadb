// Require the 'dotenv' module and configure it
require("dotenv").config();
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const util = require("util");

const express = require("express");
const bodyParser = require("body-parser");
const mariadb = require("mariadb");

const app = express();
const port = 3000;

// save console.log output to a file
// Define the file path
const logFilePath = path.join(__dirname, "console.log");

// Create a write stream
const logStream = fs.createWriteStream(logFilePath, { flags: "a" }); // 'a' flag for appending

// Override console.log
const originalConsoleLog = console.log;
console.log = function (...args) {
  // Write to the console
  originalConsoleLog.apply(console, args);

  // Write to the file
  logStream.write(util.format.apply(util, args) + "\n");
};

// Override console.error
const originalConsoleError = console.error;
console.error = function (...args) {
  // Write to the console
  originalConsoleError.apply(console, args);

  // Write to the file
  logStream.write(util.format.apply(util, args) + "\n");
};

// Use process.env to access environment variables
const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const apifyToken = process.env.APIFY_TOKEN;

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

  try {
    // Save the payload to a JSON file
    const filePath = path.join(__dirname, "payload.json"); // Adjust the file name and path as needed
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    console.log("Payload saved to", filePath);
  } catch (err) {
    console.error("Error saving payload to file:", err);
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `INSERT INTO price_history_cards (Date, url, ebay_number, price, title) VALUES (?, ?, ?, ?, ?)`;

    // Loop over each item in the "data" array
    for (const item of req.body.data) {
      const date = parseDate(item.Date[0]); // Parse the first element of the Date array
      const url = item.__url ? item.__url[0] : null; // Access the first element of the __url array
      const ebay_number = item.ebay_number[0]; // Access the first element of the ebay_number array
      const price = parseFloat(item.price[0]) || 0; // Convert the first element of the price array to a number
      const title = item.title[0]; // Access the first element of the title array

      const values = [date, url, ebay_number, price, title];
      const result = await conn.query(query, values);
      console.log("Data inserted, ID:", result.insertId);
    }

    res.sendStatus(200);
  } catch (err) {
    console.log("Error occurred:", err);
    res.status(500).send(err);
  } finally {
    if (conn) conn.release();
  }
});

app.post("/price-history-cards-apify", async (req, res) => {
  console.log("Received price-history-cards webhook:", req.body);

  // Check if the payload is a test payload
  if (
    typeof req.body.data === "string" &&
    req.body.data === "json_stringify_data"
  ) {
    console.log("Received test payload");
    return res.sendStatus(200); // respond with 200 OK to acknowledge the test payload
  }

  try {
    // Save the payload to a JSON file
    const filePath = path.join(__dirname, "payload.json");
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    console.log("Payload saved to", filePath);
  } catch (err) {
    console.error("Error saving payload to file:", err);
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `INSERT INTO price_history_cards (Date, url, ebay_number, price, title) VALUES (?, ?, ?, ?, ?)`;

    // Loop over each item in the "data" array
    for (const item of req.body.data) {
      // For each item, loop over its nested "results" array
      for (const result of item.results) {
        const date = result.date; // You might want to check the format or parse it if necessary
        const url = item.url;
        const ebayNumber = result.ebay_number.split("-")[1]; // Extract the numeric part
        const price = parseFloat(result.price.replace("$", "")) || 0; // Convert the price string to a number
        const title = result.text;

        const values = [date, url, ebayNumber, price, title];
        const resultInsert = await conn.query(query, values);
        console.log("Data inserted, ID:", resultInsert.insertId);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.log("Error occurred:", err);
    res.status(500).send(err);
  } finally {
    if (conn) conn.release();
  }
});

app.post("/price-history-webscrape", async (req, res) => {
  console.log("Received /price-history-webscrape webhook:", req.body);
  // Check if the payload is a test payload
  if (req.body.eventType && req.body.eventType === "TEST") {
    console.log("Received test payload:", req.body);
    return res.status(200).send({ message: "Test payload received!" });
  } else {
    console.log("Not a test payload:", req.body);
  }

  try {
    // Send out a GET request to fetch data
    const response = await axios.get(
      `https://api.apify.com/v2/actor-tasks/gallant_grasshopper~pricecharting/runs/last/dataset/items?token=${apifyToken}`
    );
    const data = response.data;
    console.log("Apify Data received:", data);

    // Check the data format and adjust accordingly
    if (Array.isArray(data) && data.length > 0) {
      let conn;
      try {
        conn = await pool.getConnection();
        const query = `INSERT INTO price_history_cards (Date, url, ebay_number, price, title) VALUES (?, ?, ?, ?, ?)`;

        // Process the data and push to your table
        for (const item of data) {
          for (const result of item.results) {
            const date = result.date;
            const url = item.url;
            const ebayNumber = result.ebay_number.split("-")[1];
            const price = parseFloat(result.price.replace("$", "")) || 0;
            const title = result.text;

            const values = [date, url, ebayNumber, price, title];
            const resultInsert = await conn.query(query, values);
            console.log("Data inserted, ID:", resultInsert.insertId);
          }
        }
      } catch (err) {
        console.log("Database error:", err);
        res.status(500).send(err);
      } finally {
        if (conn) conn.release();
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.log("Error occurred:", err);
    res.status(500).send(err);
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
