/**
 * card-helpers.js — Shared card rendering helpers
 * Source of truth: HOME page "Featured Shops" .sp-card format.
 * Used by: index.html, city-page.js, listings.html, search.html, deals.html
 */

/* ─── SHARED DATA CONSTANTS ─────────────────────────────────────────────── */
var SP_VERIFIED = new Set([
  'chairman-nuru-massage-bangkok', 'g2g-massage-bangkok', 'jspot-bangkok',
  'amor888', 'the333-bangkok', '666-class', 'suwon-man-s-spa-bangkok',
  'drake-luxury-lounge-bangkok', 'exotic-massage-bangkok-bangkok', 'body-bliss'
]);

var SP_DEALS = {
  'chairman-nuru-massage-bangkok': 'FREE JACUZZI',
  'g2g-massage-bangkok': 'FREE JACUZZI',
  'jspot-bangkok': 'FREE JACUZZI',
  'amor888': 'FREE JACUZZI',
  'the333-bangkok': 'FREE JACUZZI',
  '666-class': 'FREE JACUZZI',
  'suwon-man-s-spa-bangkok': 'SAVE \u0E3F500',
  'exotic-massage-bangkok-bangkok': 'SAVE \u0E3F200',
  'body-bliss': 'SAVE \u0E3F200'
};

var SP_NEW = new Set([
  'drake-luxury-lounge-bangkok',
  'lunar-nuru-bangkok',
  'dragon-lady-bkk-bangkok',
  'riviere-77-bangkok'
]);

