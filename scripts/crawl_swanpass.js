#!/usr/bin/env node
/**
 * crawl_swanpass.js — Crawl ALL Thailand listings from swanpass.com
 *
 * Strategy:
 *   1. Discover listings via JSON API: /listing.json?page=N (100 per page)
 *   2. Filter for Thailand by coordinates + address keywords
 *   3. Scrape each individual listing page for full details
 *
 * Usage:
 *   node scripts/crawl_swanpass.js              # Crawl all Thailand listings
 *   node scripts/crawl_swanpass.js --limit 5    # Crawl first 5 only
 *   node scripts/crawl_swanpass.js --all        # Crawl ALL countries
 *   node scripts/crawl_swanpass.js --no-cache   # Ignore cached HTML
 */

const fs = require('fs');
const path = require('path');
const { load } = require('cheerio');

const BASE_URL = 'https://swanpass.com';
const API_URL = `${BASE_URL}/listing.json`;
const CACHE_DIR = path.join(__dirname, '..', '.cache');
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT = path.join(DATA_DIR, 'listings.json');

const CONCURRENCY = 2;
const TIMEOUT = 15000;
const RETRIES = 3;
const DELAY_MS = 500;
const API_PAGE_SIZE = 100;

// Thailand bounding box
const TH_BOUNDS = { latMin: 5.5, latMax: 20.5, lngMin: 97.0, lngMax: 106.0 };

// Thai address keywords
const TH_KEYWORDS = [
  'bangkok', 'pattaya', 'chiang mai', 'phuket', 'hua hin', 'huahin',
  'krabi', 'samui', 'chiang rai', 'korat', 'khon kaen', 'udon',
  'nakhon', 'ayutthaya', 'rangsit', 'patong', 'thailand', 'sukhumvit',
  'silom', 'siam', 'thonglor', 'ekkamai', 'asoke', 'nana',
  'ratchada', 'pratunam', 'sathorn', 'walking street', 'phitsanulok',
  'chang wat', 'amphoe', 'tambon', 'khwaeng', 'khet', 'krung thep',
  'chon buri', 'surat thani', 'prachuap', 'nonthaburi', 'pathum thani',
  'lat phrao', 'phahon yothin', 'bang lamung', 'บาง', 'แขวง', 'เขต',
  'จังหวัด', 'อำเภอ', 'ตำบล', 'เมือง', 'กรุงเทพ',
];

// Non-Thailand keywords (to reject false positives)
const NON_TH_KEYWORDS = [
  'cambodia', 'phnom penh', 'vietnam', 'ho chi minh', 'hanoi',
  'singapore', 'malaysia', 'kuala lumpur', 'bali', 'indonesia',
  'jakarta', 'batam', 'seminyak', 'canggu', 'manila', 'philippines',
];

// Parse CLI flags
const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const ALL_COUNTRIES = args.includes('--all');
const NO_CACHE = args.includes('--no-cache');

// Ensure dirs
[CACHE_DIR, DATA_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cacheKey(url) {
  return url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 200) + '.html';
}

async function fetchHTML(url, retries = RETRIES) {
  const cached = path.join(CACHE_DIR, cacheKey(url));
  if (!NO_CACHE && fs.existsSync(cached)) {
    return fs.readFileSync(cached, 'utf-8');
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SwanPassCrawler/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      fs.writeFileSync(cached, html);
      return html;
    } catch (err) {
      if (attempt < retries) {
        console.error(`    Retry ${attempt + 1}/${retries} for ${url}: ${err.message}`);
        await sleep(1000 * (attempt + 1));
      }
    }
  }
  return null;
}

async function fetchJSON(url, retries = RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SwanPassCrawler/1.0',
          'Accept': 'application/json',
        }
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt < retries) {
        console.error(`    Retry ${attempt + 1}/${retries} for ${url}: ${err.message}`);
        await sleep(1000 * (attempt + 1));
      }
    }
  }
  return null;
}

// ─── Thailand detection ───────────────────────────────────────────

