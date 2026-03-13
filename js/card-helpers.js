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
  'suwon-man-s-spa-bangkok':        { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14615/Suwon.jpg' },
  'exotic-massage-bangkok-bangkok':  { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/12049/2024-08-16-1.jpg' },
  'drake-luxury-lounge-bangkok':     { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/15250/WhatsApp_Image_2026-02-23_at_16.12.33.webp' },
  'chairman-nuru-massage-bangkok':   { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14214/chairman-nuru.jpeg' },
  'body-bliss':                      { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/1879/ammy.jpg' },
  'g2g-massage-bangkok':             { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14216/g2g-massage.jpeg' },
  'jspot-bangkok':                   { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14639/S__6889528.jpg' },
  'the333-bangkok':                  { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14217/the333.jpeg' },
  'amor888':                         { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14212/amor888.jpeg' },
  '666-class':                       { img: 'https://sgp1.vultrobjects.com/swanprod/uploads/photo/image/14215/666-class.jpeg' }
};

var SP_VIEWS = {"suwon-man-s-spa-bangkok":"7K+","exotic-massage-bangkok-bangkok":"9K+","drake-luxury-lounge-bangkok":"100+","chairman-nuru-massage-bangkok":"1K+","body-bliss":"1K+","g2g-massage-bangkok":"9K+","jspot-bangkok":"5K+","the333-bangkok":"2K+","amor888":"2K+","666-class":"3K+","luna-wow-massage-chiang-mai":"500+","phoenix-spa-rangsit":"6K+","flora-spa":"1K+","grazip-modelling":"4K+","roze-nuru-massage-bangkok":"100+","cube-massage-bangkok":"7K+","aries":"1K+","rasputin":"8K+","lips-lounge":"7K+","relax-room":"6K+","white-room-spa":"3K+","safe-house":"2K+","nightingale-club":"3K+","aiyume-bangkok-bangkok":"100+","sluts-club":"3K+","relax-kan":"1K+","k-avenue":"1K+","aurora33":"9K+","butterfly":"1K+","la-belle":"3K+","mimi-massage-bangkok":"3K+","meeting-point":"2K+","lord-carnation":"4K+","absolute-paradise-spa":"7K+","taki":"3K+","waterbomb-massage-bangkok":"4K+","big-bear-club":"2K+","aimi-bangkok-bangkok":"6K+","peach-massage-bangkok-20-bangkok":"4K+","coffee-room":"2K+","l-spa":"3K+","yesika":"3K+","tokimeki-thonglor-story":"3K+","ladies-room":"3K+","the-loft-30":"8K+","ako-spa":"2K+","casanova":"4K+","a-beautiful-day-bangkok":"6K+","happy-hour":"3K+","cheongdam-massage":"4K+","wonder-massage":"1K+","hakumi-nuru-massage-bangkok":"3K+","dozo-massage":"7K+","tara-bangkok-soapy-massage":"1K+","td-spa-vip-the-dormitory":"4K+","slutz-gc-boomerang":"4K+","emmanuelle":"1K+","ramaix-spa-club":"2K+","the-moon-lake-spa":"4K+","mokaru-massage-spa":"2K+","waterfall-taki-snacks-karaoke-bangkok":"4K+","orbit-spa":"3K+","tycoon-a-go-go":"2K+","le-ciel-laputa-bkk-f5453c58-d6bc-4626-998a-9c466b698925":"2K+","mikado":"3K+","action-room":"1K+","climax-massage":"1K+","lala-bangkok":"100+","nuanchan-spa":"4K+","adore-spa":"2K+","classy-massage-bangkok":"100+","astro-bar":"3K+","deluxe-massage-bangkok":"2K+","lola-love-massage-chiang-mai":"700+","utamaro-22-bangkok":"100+","aurora-club":"1K+","home-alone-outcall-massage-chiang-mai-chiang-mai":"700+","u-club":"4K+","dna-massage-bangkok":"100+","ola-ola":"1K+","sento-bangkok-bangkok":"1K+","marina-massage":"4K+","erotic-massage-bangkok-bangkok":"100+","honey-lemon-spa":"6K+","heaven":"1K+","picasso":"1K+","pink-x-station":"2K+","dream-massage":"8K+","lover-spa":"4K+","dolce-spa":"3K+","black-caviar":"2K+","the-bank":"1K+","aya-massage-bangkok":"1K+","pink-spa":"4K+","polly-spa":"1K+","baya-massage":"4K+","osaka":"3K+","ellie-house":"3K+","girlfriends":"1K+","booze-club":"5K+","visa-club-phitsanulok":"4K+","madame-claude":"1K+","glamor-nuru-massage":"5K+","elite-restaurant":"3K+","awesome999-bangkok":"1K+","clubhouse-exclusive":"4K+","olivia-spa-9f89d02b-383e-4f92-ac81-e0dcd10fed2a":"3K+","venus":"9K+","lunar-nuru-bangkok":"100+","la-defense":"1K+","miyabi-old-mermaid":"3K+","olivia-spa":"2K+","aa-massage-chiang-mai":"3K+","honey-bee":"1K+","cherry-massage":"7K+","darin-club":"4K+","lusty-lady-bar":"3K+","heaven-above":"3K+","all-about-touch":"7K+","bangkok-stocking-massage":"2K+","venus-nuru-massage-bangkok":"3K+","cbody-spa-club-bangkok":"2K+","entertain-karaoke":"2K+","lolita-s":"2K+","leelawadee-massage-p-mook":"7K+","lomo-nuru-massage-bangkok":"100+","senz-diva-massage":"3K+","102-massage":"1K+","daisuki-massage-by-lolita":"4K+","club-fate":"4K+","sweets-lounge":"2K+","tata-massage":"2K+","geisha":"6K+","red-dragon":"2K+","black-lotus-massage-bangkok":"100+","seven-house-of-angels":"9K+","aloha-massage-chiang-mai":"9K+","boss-26-massage":"6K+","paco-club-19":"5K+","dubai-luxury-club":"1K+","pannarai":"8K+","hwang-jae-relax-bangkok":"100+","sherbet":"1K+","tubtim-vip":"8K+","erotic-tantra-massage":"4K+","nuru-massage-nanai-road":"6K+","orange-bar-bangkok":"4K+","icha-icha":"7K+","doki-doki":"1K+","aiyume-bangkok-bangkok-2007063c-d834-4099-ac3d-c0b224134161":"100+","sansuk-sanctuary-massage-patong":"4K+","secret-room":"3K+","angel-33-bangkok":"3K+","penthouse-spa":"8K+","hunny-bunny":"9K+","don-quixote":"7K+","thonglor-one-massage":"1K+","rakuen":"1K+","taragon":"5K+","czech-club":"1K+","where-angels-play-soi-6":"3K+","nuru-massage-soi-sansabai":"3K+","bangkok-passion":"2K+","pink-panther":"2K+","helicopter-bar":"2K+","green-mango":"4K+","z-through-spa":"4K+","the-queen-club":"4K+","maggie-mays":"2K+","xxx-lounge-patpong":"3K+","bada-bing":"4K+","paradise":"1K+","seasaw-spa":"6K+","kawaii-nuru-massage":"9K+","play-girlz-pattaya":"3K+","kiss-massage":"3K+","buzzin-bar":"3K+","fruity-spa":"5K+","asoke-first-class":"5K+","riviere-77-bangkok":"100+","qian-qian-massage-spa":"4K+","the-lovers":"4K+","escape-a-go-go":"2K+","mitu":"2K+","kawaii-bar":"3K+","dolphin-spa":"5K+","godang-8":"3K+","kiss2":"7K+","thanks-massage":"2K+","aiei-spa":"4K+","harem":"5K+","a7-dj-bar":"3K+","dollhouse":"3K+","kokoro":"8K+","miss-spa":"3K+","daisy-dream":"9K+","suzy-wongs":"5K+","honey2-body-massage":"1K+","the-vip-massage-phuket":"2K+","suzy-wong-s-2-devil-s-playground":"3K+","eric-s-bar":"2K+","the-lord":"9K+","colonze-massage-entertainment":"1K+","suzy-wong-s-3":"4K+","badabing":"1K+","relax-ratchaburi":"4K+","windmill-club":"3K+","hong-massage-chiang-mai":"1K+","mind-mint-spa":"4K+","utopia":"1K+","roxy-bar-soi-6":"3K+","wood-bar":"6K+","grand-honey3-pattaya":"3K+","pimp-exclusive-club":"3K+","the-colonze":"6K+","april-spa":"3K+","mclub":"5K+","u-bar-korat":"3K+","bangkok-bunny":"4K+","7-heaven":"2K+","nicha-home-spa-lanna":"2K+","rca-entertainment-e230b23c-03f2-4327-8567-f176e307b169":"3K+","pp-body-massage":"4K+","happy-times-bar":"2K+","pegasus-spa-rama-3":"3K+","angelwitch":"3K+","cancam":"1K+","obsessions-ladyboy-bar":"7K+","xs-gogo-pattaya":"4K+","bee-nice-spa":"3K+","red-spa":"3K+","smile-bangkok":"100+","101-premier-massage":"2K+","toy-box":"3K+","red-angel":"3K+","biwa-cafe-massage":"1K+","fortune-club":"5K+","addict-massage":"3K+","office-massage-club":"8K+","rawhide":"3K+","dream-heaven-26":"8K+","moulin-rouge":"4K+","ez-massage":"4K+","dream-heaven-33":"5K+","the-resort":"1K+","club-cozmo":"4K+","soi-cowboy":"2K+","the-underground":"2K+","momoya-massage":"2K+","momo":"1K+","henry-s-africa-bar":"2K+","the-best-babylon":"3K+","princess-spa":"5K+","tulip":"2K+","the-great-rama-9":"2K+","hua-hin-walking-street":"4K+","thai-candy-2":"6K+","palace-a-gogo":"3K+","3-angels-bar-soi-6":"3K+","paradise-massage-26":"1K+","tilac":"4K+","maria-massage-bangkok":"4K+","angel-massage":"2K+","mai-chan":"9K+","akane":"5K+","palace":"3K+","phoenix-club":"6K+","inferno-bar":"2K+","poseidon-entertainment-complex":"3K+","the-castle-bdsm-fetish-club":"9K+","leciel":"3K+","happy-bkk":"6K+","1society":"8K+","dr-bj-s-nuru":"9K+","king-s-castle-1":"3K+","spanky-s":"3K+","butterflies":"3K+","ginza-entertainment":"5K+","paza":"2K+","moulin-rouge-58db4f65-9f6e-4395-92f0-1ef67fb6d9ef":"4K+","funky-spa":"2K+","wow-leelawadee":"1K+","farenheit":"9K+","ruan-chotika":"3K+","aurora-bangkok":"8K+","sweet-at-heart":"3K+","kasalong-bj-bar":"2K+","pink-soda":"3K+","nutty-park":"3K+","bamboo-massage-bangkok":"2K+","orient-massage":"5K+","kinnaree-spa-rangsit":"4K+","auroramassage":"3K+","annies":"8K+","melody-spa":"3K+","snow-white-massage":"6K+","bb-entertainment-massage":"6K+","analisa":"5K+","sakura-akasuri":"3K+","harem-massage-spa":"3K+","sapphire-club":"4K+","zab-spa":"7K+","aqua-entertainment":"7K+","my-bar":"3K+","mossa-hue":"2K+","little-duck-massage":"5K+","pudding-spa":"6K+","day-and-night-bar-complex":"2K+","baccara":"3K+","sayuri-complex":"2K+","x-ray-exclusive-spa":"6K+","melody-spa-284d9442-4508-4300-bfaf-56056c9585dd":"1K+","sabai-dee-body-massage":"2K+","pretty":"6K+","bkk48":"3K+","christin-massage":"2K+","mango-massage":"5K+","horny-bar":"2K+","honey-1-body-massage-pattaya":"1K+","crazy-house":"4K+","billboard":"1K+","suzie-wong":"3K+","purple-gentlemen-club-2":"5K+","the-bachelor-metropole-hotel":"5K+","zood-spa-zapa":"3K+","kitty-spa-rca":"5K+","summer-spa":"2K+","pin-up-a-go-go":"3K+","unreal-bar":"4K+","orchid":"3K+","khunnoo-spa":"3K+","rong-nam-cha":"3K+","pink-baby-a-go-go":"3K+","full-moon":"9K+","paa-pretty-premium":"4K+","oscar":"3K+","foxy-lady-go-go":"4K+","galaxy":"3K+","shark":"2K+","honey":"3K+","dream-girls":"5K+","lollipop":"3K+","alaina":"7K+","lovelove":"3K+","mandarin-a-go-go":"2K+","meeting-club":"4K+","pancake-spa":"4K+","new-flowers-on-air":"5K+","atami-exclusive-club":"4K+","cheree-spa":"5K+","finspa":"3K+","goddess-a-go-go":"3K+","belle":"2K+","gig-spa-50":"3K+","mermaid":"2K+","fin-club-vx":"4K+","lamer-restaurant-karaoke":"1K+","bkk-vice":"1K+","tiara":"3K+","walking-street":"3K+","cozy-massage":"3K+","milky-way":"3K+","wow-bangkok-massage":"4K+","klerm-relax-massage":"2K+","ten-percent-bangkok":"1K+","nob-exclusive":"3K+","koi-fish-spa":"3K+","magic":"3K+","villa-massage":"5K+","barbie-18-bangkok":"2K+","nuat-kao":"5K+","69-nuru-massage-chiang-mai":"3K+","lux-spa":"5K+","celeb-shower-massage":"7K+","whiskey-gogo":"3K+","chicky-spa":"1K+","the-one":"3K+","pegasus-spa":"4K+","2-peace":"3K+","patpong":"2K+","no-19":"2K+","milking-table":"2K+","club-level-41-bangkok":"2K+","lucy-nuru-massage-bangkok":"600+","kram-spa-heaven69":"3K+","heaven-prime-nuru-massage-bangkok":"2K+","caesar-massage":"3K+","vovo":"4K+","le-ciel-laputa-bkk":"3K+","comely":"2K+","diamond-spa":"3K+","alice-in-wonderland":"2K+","lion-spa":"6K+","saowanee-massage":"3K+","bb-ex":"2K+","blue-ocean-spa":"2K+","the-lord-2":"3K+","suan-uthit-road":"3K+","maxim-massage-bangkok":"2K+","juicy-honey":"3K+","baan-nine":"2K+","lovely-spa":"3K+","orange-oil-massage":"1K+","wow":"3K+","mali-massage":"4K+","bunny-s-massage-phuket":"3K+","thermae-ruamchit-hotel":"4K+","lily":"4K+","soi-80":"5K+","katherine-massage":"1K+","lips-sexxy-club":"2K+","dragon-lady-bkk-bangkok":"500+","1-2-some":"2K+","lamai-beer-bars":"2K+","butter-nawamin":"4K+","linda-massage-outcall":"5K+","club-bell-bangkok":"1K+","lola-love-massage-chiang-mai-2f008171-4599-4231-99e5-f28bde66ced0":"100+","yoni-massage-bangkok":"5K+","lady-love":"4K+","caviar-spa":"3K+","arena-spa":"3K+","julia-spa":"3K+","madonna-massage-vip":"1K+","hera-club":"6K+","club-honey":"3K+","allure-house":"2K+","baan-puen":"2K+","vnus-spa":"2K+","the-unique":"3K+","yoshi":"3K+","in-love":"1K+","office-lady":"4K+","diva-spa":"2K+","maximum-massage":"5K+","the-kiss":"5K+","coffee-cute":"3K+","romance8083-bangkok":"2K+","basquiat":"3K+","lavender-spa":"2K+","bar-three-bangkok":"1K+","usb-spa":"5K+","nana-plaza":"3K+","bangla-road":"2K+","proud":"2K+","princess":"6K+","bonita-bangkok":"100+","queen-bangkok":"2K+","hannah-pretty-spa":"2K+","toro-nuru-massage-bangkok":"5K+","s-way":"1K+","meow-love-massage":"3K+","lucky":"3K+","stella-nuru-massage-bangkok":"2K+"};

/* ─── HELPER FUNCTIONS ──────────────────────────────────────────────────── */
function starsHTML(r) {
  if (!r) return '\u2606\u2606\u2606\u2606\u2606';
  var full = Math.floor(r);
  return '\u2605'.repeat(Math.min(full, 5)) + '\u2606'.repeat(Math.max(0, 5 - full));
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
  var pv = s.pageViews || (s.id && SP_VIEWS[s.id]) || null;
  var src = imgSrc(s);
  var imgTag = src
    ? '<img class="sp-img" src="' + src + '" alt="' + s.name + '" ' + imgErr() + '>'
    : '<div class="sp-img" style="background:linear-gradient(135deg,#2a1a1a,#1a0a0a);"></div>';
  return '<a href="' + s.page + '" class="sp-card">' +
    imgTag +
    '<div class="sp-badges">' + badgeHTML(s.tags) + '</div>' +
    '<div class="sp-body">' +
      '<div class="sp-name">' + s.name + vCheck(s.tags) + '</div>' +
      '<div class="sp-meta">' + s.catLabel + ' \u00B7 \uD83D\uDCCD ' + s.city + '</div>' +
      '<div class="sp-foot">' +
        '<div class="rating"><span class="stars">' + starsHTML(s.rating) + '</span> ' + (s.rating || 'N/A') + '</div>' +
        '<span class="visits">' + s.visits + '</span>' +
      '</div>' +
      (pv ? '<div class="sp-views">\uD83D\uDC41 Viewed ' + pv + ' times</div>' : '') +
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
    pageViews: SP_VIEWS[slug] || null,
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
