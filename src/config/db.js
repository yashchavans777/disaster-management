/**
 * MongoDB connection bootstrap.
 * Called once at server startup from src/app.js.
 */

const mongoose = require('mongoose');

// ANSI colour helpers — works in every modern terminal / concurrently output
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const BG_YELLOW = '\x1b[43m';
const BG_RED = '\x1b[41m';

const MONGODB_URI = process.env.MONGODB_URI || '';
const isLocalhost =
  !MONGODB_URI ||
  MONGODB_URI.includes('127.0.0.1') ||
  MONGODB_URI.includes('localhost');
const resolvedURI =
  MONGODB_URI || 'mongodb://127.0.0.1:27017/disaster-management';

const printAtlasWarning = () => {
  const line = '═'.repeat(68);
  process.stderr.write(
    `\n${BOLD}${BG_YELLOW} ⚠  MONGODB LOCALHOST DETECTED ${RESET}\n`
  );
  process.stderr.write(`${YELLOW}${line}${RESET}\n`);
  process.stderr.write(
    `${YELLOW}  MONGODB_URI in .env is missing or points to localhost.\n`
  );
  process.stderr.write(
    `  If you don't have MongoDB installed locally the server\n`
  );
  process.stderr.write(`  will fail with ECONNREFUSED.\n\n`);
  process.stderr.write(
    `  ${BOLD}FIX: Open .env in the project root and set:${RESET}${YELLOW}\n\n`
  );
  process.stderr.write(
    `    MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>\n\n`
  );
  process.stderr.write(`  Get a free URI at: https://cloud.mongodb.com\n`);
  process.stderr.write(`${line}${RESET}\n\n`);
};

const connectDB = async () => {
  if (isLocalhost) {
    printAtlasWarning();
  }

  try {
    const connection = await mongoose.connect(resolvedURI, {
      serverSelectionTimeoutMS: 5000,
    });

    process.stdout.write(
      `${BOLD}✓ MongoDB connected:${RESET} ${connection.connection.host}/${connection.connection.name}\n`
    );
  } catch (error) {
    process.stderr.write(
      `\n${BOLD}${BG_RED} ✖ MONGODB CONNECTION FAILED ${RESET}\n`
    );
    process.stderr.write(`${RED}  Error : ${error.message}${RESET}\n`);

    if (isLocalhost) {
      process.stderr.write(
        `${RED}  Cause : No local MongoDB running on 127.0.0.1:27017${RESET}\n`
      );
      process.stderr.write(
        `${RED}  Fix   : Set MONGODB_URI=<Atlas URI> in your .env file${RESET}\n`
      );
      process.stderr.write(
        `${RED}          https://cloud.mongodb.com → Free Cluster → Connect → Drivers${RESET}\n`
      );
    }

    process.stderr.write(
      `\n${YELLOW}  Server will keep running — all DB routes will return 500 until fixed.\n${RESET}\n`
    );
  }
};

module.exports = { connectDB };
