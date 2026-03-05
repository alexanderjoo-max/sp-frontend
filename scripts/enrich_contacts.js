#!/usr/bin/env node
/**
 * enrich_contacts.js — Contact enrichment for SwanPass listings
 *
 * Crawls listing websites to discover additional contact info (WhatsApp, email,
 * Telegram, Instagram, Facebook, LINE, booking links) without modifying existing data.
 *
 * Usage: node scripts/enrich_contacts.js [--limit N] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// ─── Config ──────────────────────────────────────────────────────────────────

const DATA_FILE = path.join(__dirname, '..', 'data', 'listings.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'listings.enriched.json');

const THROTTLE_MS = 1000;        // Delay between requests
const FETCH_TIMEOUT_MS = 8000;   // Per-request timeout
const MAX_PAGES_PER_DOMAIN = 5;  // Max pages to crawl per listing website
const MAX_RETRIES = 1;           // Retry once on failure

const CONTACT_PAGES = ['/', '/contact', '/contact-us', '/about', '/about-us'];

// Social media domains to skip when crawling "websites"
const SOCIAL_DOMAINS = [
  'instagram.com', 'facebook.com', 'fb.com', 'twitter.com', 'x.com',
  'tiktok.com', 'youtube.com', 'line.me', 't.me', 'wa.me',
  'api.whatsapp.com', 'linkedin.com', 'swanpass.com',
];

// Bio link aggregator patterns
const BIO_LINK_PATTERNS = [
  'linktr.ee', 'linktree.com', 'beacons.ai', 'linkin.bio',
  'bio.link', 'linkr.bio', 'campsite.bio', 'hoo.be',
  'tap.bio', 'bio.fm', 'lnk.bio', 'snipfeed.co',
];

// Booking platform patterns
const BOOKING_PATTERNS = [
  'booksy.com', 'fresha.com', 'treatwell.com', 'genbook.com',
  'vagaro.com', 'schedulicity.com', 'square.site', 'calendly.com',
  'setmore.com', 'acuityscheduling.com', 'book.app', 'mindbodyonline.com',
];

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const DRY_RUN = args.includes('--dry-run');

// ─── Utilities ───────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,th;q=0.8',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) return null;
    const text = await res.text();
    return text;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

async function fetchRetry(url, retries = MAX_RETRIES) {
  let html = await fetchWithTimeout(url);
  if (!html && retries > 0) {
    await sleep(2000);
    html = await fetchWithTimeout(url);
  }
  return html;
}

function isSocialDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return SOCIAL_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return true;
  }
}

function normalizeUrl(url) {
  if (!url) return null;
  url = url.trim();
  if (url.startsWith('//')) url = 'https:' + url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (url.includes('.')) url = 'https://' + url;
    else return null;
  }
  try {
    const u = new URL(url);
    return u.href;
  } catch {
    return null;
  }
}

// ─── Contact Extraction ──────────────────────────────────────────────────────

/**
 * Extract contacts from an HTML page using cheerio.
 * Returns an object with arrays of discovered values per contact type.
 */
function extractContactsFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const found = {
    phone: new Set(),
    whatsapp: new Set(),
    telegram: new Set(),
    line: new Set(),
    instagram: new Set(),
    facebook: new Set(),
    email: new Set(),
    booking: new Set(),
    bioLinks: new Set(),
  };

  // Collect all href values from anchors + onclick attributes
  const allLinks = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) allLinks.push(href.trim());
  });

  // Also check onclick and data attributes for contact links
  $('[onclick]').each((_, el) => {
    const onclick = $(el).attr('onclick') || '';
    const urlMatch = onclick.match(/(?:window\.open|location\.href)\s*[=(]\s*['"]([^'"]+)['"]/);
    if (urlMatch) allLinks.push(urlMatch[1]);
  });

  // Scan individual text nodes for phone patterns (Thai numbers)
  // Use per-element text to avoid concatenated garbage
  const textChunks = [];
  $('p, span, div, li, a, td, h1, h2, h3, h4, h5, h6, address, footer').each((_, el) => {
    const t = $(el).clone().children().remove().end().text().trim();
    if (t && t.length < 200) textChunks.push(t);
  });
  // Also add full visible text (but de-concatenated through chunks)
  const bodyText = textChunks.join(' ');

  const phoneRegex = /(?:\+66|0)\s*[-.]?\s*\d{1,2}\s*[-.]?\s*\d{3,4}\s*[-.]?\s*\d{4}/g;
  const phoneMatches = bodyText.match(phoneRegex) || [];
  phoneMatches.forEach(p => {
    const cleaned = p.replace(/[\s.-]/g, '');
    if (cleaned.length >= 9 && cleaned.length <= 13) found.phone.add(cleaned);
  });

  // Scan text chunks for emails (not concatenated body text — avoids garbled matches)
  const emailRegex = /[a-zA-Z0-9._%+-]{1,40}@[a-zA-Z0-9.-]{1,40}\.[a-zA-Z]{2,6}/g;
  for (const chunk of textChunks) {
    const emailMatches = chunk.match(emailRegex) || [];
    emailMatches.forEach(e => {
      const lower = e.toLowerCase();
      // Filter out false positives
      if (lower.length > 60) return;
      if (lower.includes('example.com') || lower.includes('wordpress') ||
          lower.includes('wixpress') || lower.includes('.png') ||
          lower.includes('.jpg') || lower.endsWith('.js') ||
          lower.includes('sentry') || lower.includes('cloudflare') ||
          lower.includes('jquery') || lower.includes('webpack')) return;
      // Reject if local part is too long or contains phone-number-like sequences
      const localPart = lower.split('@')[0];
      if (localPart.length > 30) return;
      // Reject if local part starts with digits that look like a phone number
      if (/^\d{3,}[-.]?\d{3}/.test(localPart)) return;
      // Reject if local part has 5+ consecutive digits (phone leak)
      if (/\d{5,}/.test(localPart)) return;
      found.email.add(lower);
    });
  }

  // Process all collected links
  for (const href of allLinks) {
    const hrefLower = href.toLowerCase();

    // Phone
    if (hrefLower.startsWith('tel:')) {
      const phone = href.replace(/^tel:\s*/i, '').replace(/[\s.-]/g, '');
      if (phone.length >= 9) found.phone.add(phone);
    }

    // Email
    if (hrefLower.startsWith('mailto:')) {
      const email = href.replace(/^mailto:\s*/i, '').split('?')[0].toLowerCase().trim();
      if (email.includes('@') && !email.includes('example.com')) {
        found.email.add(email);
      }
    }

    // WhatsApp
    if (hrefLower.includes('wa.me/') || hrefLower.includes('api.whatsapp.com/') ||
        hrefLower.includes('whatsapp.com/')) {
      const normalized = normalizeUrl(href);
      if (normalized) found.whatsapp.add(normalized);
    }

    // Telegram
    if (hrefLower.includes('t.me/') || hrefLower.includes('telegram.me/')) {
      const normalized = normalizeUrl(href);
      if (normalized) found.telegram.add(normalized);
    }

    // LINE
    if (hrefLower.includes('line.me/') || hrefLower.startsWith('line://') ||
        hrefLower.includes('lin.ee/')) {
      const normalized = normalizeUrl(href);
      if (normalized) found.line.add(normalized);
    }

    // Instagram
    if (hrefLower.includes('instagram.com/') && !hrefLower.includes('/p/') &&
        !hrefLower.includes('/reel/') && !hrefLower.includes('/stories/')) {
      const normalized = normalizeUrl(href);
      if (normalized) found.instagram.add(normalized);
    }

    // Facebook
    if ((hrefLower.includes('facebook.com/') || hrefLower.includes('fb.com/') ||
         hrefLower.includes('fb.me/')) && !hrefLower.includes('/sharer') &&
        !hrefLower.includes('/share.php') && !hrefLower.includes('/plugins')) {
      const normalized = normalizeUrl(href);
      if (normalized) found.facebook.add(normalized);
    }

    // Booking platforms
    for (const bp of BOOKING_PATTERNS) {
      if (hrefLower.includes(bp)) {
        const normalized = normalizeUrl(href);
        if (normalized) found.booking.add(normalized);
      }
    }

    // Bio link aggregators
    for (const bl of BIO_LINK_PATTERNS) {
      if (hrefLower.includes(bl)) {
        const normalized = normalizeUrl(href);
        if (normalized) found.bioLinks.add(normalized);
      }
    }
  }

  // Also scan meta tags and structured data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item.telephone) {
          const phone = item.telephone.replace(/[\s.-]/g, '');
          found.phone.add(phone);
        }
        if (item.email) found.email.add(item.email.toLowerCase());
        if (item.url) {
          // Check for social links in structured data
          const url = item.url.toLowerCase();
          if (url.includes('instagram.com')) found.instagram.add(normalizeUrl(item.url));
          if (url.includes('facebook.com')) found.facebook.add(normalizeUrl(item.url));
        }
        if (item.sameAs && Array.isArray(item.sameAs)) {
          for (const link of item.sameAs) {
            const linkLower = (link || '').toLowerCase();
            if (linkLower.includes('instagram.com')) found.instagram.add(normalizeUrl(link));
            if (linkLower.includes('facebook.com')) found.facebook.add(normalizeUrl(link));
            if (linkLower.includes('t.me/')) found.telegram.add(normalizeUrl(link));
            if (linkLower.includes('line.me/')) found.line.add(normalizeUrl(link));
          }
        }
      }
    } catch {}
  });

  // Clean up null values from Sets
  for (const key of Object.keys(found)) {
    found[key].delete(null);
    found[key].delete(undefined);
    found[key].delete('');
  }

  return found;
}

