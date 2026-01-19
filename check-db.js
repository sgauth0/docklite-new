#!/usr/bin/env node
// Simple script to check if database is initialized
// Used by startup script - doesn't require sqlite3 CLI

const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './data/docklite.db';

try {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);

  // Check if tokens table exists
  const result = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='tokens'"
  ).get();

  db.close();

  if (result) {
    console.log('Database initialized');
    process.exit(0);
  } else {
    console.log('Database not initialized');
    process.exit(1);
  }
} catch (err) {
  console.error('Database check failed:', err.message);
  process.exit(1);
}
