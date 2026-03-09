#!/usr/bin/env node
/**
 * fetch_all_listings.js — Fetch ALL listings from swanpass.com API
 * and update data/listings.json with correct country/city/category data.
 *
 * Country/city is derived from:
 *   1. Slug suffix (e.g., "-bangkok", "-ho-chi-minh-city", "-bali")
 *   2. full_address field (last component is usually country)
 *   3. GPS coordinates as fallback
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'listings.json');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── City/Country detection from slug suffix ──
const SLUG_CITY_MAP = {
  'bangkok': { city: 'Bangkok', country: 'Thailand' },
  'pattaya': { city: 'Pattaya', country: 'Thailand' },
  'chiang-mai': { city: 'Chiang Mai', country: 'Thailand' },
  'phuket': { city: 'Phuket', country: 'Thailand' },
  'ho-chi-minh-city': { city: 'Ho Chi Minh City', country: 'Vietnam' },
  'hanoi': { city: 'Hanoi', country: 'Vietnam' },
  'bali': { city: 'Bali', country: 'Indonesia' },
  'jakarta': { city: 'Jakarta', country: 'Indonesia' },
  'surabaya': { city: 'Surabaya', country: 'Indonesia' },
  'batam': { city: 'Batam', country: 'Indonesia' },
  'singapore': { city: 'Singapore', country: 'Singapore' },
  'phnom-penh': { city: 'Phnom Penh', country: 'Cambodia' },
  'kuala-lumpur': { city: 'Kuala Lumpur', country: 'Malaysia' },
};

// ── Country detection from full_address ──
const ADDRESS_COUNTRY_MAP = {
  'Thailand': 'Thailand',
  'Indonesia': 'Indonesia',
  'Vietnam': 'Vietnam',
  'Singapore': 'Singapore',
  'Cambodia': 'Cambodia',
  'Malaysia': 'Malaysia',
  'Philippines': 'Philippines',
  'Japan': 'Japan',
  'South Korea': 'South Korea',
  'Bali': 'Indonesia',
};

// ── GPS bounding boxes for country detection ──
function countryFromGPS(lat, lng) {
  if (!lat || !lng) return null;
  // Thailand: lat 5.5-20.5, lng 97.3-105.6
  if (lat >= 5.5 && lat <= 20.5 && lng >= 97.3 && lng <= 105.6) return 'Thailand';
  // Vietnam: lat 8.2-23.4, lng 102.1-109.5
  if (lat >= 8.2 && lat <= 23.4 && lng >= 102.1 && lng <= 109.5) return 'Vietnam';
  // Indonesia (broad): lat -11 to 6, lng 95-141
  if (lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141) return 'Indonesia';
  // Singapore: lat 1.15-1.47, lng 103.6-104.1
  if (lat >= 1.15 && lat <= 1.47 && lng >= 103.6 && lng <= 104.1) return 'Singapore';
  // Cambodia: lat 10-14.7, lng 102.3-107.6
  if (lat >= 10 && lat <= 14.7 && lng >= 102.3 && lng <= 107.6) return 'Cambodia';
  // Malaysia: lat 0.8-7.4, lng 99.6-119.3
  if (lat >= 0.8 && lat <= 7.4 && lng >= 99.6 && lng <= 119.3) return 'Malaysia';
  return null;
}

function cityFromGPS(lat, lng, country) {
  if (!lat || !lng) return '';
  if (country === 'Thailand') {
    if (lat >= 13.5 && lat <= 14.0 && lng >= 100.3 && lng <= 100.9) return 'Bangkok';
    if (lat >= 12.8 && lat <= 13.0 && lng >= 100.8 && lng <= 101.0) return 'Pattaya';
    if (lat >= 18.7 && lat <= 18.85 && lng >= 98.9 && lng <= 99.05) return 'Chiang Mai';
    if (lat >= 7.7 && lat <= 8.2 && lng >= 98.2 && lng <= 98.5) return 'Phuket';
    if (lat >= 9.5 && lat <= 9.6 && lng >= 100.0 && lng <= 100.1) return 'Ko Samui';
    if (lat >= 12.5 && lat <= 12.7 && lng >= 99.9 && lng <= 100.0) return 'Hua Hin';
  }
  if (country === 'Vietnam') {
    if (lat >= 10.6 && lat <= 11.2 && lng >= 106.4 && lng <= 107.0) return 'Ho Chi Minh City';
    if (lat >= 20.9 && lat <= 21.15 && lng >= 105.7 && lng <= 106.0) return 'Hanoi';
  }
  if (country === 'Indonesia') {
    if (lat >= -8.9 && lat <= -8.4 && lng >= 115.0 && lng <= 115.6) return 'Bali';
    if (lat >= -6.5 && lat <= -6.0 && lng >= 106.6 && lng <= 107.0) return 'Jakarta';
    if (lat >= -7.4 && lat <= -7.2 && lng >= 112.6 && lng <= 112.85) return 'Surabaya';
    if (lat >= 0.9 && lat <= 1.15 && lng >= 103.9 && lng <= 104.15) return 'Batam';
  }
  if (country === 'Cambodia') {
    if (lat >= 11.5 && lat <= 11.65 && lng >= 104.85 && lng <= 105.0) return 'Phnom Penh';
  }
  if (country === 'Malaysia') {
    if (lat >= 2.9 && lat <= 3.3 && lng >= 101.5 && lng <= 101.85) return 'Kuala Lumpur';
  }
  return '';
}

function detectCityCountry(slug, fullAddress, lat, lng) {
  // 1. Try slug suffix match
  for (const [suffix, info] of Object.entries(SLUG_CITY_MAP)) {
    if (slug.endsWith('-' + suffix)) {
      return { city: info.city, country: info.country };
    }
  }

  // 2. Try full_address match for country
  let country = '';
  let city = '';
  if (fullAddress) {
    for (const [keyword, countryName] of Object.entries(ADDRESS_COUNTRY_MAP)) {
      if (fullAddress.includes(keyword)) {
        country = countryName;
        break;
      }
    }
  }

  // 3. GPS fallback
  if (!country) {
    country = countryFromGPS(lat, lng) || '';
  }

  // 4. Detect city from GPS if we have country
  if (country && !city) {
    city = cityFromGPS(lat, lng, country);
  }

  // 5. Try to extract city from slug for known patterns
  if (!city) {
    if (slug.includes('bali')) city = 'Bali';
    else if (slug.includes('jakarta')) city = 'Jakarta';
    else if (slug.includes('surabaya')) city = 'Surabaya';
    else if (slug.includes('batam')) city = 'Batam';
  }

  return { city, country };
}

async function main() {
  console.log('=== Fetching ALL listings from swanpass.com ===\n');

  // Load existing listings for merging
  let existing;
  try {
    existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch(e) {
    existing = [];
  }
  const existingMap = {};
  existing.forEach(l => { existingMap[l.slug] = l; });
  console.log(`Existing listings in data file: ${existing.length}`);

  // Fetch page 1 to get total count
  const page1 = await fetch('https://swanpass.com/listing.json?page=1');
  const totalCount = page1.meta.total_count;
  const perPage = page1.resources.length;
  const totalPages = Math.ceil(totalCount / perPage);
  console.log(`API reports ${totalCount} total listings, ${perPage} per page, ${totalPages} pages\n`);

  // Collect all listings
  const allRaw = [...page1.resources];
  console.log(`Page 1: ${page1.resources.length} listings`);

  for (let p = 2; p <= totalPages; p++) {
    await sleep(300);
    const pageData = await fetch(`https://swanpass.com/listing.json?page=${p}`);
    allRaw.push(...pageData.resources);
    console.log(`Page ${p}: ${pageData.resources.length} listings (total so far: ${allRaw.length})`);
  }

  console.log(`\nFetched ${allRaw.length} listings total from API`);

  // Deduplicate by slug
  const bySlug = {};
  allRaw.forEach(l => { bySlug[l.slug] = l; });
  const uniqueSlugs = Object.keys(bySlug);
  console.log(`Unique slugs: ${uniqueSlugs.length}`);

  // Transform API data into our format
  const allListings = uniqueSlugs.map(slug => {
    const raw = bySlug[slug];
    const ex = existingMap[slug];

    // Detect city/country
    const { city, country } = detectCityCountry(slug, raw.full_address, raw.lat, raw.lng);

    // Parse categories
    let categories = [];
    if (raw.categories && Array.isArray(raw.categories)) {
      categories = raw.categories;
    } else if (typeof raw.categories === 'string') {
      try { categories = JSON.parse(raw.categories); } catch(e) { categories = [raw.categories]; }
    }

    // Contacts — preserve existing if available
    const contacts = ex ? ex.contacts : {
      phone: raw.phone || null,
      whatsapp: null,
      line: null,
      instagram: null,
      facebook: null,
      website: null,
      telegram: null,
    };
    // Always update phone from API
    if (raw.phone) contacts.phone = raw.phone;

    // Preserve existing rich data (services, hours, faqs, gallery, description)
    const services = ex ? ex.services : [];
    const hours = ex ? ex.hours : {};
    const faqs = ex ? ex.faqs : [];
    const gallery = ex ? ex.gallery : [];
    const description = ex ? ex.description : '';

    // Use existing review_count and rating if available (from our audit)
    const review_count = ex ? ex.review_count : (raw.reviews_count || 0);
    const rating = ex ? ex.rating : (raw.avg_rating || 0);

    return {
      id: slug,
      name: raw.name || '',
      slug: slug,
      city: city,
      country: country,
      categories: categories,
      description: description,
      address: raw.full_address || (ex ? ex.address : ''),
      geo: {
        lat: raw.lat || 0,
        lng: raw.lng || 0,
      },
      contacts: contacts,
      services: services,
      hours: hours,
      faqs: faqs,
      gallery: gallery,
      review_count: review_count,
      rating: rating,
      featured_image: raw.featured_image ? (raw.featured_image.image ? raw.featured_image.image.url : raw.featured_image.image_url) : (ex ? ex.featured_image : null),
      status: raw.status,
      sponsor: raw.sponsor || false,
      featured: raw.featured || false,
      promo: raw.promo || false,
      offer: raw.offer || null,
    };
  });

  // Country/city stats
  const countries = {};
  const cities = {};
  let noCountry = [];
  allListings.forEach(l => {
    const c = l.country || 'UNKNOWN';
    const ci = l.city || 'Unknown City';
    countries[c] = (countries[c] || 0) + 1;
    cities[`${c}/${ci}`] = (cities[`${c}/${ci}`] || 0) + 1;
    if (!l.country) noCountry.push(l.slug);
  });

  console.log('\n--- By Country ---');
  Object.entries(countries).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
  console.log('\n--- By City ---');
  Object.entries(cities).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));

  if (noCountry.length > 0) {
    console.log(`\n--- ${noCountry.length} listings with UNKNOWN country ---`);
    noCountry.forEach(s => {
      const r = bySlug[s];
      console.log(`  ${s} — addr: "${(r.full_address || '').slice(0, 80)}" lat: ${r.lat} lng: ${r.lng}`);
    });
  }

  // Sort: existing listings first (preserve order), then new ones alphabetically
  const existingSlugs = new Set(existing.map(l => l.slug));
  const existingOrder = allListings.filter(l => existingSlugs.has(l.slug));
  const newListings = allListings.filter(l => !existingSlugs.has(l.slug));
  newListings.sort((a, b) => a.name.localeCompare(b.name));

  const finalListings = [...existingOrder, ...newListings];

  console.log(`\n=== Summary ===`);
  console.log(`Existing listings retained: ${existingOrder.length}`);
  console.log(`New listings added: ${newListings.length}`);
  console.log(`Total listings: ${finalListings.length}`);

  // Write updated listings.json
  fs.writeFileSync(DATA_FILE, JSON.stringify(finalListings, null, 2));
  console.log(`\nWrote ${finalListings.length} listings to ${DATA_FILE}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