// ─── Enrichment Logic ────────────────────────────────────────────────────────

/**
 * Crawl a listing's website and extract contacts from multiple pages.
 */
async function crawlWebsite(websiteUrl) {
  const allContacts = {
    phone: new Set(), whatsapp: new Set(), telegram: new Set(),
    line: new Set(), instagram: new Set(), facebook: new Set(),
    email: new Set(), booking: new Set(), bioLinks: new Set(),
  };

  let baseUrl;
  try {
    baseUrl = new URL(websiteUrl);
  } catch {
    return allContacts;
  }

  const origin = baseUrl.origin;
  let pagesCrawled = 0;

  for (const pagePath of CONTACT_PAGES) {
    if (pagesCrawled >= MAX_PAGES_PER_DOMAIN) break;

    const pageUrl = origin + pagePath;
    const html = await fetchRetry(pageUrl);
    pagesCrawled++;

    if (html) {
      const contacts = extractContactsFromHtml(html, origin);
      // Merge into allContacts
      for (const key of Object.keys(contacts)) {
        for (const val of contacts[key]) {
          allContacts[key].add(val);
        }
      }
    }

    await sleep(THROTTLE_MS);
  }

  return allContacts;
}

/**
 * Crawl a bio link page (linktree, beacons, etc.) for additional contacts.
 */
async function crawlBioLink(bioUrl) {
  const allContacts = {
    phone: new Set(), whatsapp: new Set(), telegram: new Set(),
    line: new Set(), instagram: new Set(), facebook: new Set(),
    email: new Set(), booking: new Set(), bioLinks: new Set(),
  };

  const html = await fetchRetry(bioUrl);
  if (html) {
    const contacts = extractContactsFromHtml(html, bioUrl);
    for (const key of Object.keys(contacts)) {
      for (const val of contacts[key]) {
        allContacts[key].add(val);
      }
    }
  }

  return allContacts;
}

/**
 * Check if a discovered value is genuinely new (not already in existing contacts).
 */
function isNewContact(existingValue, newValue) {
  if (!existingValue) return true;
  if (!newValue) return false;

  const existing = existingValue.toLowerCase().replace(/[\s+\-()]/g, '');
  const fresh = newValue.toLowerCase().replace(/[\s+\-()]/g, '');

  // Check if they're essentially the same
  if (existing === fresh) return false;
  if (existing.includes(fresh) || fresh.includes(existing)) return false;

  return true;
}

/**
 * Pick the best value from a set (prefer full URLs, longer strings).
 */
