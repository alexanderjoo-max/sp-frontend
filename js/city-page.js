/**
 * city-page.js — Reusable city page renderer
 * Reads the URL path to determine country/city, fetches listings.json,
 * and renders sections: hero+search+city tools, recently added, featured,
 * top rated, all listings (filtered), SEO intro.
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

  /* ─── VERIFIED / DEALS / NEW DATA ── (from card-helpers.js) ─────── */

  /* ─── CITY HERO IMAGES ─────────────────────────────────────────── */
  var CITY_HERO_IMG = {};

  /* ─── SEO COPY ─────────────────────────────────────────────────── */
  var CITY_SEO = {
    'bangkok': 'Bangkok is Thailand\u2019s vibrant capital and the top destination for massage, spa, and nightlife experiences in Southeast Asia. From traditional Thai massage parlors to luxury soapy venues along Sukhumvit, the city offers an unmatched variety of services across neighborhoods like Thonglor, Ekkamai, Nana, and Silom. Swanpass helps you discover the best-rated, verified venues in Bangkok \u2014 with real reviews, exclusive deals, and up-to-date listings.'
  };

  /* ─── HELPERS ── (starsHTML, imgErr, vCheck, badgeHTML, bestImage from card-helpers.js) */
  function slugifyCity(c) {
    if (!c) return 'other';
    return c.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  /* ─── CARD RENDERER (uses spCardHTML from card-helpers.js) ──────── */
  function buildTags(s) {
    var tags = [];
    if (SP_VERIFIED.has(s.id)) tags.push('verified');
    if (SP_CURATED[s.id] || s.featured) tags.push('featured');
    if (SP_NEW.has(s.id)) tags.push('new');
    if (s.deal) tags.push('deal');
    return tags;
  }

  function gridCard(s) {
    var cur = SP_CURATED[s.id];
    return spCardHTML({
      name: s.name,
      page: s.page,
      img: (cur && cur.img) || s.img,
      tags: buildTags(s),
      catLabel: s.categories.join(' \u00B7 '),
      city: s.city,
      rating: s.rating,
      visits: s.reviews + ' reviews',
      pageViews: SP_VIEWS[s.id] || null,
      deal: s.deal
    });
  }

  /* ─── SECTION BUILDER ───────────────────────────────────────────── */
  function buildSection(title, id, contentHTML, extraStyle) {
    if (!contentHTML) return '';
    return '<div style="margin-bottom:24px;' + (extraStyle || '') + '">' +
      '<h2 style="font-family:\'Antonio\',sans-serif;font-size:24px;font-weight:700;letter-spacing:1px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">' +
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
          deal: SP_DEALS[l.slug] || null,
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
      var verifiedCount = cityShops.filter(function (s) { return SP_VERIFIED.has(s.id); }).length;

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
                  'style="width:100%;max-width:400px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:10px 14px;color:#fff;font-family:\'Inter\',sans-serif;font-size:13px;outline:none;backdrop-filter:blur(4px);transition:border-color .2s;" ' +
                  'onfocus="this.style.borderColor=\'rgba(232,20,42,.6)\'" onblur="this.style.borderColor=\'rgba(255,255,255,.15)\'">' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;padding:10px 14px;">' +
            '<a href="' + basePath + countrySlug + '/' + citySlug + '/deals/" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#1a2a1a,#0d1f0d);border:1px solid rgba(34,197,94,.35);border-radius:10px;padding:14px 16px;text-decoration:none;color:#fff;font-size:14px;font-weight:700;transition:all .2s;letter-spacing:.3px;" onmouseover="this.style.borderColor=\'rgba(34,197,94,.7)\';this.style.background=\'linear-gradient(135deg,#1f3520,#122a12)\'" onmouseout="this.style.borderColor=\'rgba(34,197,94,.35)\';this.style.background=\'linear-gradient(135deg,#1a2a1a,#0d1f0d)\'">' +
              '<span style="font-size:18px;">\uD83C\uDFF7\uFE0F</span>' +
              '<span>Deals</span>' +
            '</a>' +
            '<a href="' + basePath + countrySlug + '/' + citySlug + '/best-places/" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#2a1e00,#1a1200);border:1px solid rgba(212,168,71,.35);border-radius:10px;padding:14px 16px;text-decoration:none;color:#fff;font-size:14px;font-weight:700;transition:all .2s;letter-spacing:.3px;" onmouseover="this.style.borderColor=\'rgba(212,168,71,.7)\';this.style.background=\'linear-gradient(135deg,#352800,#241a00)\'" onmouseout="this.style.borderColor=\'rgba(212,168,71,.35)\';this.style.background=\'linear-gradient(135deg,#2a1e00,#1a1200)\'">' +
              '<span style="font-size:18px;">\uD83C\uDFC6</span>' +
              '<span>Best Places</span>' +
            '</a>' +
          '</div>';
      }

      // Update page title
      document.title = cityName + ', ' + countryName + ' \u2014 Swanpass';

      /* ═══════════════════════════════════════════════════════════════
         BUILD CONTENT SECTIONS
         Order: 1) Recently Added  2) Featured  3) Top Rated  4) All Listings
      ═══════════════════════════════════════════════════════════════ */
      var html = '';

      /* ── SECTION 1: RECENTLY ADDED ──────────────────────────────────── */
      var newListings = cityShops.filter(function (s) { return SP_NEW.has(s.id); });
      var newTitle = '\uD83C\uDD95 Newly Added';
      // Fallback for cities without tagged new shops: show last 6
      if (newListings.length === 0) {
        newListings = cityShops.slice().reverse().slice(0, 6);
        newTitle = '\uD83C\uDD95 Recently Added';
      }
      if (newListings.length > 0) {
        var nHTML = '<div class="sp-grid cp-grid">' +
          newListings.map(gridCard).join('') + '</div>';
        html += buildSection(newTitle, 'cpNewest', nHTML);
      }

      /* ── SECTION 2: FEATURED ──────────────────────────────────────── */
      var featured = cityShops.filter(function (s) { return SP_VERIFIED.has(s.id) || s.featured || s.sponsor; });
      if (featured.length > 0) {
        featured.sort(function (a, b) { return (SP_VERIFIED.has(b.id) ? 1 : 0) - (SP_VERIFIED.has(a.id) ? 1 : 0); });
        var featHTML = '<div class="sp-grid cp-grid">' +
          featured.map(gridCard).join('') + '</div>';
        html += buildSection('\u2B50 Featured in ' + cityName, 'cpFeatured', featHTML);
      }

      /* ── SECTION 3: TOP RATED ─────────────────────────────────────── */
      var topRated = cityShops.filter(function (s) { return s.rating > 0; })
        .sort(function (a, b) { return b.rating - a.rating || b.reviews - a.reviews; })
        .slice(0, 8);
      if (topRated.length > 0) {
        var trHTML = '<div class="sp-grid cp-grid">' +
          topRated.map(gridCard).join('') + '</div>';
        html += buildSection('\uD83C\uDFC6 Top Rated', 'cpTopRated', trHTML);
      }

      /* ── SECTION 4: ALL LISTINGS (with category filter) ───────────── */
      var filterHTML = '<div style="display:flex;gap:6px;overflow-x:auto;padding:0 0 12px;scrollbar-width:none;flex-wrap:nowrap;" id="cpCatFilter">' +
        '<button data-cat="all" style="background:var(--red,#e8142a);border:1px solid var(--red,#e8142a);border-radius:16px;padding:5px 12px;font-size:11px;font-weight:500;color:var(--white,#fff);white-space:nowrap;cursor:pointer;flex-shrink:0;font-family:\'Inter\',sans-serif;" class="cp-fbtn active">All (' + cityShops.length + ')</button>';
      catKeys.forEach(function (c) {
        filterHTML += '<button data-cat="' + c + '" style="background:var(--white10,rgba(255,255,255,.08));border:1px solid var(--border,rgba(255,255,255,.08));border-radius:16px;padding:5px 12px;font-size:11px;font-weight:500;color:var(--white70,rgba(255,255,255,.7));white-space:nowrap;cursor:pointer;flex-shrink:0;font-family:\'Inter\',sans-serif;" class="cp-fbtn">' + c + ' (' + categories[c] + ')</button>';
      });
      filterHTML += '</div>';

      // Sort: verified first, then by rating
      var sortedAll = cityShops.slice().sort(function (a, b) {
        return (SP_VERIFIED.has(b.id) ? 1 : 0) - (SP_VERIFIED.has(a.id) ? 1 : 0) || b.rating - a.rating;
      });

      var allGridHTML = filterHTML +
        '<div id="cpAllGrid" class="sp-grid cp-grid">' +
        sortedAll.map(gridCard).join('') + '</div>';

      html += buildSection('All ' + cityName + ' Listings', 'cpAll', allGridHTML);

      /* ── SEO INTRO ──────────────────────────────────────────────────── */
      var seoText = CITY_SEO[citySlug] || '';
      if (seoText) {
        html += '<div style="margin-bottom:24px;padding:20px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;">' +
          '<h2 style="font-family:\'Antonio\',sans-serif;font-size:20px;margin-bottom:10px;letter-spacing:1px;">About ' + cityName + '</h2>' +
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
