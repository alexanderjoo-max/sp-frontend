#!/usr/bin/env node
/**
 * fetch_gallery_images.js — Scrape gallery image URLs for all listings
 * Fetches each listing page from swanpass.com and extracts image URLs
 * from the CDN (sgp1.vultrobjects.com/swanprod/uploads/photo/image/...)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const LISTINGS_FILE = path.join(__dirname, '..', 'data', 'listings.json');
const BATCH_SIZE = 10; // concurrent requests
const DELAY_BETWEEN_BATCHES = 500; // ms

function fetchHTML(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchHTML(res.headers.location).then(resolve);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.setTimeout(20000, () => { req.destroy(); resolve(''); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Decode HTML entities (&quot; &amp; etc.)
 */
function decodeEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Extract gallery image URLs from a listing page HTML.
 * The page contains JSON data with image_url fields pointing to the CDN.
 * We also get the featured_image separately.
 */
function extractGalleryImages(html, listingName) {
  const decoded = decodeEntities(html);

  // Extract all unique CDN image URLs
  const cdnPattern = /https:\/\/sgp1\.vultrobjects\.com\/swanprod\/uploads\/photo\/image\/\d+\/[^"&\s<>]+/g;
  const allUrls = [];
  let match;
  while ((match = cdnPattern.exec(decoded)) !== null) {
    allUrls.push(match[0]);
  }

  // Deduplicate while preserving order
  const seen = new Set();
  const unique = [];
  for (const url of allUrls) {
    if (!seen.has(url)) {
      seen.add(url);
      unique.push(url);
    }
  }

  // Filter out common sidebar/unrelated images
  // (logo, default avatars, etc.)
  const filtered = unique.filter(u => {
    const lower = u.toLowerCase();
    return !lower.includes('swanpass-logo') &&
           !lower.includes('avatar') &&
           !lower.includes('default-user');
  });

  return filtered;
}

async function main() {
  const listings = JSON.parse(fs.readFileSync(LISTINGS_FILE, 'utf-8'));
  console.log(`Total listings: ${listings.length}`);

  // Process ALL listings to get gallery images
  const toProcess = listings;
  console.log(`Processing: ${toProcess.length} listings\n`);

  let updated = 0;
  let errors = 0;
  let totalImages = 0;

  for (let batch = 0; batch < toProcess.length; batch += BATCH_SIZE) {
    const chunk = toProcess.slice(batch, batch + BATCH_SIZE);

    const results = await Promise.all(chunk.map(async (listing) => {
      const slug = listing.slug;
      try {
        const html = await fetchHTML(`https://swanpass.com/listing/${slug}`);
        if (!html || html.length < 500) {
          return { slug, images: [], error: true };
        }
        const images = extractGalleryImages(html, listing.name);
        return { slug, images, error: false };
      } catch (e) {
        return { slug, images: [], error: true };
      }
    }));

    for (const result of results) {
      const idx = listings.findIndex(l => l.slug === result.slug);
      if (idx === -1) continue;

      if (result.error) {
        errors++;
        continue;
      }

      if (result.images.length > 0) {
        listings[idx].image_urls = result.images;
        updated++;
        totalImages += result.images.length;
      }
    }

    const processed = Math.min(batch + BATCH_SIZE, toProcess.length);
    if (processed % 50 === 0 || processed === toProcess.length) {
      console.log(`[${processed}/${toProcess.length}] Updated: ${updated}, Images: ${totalImages}, Errors: ${errors}`);
    }

    // Save periodically
    if (processed % 200 === 0) {
      fs.writeFileSync(LISTINGS_FILE, JSON.stringify(listings, null, 2));
      console.log('  (checkpoint saved)');
    }

    await sleep(DELAY_BETWEEN_BATCHES);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total processed: ${toProcess.length}`);
  console.log(`Updated with images: ${updated}`);
  console.log(`Total images found: ${totalImages}`);
  console.log(`Avg images per listing: ${updated > 0 ? (totalImages / updated).toFixed(1) : 0}`);
  console.log(`Errors: ${errors}`);

  fs.writeFileSync(LISTINGS_FILE, JSON.stringify(listings, null, 2));
  console.log('Saved listings.json');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
