#!/usr/bin/env node
/**
 * generate_pages.js — Generate static listing HTML pages from listings.json
 * Usage: node scripts/generate_pages.js [--limit N]
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'listings.json');
const OUTPUT_DIR = path.join(__dirname, '..');

const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDescription(text) {
  if (!text) return '<p>No description available.</p>';
  // Split on double newlines, or long runs without breaks (300+ chars)
  let paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  // If only one paragraph, try to break on single newlines
  if (paragraphs.length === 1) {
    paragraphs = text.split(/\n/).filter(Boolean);
  }
  // If STILL one giant block, split at sentence boundaries every ~300 chars
  if (paragraphs.length === 1 && text.length > 300) {
    paragraphs = [];
    let remaining = text;
    while (remaining.length > 300) {
      const cutPoint = remaining.lastIndexOf('. ', 350);
      if (cutPoint > 100) {
        paragraphs.push(remaining.slice(0, cutPoint + 1));
        remaining = remaining.slice(cutPoint + 1).trim();
      } else {
        break;
      }
    }
    paragraphs.push(remaining);
  }
  const escaped = paragraphs.map(p => `<p>${escapeHtml(p.trim())}</p>`);
  // If long description, show first 2 paragraphs + "Read more"
  if (escaped.length > 2) {
    const preview = escaped.slice(0, 2).join('\n      ');
    const rest = escaped.slice(2).join('\n      ');
    return `${preview}
      <div class="desc-rest" style="display:none">
      ${rest}
      </div>
      <button class="btn-readmore" onclick="const r=this.previousElementSibling;r.style.display=r.style.display==='none'?'block':'none';this.textContent=r.style.display==='none'?'Read more ▾':'Show less ▴'">Read more ▾</button>`;
  }
  return escaped.join('\n      ');
}

function starsHtml(rating) {
  const r = Math.round(rating || 0);
  return '★'.repeat(r) + '☆'.repeat(Math.max(0, 5 - r));
}

function filterImages(urls) {
  // Remove broken wp-content URLs, keep only working CDN images
  return (urls || []).filter(u => u && !u.includes('swanpass.com/wp-content/'));
}

function generateGalleryScript(listing) {
  const raw = listing.images.length > 0 ? listing.images : listing.image_urls;
  const images = filterImages(raw);
  if (images.length === 0) return '';
  const photosArray = images.map(i => `'${i}'`).join(',\n  ');
  return `
const photos = [
  ${photosArray}
];
let current = 0;
const mainImg = document.getElementById('galleryMain');
const thumbsEl = document.getElementById('galleryThumbs');
const countEl = document.getElementById('galleryCount');
const dotsEl = document.getElementById('galleryDots');

function setPhoto(i) {
  current = i;
  mainImg.src = photos[i];
  countEl.textContent = (i+1) + ' / ' + photos.length;
  document.querySelectorAll('.gallery-thumb').forEach((t,j) => t.classList.toggle('active', j===i));
  document.querySelectorAll('.gallery-dot').forEach((d,j) => d.classList.toggle('active', j===i));
}

photos.forEach((p,i) => {
  const t = document.createElement('img');
  t.className = 'gallery-thumb' + (i===0?' active':'');
  t.src = p; t.onclick = () => setPhoto(i);
  t.onerror = function() { this.style.background='linear-gradient(135deg,#2a1a1a,#1a0a0a)'; this.removeAttribute('src'); };
  thumbsEl.appendChild(t);
  const d = document.createElement('div');
  d.className = 'gallery-dot' + (i===0?' active':'');
  d.onclick = () => setPhoto(i);
  dotsEl.appendChild(d);
});

mainImg.onclick = () => setPhoto((current+1) % photos.length);
mainImg.onerror = function() { this.style.background='linear-gradient(135deg,#2a1a1a,#1a0a0a)'; this.removeAttribute('src'); };
`;
}

function generateServicesHtml(services) {
  if (!services || services.length === 0) return '<p style="color:var(--white40);font-size:13px;">Contact the shop for pricing information.</p>';

  let html = '<div class="collapsible open" onclick="toggleCollapsible(this)">\n';
  html += '  <div class="collapsible-header">Services & Prices <span class="collapsible-arrow">▼</span></div>\n';
  html += '  <div class="collapsible-body">\n';
  html += '    <table class="price-table">\n';
  services.forEach(s => {
    const name = escapeHtml(s.name || 'Service');
    const duration = s.duration ? ` (${escapeHtml(s.duration)})` : '';
    const price = escapeHtml(s.price || 'Ask');
    html += `      <tr><td>${name}${duration}</td><td>${price}</td></tr>\n`;
  });
  html += '    </table>\n  </div>\n</div>';
  return html;
}

function generateContactsHtml(contacts) {
  const items = [];
  if (contacts.phone) {
    items.push(`<div class="contact-item"><div class="contact-icon phone">📞</div><a href="tel:${escapeHtml(contacts.phone)}">${escapeHtml(contacts.phone)}</a></div>`);
  }
  if (contacts.telegram) {
    items.push(`<div class="contact-item"><div class="contact-icon tg">✈️</div><a href="${escapeHtml(contacts.telegram)}" target="_blank">${escapeHtml(contacts.telegram.replace('https://t.me/', '@'))}</a></div>`);
  }
  if (contacts.line) {
    const lineDisplay = contacts.line.startsWith('http') ? 'LINE' : `LINE: ${contacts.line}`;
    const lineHref = contacts.line.startsWith('http') ? contacts.line : `https://line.me/ti/p/~${contacts.line}`;
    items.push(`<div class="contact-item"><div class="contact-icon line">💬</div><a href="${escapeHtml(lineHref)}" target="_blank">${escapeHtml(lineDisplay)}</a></div>`);
  }
  if (contacts.whatsapp) {
    items.push(`<div class="contact-item"><div class="contact-icon phone">📱</div><a href="${escapeHtml(contacts.whatsapp)}" target="_blank">WhatsApp</a></div>`);
  }
  if (contacts.instagram) {
    items.push(`<div class="contact-item"><div class="contact-icon ig">📸</div><a href="${escapeHtml(contacts.instagram)}" target="_blank">Instagram</a></div>`);
  }
  if (contacts.facebook) {
    items.push(`<div class="contact-item"><div class="contact-icon web">📘</div><a href="${escapeHtml(contacts.facebook)}" target="_blank">Facebook</a></div>`);
  }
  if (contacts.website) {
    const display = contacts.website.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    items.push(`<div class="contact-item"><div class="contact-icon web">🌐</div><a href="${escapeHtml(contacts.website)}" target="_blank">${escapeHtml(display)}</a></div>`);
  }
  if (items.length === 0) {
    return '<p style="color:var(--white40);font-size:13px;">No contact information available.</p>';
  }
  return `<div class="contact-list">${items.join('\n')}</div>`;
}

function generateHoursHtml(hours) {
  if (!hours) return '<p style="color:var(--white40);font-size:13px;">Contact the shop for business hours.</p>';
  const lines = hours.split('\n').filter(Boolean);
  let html = '<div class="hours-grid">';
  lines.forEach(line => {
    // Try to split into day and time
    const match = line.match(/^(\w+(?:\s*[-–]\s*\w+)?)\s+(.+)$/);
    if (match) {
      html += `<div class="hours-row"><span class="hours-day">${escapeHtml(match[1])}</span><span class="hours-time">${escapeHtml(match[2])}</span></div>`;
    } else {
      html += `<div class="hours-row"><span class="hours-day">${escapeHtml(line)}</span></div>`;
    }
  });
  html += '</div>';
  return html;
}

function generateMapHtml(listing) {
  if (!listing.geo.lat || !listing.geo.lng) {
    return '<p style="color:var(--white40);font-size:13px;">Location not available.</p>';
  }
  return `
    <iframe class="map-embed"
      src="https://maps.google.com/maps?q=${listing.geo.lat},${listing.geo.lng}&z=16&output=embed"
      allowfullscreen loading="lazy"></iframe>
    <p class="address-text">📍 ${escapeHtml(listing.address || 'Address not available')}</p>
    <div style="margin-top:12px">
      <a href="https://maps.google.com/?q=${listing.geo.lat},${listing.geo.lng}" target="_blank" class="btn btn-outline">🗺️ Open in Google Maps</a>
    </div>`;
}

function generateCtaButtons(contacts) {
  const buttons = [];
  if (contacts.phone) {
    buttons.push(`<a href="tel:${escapeHtml(contacts.phone)}" class="btn btn-primary">📞 Call</a>`);
  }
  if (contacts.telegram) {
    buttons.push(`<a href="${escapeHtml(contacts.telegram)}" target="_blank" class="btn btn-outline">✈️ Telegram</a>`);
  }
  if (contacts.line) {
    const href = contacts.line.startsWith('http') ? contacts.line : `https://line.me/ti/p/~${contacts.line}`;
    buttons.push(`<a href="${escapeHtml(href)}" target="_blank" class="btn btn-green">💬 LINE</a>`);
  }
  if (contacts.whatsapp) {
    buttons.push(`<a href="${escapeHtml(contacts.whatsapp)}" target="_blank" class="btn btn-green">📱 WhatsApp</a>`);
  }
  return buttons;
}

function generatePage(listing, allListings) {
  const raw = listing.images.length > 0 ? listing.images : listing.image_urls;
  const images = filterImages(raw);
  const mainImage = images[0] || '';
  const categoryBadges = listing.categories.map(c => `<span class="badge badge-cat">${escapeHtml(c)}</span>`).join('\n    ');
  const rating = listing.rating ? listing.rating.toFixed(1) : 'N/A';
  const reviewCount = listing.review_count || 0;
  const actionButtons = generateCtaButtons(listing.contacts);
  const stickyButtons = actionButtons.slice(0, 3);

  // Find nearby listings (same city, different listing — skip null cities)
  const nearby = listing.city
    ? allListings.filter(l => l.slug !== listing.slug && l.city === listing.city).slice(0, 4)
    : allListings.filter(l => l.slug !== listing.slug && l.categories.some(c => listing.categories.includes(c))).slice(0, 4);

  const nearbyHtml = nearby.map(n => {
    const nImgs = filterImages(n.images && n.images.length > 0 ? n.images : n.image_urls);
    const nImg = nImgs[0] || '';
    return `<a href="listing-${n.slug}.html" class="nearby-card">
        <img class="nearby-img" src="${nImg}" alt="${escapeHtml(n.name)}" onerror="this.style.background='linear-gradient(135deg,#2a1a1a,#1a0a0a)';this.removeAttribute('src')">
        <div class="nearby-body"><div class="nearby-name">${escapeHtml(n.name)}</div><div class="nearby-meta">${escapeHtml(n.categories.join(' · '))} · ★ ${n.rating ? n.rating.toFixed(1) : 'N/A'}</div></div>
      </a>`;
  }).join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(listing.name)} — Swanpass</title>
<meta name="description" content="${escapeHtml((listing.description || '').slice(0, 160))}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/site.css">
</head>
<body>

<div data-include="partials/header.html"></div>

<!-- GALLERY -->
<div class="gallery">
  <img class="gallery-main" id="galleryMain" src="${mainImage}" alt="${escapeHtml(listing.name)}" onerror="this.style.background='linear-gradient(135deg,#2a1a1a,#1a0a0a)';this.removeAttribute('src')">
  <div class="gallery-count" id="galleryCount">1 / ${images.length}</div>
  <div class="gallery-dots" id="galleryDots"></div>
</div>
<div class="gallery-thumbs" id="galleryThumbs"></div>

<!-- MAIN LAYOUT -->
<div id="mainLayout">

<!-- LISTING INFO -->
<div class="listing-info">
  <div class="listing-badges">
    ${categoryBadges}
  </div>
  <h1 class="listing-name">${escapeHtml(listing.name)}</h1>
  <div class="listing-meta">
    <span>📍 ${escapeHtml(listing.address || listing.city || 'Location not specified')}</span>
    <span>·</span>
    <span class="rating-row"><span class="stars">${starsHtml(listing.rating)}</span> <span class="rating-num">${rating}</span> <span class="review-count">(${reviewCount} reviews)</span></span>
  </div>
  <div class="action-row">
    ${actionButtons.join('\n    ')}
    <button class="btn btn-outline" onclick="this.textContent=this.textContent==='♡ Save'?'♥ Saved':'♡ Save'">♡ Save</button>
  </div>

  <!-- TABS -->
  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('overview')">Overview</button>
    <button class="tab-btn" onclick="switchTab('prices')">Prices</button>
    <button class="tab-btn" onclick="switchTab('reviews')">Reviews (${reviewCount})</button>
    <button class="tab-btn" onclick="switchTab('contact')">Contact & Hours</button>
    <button class="tab-btn" onclick="switchTab('location')">Location</button>
  </div>

  <!-- OVERVIEW TAB -->
  <div class="tab-content active" id="tab-overview">
    <div class="section-title">About ${escapeHtml(listing.name)}</div>
    <div class="description">
      ${formatDescription(listing.description)}
    </div>
  </div>

  <!-- PRICES TAB -->
  <div class="tab-content" id="tab-prices">
    <div class="section-title">Price List</div>
    ${generateServicesHtml(listing.services)}
  </div>

  <!-- REVIEWS TAB -->
  <div class="tab-content" id="tab-reviews">
    <div class="review-summary">
      <div>
        <div class="review-big-num">${rating}</div>
        <div class="review-stars-big">${starsHtml(listing.rating)}</div>
        <div style="font-size:12px;color:var(--white40);margin-top:4px;">${reviewCount} Reviews</div>
      </div>
    </div>
    <div style="text-align:center;padding:16px 0;">
      <a href="${escapeHtml(listing.source_url)}#reviews" target="_blank" class="btn btn-outline">View all reviews on SwanPass →</a>
    </div>
  </div>

  <!-- CONTACT TAB -->
  <div class="tab-content" id="tab-contact">
    <div class="section-title">Contact Details</div>
    ${generateContactsHtml(listing.contacts)}
    <div style="height:20px"></div>
    <div class="section-title">Business Hours</div>
    ${generateHoursHtml(listing.hours)}
  </div>

  <!-- LOCATION TAB -->
  <div class="tab-content" id="tab-location">
    <div class="section-title">Location</div>
    ${generateMapHtml(listing)}
  </div>

  <!-- NEARBY SHOPS -->
  ${nearby.length > 0 ? `
  <div style="margin-top:24px;padding-top:24px;border-top:1px solid var(--border);">
    <div class="section-title">Nearby Shops</div>
    <div class="nearby-grid">
      ${nearbyHtml}
    </div>
  </div>` : ''}

</div><!-- /listing-info -->
</div><!-- /mainLayout -->

<!-- STICKY MOBILE CTA -->
${stickyButtons.length > 0 ? `
<div class="sticky-cta">
  ${stickyButtons.join('\n  ')}
</div>
<div style="height:80px"></div>` : ''}

<div data-include="partials/footer.html"></div>

<script src="js/include.js"></script>
<script>
${generateGalleryScript(listing)}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b,i) => {
    const tabs = ['overview','prices','reviews','contact','location'];
    b.classList.toggle('active', tabs[i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
}

function toggleCollapsible(el) {
  el.classList.toggle('open');
}
</script>
</body>
</html>`;
}

function main() {
  console.log('=== SwanPass Page Generator ===');

  if (!fs.existsSync(DATA_FILE)) {
    console.error('Error: data/listings.json not found. Run crawl_swanpass.js first.');
    process.exit(1);
  }

  const allListings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  let listings = allListings;
  if (LIMIT < listings.length) {
    listings = listings.slice(0, LIMIT);
    console.log(`Limited to ${LIMIT} listings`);
  }

  let generated = 0;

  listings.forEach((listing, i) => {
    const filename = `listing-${listing.slug}.html`;
    const filepath = path.join(OUTPUT_DIR, filename);
    const html = generatePage(listing, allListings);
    fs.writeFileSync(filepath, html);
    generated++;
    console.log(`  [${i + 1}/${listings.length}] Generated: ${filename}`);
  });

  console.log(`\n=== Summary ===`);
  console.log(`Generated: ${generated} listing pages`);
}

main();
