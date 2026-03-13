// Shared mobile bottom nav — included on all pages
(function() {
  var page = location.pathname.split('/').pop() || 'index.html';

  // Detect base path from this script's src attribute
  var basePath = '';
  var scripts = document.getElementsByTagName('script');
  for (var s = 0; s < scripts.length; s++) {
    var src = scripts[s].getAttribute('src') || '';
    if (src.indexOf('bottom-nav.js') !== -1) {
      basePath = src.replace('js/bottom-nav.js', '');
      break;
    }
  }

  var items = [
    { href: 'map.html', icon: '🗺️', label: 'Map', match: ['map.html'] },
    { href: 'deals.html', icon: '🏷️', label: 'Deals', match: ['deals.html'] },
    { href: 'best-places.html', icon: '🏆', label: 'Best', match: ['best-places.html'] },
    { href: 'search.html', icon: '🔍', label: 'Search', match: ['search.html', 'listings.html'] },
    { href: 'cities.html', icon: '📍', label: 'Cities', match: ['cities.html'] },
  ];

  // Build nav HTML
  var html = '<div class="bn-spacer"></div><nav class="bottom-nav">';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var active = it.match.indexOf(page) !== -1;
    // Also match listing-* and city-* pages to Browse
    if (!active && it.href === 'listings.html' && (page.indexOf('listing-') === 0 || page.indexOf('city-') === 0)) active = true;
    html += '<a href="' + basePath + it.href + '" class="bnav-item' + (active ? ' active' : '') + '">';
    html += '<span class="bi">' + it.icon + '</span>';
    html += '<span class="bl">' + it.label + '</span>';
    html += '</a>';
  }
  html += '</nav>';

  // Insert before </body>
  document.body.insertAdjacentHTML('beforeend', html);
})();
