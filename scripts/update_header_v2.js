#!/usr/bin/env node
/**
 * update_header_v2.js
 * Updates all standalone pages with new header structure:
 * 1. Remove header-search div
 * 2. Add hamburger button before logo
 * 3. Add flex spacer where search was
 * 4. Add Register button before Login
 * 5. Update nav-tabs script to include close-on-click
 *
 * NOTE: index.html is excluded (already updated manually with hero changes)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const files = [
  'listings.html', 'cities.html', 'profile.html',
  'map.html', 'deals.html', 'search.html', 'best-places.html',
  'add-listing.html', 'login.html', 'admin.html',
  'city-bangkok.html', 'city-pattaya.html', 'city-chiangmai.html',
  'city-phuket.html', 'city-huahin.html', 'city-bali.html', 'city-hcmc.html',
  '_listing-template.html'
];

const HAMBURGER = `<button class="btn-hamburger" aria-label="Menu" onclick="var n=document.querySelector('.nav-tabs');n.classList.toggle('open');this.textContent=n.classList.contains('open')?'\\u2715':'\\u2630'">☰</button>`;
const REGISTER = `<button class="btn-register" onclick="window.location='login.html?register=1'">Register</button>`;
const SPACER = `<div style="flex:1"></div>`;

// New script block with close-on-click
const NEW_SCRIPT = `<script>
(function(){
  var page = location.pathname.split('/').pop() || 'index.html';
  var tabs = document.querySelectorAll('.nav-tab');
  for (var i = 0; i < tabs.length; i++) {
    var href = tabs[i].getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      tabs[i].classList.add('active');
    }
    if (page.indexOf('city-') === 0 && href === 'cities.html') {
      tabs[i].classList.add('active');
    }
    if (page.indexOf('listing-') === 0 && href === 'search.html') {
      tabs[i].classList.add('active');
    }
  }
  var nav = document.querySelector('.nav-tabs');
  var btn = document.querySelector('.btn-hamburger');
  tabs.forEach(function(t){
    t.addEventListener('click', function(){
      nav.classList.remove('open');
      if(btn) btn.textContent = '\\u2630';
    });
  });
})();
</script>`;

let updated = 0;

files.forEach(f => {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) {
    console.log(`  SKIP: ${f} (not found)`);
    return;
  }
  let html = fs.readFileSync(fp, 'utf-8');
  const orig = html;

  // 1. Remove the header-search div (the whole block including children)
  // Match: <div class="header-search" ... > ... </div>
  // This is tricky because it contains nested elements. Use a targeted approach.
  html = html.replace(
    /\s*<div class="header-search"[^>]*>[\s\S]*?<\/button>\s*\n\s*<\/div>/g,
    '\n    ' + SPACER
  );

  // 2. Add hamburger button before the logo link (if not already present)
  if (!html.includes('btn-hamburger')) {
    html = html.replace(
      /(<div class="header-inner">\s*\n\s*)(<a href="index\.html">)/,
      `$1${HAMBURGER}\n    $2`
    );
  }

  // 3. Add Register button before Login button (if not already present)
  if (!html.includes('btn-register')) {
    html = html.replace(
      /(\s*)(<button class="btn-login")/,
      `$1${REGISTER}\n$1$2`
    );
  }

  // 4. Replace the old nav script with new one (including close-on-click)
  html = html.replace(
    /<script>\s*\(function\(\)\{[\s\S]*?var page = location\.pathname[\s\S]*?\}\)\(\);\s*<\/script>/,
    NEW_SCRIPT
  );

  if (html !== orig) {
    fs.writeFileSync(fp, html);
    updated++;
    console.log(`  Updated: ${f}`);
  } else {
    console.log(`  No changes: ${f}`);
  }
});

console.log(`\nDone. Updated ${updated}/${files.length} files.`);