function pickBest(values) {
  const arr = [...values].filter(Boolean);
  if (arr.length === 0) return null;
  // Prefer https URLs
  const https = arr.filter(v => v.startsWith('https://'));
  if (https.length > 0) return https[0];
  const http = arr.filter(v => v.startsWith('http://'));
  if (http.length > 0) return http[0];
  // Return longest
  arr.sort((a, b) => b.length - a.length);
  return arr[0];
}

/**
 * Enrich a single listing's contacts.
 */
async function enrichListing(listing) {
  const contacts = { ...(listing.contacts || {}) };
  const enrichedMeta = {};
  const allDiscovered = {
    phone: new Set(), whatsapp: new Set(), telegram: new Set(),
    line: new Set(), instagram: new Set(), facebook: new Set(),
    email: new Set(), booking: new Set(), bioLinks: new Set(),
  };

  const websiteUrl = contacts.website;
  let crawledWebsite = false;

  // Step 1: Crawl the listing's website (if it's a real domain, not social media)
  if (websiteUrl && !isSocialDomain(websiteUrl)) {
    try {
      const siteContacts = await crawlWebsite(websiteUrl);
      for (const key of Object.keys(siteContacts)) {
        for (const val of siteContacts[key]) {
          allDiscovered[key].add(val);
        }
      }
      crawledWebsite = true;
    } catch (e) {
      // Silently continue
    }
  }

  // Step 2: Crawl bio links if discovered or if website is a social link
  const bioLinks = [...allDiscovered.bioLinks];
  // Also check if the "website" is actually a bio link
  if (websiteUrl) {
    for (const pattern of BIO_LINK_PATTERNS) {
      if (websiteUrl.toLowerCase().includes(pattern) && !bioLinks.includes(websiteUrl)) {
        bioLinks.push(websiteUrl);
      }
    }
  }

  for (const bioUrl of bioLinks.slice(0, 2)) { // Max 2 bio links
    try {
      const bioContacts = await crawlBioLink(bioUrl);
      for (const key of Object.keys(bioContacts)) {
        for (const val of bioContacts[key]) {
          allDiscovered[key].add(val);
        }
      }
      await sleep(THROTTLE_MS);
    } catch {}
  }

  // Step 3: Merge discovered contacts (only append new ones)
  const contactTypes = ['phone', 'whatsapp', 'telegram', 'line', 'instagram', 'facebook', 'email', 'booking'];

  for (const type of contactTypes) {
    const existing = contacts[type];
    const discovered = allDiscovered[type];

    if (discovered.size === 0) continue;

    const bestNew = pickBest(discovered);
    if (!bestNew) continue;

    if (isNewContact(existing, bestNew)) {
      if (!existing) {
        // Field was empty/null — fill it
        contacts[type] = bestNew;
        const source = crawledWebsite ? 'website' : 'bio_link';
        enrichedMeta[type] = { value: bestNew, source };
      } else {
        // Field already has a value — store as additional discovery in metadata only
        const source = crawledWebsite ? 'website' : 'bio_link';
        enrichedMeta[type + '_additional'] = { value: bestNew, source };
      }
    }
  }

  // Attach enrichment metadata
  if (Object.keys(enrichedMeta).length > 0) {
    contacts._enriched = enrichedMeta;
  }

  return contacts;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== SwanPass Contact Enrichment ===\n');

  if (!fs.existsSync(DATA_FILE)) {
    console.error('Error: data/listings.json not found.');
    process.exit(1);
  }

  const allListings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  let listings = allListings;

  if (LIMIT < listings.length) {
    listings = listings.slice(0, LIMIT);
    console.log(`Limited to ${LIMIT} listings\n`);
  }

  if (DRY_RUN) {
    console.log('DRY RUN — no output file will be written\n');
  }

  // Stats tracking
  const stats = {
    total: listings.length,
    hasWebsite: 0,
    websiteCrawled: 0,
    enriched: 0,
    newContacts: { phone: 0, whatsapp: 0, telegram: 0, line: 0, instagram: 0, facebook: 0, email: 0, booking: 0 },
    topEnriched: [],
    errors: 0,
  };

  // Count listings with crawlable websites
  stats.hasWebsite = listings.filter(l => l.contacts?.website && !isSocialDomain(l.contacts.website)).length;
  const socialWebsites = listings.filter(l => l.contacts?.website && isSocialDomain(l.contacts.website)).length;

  console.log(`Total listings: ${stats.total}`);
  console.log(`With crawlable websites: ${stats.hasWebsite}`);
  console.log(`With social-media "websites" (skipped): ${socialWebsites}`);
  console.log(`\nStarting enrichment...\n`);

  const startTime = Date.now();

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    const hasWebsite = listing.contacts?.website && !isSocialDomain(listing.contacts.website);

    if (!hasWebsite) {
      // Nothing to crawl — skip but keep listing in output
      if ((i + 1) % 100 === 0 || i === listings.length - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`  [${i + 1}/${listings.length}] ${elapsed}s — ${stats.enriched} enriched so far`);
      }
      continue;
    }

    try {
      const enrichedContacts = await enrichListing(listing);
      listing.contacts = enrichedContacts;

      if (enrichedContacts._enriched) {
        stats.enriched++;
        const newCount = Object.keys(enrichedContacts._enriched).length;

        // Count by type
        for (const key of Object.keys(enrichedContacts._enriched)) {
          const baseType = key.replace('_additional', '');
          if (stats.newContacts[baseType] !== undefined) {
            stats.newContacts[baseType]++;
          }
        }

        stats.topEnriched.push({ name: listing.name, slug: listing.slug, newContacts: newCount });
      }

      stats.websiteCrawled++;
    } catch (e) {
      stats.errors++;
    }

    // Progress
    if ((i + 1) % 10 === 0 || i === listings.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`  [${i + 1}/${listings.length}] ${elapsed}s — crawled: ${stats.websiteCrawled}, enriched: ${stats.enriched}`);
    }
  }

  // ─── Write output ──────────────────────────────────────────────────────────

  if (!DRY_RUN) {
    // Write to a NEW file (not overwriting original)
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allListings, null, 2));
    console.log(`\nOutput written to: ${OUTPUT_FILE}`);
  }

  // ─── Report ────────────────────────────────────────────────────────────────

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(60));
  console.log('  ENRICHMENT REPORT');
  console.log('═'.repeat(60));
  console.log(`  Total listings processed:    ${stats.total}`);
  console.log(`  Listings with websites:      ${stats.hasWebsite}`);
  console.log(`  Websites successfully crawled: ${stats.websiteCrawled}`);
  console.log(`  Listings enriched:           ${stats.enriched}`);
  console.log(`  Errors:                      ${stats.errors}`);
  console.log(`  Time elapsed:                ${elapsed}s`);
  console.log('');
  console.log('  NEW CONTACTS DISCOVERED BY TYPE:');
  console.log('  ─────────────────────────────────');

  const contactTypes = ['phone', 'whatsapp', 'telegram', 'line', 'instagram', 'facebook', 'email', 'booking'];
  let totalNew = 0;
  for (const type of contactTypes) {
    const count = stats.newContacts[type];
    totalNew += count;
    const bar = '█'.repeat(Math.min(count, 40));
    console.log(`  ${type.padEnd(12)} ${String(count).padStart(4)}  ${bar}`);
  }
  console.log(`  ${'TOTAL'.padEnd(12)} ${String(totalNew).padStart(4)}`);

  if (stats.topEnriched.length > 0) {
    console.log('');
    console.log('  TOP ENRICHED LISTINGS:');
    console.log('  ─────────────────────────────────');
    stats.topEnriched
      .sort((a, b) => b.newContacts - a.newContacts)
      .slice(0, 15)
      .forEach((item, i) => {
        console.log(`  ${String(i + 1).padStart(3)}. ${item.name.padEnd(35)} +${item.newContacts} contacts`);
      });
  }

  console.log('\n' + '═'.repeat(60));
  if (!DRY_RUN) {
    console.log(`\nRun: node scripts/enrich_contacts.js`);
    console.log(`Output: data/listings.enriched.json`);
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
