#!/usr/bin/env node
/**
 * generate_pages.js — Generate static listing HTML pages from listings.json
 * Usage: node scripts/generate_pages.js [--limit N]
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'listings.json');
const OUTPUT_DIR = path.join(__dirname, '..');
const PARTIALS_DIR = path.join(__dirname, '..', 'partials');

const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;

// Read shared partials once at build time (inlined into every page)
const HEADER_HTML = fs.readFileSync(path.join(PARTIALS_DIR, 'header.html'), 'utf-8');
const FOOTER_HTML = fs.readFileSync(path.join(PARTIALS_DIR, 'footer.html'), 'utf-8');

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

/**
 * Build a set of "garbage" image URLs that appear across many listings.
 * These are sidebar/sponsored thumbnails that got scraped into every listing's
 * image_urls — they don't belong to the listing itself.
 */
function buildGarbageImageSet(allListings) {
  const urlCounts = {};
  allListings.forEach(l => {
    const seen = new Set(); // count each URL once per listing
    (l.image_urls || []).forEach(u => {
      if (u && !u.includes('swanpass.com/wp-content/') && !seen.has(u)) {
        seen.add(u);
        urlCounts[u] = (urlCounts[u] || 0) + 1;
      }
    });
  });
  // Any image appearing in 20+ different listings is sidebar garbage
  const garbage = new Set();
  for (const [url, count] of Object.entries(urlCounts)) {
    if (count >= 20) garbage.add(url);
  }
  return garbage;
}

/**
 * Get the correct images for a listing, preferring the categorized photos array
 * over the unreliable image_urls (which often contain sidebar/related-listing images).
 *
 * Priority: photos with valid IDs > image_urls (filtered + de-garbage'd) > empty
 * Order: featured first, then shop, then talent
 */