function isThailand(listing) {
  const addr = (listing.full_address || '').toLowerCase();
  const slug = (listing.slug || '').toLowerCase();
  const combined = `${addr} ${slug}`;

  // Reject if clearly non-Thailand
  if (NON_TH_KEYWORDS.some(kw => combined.includes(kw))) return false;

  // Check coordinates within Thailand bounding box
  const lat = parseFloat(listing.lat);
  const lng = parseFloat(listing.lng);
  if (lat && lng) {
    if (lat >= TH_BOUNDS.latMin && lat <= TH_BOUNDS.latMax &&
        lng >= TH_BOUNDS.lngMin && lng <= TH_BOUNDS.lngMax) {
      return true;
    }
  }

  // Check address keywords
  return TH_KEYWORDS.some(kw => combined.includes(kw));
}

// ─── Step 1: Discover via JSON API ───────────────────────────────

async function discoverListings() {
  console.log('Step 1: Discovering listings via JSON API...');
  let allListings = [];
  let page = 1;

  while (true) {
    const url = `${API_URL}?page=${page}`;
    console.log(`  Fetching API page ${page}...`);
    const data = await fetchJSON(url);
    if (!data || !data.resources || data.resources.length === 0) break;

    allListings = allListings.concat(data.resources);
    console.log(`    Got ${data.resources.length} (total: ${allListings.length})`);

    if (data.resources.length < API_PAGE_SIZE) break; // Last page
    page++;
    await sleep(DELAY_MS);
  }

  console.log(`  Total from API: ${allListings.length}`);

  // Filter for Thailand unless --all
  let filtered;
  if (ALL_COUNTRIES) {
    filtered = allListings;
    console.log(`  Using all ${filtered.length} listings (--all flag)`);
  } else {
    filtered = allListings.filter(isThailand);
    console.log(`  Thailand listings: ${filtered.length}`);
  }

  return filtered;
}

// ─── Step 2: Parse listing page ──────────────────────────────────

