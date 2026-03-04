#!/usr/bin/env node
/**
 * discover_thailand.js — Fetch all listings from swanpass.com JSON API
 * and identify Thailand listings by coordinates/address
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://swanpass.com/listing.json';
const OUTPUT = path.join(__dirname, '..', 'data', 'all_api_listings.json');
const TH_OUTPUT = path.join(__dirname, '..', 'data', 'thailand_slugs.json');

// Thailand bounding box (approximate)
const TH_BOUNDS = { latMin: 5.5, latMax: 20.5, lngMin: 97.0, lngMax: 106.0 };

// Thai city/region keywords
const TH_KEYWORDS = [
  'bangkok', 'pattaya', 'chiang mai', 'phuket', 'hua hin', 'huahin',
  'krabi', 'samui', 'chiang rai', 'korat', 'khon kaen', 'udon',
  'nakhon', 'ayutthaya', 'rangsit', 'patong', 'thailand', 'sukhumvit',
  'silom', 'siam', 'thonglor', 'ekkamai', 'asoke', 'nana',
  'ratchada', 'pratunam', 'sathorn', 'walking street'
];

async function fetchPage(page) {
  const url = `${BASE_URL}?page=${page}`;
  console.log(`  Fetching page ${page}...`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for page ${page}`);
  const data = await resp.json();
  return data.resources || [];
}

function isThailand(listing) {
  const lat = parseFloat(listing.lat);
  const lng = parseFloat(listing.lng);

  // Check coordinates
  if (lat && lng) {
    if (lat >= TH_BOUNDS.latMin && lat <= TH_BOUNDS.latMax &&
        lng >= TH_BOUNDS.lngMin && lng <= TH_BOUNDS.lngMax) {
      return true;
    }
  }

  // Check address text
  const addr = (listing.full_address || '').toLowerCase();
  const name = (listing.name || '').toLowerCase();
  const slug = (listing.slug || '').toLowerCase();
  const combined = `${addr} ${name} ${slug}`;

  return TH_KEYWORDS.some(kw => combined.includes(kw));
}

async function main() {
  console.log('Fetching all listings from swanpass.com API...\n');

  let allListings = [];
  let page = 1;

  while (true) {
    const listings = await fetchPage(page);
    if (listings.length === 0) break;
    allListings = allListings.concat(listings);
    console.log(`    Got ${listings.length} listings (total: ${allListings.length})`);
    if (listings.length < 100) break; // Last page
    page++;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nTotal listings from API: ${allListings.length}`);

  // Filter Thailand
  const thailand = allListings.filter(isThailand);
  const nonThailand = allListings.filter(l => !isThailand(l));

  console.log(`Thailand listings: ${thailand.length}`);
  console.log(`Non-Thailand: ${nonThailand.length}`);

  // Save all
  fs.writeFileSync(OUTPUT, JSON.stringify(allListings, null, 2));
  console.log(`\nSaved all ${allListings.length} listings to ${OUTPUT}`);

  // Save Thailand slugs with basic info
  const thaiData = thailand.map(l => ({
    slug: l.slug,
    name: l.name,
    address: l.full_address,
    lat: l.lat,
    lng: l.lng,
    rating: l.avg_rating,
    reviews: l.reviews_count,
    categories: l.categories?.map(c => c.name) || [],
    phone: l.phone,
  }));
  fs.writeFileSync(TH_OUTPUT, JSON.stringify(thaiData, null, 2));
  console.log(`Saved ${thaiData.length} Thailand slugs to ${TH_OUTPUT}`);

  // Compare with existing repo data
  const existingPath = path.join(__dirname, '..', 'data', 'listings.json');
  if (fs.existsSync(existingPath)) {
    const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
    const existingSlugs = new Set(existing.map(l => l.slug));
    const apiSlugs = new Set(thailand.map(l => l.slug));

    const missing = thailand.filter(l => !existingSlugs.has(l.slug));
    const extra = existing.filter(l => !apiSlugs.has(l.slug));

    console.log(`\n--- Comparison with existing repo data ---`);
    console.log(`Existing in repo: ${existing.length}`);
    console.log(`Thailand on API: ${thailand.length}`);
    console.log(`Missing from repo (need to add): ${missing.length}`);
    if (missing.length > 0) {
      missing.forEach(l => console.log(`  + ${l.slug} — ${l.name} (${l.full_address})`));
    }
    console.log(`Extra in repo (not in Thailand API): ${extra.length}`);
    if (extra.length > 0) {
      extra.forEach(l => console.log(`  - ${l.slug} — ${l.name}`));
    }
  }

  console.log(`\nTotal Thailand listings scraped: ${thailand.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
