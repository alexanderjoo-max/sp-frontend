#!/usr/bin/env node
/**
 * generate_shops_data.js — Generate js/shops-data.js from listings.json + all_api_listings.json
 * Contains the full SHOPS array for the homepage.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LISTINGS_FILE = path.join(ROOT, 'data', 'listings.json');
const API_FILE = path.join(ROOT, 'data', 'all_api_listings.json');
const OUTPUT_FILE = path.join(ROOT, 'js', 'shops-data.js');

// The 10 currently featured + verified shops (one-time list, not auto-coupled)
const VERIFIED_SLUGS = new Set([
  'chairman-nuru-massage-bangkok',
  'g2g-massage-bangkok',
  'jspot-bangkok',
  'amor888',
  'the333-bangkok',
  '666-class',
  'suwon-man-s-spa-bangkok',
  'drake-luxury-lounge-bangkok',
  'exotic-massage-bangkok-bangkok',
  'body-bliss',
]);

const FEATURED_SLUGS = new Set(VERIFIED_SLUGS);

// Recently added listings (manually curated — update when new shops onboard)
const NEW_SLUGS = new Set([
  'lunar-nuru-bangkok',
  'dragon-lady-bkk-bangkok',
  'riviere-77-bangkok',
  'drake-luxury-lounge-bangkok',
]);

// Deals for known shops (preserved from original SHOPS array)
const DEALS = {
  'chairman-nuru-massage-bangkok': 'FREE JACUZZI',
  'g2g-massage-bangkok': 'FREE JACUZZI',
  'jspot-bangkok': 'FREE JACUZZI',
  'amor888': 'FREE JACUZZI',
  'the333-bangkok': 'FREE JACUZZI',
  '666-class': 'FREE JACUZZI',
  'suwon-man-s-spa-bangkok': 'SAVE ฿500',
  'exotic-massage-bangkok-bangkok': 'SAVE ฿200',
  'body-bliss': 'SAVE ฿200',
};

// City inference patterns for listings with null city
const CITY_PATTERNS = [
  ['Bangkok', /Bangkok|Sukhumvit|Silom|Sathorn|Asok|Thonglor|Ekkamai|Nana|Khlong Toei|Watthana|Pathum Wan|Ratchathewi|Phra Khanong|Huai Khwang|Din Daeng|Bang Rak|Chatuchak|Lat Phrao|RCA|Rama\s|Siam|Pratunam|Phrom Phong|On Nut|Udom Suk|Bang Na|Saphan Khwai|Ari\b|Ratchada|Nawamin|Rangsit|Krung Thep/i],
  ['Pattaya', /Pattaya|Walking Street|Chon Buri|Soi Buakhao|Naklua|Jomtien|Bang Lamung|Soi LK|Soi Lengkee/i],
  ['Chiang Mai', /Chiang Mai|Chang Moi|Mae Rim|Si Phum|Muang Chiang|Nimmanhaemin/i],
  ['Phuket', /Phuket|Patong|Bangla|Kathu/i],
  ['Hua Hin', /Hua Hin|Prachuap/i],
  ['Koh Samui', /Samui|Surat Thani/i],
  ['Khon Kaen', /Khon Kaen/i],
  ['Korat', /Korat|Nakhon Ratchasima/i],
  ['Krabi', /Krabi/i],
];

function inferCity(address) {
  if (!address) return null;
  for (const [city, pattern] of CITY_PATTERNS) {
    if (pattern.test(address)) return city;
  }
  return null;
}

function extractArea(address, city) {
  if (!address) return city || '';
  // Try to extract a meaningful area from the address
  const parts = address.split(',').map(s => s.trim());
  // Look for "Soi" or "Sukhumvit" references
  for (const part of parts) {
    if (/Soi\s+\S+/i.test(part) || /Sukhumvit/i.test(part)) {
      return part.replace(/^[\d\s/]+/, '').substring(0, 30);
    }
  }
  // Return the first part if short enough
  if (parts[0] && parts[0].length < 40) return parts[0];
  return city || '';
}

function mapCategory(categories) {
  if (!categories || categories.length === 0) return { cat: 'other', catLabel: 'Other' };
  const catMap = {
    'Massage': 'massage',
    'Soapy': 'soapy',
    "Gentlemen's Club": 'club',
    'Go-Go': 'gogo',
    'Freelancers': 'freelancer',
    'Red Light': 'redlight',
    'Bar': 'bar',
    'KTV': 'club',
    'Karaoke': 'club',
  };
  const primary = catMap[categories[0]] || categories[0].toLowerCase().replace(/[^a-z]/g, '');
  const label = categories.filter(Boolean).join(' · ');
  return { cat: primary, catLabel: label };
}

function main() {
  const listings = JSON.parse(fs.readFileSync(LISTINGS_FILE, 'utf8'));
  const api = JSON.parse(fs.readFileSync(API_FILE, 'utf8'));

  // Build views map from API data
  const viewsMap = {};
  api.forEach(l => { viewsMap[l.slug] = l.views_count || '<100'; });

  // Build featured image map from API data
  const featImgMap = {};
  api.forEach(l => {
    if (l.featured_image && l.featured_image.image_url) {
      featImgMap[l.slug] = l.featured_image.image_url;
    }
  });

  const shops = [];

  listings.forEach(l => {
    const city = l.city || inferCity(l.address);
    const { cat, catLabel } = mapCategory(l.categories);
    const area = extractArea(l.address, city);
    const rating = l.rating ? parseFloat(l.rating.toFixed(1)) : null;
    const visits = viewsMap[l.slug] || '<100';

    // Build tags
    const tags = [];
    if (FEATURED_SLUGS.has(l.slug)) tags.push('featured');
    if (DEALS[l.slug]) tags.push('deal');
    if (VERIFIED_SLUGS.has(l.slug)) tags.push('verified');
    if (NEW_SLUGS.has(l.slug)) tags.push('new');

    // Get primary image
    let img = null;
    if (l.photos && l.photos.length > 0) {
      const featured = l.photos.find(p => p.category === 'featured' && p.url);
      const shop = l.photos.find(p => p.category === 'shop' && p.url);
      const any = l.photos.find(p => p.url);
      img = (featured || shop || any || {}).url || null;
    }
    if (!img) {
      img = featImgMap[l.slug] || null;
    }

    shops.push({
      id: l.slug,
      name: l.name,
      cat,
      catLabel,
      city: city || 'Thailand',
      area,
      rating,
      visits,
      tags,
      img,
      page: `listing-${l.slug}.html`,
      deal: DEALS[l.slug] || null,
      lat: l.geo ? l.geo.lat : null,
      lng: l.geo ? l.geo.lng : null,
    });
  });

  // Sort: featured first, then by rating desc
  shops.sort((a, b) => {
    const af = a.tags.includes('featured') ? 1 : 0;
    const bf = b.tags.includes('featured') ? 1 : 0;
    if (af !== bf) return bf - af;
    return (b.rating || 0) - (a.rating || 0);
  });

  // Write JS file
  const js = `// Auto-generated by scripts/generate_shops_data.js — do not edit manually
const SHOPS = ${JSON.stringify(shops, null, 2)};
`;

  fs.writeFileSync(OUTPUT_FILE, js, 'utf8');
  console.log(`Generated ${OUTPUT_FILE} with ${shops.length} shops`);

  // Report city counts
  const cityCounts = {};
  shops.forEach(s => { cityCounts[s.city] = (cityCounts[s.city] || 0) + 1; });
  console.log('\nCity counts:');
  Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).forEach(([city, count]) => {
    console.log(`  ${city}: ${count}`);
  });
}

main();