function getListingImages(listing, garbageSet) {
  const photos = listing.photos || [];
  // Check if photos have valid IDs (not garbage sidebar data)
  const validPhotos = photos.filter(p => p.id !== null && p.url);

  if (validPhotos.length > 0) {
    // Sort: featured first, then shop, then talent
    const order = { featured: 0, shop: 1, talent: 2 };
    const sorted = [...validPhotos].sort((a, b) => {
      const oa = order[a.category] ?? 1;
      const ob = order[b.category] ?? 1;
      if (oa !== ob) return oa - ob;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    return sorted.map(p => p.url);
  }

  // Fallback: use image_urls, filtering out both wp-content AND known garbage sidebar images
  const filtered = filterImages(listing.image_urls).filter(u => !garbageSet.has(u));
  return filtered;
}

function generateGalleryScript(listing, garbageSet) {
  const images = getListingImages(listing, garbageSet);
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

function generatePage(listing, allListings, garbageSet) {
  const images = getListingImages(listing, garbageSet);
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
    const nImgs = getListingImages(n, garbageSet);
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

${HEADER_HTML}

<!-- GALLERY -->
<div class="gallery">
  <img class="gallery-main" id="galleryMain" src="${mainImage}" alt="${escapeHtml(listing.name)}" onerror="this.style.background='linear-gradient(135deg,#2a1a1a,#1a0a0a)';this.removeAttribute('src')">
  <div class="gallery-count" id="galleryCount">1 / ${images.length}</div>
  <div class="gallery-dots" id="galleryDots"></div>
</div>
<div class="gallery-thumbs" id="galleryThumbs"></div>
${(listing.photos && listing.photos.length > 0) ? `<a href="photos-${listing.slug}.html" class="gallery-view-all">📷 View all ${listing.photos.length} photos →</a>` : ''}

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

${FOOTER_HTML}

<script>
${generateGalleryScript(listing, garbageSet)}

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

function generatePhotosPage(listing) {
  const photos = listing.photos || [];
  if (photos.length === 0) return null;

  const talentPhotos = photos.filter(p => p.category === 'talent');
  const shopPhotos = photos.filter(p => p.category === 'shop' || p.category === 'featured');
  const allCount = photos.length;
  const talentCount = talentPhotos.length;
  const shopCount = shopPhotos.length;

  function photoGrid(list) {
    return list.map((p, i) => {
      const url = p.url;
      return `<div class="photo-thumb" data-cat="${p.category}" onclick="openLightbox(${i}, this.parentNode)">
        <img src="${url}" alt="${escapeHtml(listing.name)}" loading="lazy" onerror="this.parentNode.style.display='none'">
      </div>`;
    }).join('\n      ');
  }

  // Build JSON array of all photo URLs for lightbox (per tab)
  const allUrls = photos.map(p => p.url);
  const talentUrls = talentPhotos.map(p => p.url);
  const shopUrls = shopPhotos.map(p => p.url);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Photos — ${escapeHtml(listing.name)} — Swanpass</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/site.css">
</head>
<body>

${HEADER_HTML}

<div class="photos-header">
  <a href="listing-${listing.slug}.html" class="photos-back">←</a>
  <div class="photos-title">Photos for ${escapeHtml(listing.name)}</div>
</div>

<div class="photos-tab-bar">
  <button class="photos-tab active" onclick="filterPhotos('all', this)">All<span class="photos-count">${allCount}</span></button>
  ${talentCount > 0 ? `<button class="photos-tab" onclick="filterPhotos('talent', this)">Talents<span class="photos-count">${talentCount}</span></button>` : ''}
  ${shopCount > 0 ? `<button class="photos-tab" onclick="filterPhotos('shop', this)">Interior/Exterior<span class="photos-count">${shopCount}</span></button>` : ''}
</div>

<div class="photos-grid" id="photosGrid">
  ${photoGrid(photos)}
</div>

<!-- LIGHTBOX -->
<div class="lightbox" id="lightbox">
  <button class="lightbox-close" onclick="closeLightbox()">✕</button>
  <div class="lightbox-counter" id="lightboxCounter"></div>
  <button class="lightbox-nav lightbox-prev" onclick="navLightbox(-1)">‹</button>
  <img class="lightbox-img" id="lightboxImg" src="" alt="">
  <button class="lightbox-nav lightbox-next" onclick="navLightbox(1)">›</button>
</div>

${FOOTER_HTML}

<script>
const photoSets = {
  all: ${JSON.stringify(allUrls)},
  talent: ${JSON.stringify(talentUrls)},
  shop: ${JSON.stringify(shopUrls)}
};
let currentSet = 'all';
let lbIndex = 0;

function filterPhotos(cat, btn) {
  currentSet = cat;
  document.querySelectorAll('.photos-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.photo-thumb').forEach(el => {
    if (cat === 'all') {
      el.style.display = '';
    } else if (cat === 'shop') {
      el.style.display = (el.dataset.cat === 'shop' || el.dataset.cat === 'featured') ? '' : 'none';
    } else {
      el.style.display = el.dataset.cat === cat ? '' : 'none';
    }
  });
}

function openLightbox(idx, grid) {
  // Build URL list from visible thumbs
  const visible = [...grid.querySelectorAll('.photo-thumb')].filter(t => t.style.display !== 'none');
  const url = visible[idx]?.querySelector('img')?.src;
  if (!url) return;
  // Find index in current set
  const urls = photoSets[currentSet].length > 0 ? photoSets[currentSet] : photoSets.all;
  lbIndex = urls.indexOf(url);
  if (lbIndex === -1) lbIndex = 0;
  showLightbox(urls, lbIndex);
}

function showLightbox(urls, idx) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  const counter = document.getElementById('lightboxCounter');
  img.src = urls[idx];
  counter.textContent = (idx + 1) + ' / ' + urls.length;
  lb.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';
}

function navLightbox(dir) {
  const urls = photoSets[currentSet].length > 0 ? photoSets[currentSet] : photoSets.all;
  lbIndex = (lbIndex + dir + urls.length) % urls.length;
  document.getElementById('lightboxImg').src = urls[lbIndex];
  document.getElementById('lightboxCounter').textContent = (lbIndex + 1) + ' / ' + urls.length;
}

// Keyboard navigation
document.addEventListener('keydown', e => {
  const lb = document.getElementById('lightbox');
  if (!lb.classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') navLightbox(-1);
  if (e.key === 'ArrowRight') navLightbox(1);
});

// Touch swipe for mobile lightbox
let touchStartX = 0;
document.getElementById('lightbox').addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
});
document.getElementById('lightbox').addEventListener('touchend', e => {
  const diff = e.changedTouches[0].screenX - touchStartX;
  if (Math.abs(diff) > 50) {
    navLightbox(diff > 0 ? -1 : 1);
  }
});

// Close lightbox on background click
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target.id === 'lightbox') closeLightbox();
});
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

  // Build garbage image set (sidebar/sponsored images that got scraped into every listing)
  const garbageSet = buildGarbageImageSet(allListings);
  console.log(`Identified ${garbageSet.size} garbage sidebar images to filter out`);

  let listings = allListings;
  if (LIMIT < listings.length) {
    listings = listings.slice(0, LIMIT);
    console.log(`Limited to ${LIMIT} listings`);
  }

  let generated = 0;
  let photosGenerated = 0;
  let noImages = 0;

  listings.forEach((listing, i) => {
    // Generate listing page
    const filename = `listing-${listing.slug}.html`;
    const filepath = path.join(OUTPUT_DIR, filename);
    const html = generatePage(listing, allListings, garbageSet);
    if (getListingImages(listing, garbageSet).length === 0) noImages++;
    fs.writeFileSync(filepath, html);
    generated++;

    // Generate photos page
    const photosHtml = generatePhotosPage(listing);
    if (photosHtml) {
      const photosFilename = `photos-${listing.slug}.html`;
      const photosFilepath = path.join(OUTPUT_DIR, photosFilename);
      fs.writeFileSync(photosFilepath, photosHtml);
      photosGenerated++;
    }

    if ((i + 1) % 50 === 0 || i === listings.length - 1) {
      console.log(`  [${i + 1}/${listings.length}] Generated listing + photos pages`);
    }
  });

  console.log(`\n=== Summary ===`);
  console.log(`Listing pages: ${generated}`);
  console.log(`Photos pages:  ${photosGenerated}`);
  console.log(`No images (placeholder): ${noImages}`);
}

main();
