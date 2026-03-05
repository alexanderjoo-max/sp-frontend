#!/usr/bin/env node
/**
 * merge_enriched.js — Merge enriched contacts into listings.json
 */
const fs = require('fs');
const path = require('path');

const ORIG_FILE = path.join(__dirname, '..', 'data', 'listings.json');
const ENRICHED_FILE = path.join(__dirname, '..', 'data', 'listings.enriched.json');

const orig = JSON.parse(fs.readFileSync(ORIG_FILE, 'utf-8'));
const enriched = JSON.parse(fs.readFileSync(ENRICHED_FILE, 'utf-8'));

// Build slug -> enriched contacts map
const enrichMap = {};
enriched.forEach(l => { enrichMap[l.slug] = l.contacts; });

let merged = 0, newFields = 0;
const fieldCounts = {};

orig.forEach(l => {
  const ec = enrichMap[l.slug];
  if (!ec || !ec._enriched) return;

  merged++;
  const meta = ec._enriched;

  for (const [key, info] of Object.entries(meta)) {
    // Skip "_additional" entries (existing field already had a value)
    if (key.endsWith('_additional')) continue;

    // Apply new value where original was null/empty
    if (!l.contacts[key] && ec[key]) {
      l.contacts[key] = ec[key];
      newFields++;
      fieldCounts[key] = (fieldCounts[key] || 0) + 1;
    }
  }
});

fs.writeFileSync(ORIG_FILE, JSON.stringify(orig, null, 2));
console.log('Merged ' + merged + ' enriched listings into listings.json');
console.log('New fields applied: ' + newFields);
console.log('By type:', JSON.stringify(fieldCounts, null, 2));
