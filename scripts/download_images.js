#!/usr/bin/env node
/**
 * download_images.js — Download all images from listings.json
 * Usage: node scripts/download_images.js [--limit N]
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'listings.json');
const IMAGES_DIR = path.join(__dirname, '..', 'images', 'listings');

const CONCURRENCY = 3;
const TIMEOUT = 15000;
const RETRIES = 2;

const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getExtension(url) {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase().split('?')[0];
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'].includes(ext)) return ext;
  return '.jpg'; // default
}

async function downloadFile(url, dest, retries = RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SwanPassImageDownloader/1.0',
        }
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buffer);
      return true;
    } catch (err) {
      if (attempt < retries) await sleep(1000 * (attempt + 1));
      else {
        console.error(`    FAIL: ${url} — ${err.message}`);
        return false;
      }
    }
  }
  return false;
}

async function processInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

async function main() {
  console.log('=== SwanPass Image Downloader ===');

  if (!fs.existsSync(DATA_FILE)) {
    console.error('Error: data/listings.json not found. Run crawl_swanpass.js first.');
    process.exit(1);
  }

  let listings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  if (LIMIT < listings.length) {
    listings = listings.slice(0, LIMIT);
    console.log(`Limited to ${LIMIT} listings`);
  }

  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let totalImages = 0;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    const slug = listing.slug;
    const imgDir = path.join(IMAGES_DIR, slug);
    fs.mkdirSync(imgDir, { recursive: true });

    console.log(`[${i + 1}/${listings.length}] ${listing.name || slug} (${listing.image_urls.length} images)`);

    const downloadTasks = listing.image_urls.map((url, idx) => {
      const ext = getExtension(url);
      const filename = String(idx + 1).padStart(2, '0') + ext;
      const dest = path.join(imgDir, filename);
      return { url, dest, filename, idx };
    });

    // Track local image paths
    listing.images = [];

    await processInBatches(downloadTasks, CONCURRENCY, async (task) => {
      totalImages++;
      const relativePath = `images/listings/${slug}/${task.filename}`;

      if (fs.existsSync(task.dest)) {
        totalSkipped++;
        listing.images.push(relativePath);
        return;
      }

      const ok = await downloadFile(task.url, task.dest);
      if (ok) {
        totalDownloaded++;
        listing.images.push(relativePath);
      } else {
        totalFailed++;
        // Still add the path but note it
        listing.images.push(relativePath);
      }
    });

    // Small delay between listings
    await sleep(200);
  }

  // Save updated listings with local image paths
  fs.writeFileSync(DATA_FILE, JSON.stringify(listings, null, 2));

  console.log('\n=== Summary ===');
  console.log(`Total images: ${totalImages}`);
  console.log(`Downloaded: ${totalDownloaded}`);
  console.log(`Skipped (existing): ${totalSkipped}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Updated listings.json with local image paths`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
