#!/usr/bin/env node
/**
 * reingest_listing.js — Re-scrape a single listing from swanpass.com
 * and update listings.json with fresh data (photos, contacts, etc.)
 *
 * Usage: node scripts/reingest_listing.js <slug>
 */
const fs = require('fs');
const path = require('path');
const { load } = require('cheerio');

const DATA_FILE = path.join(__dirname, '..', 'data', 'listings.json');
const CACHE_DIR = path.join(__dirname, '..', '.cache');
const BASE_URL = 'https://swanpass.com';

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/reingest_listing.js <slug>');
  process.exit(1);
}

async function fetchHTML(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      console.log(`  Attempt ${attempt + 1} failed: ${e.message}`);
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

async function main() {
  const url = `${BASE_URL}/listing/${slug}`;
  console.log(`Fetching: ${url}`);
  const html = await fetchHTML(url);
  if (!html) { console.error('Failed to fetch page'); process.exit(1); }

  // Cache the HTML
  const cacheFile = path.join(CACHE_DIR, url.replace(/[^a-zA-Z0-9]/g, '_') + '.html');
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, html);
  console.log(`Cached: ${cacheFile}`);

  const $ = load(html);

  // ─── Extract photos from React props ───
  const photos = [];
  $('[data-react-class]').each((_, el) => {
    try {
      const props = JSON.parse($(el).attr('data-react-props') || '{}');
      const listing = props.listing || props;

      // Featured image
      if (listing.featured_image?.image?.url) {
        photos.push({
          id: listing.featured_image.id,
          url: listing.featured_image.image.url,
          width: listing.featured_image.width || null,
          height: listing.featured_image.height || null,
          category: 'featured',
          caption: listing.featured_image.caption || null,
          sort_order: listing.featured_image.sort_order || 0,
        });
      }

      // Talent images
      if (listing.talent_images) {
        listing.talent_images.forEach(img => {
          if (img.image?.url && !photos.find(p => p.id === img.id)) {
            photos.push({
              id: img.id,
              url: img.image.url,
              width: img.width || null,
              height: img.height || null,
              category: 'talent',
              caption: img.caption || null,
              sort_order: img.sort_order || 0,
            });
          }
        });
      }

      // Property/shop images (key is "property_images" on swanpass.com)
      const shopKey = listing.shop_images ? 'shop_images' : 'property_images';
      if (listing[shopKey]) {
        listing[shopKey].forEach(img => {
          if (img.image?.url && !photos.find(p => p.id === img.id)) {
            photos.push({
              id: img.id,
              url: img.image.url,
              width: img.width || null,
              height: img.height || null,
              category: 'shop',
              caption: img.caption || null,
              sort_order: img.sort_order || 0,
            });
          }
        });
      }
    } catch (e) {}
  });

  // Sort photos by sort_order
  photos.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  // ─── Extract image_urls (flat list) ───
  const imageUrls = [];
  const addUrl = (src) => {
    if (src && !imageUrls.includes(src)) imageUrls.push(src);
  };

  // From photos
  photos.forEach(p => addUrl(p.url));

  // From HTML
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && (src.includes('vultrobjects.com') || src.includes('swanpass.com/wp-content'))) addUrl(src);
  });
  $('[data-src]').each((_, el) => {
    const src = $(el).attr('data-src');
    if (src && (src.includes('vultrobjects.com') || src.includes('swanpass.com/wp-content'))) addUrl(src);
  });

  // ─── Extract contacts ───
  const contacts = {
    phone: null, whatsapp: null, line: null, instagram: null,
    facebook: null, website: null, telegram: null, email: null,
  };

  // Phone
  $('a[href^="tel:"]').each((_, el) => {
    if (!contacts.phone) contacts.phone = $(el).attr('href').replace('tel:', '').trim();
  });

  // Telegram — from links
  $('a[href*="t.me"]').each((_, el) => {
    if (!contacts.telegram) contacts.telegram = $(el).attr('href');
  });
  // Telegram — from sidebar <li> with fa-telegram icon
  if (!contacts.telegram) {
    $('.utf_listing_detail_sidebar li').each((_, el) => {
      const html = $(el).html() || '';
      const text = $(el).text().trim();
      if (html.includes('fa-telegram') && text) {
        contacts.telegram = text.startsWith('http') ? text : 'https://t.me/' + text.replace(/^@/, '');
      }
    });
  }

  // LINE
  $('a[href*="line.me"], a[href*="line://"]').each((_, el) => {
    if (!contacts.line) contacts.line = $(el).attr('href');
  });
  if (!contacts.line) {
    $('.utf_listing_detail_sidebar li').each((_, el) => {
      const html = $(el).html() || '';
      const text = $(el).text().trim();
      if (html.includes('fa-line') && text) contacts.line = text;
    });
  }

  // WhatsApp
  $('a[href*="wa.me"]').each((_, el) => {
    if (!contacts.whatsapp) contacts.whatsapp = $(el).attr('href');
  });

  // Instagram
  $('a[href*="instagram.com"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.includes('swanpass') && !contacts.instagram) contacts.instagram = href;
  });

  // Facebook
  $('a[href*="facebook.com"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.includes('sharer') && !href.includes('SwanPass') && !contacts.facebook) contacts.facebook = href;
  });

  // Website
  $('.utf_listing_detail_sidebar a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const parentHtml = $(el).parent().html() || '';
    if (!contacts.website &&
      (parentHtml.includes('sl-icon-globe') || parentHtml.includes('fa-globe')) &&
      href.startsWith('http') && !href.includes('swanpass.com') && !href.includes('google.com')
    ) {
      contacts.website = href;
    }
  });

  // Email (mailto links)
  $('a[href^="mailto:"]').each((_, el) => {
    if (!contacts.email) contacts.email = $(el).attr('href').replace('mailto:', '').trim();
  });

  // ─── Extract description ───
  let description = null;
  $('#utf_listing_overview p, .listing-description p').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 20) {
      description = description ? description + '\n' + text : text;
    }
  });

  // ─── Extract services ───
  const services = [];
  $('table.utf_pricing_list tbody tr, .utf_pricing_list tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 2) {
      const name = $(cells[0]).text().trim();
      const price = $(cells[1]).text().trim();
      if (name && price) {
        const durationMatch = name.match(/(\d+)\s*(min|hour|hr|mins|hours)/i);
        services.push({ name, duration: durationMatch ? durationMatch[0] : null, price, notes: null });
      }
    }
  });

  // ─── Extract hours ───
  const hoursLines = [];
  $('[class*="hours"] [class*="row"], [class*="hours"] tr, [class*="hours"] li').each((_, el) => {
    const text = $(el).text().trim();
    if (text) hoursLines.push(text);
  });

  // ─── Report ───
  console.log('\n=== Re-ingested data ===');
  console.log(`Photos: ${photos.length} (featured: ${photos.filter(p=>p.category==='featured').length}, talent: ${photos.filter(p=>p.category==='talent').length}, shop: ${photos.filter(p=>p.category==='shop').length})`);
  console.log(`Image URLs: ${imageUrls.length}`);
  console.log('Contacts:');
  for (const [k, v] of Object.entries(contacts)) {
    if (v) console.log(`  ${k}: ${v}`);
  }
  if (services.length) console.log(`Services: ${services.length}`);
  if (hoursLines.length) console.log(`Hours: ${hoursLines.length} lines`);
  if (description) console.log(`Description: ${description.slice(0, 80)}...`);

  // ─── Update listings.json ───
  const listings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const idx = listings.findIndex(l => l.slug === slug);
  if (idx === -1) {
    console.error(`\nListing "${slug}" not found in listings.json`);
    process.exit(1);
  }

  const existing = listings[idx];
  console.log(`\nExisting data for "${existing.name}":`);
  console.log(`  Photos: ${(existing.photos || []).length}`);
  console.log(`  Image URLs: ${(existing.image_urls || []).length}`);
  console.log(`  Contacts: ${Object.entries(existing.contacts || {}).filter(([,v]) => v).map(([k,v]) => k).join(', ') || 'none'}`);

  // Update photos (replace entirely — fresh from source)
  if (photos.length > 0) {
    existing.photos = photos;
    console.log(`  → Updated photos: ${photos.length}`);
  }

  // Update image_urls (replace entirely)
  if (imageUrls.length > 0) {
    existing.image_urls = imageUrls;
    console.log(`  → Updated image_urls: ${imageUrls.length}`);
  }

  // Update contacts (only fill nulls, or replace if new value is different)
  for (const [key, val] of Object.entries(contacts)) {
    if (val && !existing.contacts[key]) {
      existing.contacts[key] = val;
      console.log(`  → New contact: ${key} = ${val}`);
    }
  }

  // Update services if we found more
  if (services.length > 0 && services.length >= (existing.services || []).length) {
    existing.services = services;
    console.log(`  → Updated services: ${services.length}`);
  }

  // Update hours
  if (hoursLines.length > 0) {
    existing.hours = hoursLines.join('\n');
    console.log(`  → Updated hours`);
  }

  // Update description if missing
  if (description && !existing.description) {
    existing.description = description;
    console.log(`  → Updated description`);
  }

  existing.scraped_at = new Date().toISOString();

  listings[idx] = existing;
  fs.writeFileSync(DATA_FILE, JSON.stringify(listings, null, 2));
  console.log(`\nSaved to ${DATA_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