function parseListing(html, url, apiData) {
  const $ = load(html);
  const listing = {
    id: null,
    name: null,
    slug: null,
    city: null,
    country: null,
    categories: [],
    description: null,
    address: null,
    geo: { lat: null, lng: null },
    contacts: {
      phone: null,
      whatsapp: null,
      line: null,
      instagram: null,
      facebook: null,
      website: null,
      telegram: null,
    },
    services: [],
    hours: null,
    rating: null,
    review_count: null,
    image_urls: [],
    images: [],
    source_url: url,
    scraped_at: new Date().toISOString(),
    notes: [],
  };

  // Pre-fill from API data
  if (apiData) {
    listing.slug = apiData.slug;
    listing.id = apiData.slug;
    listing.name = apiData.name;
    listing.address = apiData.full_address || null;
    listing.geo.lat = parseFloat(apiData.lat) || null;
    listing.geo.lng = parseFloat(apiData.lng) || null;
    listing.rating = apiData.avg_rating || null;
    listing.review_count = apiData.reviews_count || null;
    listing.contacts.phone = apiData.phone || null;
    if (apiData.categories) {
      listing.categories = apiData.categories.map(c => c.name).filter(Boolean);
    }
    // Featured image from API
    if (apiData.featured_image?.image?.url) {
      listing.image_urls.push(apiData.featured_image.image.url);
    }
  }

  // Extract slug from URL if not from API
  if (!listing.slug) {
    const urlParts = url.split('/');
    listing.slug = urlParts[urlParts.length - 1];
    listing.id = listing.slug;
  }

  // Name — prefer page content over API (more accurate)
  const titlebarName = $('.utf_listing_titlebar_title h2').clone().children().remove().end().text().trim();
  const h1Name = $('h1').first().text().trim();
  if (titlebarName && titlebarName.toLowerCase() !== 'swanpass') {
    listing.name = titlebarName;
  } else if (h1Name && h1Name.toLowerCase() !== 'swanpass') {
    listing.name = h1Name;
  }

  // JSON-LD data (enriches description, address, images)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const items = Array.isArray(data) ? data : (data['@graph'] || [data]);
      items.forEach(item => {
        if (item['@type'] === 'LocalBusiness' || item['@type'] === 'Organization' || item['@type']?.includes?.('Business')) {
          if (item.description && !listing.description) listing.description = item.description;
          if (item.address && !listing.address) {
            if (typeof item.address === 'string') {
              listing.address = item.address;
            } else {
              const a = item.address;
              listing.address = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry]
                .filter(Boolean).join(', ');
              if (a.addressLocality && !listing.city) listing.city = a.addressLocality;
              if (a.addressCountry && !listing.country) {
                listing.country = typeof a.addressCountry === 'string' ? a.addressCountry : a.addressCountry?.name;
              }
            }
          }
          if (item.telephone && !listing.contacts.phone) listing.contacts.phone = item.telephone;
          if (item.geo && !listing.geo.lat) {
            listing.geo.lat = parseFloat(item.geo.latitude) || null;
            listing.geo.lng = parseFloat(item.geo.longitude) || null;
          }
          if (item.aggregateRating) {
            if (!listing.rating) listing.rating = parseFloat(item.aggregateRating.ratingValue) || null;
            if (!listing.review_count) listing.review_count = parseInt(item.aggregateRating.reviewCount) || null;
          }
          if (item.image) {
            const imgs = Array.isArray(item.image) ? item.image : [item.image];
            imgs.forEach(img => {
              const src = typeof img === 'string' ? img : img.url;
              if (src && !listing.image_urls.includes(src)) listing.image_urls.push(src);
            });
          }
        }
      });
    } catch (e) {
      listing.notes.push(`JSON-LD parse error: ${e.message}`);
    }
  });

  // Description — from page content
  if (!listing.description) {
    const descEl = $('[class*="description"], [class*="about"], .listing-desc, .listing-description').first();
    if (descEl.length) listing.description = descEl.text().trim().slice(0, 2000);
  }
  if (!listing.description) {
    listing.description = $('meta[name="description"]').attr('content') || null;
  }

  // Images — collect from all sources
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src.includes('vultrobjects.com') || src.includes('swanpass.com/wp-content')) {
      if (!listing.image_urls.includes(src)) listing.image_urls.push(src);
    }
  });
  $('[data-src], [data-lazy-src], [srcset]').each((_, el) => {
    ['data-src', 'data-lazy-src', 'srcset'].forEach(a => {
      const val = $(el).attr(a);
      if (!val) return;
      val.split(',').map(s => s.trim().split(/\s+/)[0]).forEach(src => {
        if ((src.includes('vultrobjects.com') || src.includes('swanpass.com/wp-content')) && !listing.image_urls.includes(src)) {
          listing.image_urls.push(src);
        }
      });
    });
  });
  $('script').each((_, el) => {
    const text = $(el).html() || '';
    const imgMatches = text.match(/https?:\/\/sgp1\.vultrobjects\.com\/[^'")\s]+/g);
    if (imgMatches) imgMatches.forEach(src => { if (!listing.image_urls.includes(src)) listing.image_urls.push(src); });
  });
  $('[style*="background"]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const bgMatches = style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/g);
    if (bgMatches) bgMatches.forEach(m => {
      const src = m.replace(/url\(['"]?/, '').replace(/['"]?\)/, '');
      if ((src.includes('vultrobjects.com') || src.includes('swanpass.com')) && !listing.image_urls.includes(src)) {
        listing.image_urls.push(src);
      }
    });
  });

  // Categories — from page (supplements API categories)
  $('.listing-tag').each((_, el) => {
    const text = $(el).text().trim();
    if (text && !listing.categories.includes(text)) listing.categories.push(text);
  });
  if (listing.categories.length === 0) {
    $('[class*="badge"], [class*="category"]').each((_, el) => {
      const text = $(el).text().trim().replace(/[⭐✓💆🛁💃👯🔥★]/g, '').trim();
      if (text && text.length < 30 && !['Sponsored', 'Verified', 'New', 'Featured', 'Deal'].includes(text)) {
        if (!listing.categories.includes(text)) listing.categories.push(text);
      }
    });
  }

  // Services / Prices
  $('.utf_pricing_list_section ul li').each((_, el) => {
    const name = $(el).find('h5').text().trim();
    const duration = $(el).find('p').text().trim() || null;
    const price = $(el).find('span').first().text().trim() || null;
    if (name || price) listing.services.push({ name, duration, price, notes: null });
  });
  if (listing.services.length === 0) {
    $('table[class*="price"] tr, [class*="price-table"] tr').each((_, el) => {
      const cells = $(el).find('td');
      if (cells.length >= 2) {
        const name = $(cells[0]).text().trim();
        const price = $(cells[1]).text().trim();
        if (name && price) listing.services.push({ name, duration: extractDuration(name), price, notes: null });
      }
    });
  }
  if (listing.services.length === 0) {
    $('[class*="service"], [class*="menu-item"], [class*="price-item"]').each((_, el) => {
      const text = $(el).text().trim();
      const priceMatch = text.match(/([\d,]+)\s*(THB|baht|฿)/i);
      if (priceMatch) {
        listing.services.push({
          name: text.replace(priceMatch[0], '').trim(),
          duration: extractDuration(text),
          price: priceMatch[0].trim(),
          notes: null,
        });
      }
    });
  }

  // Contacts — phone
  $('a[href^="tel:"]').each((_, el) => {
    if (!listing.contacts.phone) listing.contacts.phone = $(el).attr('href').replace('tel:', '').trim();
  });

  // Contacts — telegram
  $('a[href*="t.me"]').each((_, el) => {
    if (!listing.contacts.telegram) listing.contacts.telegram = $(el).attr('href');
  });

  // Contacts — LINE
  if (!listing.contacts.line) {
    $('a[href*="line.me"], a[href*="line://"]').each((_, el) => {
      listing.contacts.line = $(el).attr('href');
    });
  }
  if (!listing.contacts.line) {
    $('.utf_listing_detail_sidebar li').each((_, el) => {
      const html = $(el).html() || '';
      const text = $(el).text().trim();
      if (html.includes('fa-line') && text) listing.contacts.line = text;
    });
  }

  // Contacts — whatsapp
  $('a[href*="wa.me"]').each((_, el) => {
    if (!listing.contacts.whatsapp) listing.contacts.whatsapp = $(el).attr('href');
  });

  // Contacts — instagram
  $('.utf_social_icon a.instagram, .utf_listing_detail_sidebar a[href*="instagram.com"]').each((_, el) => {
    if (!listing.contacts.instagram) listing.contacts.instagram = $(el).attr('href');
  });
  if (!listing.contacts.instagram) {
    $('a[href*="instagram.com"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href.includes('swanpass') && !listing.contacts.instagram) listing.contacts.instagram = href;
    });
  }

  // Contacts — facebook
  $('.utf_social_icon a.facebook').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.includes('sharer') && !listing.contacts.facebook) listing.contacts.facebook = href;
  });
  if (!listing.contacts.facebook) {
    $('a[href*="facebook.com"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href.includes('sharer') && !href.includes('SwanPass') && !listing.contacts.facebook) listing.contacts.facebook = href;
    });
  }

  // Contacts — website
  $('.utf_listing_detail_sidebar a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const parentHtml = $(el).parent().html() || '';
    if (!listing.contacts.website &&
      (parentHtml.includes('sl-icon-globe') || parentHtml.includes('fa-globe')) &&
      href.startsWith('http') && !href.includes('swanpass.com') && !href.includes('google.com')
    ) {
      listing.contacts.website = href;
    }
  });
  if (!listing.contacts.website) {
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().toLowerCase();
      if (!listing.contacts.website &&
        (text.includes('website') || text.includes('official')) &&
        href.startsWith('http') &&
        !href.includes('swanpass.com') && !href.includes('t.me') && !href.includes('line.me') &&
        !href.includes('wa.me') && !href.includes('instagram.com') &&
        !href.includes('facebook.com') && !href.includes('google.com') && !href.includes('whatsapp')
      ) {
        listing.contacts.website = href;
      }
    });
  }

  // Geo from Google Maps links
  if (!listing.geo.lat) {
    $('iframe[src*="maps.google"], iframe[src*="google.com/maps"]').each((_, el) => {
      const src = $(el).attr('src') || '';
      const coordMatch = src.match(/q=([-\d.]+),([-\d.]+)/) || src.match(/@([-\d.]+),([-\d.]+)/);
      if (coordMatch) {
        listing.geo.lat = parseFloat(coordMatch[1]);
        listing.geo.lng = parseFloat(coordMatch[2]);
      }
    });
  }
  if (!listing.geo.lat) {
    $('a[href*="google.com/maps"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const coordMatch = href.match(/\/([-\d.]+),([-\d.]+)/);
      if (coordMatch && !listing.geo.lat) {
        listing.geo.lat = parseFloat(coordMatch[1]);
        listing.geo.lng = parseFloat(coordMatch[2]);
      }
    });
  }

  // City detection
  if (!listing.city) {
    const cityMap = {
      'bangkok': 'Bangkok', 'pattaya': 'Pattaya', 'phuket': 'Phuket',
      'chiang-mai': 'Chiang Mai', 'chiang mai': 'Chiang Mai',
      'hua-hin': 'Hua Hin', 'hua hin': 'Hua Hin',
      'samui': 'Koh Samui', 'krabi': 'Krabi', 'korat': 'Korat',
      'khon kaen': 'Khon Kaen', 'patong': 'Patong',
    };
    const searchText = `${listing.slug} ${listing.address || ''}`.toLowerCase();
    for (const [kw, city] of Object.entries(cityMap)) {
      if (searchText.includes(kw)) { listing.city = city; break; }
    }
  }

  // Country — default to Thailand for this crawler
  if (!listing.country) {
    listing.country = 'Thailand';
  }

  // Hours
  const hoursLines = [];
  $('.opening-hours ul li').each((_, el) => {
    const day = $(el).clone().children().remove().end().text().trim();
    const time = $(el).find('span').text().trim();
    if (day && time) hoursLines.push(`${day} ${time}`);
  });
  if (hoursLines.length === 0) {
    $('[class*="hours"] [class*="row"], [class*="hours"] tr, [class*="hours"] li').each((_, el) => {
      const text = $(el).text().trim();
      if (text) hoursLines.push(text);
    });
  }
  listing.hours = hoursLines.length > 0 ? hoursLines.join('\n') : null;

  // Address fallback
  if (!listing.address) {
    $('.utf_listing_detail_sidebar li').each((_, el) => {
      const html = $(el).html() || '';
      if (html.includes('sl-icon-location') || html.includes('fa-map')) {
        const text = $(el).text().trim();
        if (text) listing.address = text;
      }
    });
  }

  // Rating from React component
  $('[data-react-class="ListingReviews"]').each((_, el) => {
    try {
      const props = JSON.parse($(el).attr('data-react-props') || '{}');
      if (props.listing) {
        if (props.listing.avg_rating && !listing.rating) listing.rating = props.listing.avg_rating;
        if (props.listing.reviews_count && !listing.review_count) listing.review_count = props.listing.reviews_count;
      }
    } catch (e) {}
  });
  if (!listing.rating) {
    const ratingText = $('.utf_counter_star_rating').text().trim();
    const ratingMatch = ratingText.match(/\(([\d.]+)\)/);
    const reviewMatch = ratingText.match(/\((\d+)\s*Reviews?\)/i);
    if (ratingMatch) listing.rating = parseFloat(ratingMatch[1]);
    if (reviewMatch) listing.review_count = parseInt(reviewMatch[1]);
  }
  if (!listing.rating) {
    const ratingAttr = $('[data-rating]').attr('data-rating');
    if (ratingAttr) listing.rating = parseFloat(ratingAttr);
  }

  // Notes for missing data
  if (!listing.name) listing.notes.push('Could not extract name');
  if (!listing.description) listing.notes.push('Could not extract description');
  if (listing.image_urls.length === 0) listing.notes.push('No images found');
  if (listing.services.length === 0) listing.notes.push('No services/prices found');

  return listing;
}

