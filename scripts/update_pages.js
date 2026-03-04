#!/usr/bin/env node
/**
 * update_pages.js — Add shared CSS, header, footer includes to existing pages
 * Adds: css/site.css link, data-include header/footer, js/include.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Pages to update (non-generated, non-template)
const pages = [
  'index.html',
  'search.html',
  'map.html',
  'deals.html',
  'best-places.html',
  'cities.html',
  'city-bangkok.html',
  'city-pattaya.html',
  'city-chiangmai.html',
  'city-phuket.html',
  'city-huahin.html',
  'city-bali.html',
  'city-hcmc.html',
  'login.html',
  'profile.html',
  'add-listing.html',
  'admin.html',
];

let updated = 0;
let skipped = 0;

pages.forEach(page => {
  const filepath = path.join(ROOT, page);
  if (!fs.existsSync(filepath)) {
    console.log(`  SKIP (not found): ${page}`);
    skipped++;
    return;
  }

  let html = fs.readFileSync(filepath, 'utf-8');
  let changed = false;

  // 1. Add CSS link if missing
  if (!html.includes('css/site.css')) {
    // Insert after the Google Fonts link or before </head>
    if (html.includes('</head>')) {
      html = html.replace('</head>', '<link rel="stylesheet" href="css/site.css">\n</head>');
      changed = true;
    }
  }

  // 2. Add footer include before </body> if missing
  if (!html.includes('data-include="partials/footer.html"')) {
    if (html.includes('</body>')) {
      html = html.replace('</body>', '<div data-include="partials/footer.html"></div>\n</body>');
      changed = true;
    }
  }

  // 3. Add include.js before </body> if missing
  if (!html.includes('js/include.js')) {
    if (html.includes('</body>')) {
      html = html.replace('</body>', '<script src="js/include.js"></script>\n</body>');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filepath, html);
    console.log(`  UPDATED: ${page}`);
    updated++;
  } else {
    console.log(`  OK (already has includes): ${page}`);
    skipped++;
  }
});

console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
