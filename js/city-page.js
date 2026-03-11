/**
 * city-page.js — Reusable city page renderer
 * Reads the URL path to determine country/city, fetches listings.json,
 * and renders 9 sections: hero+search, featured, deals, top rated,
 * new listings, all listings (filtered), best places / map links, SEO intro.
 *
 * Usage: include on any /country/city/index.html page.
 * The page must contain:
 *   <div id="cityHero"></div>
 *   <div id="cityContent"></div>
 * And load this script after those elements.
 *
 * Optional: set window.CITY_PAGE_CONFIG before loading this script:
 *   { country: 'thailand', city: 'bangkok', flatUrls: true }
 * - country/city: override URL-based detection
 * - flatUrls: generate listing-{slug}.html links instead of /country/city/slug/
 */
(function () {
  'use strict';

  /* ─── CONFIG & BASE PATH ────────────────────────────────────────── */
  var config = window.CITY_PAGE_CONFIG || {};

  // Compute basePath from the script's src attribute (handles GitHub Pages subpaths)
  var basePath = '';
  var scriptEls = document.querySelectorAll('script[src*="city-page"]');
  if (scriptEls.length > 0) {
    basePath = scriptEls[0].getAttribute('src').replace(/js\/city-page\.js.*$/, '');
  }

  /* ─── PATH PARSING ──────────────────────────────────────────────── */
  var segs = location.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
  var countrySlug = config.country || segs[0] || '';
  var citySlug = config.city || segs[1] || '';

  /* ─── CITY / COUNTRY NAME MAPS ──────────────────────────────────── */
  var CITY_NAMES = {
    'bangkok': 'Bangkok',
    'pattaya': 'Pattaya',
    'chiang-mai': 'Chiang Mai',
    'phuket': 'Phuket',
    'hua-hin': 'Hua Hin',
    'khon-kaen': 'Khon Kaen',
    'ko-samui': 'Ko Samui',
    'korat': 'Nakhon Ratchasima',
    'nakhon-ratchasima': 'Nakhon Ratchasima',
    'udon-thani': 'Udon Thani',
    'ubon-ratchathani': 'Ubon Ratchathani',
    'phitsanulok': 'Phitsanulok',
    'krabi': 'Krabi',
    'kanchanaburi': 'Kanchanaburi',
    'ratchaburi': 'Ratchaburi',
    'nakhon-sawan': 'Nakhon Sawan',
    'si-racha': 'Sri Racha',
    'sri-racha': 'Sri Racha',
    'rayong': 'Rayong',
    'pathum-thani': 'Pathum Thani',
    'ho-chi-minh-city': 'Ho Chi Minh City',
    'hanoi': 'Hanoi',
    'danang': 'Danang',
    'bali': 'Bali',
    'jakarta': 'Jakarta',
    'surabaya': 'Surabaya',
    'batam': 'Batam',
    'phnom-penh': 'Phnom Penh',
    'singapore': 'Singapore',
    'kuala-lumpur': 'Kuala Lumpur'
  };

  var COUNTRY_NAMES = {
    'thailand': 'Thailand',
    'vietnam': 'Vietnam',
    'indonesia': 'Indonesia',
    'cambodia': 'Cambodia',
    'singapore': 'Singapore',
    'malaysia': 'Malaysia'
  };

  var COUNTRY_FLAGS = {
    'thailand': '\uD83C\uDDF9\uD83C\uDDED',
    'vietnam': '\uD83C\uDDFB\uD83C\uDDF3',
    'indonesia': '\uD83C\uDDEE\uD83C\uDDE9',
    'cambodia': '\uD83C\uDDF0\uD83C\uDDED',
    'singapore': '\uD83C\uDDF8\uD83C\uDDEC',
    'malaysia': '\uD83C\uDDF2\uD83C\uDDFE'
  };

  var cityName = CITY_NAMES[citySlug] || citySlug.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  var countryName = COUNTRY_NAMES[countrySlug] || countrySlug.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  var flag = COUNTRY_FLAGS[countrySlug] || '\uD83D\uDCCD';

  /* ─── VERIFIED / DEALS / NEW DATA ───────────────────────────────── */
  var VER_SET = new Set([
    'chairman-nuru-massage-bangkok', 'g2g-massage-bangkok', 'jspot-bangkok',
    'amor888', 'the333-bangkok', '666-class', 'suwon-man-s-spa-bangkok',
    'drake-luxury-lounge-bangkok', 'exotic-massage-bangkok-bangkok', 'body-bliss'
  ]);

  var DEALS_MAP = {
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

  var NEW_SET = new Set([
    'drake-luxury-lounge-bangkok',
    'lunar-nuru-bangkok',
    'dragon-lady-bkk-bangkok',
    'riviere-77-bangkok'
  ]);

  /* ─── CITY HERO IMAGES ─────────────────────────────────────────── */
  var CITY_HERO_IMG = {};

  /* ─── SEO COPY ─────────────────────────────────────────────────── */
  var CITY_SEO = {
    'bangkok': 'Bangkok is Thailand\u2019s vibrant capital and the top destination for massage, spa, and nightlife experiences in Southeast Asia. From traditional Thai massage parlors to luxury soapy venues along Sukhumvit, the city offers an unmatched variety of services across neighborhoods like Thonglor, Ekkamai, Nana, and Silom. Swanpass helps you discover the best-rated, verified venues in Bangkok \u2014 with real reviews, exclusive deals, and up-to-date listings.'
  };

  /* ─── HELPERS ───────────────────────────────────────────────────── */
  function slugifyCity(c) {
    if (!c) return 'other';
    return c.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  function starsHTML(r) {
    var f = Math.round(r || 0);
    return '\u2605'.repeat(f) + '\u2606'.repeat(Math.max(0, 5 - f));
  }

  function imgErr() {
    return 'onerror="this.style.background=\'linear-gradient(135deg,#2a1a1a,#1a0a0a)\';this.removeAttribute(\'src\')"';
  }

  function vCheck(id) {
    if (!VER_SET.has(id)) return '';
    return '<span class="v-check"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></span>';
  }

  function cardBadges(shop) {
    var h = '';
    if (VER_SET.has(shop.id)) h += '<span class="badge" style="font-size:7px;font-weight:900;padding:2px 7px;border-radius:14px;text-transform:uppercase;letter-spacing:.5px;background:rgba(59,130,246,.92);color:#fff;">\u2713 Verified</span>';
    if (shop.featured) h += '<span class="badge" style="font-size:7px;font-weight:900;padding:2px 7px;border-radius:14px;text-transform:uppercase;letter-spacing:.5px;background:linear-gradient(135deg,#d4a847,#f5d784,#d4a847);color:#1a1000;">\u2605 Featured</span>';
    if (NEW_SET.has(shop.id)) h += '<span class="badge" style="font-size:7px;font-weight:900;padding:2px 7px;border-radius:14px;text-transform:uppercase;letter-spacing:.5px;background:rgba(99,102,241,.92);color:#fff;">\uD83C\uDD95 New</span>';
    return h ? '<div style="position:absolute;top:6px;left:6px;display:flex;flex-direction:column;gap:3px;">' + h + '</div>' : '';
  }

  function bestImage(l, garbageSet) {
    var validPhotos = (l.photos || []).filter(function (p) { return p.id !== null && p.url; });
    if (validPhotos.length > 0) {
      var order = { featured: 0, shop: 1, talent: 2 };
      validPhotos.sort(function (a, b) {
        return ((order[a.category] != null ? order[a.category] : 1) - (order[b.category] != null ? order[b.category] : 1)) || ((a.sort_order || 0) - (b.sort_order || 0));
      });
      return validPhotos[0].url;
    }
    var fallback = (l.image_urls || []).filter(function (u) { return u && !garbageSet.has(u); });
    return fallback[0] || '';
  }

  /* ─── CARD RENDERERS ────────────────────────────────────────────── */

  /** Small grid card (top rated, newest, full grid) */
  function gridCard(s) {
    return '<a href="' + s.page + '" class="shop-card" style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;position:relative;text-decoration:none;color:inherit;display:block;transition:transform .2s,border-color .2s;">' +
      '<img style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:linear-gradient(135deg,#2a1a1a,#1a0f0f);" src="' + s.img + '" alt="' + s.name + '" ' + imgErr() + '>' +
      cardBadges(s) +
      '<div style="padding:8px 10px 10px;">' +
        '<div style="font-size:10px;color:var(--white40,rgba(255,255,255,.4));margin-bottom:2px;">' + s.categories.join(' \u00B7 ') + '</div>' +
        '<div style="font-size:12px;font-weight:700;line-height:1.2;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + s.name + vCheck(s.id) + '</div>' +
        '<div style="font-size:10px;color:var(--white40,rgba(255,255,255,.4));margin-bottom:6px;">\uD83D\uDCCD ' + (s.area || s.city) + '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<div style="display:flex;align-items:center;gap:4px;"><span style="color:var(--gold,#d4a847);font-size:11px;">' + starsHTML(s.rating) + '</span> <span style="font-size:11px;font-weight:600;">' + (s.rating ? s.rating.toFixed(1) : 'N/A') + '</span></div>' +
          '<span style="font-size:10px;color:var(--white40,rgba(255,255,255,.4));">' + s.reviews + ' reviews</span>' +
        '</div>' +
        (s.deal ? '<div style="margin-top:4px;font-size:10px;color:var(--green,#22c55e);font-weight:600;">\uD83C\uDFF7\uFE0F ' + s.deal + '</div>' : '') +
      '</div></a>';
  }

  /** Wide featured card (featured section) */
  function featuredCard(s) {
    return '<a href="' + s.page + '" style="display:flex;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;overflow:hidden;text-decoration:none;color:inherit;transition:border-color .2s;position:relative;" onmouseover="this.style.borderColor=\'rgba(232,20,42,.4)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
      '<img src="' + s.img + '" alt="' + s.name + '" style="width:110px;height:110px;flex-shrink:0;object-fit:cover;background:linear-gradient(135deg,#2a1a1a,#1a0f0f);" ' + imgErr() + '>' +
      '<div style="flex:1;padding:10px 12px;min-width:0;">' +
        '<div style="font-size:13px;font-weight:700;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + s.name + vCheck(s.id) + '</div>' +
        '<div style="font-size:11px;color:var(--white40,rgba(255,255,255,.4));margin-bottom:6px;">' + s.categories.join(' \u00B7 ') + ' \u00B7 \uD83D\uDCCD ' + (s.area || s.city) + '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span style="color:var(--gold,#d4a847);font-size:12px;">' + starsHTML(s.rating) + '</span>' +
          '<span style="font-size:12px;font-weight:600;">' + (s.rating ? s.rating.toFixed(1) : 'N/A') + '</span>' +
          '<span style="font-size:10px;color:var(--white40,rgba(255,255,255,.4));">' + s.reviews + ' reviews</span>' +
        '</div>' +
        (s.deal ? '<div style="margin-top:4px;font-size:10px;color:var(--green,#22c55e);font-weight:600;">\uD83C\uDFF7\uFE0F ' + s.deal + '</div>' : '') +
      '</div></a>';
  }

  /** Horizontal scroll deal card (deals section) */
  function dealCard(s) {
    return '<a href="' + s.page + '" style="flex-shrink:0;width:160px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;overflow:hidden;display:block;color:inherit;text-decoration:none;transition:border-color .2s;position:relative;" onmouseover="this.style.borderColor=\'rgba(232,20,42,.4)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
      '<img src="' + s.img + '" alt="' + s.name + '" style="width:100%;height:100px;object-fit:cover;display:block;background:linear-gradient(135deg,#2a1a1a,#1a0f0f);" ' + imgErr() + '>' +
      '<div style="position:absolute;top:6px;left:6px;">' +
        (VER_SET.has(s.id) ? '<span class="badge" style="font-size:7px;font-weight:900;padding:2px 7px;border-radius:14px;text-transform:uppercase;letter-spacing:.5px;background:rgba(59,130,246,.92);color:#fff;">\u2713 Verified</span>' : '') +
      '</div>' +
      '<div style="padding:8px 10px;">' +
        '<div style="font-size:11px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + s.name + vCheck(s.id) + '</div>' +
        '<div style="font-size:10px;color:var(--white40,rgba(255,255,255,.4));">\uD83D\uDCCD ' + (s.area || s.city) + '</div>' +
      '</div>' +
      '<div style="background:linear-gradient(90deg,var(--red,#e8142a),#ff4d6d);padding:4px 10px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:space-between;">' +
        '<span>\uD83C\uDFF7\uFE0F ' + s.deal + '</span>' +
      '</div>' +
    '</a>';
  }

  /* ─── SECTION BUILDER ───────────────────────────────────────────── */
  function buildSection(title, id, contentHTML, extraStyle) {
    if (!contentHTML) return '';
    return '<div style="margin-bottom:24px;' + (extraStyle || '') + '">' +
      '<h2 style="font-family:\'Bebas Neue\',sans-serif;font-size:24px;font-weight:700;letter-spacing:1px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">' +
        '<span style="width:3px;height:14px;background:var(--red,#e8142a);border-radius:2px;flex-shrink:0;"></span>' + title +
      '</h2>' +
      '<div id="' + id + '">' + contentHTML + '</div>' +
    '</div>';
  }

  /* ─── MAIN: FETCH & RENDER ──────────────────────────────────────── */
  var heroEl = document.getElementById('cityHero');
  var contentEl = document.getElementById('cityContent');

  // Show loading hero
  if (heroEl) {
    var loadImg = CITY_HERO_IMG[citySlug] || '';
    heroEl.innerHTML =
      '<div class="city-hero">' +
        (loadImg
          ? '<img class="city-hero-img" src="' + loadImg + '" onerror="this.style.background=\'linear-gradient(135deg,#1a0305,#4a000f)\';this.removeAttribute(\'src\')" alt="' + cityName + '">'
          : '<div class="city-hero-img" style="background:linear-gradient(135deg,#1a0305,#4a000f);"></div>') +
        '<div class="hero-overlay"></div>' +
        '<div class="hero-content">' +
          '<div style="font-size:26px;margin-bottom:4px;">' + flag + '</div>' +
          '<h1 class="city-big">' + cityName.toUpperCase() + '</h1>' +
          '<p style="font-size:14px;color:rgba(255,255,255,.5);margin-top:4px;">Loading\u2026</p>' +
        '</div>' +
      '</div>';
  }

  fetch(basePath + 'data/listings.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      /* ── Build garbage image set ── */
      var urlCounts = {};
      data.forEach(function (l) {
        var seen = {};
        (l.image_urls || []).forEach(function (u) {
          if (u && !seen[u]) { seen[u] = 1; urlCounts[u] = (urlCounts[u] || 0) + 1; }
        });
      });
      var garbageSet = new Set(Object.keys(urlCounts).filter(function (u) { return urlCounts[u] >= 20; }));

      /* ── Map raw data → shop objects ── */
      var allShops = data.map(function (l) {
        return {
          id: l.slug,
          name: l.name || l.slug,
          categories: l.categories || [],
          city: l.city || '',
          country: l.country || '',
          area: (l.address || '').split(',')[0] || '',
          address: l.address || '',
          rating: l.rating || 0,
          reviews: l.review_count || 0,
          featured: l.featured || false,
          sponsor: l.sponsor || false,
          img: bestImage(l, garbageSet),
          page: config.flatUrls
            ? basePath + 'listing-' + l.slug + '.html'
            : '/' + (l.country || 'Thailand').toLowerCase() + '/' + slugifyCity(l.city || 'other') + '/' + l.slug + '/',
          deal: DEALS_MAP[l.slug] || null,
          slug: l.slug,
          created: l.created_at || l.updated_at || ''
        };
      });

      /* ── Filter for this city ── */
      var cityShops = allShops.filter(function (s) {
        return slugifyCity(s.city) === citySlug ||
               (citySlug === 'korat' && slugifyCity(s.city) === 'nakhon-ratchasima');
      });

      /* ── Compute stats ── */
      var ratedShops = cityShops.filter(function (s) { return s.rating > 0; });
      var avgRating = ratedShops.length > 0
        ? (ratedShops.reduce(function (sum, s) { return sum + s.rating; }, 0) / ratedShops.length).toFixed(1)
        : 'N/A';
      var dealShops = cityShops.filter(function (s) { return s.deal; });
      var dealCount = dealShops.length;
      var verifiedCount = cityShops.filter(function (s) { return VER_SET.has(s.id); }).length;

      /* ── Category counts ── */
      var categories = {};
      cityShops.forEach(function (s) {
        (s.categories || []).forEach(function (c) { categories[c] = (categories[c] || 0) + 1; });
      });
      var catKeys = Object.keys(categories).sort(function (a, b) { return categories[b] - categories[a]; });

      /* ═══════════════════════════════════════════════════════════════
         SECTION 1: HERO + SEARCH + STATS BAR
      ═══════════════════════════════════════════════════════════════ */
      if (heroEl) {
        var heroImg = CITY_HERO_IMG[citySlug] || '';
        heroEl.innerHTML =
          '<div class="city-hero">' +
            (heroImg
              ? '<img class="city-hero-img" src="' + heroImg + '" onerror="this.style.background=\'linear-gradient(135deg,#1a0305,#4a000f)\';this.removeAttribute(\'src\')" alt="' + cityName + '">'
              : '<div class="city-hero-img" style="background:linear-gradient(135deg,#1a0305,#4a000f);"></div>') +
            '<div class="hero-overlay"></div>' +
            '<div class="hero-content">' +
              '<p style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:6px;text-transform:uppercase;letter-spacing:2px;">' +
                '<a href="' + (basePath || '/') + '" style="color:inherit;text-decoration:none;">Home</a> \u203A ' +
                '<a href="' + (basePath || '/') + countrySlug + '/" style="color:inherit;text-decoration:none;">' + countryName + '</a>' +
              '</p>' +
              '<div style="font-size:26px;margin-bottom:4px;">' + flag + '</div>' +
              '<h1 class="city-big">' + cityName.toUpperCase() + '</h1>' +
              '<div class="city-stats-row">' +
                '<div class="city-stat"><strong>' + cityShops.length + '</strong> listings</div>' +
                '<div class="city-stat"><strong>' + catKeys.length + '</strong> categories</div>' +
                (dealCount > 0 ? '<div class="city-stat"><strong>' + dealCount + '</strong> active deals</div>' : '') +
                '<div class="city-stat">\u2B50 Avg ' + avgRating + '</div>' +
              '</div>' +
              '<div style="margin-top:14px;">' +
                '<input type="text" id="cpSearchInput" placeholder="Search ' + cityName + ' listings\u2026" ' +
                  'style="width:100%;max-width:400px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:10px 14px;color:#fff;font-family:\'DM Sans\',sans-serif;font-size:13px;outline:none;backdrop-filter:blur(4px);transition:border-color .2s;" ' +
                  'onfocus="this.style.borderColor=\'rgba(232,20,42,.6)\'" onblur="this.style.borderColor=\'rgba(255,255,255,.15)\'">' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<a href="' + basePath + 'map.html?city=' + encodeURIComponent(cityName) + '" style="display:flex;align-items:center;justify-content:center;gap:8px;background:var(--card-bg,#161616);border:1px solid var(--border);padding:12px 16px;text-decoration:none;color:#fff;font-size:13px;font-weight:500;transition:border-color .2s;" onmouseover="this.style.borderColor=\'rgba(232,20,42,.5)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
            '<span style="font-size:18px;">\uD83D\uDDFA\uFE0F</span>' +
            '<span>Search on the Map \u2014 find venues near you</span>' +
            '<span style="color:var(--red,#e8142a);font-size:16px;">\u203A</span>' +
          '</a>';
      }

      // Update page title
      document.title = cityName + ', ' + countryName + ' \u2014 Swanpass';

      /* ═══════════════════════════════════════════════════════════════
         BUILD CONTENT SECTIONS
      ═══════════════════════════════════════════════════════════════ */
      var html = '';

      /* ── SECTION 2: FEATURED ──────────────────────────────────────── */
      var featured = cityShops.filter(function (s) { return VER_SET.has(s.id) || s.featured || s.sponsor; });
      if (featured.length > 0) {
        featured.sort(function (a, b) { return (VER_SET.has(b.id) ? 1 : 0) - (VER_SET.has(a.id) ? 1 : 0); });
        var featHTML = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;" class="cp-grid">' +
          featured.map(gridCard).join('') + '</div>';
        html += buildSection('\u2B50 Featured in ' + cityName, 'cpFeatured', featHTML);
      }

      /* ── SECTION 3: DEALS ─────────────────────────────────────────── */
      if (dealShops.length > 0) {
        var dealsHTML = '<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;" class="cp-deals-scroll">' +
          dealShops.map(dealCard).join('') + '</div>';
        html += buildSection('\uD83C\uDFF7\uFE0F ' + cityName + ' Deals', 'cpDeals', dealsHTML);
      }

      /* ── SECTION 4: TOP RATED ─────────────────────────────────────── */
      var topRated = cityShops.filter(function (s) { return s.rating > 0; })
        .sort(function (a, b) { return b.rating - a.rating || b.reviews - a.reviews; })
        .slice(0, 8);
      if (topRated.length > 0) {
        var trHTML = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;" class="cp-grid">' +
          topRated.map(gridCard).join('') + '</div>';
        html += buildSection('\uD83C\uDFC6 Top Rated', 'cpTopRated', trHTML);
      }

      /* ── SECTION 5: NEW LISTINGS ──────────────────────────────────── */
      var newListings = cityShops.filter(function (s) { return NEW_SET.has(s.id); });
      var newTitle = '\uD83C\uDD95 Newly Added';
      // Fallback for cities without tagged new shops: show last 6
      if (newListings.length === 0) {
        newListings = cityShops.slice().reverse().slice(0, 6);
        newTitle = '\uD83C\uDD95 Recently Added';
      }
      if (newListings.length > 0) {
        var nHTML = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;" class="cp-grid">' +
          newListings.map(gridCard).join('') + '</div>';
        html += buildSection(newTitle, 'cpNewest', nHTML);
      }

      /* ── SECTION 6: ALL LISTINGS (with category filter) ───────────── */
      var filterHTML = '<div style="display:flex;gap:6px;overflow-x:auto;padding:0 0 12px;scrollbar-width:none;flex-wrap:nowrap;" id="cpCatFilter">' +
        '<button data-cat="all" style="background:var(--red,#e8142a);border:1px solid var(--red,#e8142a);border-radius:16px;padding:5px 12px;font-size:11px;font-weight:500;color:var(--white,#fff);white-space:nowrap;cursor:pointer;flex-shrink:0;font-family:\'DM Sans\',sans-serif;" class="cp-fbtn active">All (' + cityShops.length + ')</button>';
      catKeys.forEach(function (c) {
        filterHTML += '<button data-cat="' + c + '" style="background:var(--white10,rgba(255,255,255,.08));border:1px solid var(--border,rgba(255,255,255,.08));border-radius:16px;padding:5px 12px;font-size:11px;font-weight:500;color:var(--white70,rgba(255,255,255,.7));white-space:nowrap;cursor:pointer;flex-shrink:0;font-family:\'DM Sans\',sans-serif;" class="cp-fbtn">' + c + ' (' + categories[c] + ')</button>';
      });
      filterHTML += '</div>';

      // Sort: verified first, then by rating
      var sortedAll = cityShops.slice().sort(function (a, b) {
        return (VER_SET.has(b.id) ? 1 : 0) - (VER_SET.has(a.id) ? 1 : 0) || b.rating - a.rating;
      });

      var allGridHTML = filterHTML +
        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;" id="cpAllGrid" class="cp-grid">' +
        sortedAll.map(gridCard).join('') + '</div>';

      html += buildSection('All ' + cityName + ' Listings', 'cpAll', allGridHTML);

      /* ── SECTION 7 & 8: BEST PLACES + MAP LINKS ──────────────────── */
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;">' +
        '<a href="' + basePath + 'best-places.html" style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:20px;text-align:center;display:block;color:inherit;text-decoration:none;transition:border-color .2s;" onmouseover="this.style.borderColor=\'rgba(232,20,42,.4)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
          '<div style="font-size:28px;margin-bottom:8px;">\uD83C\uDFC6</div>' +
          '<div style="font-size:14px;font-weight:600;">Best Places</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;">Top-rated venues in ' + cityName + '</div>' +
        '</a>' +
        '<a href="' + basePath + 'map.html?city=' + encodeURIComponent(cityName) + '" style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:20px;text-align:center;display:block;color:inherit;text-decoration:none;transition:border-color .2s;" onmouseover="this.style.borderColor=\'rgba(232,20,42,.4)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
          '<div style="font-size:28px;margin-bottom:8px;">\uD83D\uDDFA\uFE0F</div>' +
          '<div style="font-size:14px;font-weight:600;">Explore Map</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;">Find venues near you</div>' +
        '</a>' +
      '</div>';

      /* ── SECTION 9: SEO INTRO ─────────────────────────────────────── */
      var seoText = CITY_SEO[citySlug] || '';
      if (seoText) {
        html += '<div style="margin-bottom:24px;padding:20px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;">' +
          '<h2 style="font-family:\'Bebas Neue\',sans-serif;font-size:20px;margin-bottom:10px;letter-spacing:1px;">About ' + cityName + '</h2>' +
          '<p style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.7;">' + seoText + '</p>' +
        '</div>';
      }

      /* ── Render all content ── */
      if (contentEl) contentEl.innerHTML = html;

      /* ═══════════════════════════════════════════════════════════════
         INTERACTIVITY
      ═══════════════════════════════════════════════════════════════ */

      /* ── Search (hero input filters All Listings grid) ── */
      var searchInput = document.getElementById('cpSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', function () {
          var q = this.value.toLowerCase().trim();
          var allGrid = document.getElementById('cpAllGrid');
          var allSection = document.getElementById('cpAll');
          if (!allGrid) return;

          // Reset category filter to All when searching
          var fw = document.getElementById('cpCatFilter');
          if (fw && q.length > 0) {
            fw.querySelectorAll('.cp-fbtn').forEach(function (b) {
              b.classList.remove('active');
              b.style.background = 'var(--white10,rgba(255,255,255,.08))';
              b.style.borderColor = 'var(--border,rgba(255,255,255,.08))';
              b.style.color = 'var(--white70,rgba(255,255,255,.7))';
            });
            var allBtn = fw.querySelector('[data-cat="all"]');
            if (allBtn) {
              allBtn.classList.add('active');
              allBtn.style.background = 'var(--red,#e8142a)';
              allBtn.style.borderColor = 'var(--red,#e8142a)';
              allBtn.style.color = 'var(--white,#fff)';
            }
          }

          // Filter by name, area, or category
          var filtered = q.length === 0 ? sortedAll : sortedAll.filter(function (s) {
            return s.name.toLowerCase().indexOf(q) !== -1 ||
              (s.area && s.area.toLowerCase().indexOf(q) !== -1) ||
              s.categories.some(function (c) { return c.toLowerCase().indexOf(q) !== -1; });
          });

          allGrid.innerHTML = filtered.length > 0
            ? filtered.map(gridCard).join('')
            : '<p style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,.4);font-size:13px;">No listings found for \u201C' + this.value + '\u201D</p>';

          // Scroll to all listings when searching
          if (q.length > 0 && allSection) {
            allSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }

      /* ── Category filter ── */
      var filterWrap = document.getElementById('cpCatFilter');
      if (filterWrap) {
        filterWrap.addEventListener('click', function (e) {
          var btn = e.target.closest('.cp-fbtn');
          if (!btn) return;

          // Clear search input
          var si = document.getElementById('cpSearchInput');
          if (si) si.value = '';

          // Update active state
          filterWrap.querySelectorAll('.cp-fbtn').forEach(function (b) {
            b.classList.remove('active');
            b.style.background = 'var(--white10,rgba(255,255,255,.08))';
            b.style.borderColor = 'var(--border,rgba(255,255,255,.08))';
            b.style.color = 'var(--white70,rgba(255,255,255,.7))';
          });
          btn.classList.add('active');
          btn.style.background = 'var(--red,#e8142a)';
          btn.style.borderColor = 'var(--red,#e8142a)';
          btn.style.color = 'var(--white,#fff)';

          var cat = btn.getAttribute('data-cat');
          var filtered = cat === 'all' ? sortedAll : sortedAll.filter(function (s) {
            return s.categories.some(function (c) { return c === cat; });
          });
          document.getElementById('cpAllGrid').innerHTML = filtered.map(gridCard).join('');
        });
      }

      // Log for verification
      console.log('[city-page] ' + cityName + ': ' + cityShops.length + ' listings loaded (total dataset: ' + data.length + ')');
    })
    .catch(function (err) {
      console.error('[city-page] Failed to load listings:', err);
      if (contentEl) contentEl.innerHTML = '<p style="text-align:center;padding:40px;color:var(--white40,rgba(255,255,255,.4));">Failed to load listings. Please try again.</p>';
    });
})();
