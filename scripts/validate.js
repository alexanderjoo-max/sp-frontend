#!/usr/bin/env node
/**
 * validate.js — Validate SwanPass data, pages, and images
 * Usage: node scripts/validate.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'data', 'listings.json');
const IMAGES_DIR = path.join(ROOT, 'images', 'listings');

function main() {
  console.log('=== SwanPass Validation ===\n');

  if (!fs.existsSync(DATA_FILE)) {
    console.error('ERROR: data/listings.json not found');
    process.exit(1);
  }

  const listings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const issues = [];

  // 1. Slug uniqueness
  const slugs = listings.map(l => l.slug);
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dupes.length > 0) {
    issues.push(`Duplicate slugs: ${[...new Set(dupes)].join(', ')}`);
  }

  // 2. Check each listing
  let pagesExist = 0;
  let pagesMissing = 0;
  let imagesExist = 0;
  let imagesMissing = 0;
  let withServices = 0;
  let withContacts = 0;
  let withDescription = 0;
  let withAddress = 0;
  let withCoordinates = 0;
  let withImages = 0;
  let withHours = 0;
  let withRating = 0;

  listings.forEach(listing => {
    const slug = listing.slug;

    // Check listing page exists
    const pagePath = path.join(ROOT, `listing-${slug}.html`);
    if (fs.existsSync(pagePath)) {
      pagesExist++;
    } else {
      pagesMissing++;
      issues.push(`Missing page: listing-${slug}.html`);
    }

    // Check image directory and files
    if (listing.images && listing.images.length > 0) {
      withImages++;
      listing.images.forEach(img => {
        const imgPath = path.join(ROOT, img);
        if (fs.existsSync(imgPath)) {
          imagesExist++;
        } else {
          imagesMissing++;
        }
      });
    }

    // Check data completeness
    if (listing.services && listing.services.length > 0) withServices++;
    if (listing.contacts && Object.values(listing.contacts).some(v => v)) withContacts++;
    if (listing.description) withDescription++;
    if (listing.address) withAddress++;
    if (listing.geo && listing.geo.lat) withCoordinates++;
    if (listing.hours) withHours++;
    if (listing.rating) withRating++;

    // Check for issues in listing notes
    if (listing.notes && listing.notes.length > 0) {
      listing.notes.forEach(n => issues.push(`${slug}: ${n}`));
    }
  });

  // Summary
  console.log('--- Data Summary ---');
  console.log(`Total listings:     ${listings.length}`);
  console.log(`With description:   ${withDescription}/${listings.length}`);
  console.log(`With address:       ${withAddress}/${listings.length}`);
  console.log(`With coordinates:   ${withCoordinates}/${listings.length}`);
  console.log(`With services:      ${withServices}/${listings.length}`);
  console.log(`With contacts:      ${withContacts}/${listings.length}`);
  console.log(`With hours:         ${withHours}/${listings.length}`);
  console.log(`With rating:        ${withRating}/${listings.length}`);
  console.log(`With images:        ${withImages}/${listings.length}`);

  console.log('\n--- File Summary ---');
  console.log(`Pages exist:        ${pagesExist}/${listings.length}`);
  console.log(`Pages missing:      ${pagesMissing}`);
  console.log(`Images exist:       ${imagesExist}`);
  console.log(`Images missing:     ${imagesMissing}`);

  // Unique slugs
  console.log(`\n--- Slug Check ---`);
  console.log(`Unique slugs:       ${new Set(slugs).size}/${listings.length}`);
  if (dupes.length > 0) {
    console.log(`Duplicate slugs:    ${[...new Set(dupes)].join(', ')}`);
  }

  // Issues
  if (issues.length > 0) {
    console.log(`\n--- Issues (${issues.length}) ---`);
    issues.forEach(i => console.log(`  ⚠ ${i}`));
  } else {
    console.log('\n✓ No issues found!');
  }

  // Final status
  const hasBlockers = pagesMissing > listings.length / 2 || dupes.length > 0;
  console.log(`\n=== ${hasBlockers ? 'FAIL' : 'PASS'} ===`);
  process.exit(hasBlockers ? 1 : 0);
}

main();