var SP_CURATED = {
  'suwon-man-s-spa-bangkok':        { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14615/Suwon.jpg', visits: '7K+' },
  'exotic-massage-bangkok-bangkok':  { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/12049/2024-08-16-1.jpg', visits: '9K+' },
  'drake-luxury-lounge-bangkok':     { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/15250/WhatsApp_Image_2026-02-23_at_16.12.33.webp', visits: '100+' },
  'chairman-nuru-massage-bangkok':   { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14214/chairman-nuru.jpeg', visits: '1K+' },
  'body-bliss':                      { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/1879/ammy.jpg', visits: '1K+' },
  'g2g-massage-bangkok':             { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14216/g2g-massage.jpeg', visits: '9K+' },
  'jspot-bangkok':                   { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14639/S__6889528.jpg', visits: '5K+' },
  'the333-bangkok':                  { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14217/the333.jpeg', visits: '2K+' },
  'amor888':                         { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14212/amor888.jpeg', visits: '2K+' },
  '666-class':                       { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14215/666-class.jpeg', visits: '3K+' }
};

/* ─── HELPER FUNCTIONS ──────────────────────────────────────────────────── */
function starsHTML(r) {
  if (!r) return '\u2606\u2606\u2606\u2606\u2606';
  var full = Math.round(r);
  return '\u2605'.repeat(full) + '\u2606'.repeat(Math.max(0, 5 - full));
}

function badgeHTML(tags) {
  var map = {
    featured: '<span class="badge b-sp">\u2605 Featured</span>',
    new:      '<span class="badge b-nw">\uD83C\uDD95 New</span>',
    verified: '<span class="badge b-vr">\u2713 Verified</span>'
  };
  return tags.filter(function(t) { return map[t]; }).map(function(t) { return map[t]; }).join('');
}

function imgSrc(shop) {
  return shop.img || '';
}

function imgErr() {
  return 'onerror="this.style.background=\'linear-gradient(135deg,#2a1a1a,#1a0a0a)\';this.removeAttribute(\'src\')"';
}

function vCheck(tags) {
  if (!tags || (Array.isArray(tags) ? tags.indexOf('verified') === -1 : !SP_VERIFIED.has(tags))) return '';
  return '<span class="v-check"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></span>';
}

function bestImage(l, garbageSet) {
  var validPhotos = (l.photos || []).filter(function(p) { return p.id !== null && p.url; });
  if (validPhotos.length > 0) {
    var order = { featured: 0, shop: 1, talent: 2 };
    validPhotos.sort(function(a, b) {
      return ((order[a.category] != null ? order[a.category] : 1) - (order[b.category] != null ? order[b.category] : 1)) || ((a.sort_order || 0) - (b.sort_order || 0));
    });
    return validPhotos[0].url;
  }
  var fallback = (l.image_urls || []).filter(function(u) { return u && !garbageSet.has(u); });
  return fallback[0] || '';
}

/* ─── STANDARD CARD RENDERER ────────────────────────────────────────────── */
/**
 * Renders a standard .sp-card.
 * @param {Object} s — normalized shop: { name, page, img, tags[], catLabel, city, rating, visits, deal }
 */
function spCardHTML(s) {
  return '<a href="' + s.page + '" class="sp-card">' +
    '<img class="sp-img" src="' + imgSrc(s) + '" alt="' + s.name + '" ' + imgErr() + '>' +
    '<div class="sp-badges">' + badgeHTML(s.tags) + '</div>' +
    '<div class="sp-body">' +
      '<div class="sp-name">' + s.name + vCheck(s.tags) + '</div>' +
      '<div class="sp-meta">' + s.catLabel + ' \u00B7 \uD83D\uDCCD ' + s.city + '</div>' +
      '<div class="sp-foot">' +
        '<div class="rating"><span class="stars">' + starsHTML(s.rating) + '</span> ' + (s.rating || 'N/A') + '</div>' +
        '<span class="visits">' + s.visits + '</span>' +
      '</div>' +
      (s.pageViews ? '<div class="sp-views">\uD83D\uDC41 Viewed ' + s.pageViews + ' times</div>' : '') +
      (s.deal ? '<div class="sp-deal">\uD83C\uDFF7\uFE0F ' + s.deal + '</div>' : '') +
    '</div></a>';
}

/* ─── NORMALIZER FOR listings.json DATA ─────────────────────────────────── */
/**
 * Converts a raw listings.json object to the spCardHTML shape.
 * @param {Object} l — raw listing from JSON
 * @param {Set} garbageSet — set of garbage image URLs to skip
 * @param {Object} opts — optional: { basePath: '', flatUrls: false }
 */
function normalizeShop(l, garbageSet, opts) {
  opts = opts || {};
  var slug = l.slug || '';
  var cur = SP_CURATED[slug];
  var tags = [];
  if (SP_VERIFIED.has(slug)) tags.push('verified');
  if (cur || l.featured) tags.push('featured');
  if (SP_NEW.has(slug)) tags.push('new');
  if (SP_DEALS[slug]) tags.push('deal');
  var basePath = opts.basePath || '';
  return {
    id: slug,
    name: l.name || slug,
    page: opts.flatUrls
      ? basePath + 'listing-' + slug + '.html'
      : '/' + (l.country || 'Thailand').toLowerCase() + '/' + (l.city ? l.city.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') : 'other') + '/' + slug + '/',
    img: (cur && cur.img) || bestImage(l, garbageSet),
    tags: tags,
    catLabel: (l.categories || []).join(' \u00B7 '),
    city: l.city || '',
    area: (l.address || '').split(',')[0] || '',
    rating: l.rating || 0,
    visits: (l.review_count || 0) + ' reviews',
    pageViews: (cur && cur.visits) || null,
    deal: SP_DEALS[slug] || null,
    categories: l.categories || [],
    country: l.country || '',
    reviews: l.review_count || 0,
    featured: !!(cur || l.featured),
    sponsor: l.sponsor || false,
    slug: slug,
    address: l.address || '',
    created: l.created_at || l.updated_at || ''
  };
}

/**
 * Builds a garbage image set from raw listings data.
 * Images used by 20+ listings are considered garbage/placeholder.
 */
function buildGarbageSet(data) {
  var urlCounts = {};
  data.forEach(function(l) {
    var seen = {};
    (l.image_urls || []).forEach(function(u) {
      if (u && !seen[u]) { seen[u] = 1; urlCounts[u] = (urlCounts[u] || 0) + 1; }
    });
  });
  return new Set(Object.keys(urlCounts).filter(function(u) { return urlCounts[u] >= 20; }));
}
