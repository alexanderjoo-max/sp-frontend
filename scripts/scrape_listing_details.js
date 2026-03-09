#!/usr/bin/env node
/**
 * scrape_listing_details.js — Scrape detailed info for listings missing descriptions
 * Fetches individual listing pages from swanpass.com and extracts:
 *   - description, contacts, hours, services/menus, address
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const LISTINGS_FILE = path.join(__dirname, '..', 'data', 'listings.json');

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchHTML(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.setTimeout(15000, () => { req.destroy(); resolve(''); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractBetween(html, startMarker, endMarker) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return '';
  const afterStart = startIdx + startMarker.length;
  const endIdx = html.indexOf(endMarker, afterStart);
  if (endIdx === -1) return html.slice(afterStart, afterStart + 5000);
  return html.slice(afterStart, endIdx);
}

function stripHTML(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractDescription(html) {
  // Look for the listing description section
  // The description is typically in a section after the listing header
  const descSection = extractBetween(html, 'class="listing_description"', '</div>');
  if (descSection) {
    const content = descSection.replace(/^[^>]*>/, ''); // remove opening tag remainder
    return stripHTML(content);
  }

  // Alternative: look for about section
  const aboutSection = extractBetween(html, 'id="about"', '</section>');
  if (aboutSection) return stripHTML(aboutSection);

  return '';
}

function extractContacts(html) {
  const contacts = {};

  // Phone
  const phoneMatch = html.match(/class="phone"[^>]*>([^<]+)/);
  if (phoneMatch) contacts.phone = phoneMatch[1].trim();

  // WhatsApp
  const waMatch = html.match(/whatsapp\.com\/send\?phone=([0-9+]+)/);
  if (waMatch) contacts.whatsapp = waMatch[1];
  else {
    const waMatch2 = html.match(/class="ct_whatsapp"[^>]*>([^<]+)/);
    if (waMatch2) contacts.whatsapp = waMatch2[1].trim();
  }

  // Line
  const lineMatch = html.match(/line\.me\/[^"]+/);
  if (lineMatch) contacts.line = 'https://' + lineMatch[0];

  // Instagram
  const igMatch = html.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
  if (igMatch && igMatch[1] !== 'swanpass_official') contacts.instagram = 'https://instagram.com/' + igMatch[1];

  // Website
  const webMatch = html.match(/class="website"[^>]*href="([^"]+)"/);
  if (webMatch) contacts.website = webMatch[1];

  // Telegram
  const tgMatch = html.match(/t\.me\/([a-zA-Z0-9_]+)/);
  if (tgMatch) contacts.telegram = 'https://t.me/' + tgMatch[1];

  // Facebook
  const fbMatch = html.match(/facebook\.com\/([a-zA-Z0-9._-]+)/);
  if (fbMatch && fbMatch[1] !== 'sharer') contacts.facebook = 'https://facebook.com/' + fbMatch[1];

  return contacts;
}

function extractAddress(html) {
  // Look for the address in the listing detail
  const addrMatch = html.match(/class="address"[^>]*title="([^"]+)"/);
  if (addrMatch) return addrMatch[1];

  const addrMatch2 = html.match(/class="address"[^>]*>([^<]+)/);
  if (addrMatch2) return addrMatch2[1].trim();

  return '';
}

function extractHours(html) {
  const hours = {};
  const dayMap = { 'Monday': 'mon', 'Tuesday': 'tue', 'Wednesday': 'wed', 'Thursday': 'thu', 'Friday': 'fri', 'Saturday': 'sat', 'Sunday': 'sun' };

  for (const [fullDay, shortDay] of Object.entries(dayMap)) {
    const regex = new RegExp(fullDay + '[^<]*<[^>]*>([^<]+)', 'i');
    const match = html.match(regex);
    if (match) hours[shortDay] = match[1].trim();
  }

  return Object.keys(hours).length > 0 ? hours : null;
}

function extractMenus(html) {
  const menus = [];
  // Look for menu/price table rows
  const menuSection = extractBetween(html, 'id="pricing"', '</section>');
  if (!menuSection) return menus;

  const rows = menuSection.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
  if (!rows) return menus;

  rows.forEach(row => {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (cells && cells.length >= 2) {
      const name = stripHTML(cells[0]);
      const duration = cells.length >= 3 ? stripHTML(cells[1]) : '';
      const price = stripHTML(cells[cells.length - 1]);
      if (name && !name.match(/^(service|name|type)/i)) {
        menus.push({ name, duration, price });
      }
    }
  });

  return menus;
}

async function main() {
  const listings = JSON.parse(fs.readFileSync(LISTINGS_FILE, 'utf-8'));

  // Find listings missing description (new listings)
  const needScrape = listings.filter(l => !l.description || l.description.length < 10);
  console.log(`Total listings: ${listings.length}`);
  console.log(`Listings needing detail scrape: ${needScrape.length}\n`);

  let updated = 0;
  let errors = 0;

  for (let i = 0; i < needScrape.length; i++) {
    const listing = needScrape[i];
    const slug = listing.slug;

    const html = await fetchHTML(`https://swanpass.com/listing/${slug}`);
    if (!html || html.length < 500) {
      errors++;
      console.log(`[${i+1}/${needScrape.length}] ${slug} — ERROR (no HTML)`);
      await sleep(300);
      continue;
    }

    const idx = listings.findIndex(l => l.slug === slug);
    if (idx === -1) continue;

    // Extract data
    const description = extractDescription(html);
    const contacts = extractContacts(html);
    const address = extractAddress(html);
    const hours = extractHours(html);
    const menus = extractMenus(html);

    // Update listing
    if (description) listings[idx].description = description;
    if (address && (!listings[idx].address || listings[idx].address.length < 5)) listings[idx].address = address;
    if (Object.keys(contacts).length > 0) {
      listings[idx].contacts = { ...listings[idx].contacts, ...contacts };
    }
    if (hours) listings[idx].hours = hours;
    if (menus.length > 0) listings[idx].services = menus;

    updated++;
    if ((i + 1) % 20 === 0 || i === needScrape.length - 1) {
      console.log(`[${i+1}/${needScrape.length}] ${slug} — desc: ${description ? description.length + 'ch' : 'none'}, contacts: ${Object.keys(contacts).length}, menus: ${menus.length}`);
    }

    await sleep(250);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Scraped: ${needScrape.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);

  fs.writeFileSync(LISTINGS_FILE, JSON.stringify(listings, null, 2));
  console.log('Saved listings.json');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