function extractDuration(text) {
  const match = text.match(/(\d+)\s*(min|hour|hr|mins|hours)/i);
  return match ? match[0] : null;
}

// ─── Step 3: Process in batches ──────────────────────────────────

async function processInBatches(apiListings, batchSize) {
  const results = [];
  const failed = [];

  for (let i = 0; i < apiListings.length; i += batchSize) {
    const batch = apiListings.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (apiItem) => {
        const url = `${BASE_URL}/listing/${apiItem.slug}`;
        const idx = i + batch.indexOf(apiItem) + 1;
        process.stdout.write(`  [${idx}/${apiListings.length}] ${apiItem.slug}...`);

        const html = await fetchHTML(url);
        if (!html) {
          console.log(' FAILED');
          failed.push(apiItem.slug);
          return {
            id: apiItem.slug, name: apiItem.name, slug: apiItem.slug,
            city: null, country: 'Thailand', categories: [],
            description: null, address: apiItem.full_address,
            geo: { lat: parseFloat(apiItem.lat) || null, lng: parseFloat(apiItem.lng) || null },
            contacts: { phone: apiItem.phone || null, whatsapp: null, line: null, instagram: null, facebook: null, website: null, telegram: null },
            services: [], hours: null, rating: apiItem.avg_rating, review_count: apiItem.reviews_count,
            image_urls: [], images: [], source_url: url,
            scraped_at: new Date().toISOString(),
            notes: ['Failed to fetch page after retries — using API data only'],
          };
        }
        try {
          const result = parseListing(html, url, apiItem);
          console.log(` OK (${result.services.length} svcs, ${result.image_urls.length} imgs)`);
          return result;
        } catch (err) {
          console.log(` PARSE ERROR: ${err.message}`);
          failed.push(apiItem.slug);
          return {
            id: apiItem.slug, name: apiItem.name, slug: apiItem.slug,
            city: null, country: 'Thailand', categories: [],
            description: null, address: apiItem.full_address,
            geo: { lat: parseFloat(apiItem.lat) || null, lng: parseFloat(apiItem.lng) || null },
            contacts: { phone: apiItem.phone || null, whatsapp: null, line: null, instagram: null, facebook: null, website: null, telegram: null },
            services: [], hours: null, rating: apiItem.avg_rating, review_count: apiItem.reviews_count,
            image_urls: [], images: [], source_url: url,
            scraped_at: new Date().toISOString(),
            notes: [`Parse error: ${err.message}`],
          };
        }
      })
    );
    results.push(...batchResults);
    if (i + batchSize < apiListings.length) await sleep(DELAY_MS);
  }

  // Retry failed listings once
  if (failed.length > 0) {
    console.log(`\nRetrying ${failed.length} failed listings...`);
    for (const slug of failed) {
      const url = `${BASE_URL}/listing/${slug}`;
      process.stdout.write(`  Retry: ${slug}...`);
      const html = await fetchHTML(url);
      if (html) {
        try {
          const apiItem = apiListings.find(a => a.slug === slug);
          const result = parseListing(html, url, apiItem);
          const idx = results.findIndex(r => r.slug === slug);
          if (idx !== -1) results[idx] = result;
          console.log(' OK');
        } catch (e) {
          console.log(` Still failed: ${e.message}`);
        }
      } else {
        console.log(' Still failed');
      }
      await sleep(1000);
    }
  }

  return results;
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('=== SwanPass Thailand Crawler ===');
  console.log(`Mode: ${ALL_COUNTRIES ? 'All countries' : 'Thailand only'}`);
  console.log(`Limit: ${LIMIT === Infinity ? 'none' : LIMIT}`);
  console.log(`Cache: ${NO_CACHE ? 'disabled' : 'enabled'}`);
  console.log('');

  // Step 1: Discover via API
  let apiListings = await discoverListings();
  console.log('');

  // Apply limit
  if (LIMIT < apiListings.length) {
    apiListings = apiListings.slice(0, LIMIT);
    console.log(`Limited to ${LIMIT} listings`);
  }

  // Step 2: Crawl each listing page
  console.log(`Step 2: Crawling ${apiListings.length} listing pages...\n`);
  const listings = await processInBatches(apiListings, CONCURRENCY);

  // Step 3: Save
  fs.writeFileSync(OUTPUT, JSON.stringify(listings, null, 2));
  console.log(`\nSaved ${listings.length} listings to ${OUTPUT}`);

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total listings: ${listings.length}`);
  console.log(`With name: ${listings.filter(l => l.name).length}`);
  console.log(`With description: ${listings.filter(l => l.description).length}`);
  console.log(`With address: ${listings.filter(l => l.address).length}`);
  console.log(`With coordinates: ${listings.filter(l => l.geo.lat).length}`);
  console.log(`With images: ${listings.filter(l => l.image_urls.length > 0).length}`);
  console.log(`With services: ${listings.filter(l => l.services.length > 0).length}`);
  console.log(`With phone: ${listings.filter(l => l.contacts.phone).length}`);
  console.log(`With LINE: ${listings.filter(l => l.contacts.line).length}`);
  console.log(`With hours: ${listings.filter(l => l.hours).length}`);
  console.log(`With issues: ${listings.filter(l => l.notes.length > 0).length}`);

  const withIssues = listings.filter(l => l.notes.length > 0);
  if (withIssues.length > 0 && withIssues.length <= 20) {
    withIssues.forEach(l => console.log(`  ${l.slug}: ${l.notes.join('; ')}`));
  }

  console.log(`\nTotal Thailand listings scraped: ${listings.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
