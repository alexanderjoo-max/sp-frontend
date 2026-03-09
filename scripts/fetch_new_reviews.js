#!/usr/bin/env node
/**
 * fetch_new_reviews.js — Fetch reviews for all listings that have 0 reviews in reviews.json
 * Uses the same swanpass.com review API as the audit script.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const LISTINGS_FILE = path.join(__dirname, '..', 'data', 'listings.json');
const REVIEWS_FILE = path.join(__dirname, '..', 'data', 'reviews.json');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const listings = JSON.parse(fs.readFileSync(LISTINGS_FILE, 'utf-8'));
  const reviews = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf-8'));

  // Find listings without reviews in reviews.json
  const needReviews = listings.filter(l => !reviews[l.slug] || reviews[l.slug].length === 0);
  console.log(`Total listings: ${listings.length}`);
  console.log(`Listings needing review fetch: ${needReviews.length}\n`);

  let totalFetched = 0;
  let listingsUpdated = 0;
  let errors = 0;

  for (let i = 0; i < needReviews.length; i++) {
    const listing = needReviews[i];
    const slug = listing.slug;

    // Fetch page 1 to get meta
    const page1 = await fetch(`https://swanpass.com/listing/${slug}/reviews.json?page=1`);
    if (!page1 || !page1.meta) {
      errors++;
      if (i % 50 === 0) console.log(`[${i+1}/${needReviews.length}] ${slug} — error/no data`);
      await sleep(200);
      continue;
    }

    const total = page1.meta.total || 0;
    const totalPages = page1.meta.pages || 0;

    if (total === 0) {
      reviews[slug] = [];
      if (i % 50 === 0) console.log(`[${i+1}/${needReviews.length}] ${slug} — 0 reviews`);
      await sleep(100);
      continue;
    }

    // Collect all reviews
    let allReviews = [...(page1.resources || [])];

    for (let p = 2; p <= totalPages; p++) {
      await sleep(200);
      const pageData = await fetch(`https://swanpass.com/listing/${slug}/reviews.json?page=${p}`);
      if (pageData && pageData.resources) {
        allReviews.push(...pageData.resources);
      }
    }

    // Deduplicate by ID
    const seen = new Set();
    allReviews = allReviews.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    reviews[slug] = allReviews;
    totalFetched += allReviews.length;
    listingsUpdated++;

    // Update review_count and rating in listings
    const idx = listings.findIndex(l => l.slug === slug);
    if (idx !== -1) {
      listings[idx].review_count = allReviews.length;
      listings[idx].rating = page1.meta.average_rating || 0;
    }

    console.log(`[${i+1}/${needReviews.length}] ${slug} — ${allReviews.length} reviews (avg: ${page1.meta.average_rating || 0})`);
    await sleep(150);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Listings processed: ${needReviews.length}`);
  console.log(`Listings with reviews: ${listingsUpdated}`);
  console.log(`Total reviews fetched: ${totalFetched}`);
  console.log(`Errors: ${errors}`);

  // Count total reviews
  let grandTotal = 0;
  Object.values(reviews).forEach(arr => { grandTotal += arr.length; });
  console.log(`Grand total reviews in file: ${grandTotal}`);

  // Save
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews));
  fs.writeFileSync(LISTINGS_FILE, JSON.stringify(listings, null, 2));
  console.log('\nSaved reviews.json and listings.json');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
