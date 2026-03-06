#!/usr/bin/env node
/**
 * generate_pages.js — Generate static listing HTML pages from listings.json
 * Usage: node scripts/generate_pages.js [--limit N]
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'listings.json');
const REVIEWS_FILE = path.join(__dirname, '..', 'data', 'reviews.json');
const OUTPUT_DIR = path.join(__dirname, '..');
const PARTIALS_DIR = path.join(__dirname, '..', 'partials');

const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;

// The 10 currently verified shops (one-time list, not auto-coupled to featured)
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

/**
 * Build a set of "garbage" image URLs that appear across many listings.
 * These are sidebar/sponsored thumbnails that got scraped into every listing's
 * image_urls — they don't belong to the listing itself.
 * Includes both CDN and wp-content URLs.
 */
function buildGarbageImageSet(allListings) {
  const urlCounts = {};
  allListings.forEach(l => {
    const seen = new Set(); // count each URL once per listing
    (l.image_urls || []).forEach(u => {
      if (u && !seen.has(u)) {
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
 * Priority: photos with valid IDs > image_urls (de-garbage'd) > empty
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

  // Fallback: use image_urls, filtering out only known garbage sidebar images
  // wp-content URLs are kept — they serve as valid cover images
  const filtered = (listing.image_urls || []).filter(u => u && !garbageSet.has(u));
  return filtered;
}

function generateGalleryScript(listing, garbageSet) {
  const images = getListingImages(listing, garbageSet);
  if (images.length === 0) return '';
  return `
const strip = document.getElementById('galleryStrip');
const countEl = document.getElementById('galleryCount');
const allPhotos = [...strip.querySelectorAll('.gallery-photo')];
const thumbsEl = document.getElementById('galleryThumbs');
const thumbs = thumbsEl ? [...thumbsEl.querySelectorAll('.gallery-thumb')] : [];
let currentIdx = 0;

function updateThumbs(i) {
  thumbs.forEach((t, idx) => t.classList.toggle('active', idx === i));
  if (thumbs[i]) thumbs[i].scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
}

function scrollToPhoto(i) {
  if (allPhotos.length === 0) return;
  if (i >= allPhotos.length) i = 0;
  if (i < 0) i = allPhotos.length - 1;
  currentIdx = i;
  allPhotos[i].scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' });
  countEl.textContent = (i+1) + ' / ' + allPhotos.length;
  updateThumbs(i);
}

// Thumbnail clicks
if (thumbsEl) {
  thumbsEl.addEventListener('click', function(e) {
    const thumb = e.target.closest('.gallery-thumb');
    if (!thumb) return;
    const idx = parseInt(thumb.dataset.idx, 10);
    scrollToPhoto(idx);
    resetAutoScroll();
  });
}

// Track scroll to update counter + thumbnails
let scrollRaf = 0;
strip.addEventListener('scroll', () => {
  cancelAnimationFrame(scrollRaf);
  scrollRaf = requestAnimationFrame(() => {
    const cx = strip.scrollLeft + strip.offsetWidth / 2;
    let closest = 0, minDist = Infinity;
    allPhotos.forEach((p, i) => {
      const mid = p.offsetLeft + p.offsetWidth / 2;
      const d = Math.abs(mid - cx);
      if (d < minDist) { minDist = d; closest = i; }
    });
    if (closest !== currentIdx) {
      currentIdx = closest;
      countEl.textContent = (closest+1) + ' / ' + allPhotos.length;
      updateThumbs(closest);
    }
  });
});

// Tap to advance
strip.addEventListener('click', () => { scrollToPhoto(currentIdx + 1); resetAutoScroll(); });

// Auto-scroll every 4s
let autoTimer = null;
function startAutoScroll() {
  if (allPhotos.length <= 1) return;
  autoTimer = setInterval(() => scrollToPhoto(currentIdx + 1), 4000);
}
function resetAutoScroll() {
  clearInterval(autoTimer);
  startAutoScroll();
}
startAutoScroll();

// Pause on touch drag
strip.addEventListener('touchstart', () => clearInterval(autoTimer));
strip.addEventListener('touchend', () => { setTimeout(resetAutoScroll, 2000); });
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

// Brand SVG icons — white on solid brand-colored backgrounds (see CSS)
const CONTACT_ICONS = {
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.01 1.17 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.12 7.84a16 16 0 006.04 6.04l1.2-1.2a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>`,
  telegram: `<svg viewBox="0 0 24 24" fill="white"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`,
  line: `<svg viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.07 9.436-6.977C23.176 13.986 24 12.241 24 10.314"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  wechat: `<svg viewBox="0 0 24 24" fill="white"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-3.895-6.348-7.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.11.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.063-6.122zm-3.812 2.764c.533 0 .966.441.966.982a.974.974 0 01-.966.983.974.974 0 01-.966-.983c0-.54.433-.982.966-.982zm5.61 0c.533 0 .966.441.966.982a.974.974 0 01-.966.983.974.974 0 01-.966-.983c0-.54.433-.982.966-.982z"/></svg>`,
  email: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  website: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
};

const ICON_KEY = { tg: 'telegram', wa: 'whatsapp', wc: 'wechat', fb: 'facebook', ig: 'instagram', em: 'email', web: 'website' };
function icon(type) {
  const key = ICON_KEY[type] || type;
  return `<div class="contact-icon ${type}">${CONTACT_ICONS[key] || ''}</div>`;
}

function generateContactsHtml(contacts) {
  const items = [];
  if (contacts.phone) {
    items.push(`<div class="contact-item">${icon('phone')}<a href="tel:${escapeHtml(contacts.phone)}">${escapeHtml(contacts.phone)}</a></div>`);
  }
  if (contacts.telegram) {
    const tgDisplay = contacts.telegram.replace('https://t.me/', '@');
    items.push(`<div class="contact-item">${icon('tg')}<a href="${escapeHtml(contacts.telegram)}" target="_blank" rel="noopener">${escapeHtml(tgDisplay)}</a></div>`);
  }
  if (contacts.line) {
    const lineDisplay = contacts.line.startsWith('http') ? 'LINE' : `LINE: ${contacts.line}`;
    const lineHref = contacts.line.startsWith('http') ? contacts.line : `https://line.me/ti/p/~${contacts.line}`;
    items.push(`<div class="contact-item">${icon('line')}<a href="${escapeHtml(lineHref)}" target="_blank" rel="noopener">${escapeHtml(lineDisplay)}</a></div>`);
  }
  if (contacts.whatsapp) {
    items.push(`<div class="contact-item">${icon('wa')}<a href="${escapeHtml(contacts.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></div>`);
  }
  if (contacts.wechat) {
    items.push(`<div class="contact-item">${icon('wc')}<span style="color:var(--white)">WeChat: ${escapeHtml(contacts.wechat)}</span></div>`);
  }
  if (contacts.instagram) {
    items.push(`<div class="contact-item">${icon('ig')}<a href="${escapeHtml(contacts.instagram)}" target="_blank" rel="noopener">Instagram</a></div>`);
  }
  if (contacts.facebook) {
    items.push(`<div class="contact-item">${icon('fb')}<a href="${escapeHtml(contacts.facebook)}" target="_blank" rel="noopener">Facebook</a></div>`);
  }
  if (contacts.email) {
    items.push(`<div class="contact-item">${icon('em')}<a href="mailto:${escapeHtml(contacts.email)}">${escapeHtml(contacts.email)}</a></div>`);
  }
  if (contacts.website) {
    const display = contacts.website.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    items.push(`<div class="contact-item">${icon('web')}<a href="${escapeHtml(contacts.website)}" target="_blank" rel="noopener">${escapeHtml(display)}</a></div>`);
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

function generateReviewCardsHtml(listing, allReviews) {
  const reviews = (allReviews || {})[listing.slug] || [];
  if (reviews.length === 0) {
    return `<div style="text-align:center;padding:16px 0;color:var(--white40);font-size:13px;">
      <p>No reviews yet.</p>
      <a href="${escapeHtml(listing.source_url)}#reviews" target="_blank" class="btn btn-outline" style="margin-top:8px;">Leave a review on SwanPass &rarr;</a>
    </div>`;
  }
  const sorted = [...reviews]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  let html = '';
  sorted.forEach(r => {
    const name = escapeHtml(r.title || r.display_name || 'Anonymous');
    const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    const stars = starsHtml(r.rating);
    const body = escapeHtml(r.message || '').replace(/\n/g, '<br>');
    html += `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-weight:600;color:var(--white);font-size:14px;">${name}</div>
        <div style="font-size:12px;color:var(--white40);">${date}</div>
      </div>
      <div class="stars" style="color:var(--gold);font-size:14px;margin-bottom:8px;">${stars}</div>
      ${body ? `<div style="color:var(--white70);font-size:13px;line-height:1.5;">${body}</div>` : ''}
    </div>`;
  });
  return html;
}

/**
 * Haversine distance in km between two lat/lng points.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the N nearest listings by geographic distance.
 * Falls back to same-city if current listing has no coordinates.
 */
function findNearbyByDistance(listing, allListings, count) {
  const hasGeo = listing.geo && listing.geo.lat && listing.geo.lng;
  if (!hasGeo) {
    // Fallback: same city, or same category
    if (listing.city) {
      return allListings.filter(l => l.slug !== listing.slug && l.city === listing.city).slice(0, count);
    }
    return allListings.filter(l => l.slug !== listing.slug && l.categories.some(c => listing.categories.includes(c))).slice(0, count);
  }

  const lat1 = listing.geo.lat;
  const lng1 = listing.geo.lng;

  const withDist = allListings
    .filter(l => l.slug !== listing.slug && l.geo && l.geo.lat && l.geo.lng)
    .map(l => ({
      listing: l,
      dist: haversineKm(lat1, lng1, l.geo.lat, l.geo.lng)
    }))
    .sort((a, b) => a.dist - b.dist);

  return withDist.slice(0, count).map(d => d.listing);
}

function generatePage(listing, allListings, garbageSet, allReviews) {
  const images = getListingImages(listing, garbageSet);
  const mainImage = images[0] || '';
  const categoryBadges = listing.categories.map(c => `<span class="badge badge-cat">${escapeHtml(c)}</span>`).join('\n    ')
    + (VERIFIED_SLUGS.has(listing.slug) ? '\n    <span class="badge badge-verified">✓ Verified</span>' : '');
  const rating = listing.rating ? listing.rating.toFixed(1) : 'N/A';
  const reviewCount = listing.review_count || 0;
  const actionButtons = generateCtaButtons(listing.contacts);
  const stickyButtons = actionButtons.slice(0, 3);

  // Find nearby listings using Haversine distance (lat/lng)
  const nearby = findNearbyByDistance(listing, allListings, 4);

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
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(listing.name)} — Swanpass</title>
<meta name="description" content="${escapeHtml((listing.description || '').slice(0, 160))}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/site.css?v=3">
</head>
<body>

${HEADER_HTML}

<!-- GALLERY -->
<div class="gallery">
  <div class="gallery-strip" id="galleryStrip">
    ${images.map((img, i) => `<img class="gallery-photo" src="${img}" alt="${escapeHtml(listing.name)}" ${i > 4 ? 'loading="lazy"' : ''} onerror="this.style.display='none'">`).join('\n    ')}
  </div>
  <div class="gallery-count" id="galleryCount">1 / ${images.length}</div>
</div>
${images.length > 1 ? `<div class="gallery-thumbs" id="galleryThumbs">
  ${images.map((img, i) => `<div class="gallery-thumb${i === 0 ? ' active' : ''}" data-idx="${i}"><img src="${img}" alt="" loading="lazy" onerror="this.parentNode.style.display='none'"></div>`).join('\n  ')}
</div>` : ''}
${(listing.photos && listing.photos.length > 0) ? `<a href="photos-${listing.slug}.html" class="gallery-view-all">📷 View all ${listing.photos.length} photos →</a>` : ''}

<!-- MAIN LAYOUT -->
<div id="mainLayout">

<!-- LISTING INFO -->
<div class="listing-info">
  <div class="listing-badges">
    ${categoryBadges}
  </div>
  <div class="listing-name-row">
    <h1 class="listing-name">${escapeHtml(listing.name)}</h1>
    <button class="btn-save" onclick="this.classList.toggle('saved');this.textContent=this.classList.contains('saved')?'♥':'♡'">♡</button>
  </div>
  <div class="listing-meta">
    <span>📍 ${escapeHtml(listing.address || listing.city || 'Location not specified')}</span>
    <span>·</span>
    <span class="rating-row"><span class="stars">${starsHtml(listing.rating)}</span> <span class="rating-num">${rating}</span> <span class="review-count">(${reviewCount} reviews)</span></span>
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
    ${generateReviewCardsHtml(listing, allReviews)}
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
<link rel="stylesheet" href="css/site.css?v=3">
</head>
<body>

${HEADER_HTML}

<div class="photos-header">
  <a href="listing-${listing.slug}.html" class="photos-back">←</a>
  <div class="photos-title">Photos for ${escapeHtml(listing.name)}</div>
</div>

<div class="photos-tab-bar">
  <button class="photos-tab active" onclick="filterPhotos('all', this)">All<span class="photos-count">${allCount}</span></button>
  ${talentCount > 0 ? `<button class="photos-tab" onclick="filterPhotos('talent', this)">Talent<span class="photos-count">${talentCount}</span></button>` : ''}
  ${shopCount > 0 ? `<button class="photos-tab" onclick="filterPhotos('shop', this)">Shop<span class="photos-count">${shopCount}</span></button>` : ''}
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

  // Load reviews data
  let allReviews = {};
  if (fs.existsSync(REVIEWS_FILE)) {
    allReviews = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf-8'));
    console.log(`Loaded reviews for ${Object.keys(allReviews).length} listings`);
  } else {
    console.log('Warning: data/reviews.json not found, reviews will be empty');
  }

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
    const html = generatePage(listing, allListings, garbageSet, allReviews);
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
