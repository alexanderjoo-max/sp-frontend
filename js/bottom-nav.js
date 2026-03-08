// Shared mobile bottom nav — included on all pages
(function() {
  var page = location.pathname.split('/').pop() || 'index.html';

  var items = [
    { href: 'index.html', icon: '🏠', label: 'Home', match: ['index.html', ''] },
    { href: 'map.html', icon: '🗺️', label: 'Map', match: ['map.html'] },
    { href: 'best-places.html', icon: '🏆', label: 'Best', match: ['best-places.html'] },
    { href: 'listings.html', icon: '▦', label: 'Browse', match: ['listings.html', 'search.html'] },
    { href: 'deals.html', icon: '🏷️', label: 'Deals', match: ['deals.html'] },
  ];

  // Build nav HTML
  var html = '<div class="bn-spacer"></div><nav class="bottom-nav">';
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var active = it.match.indexOf(page) !== -1;
    // Also match listing-* and city-* pages to Browse
    if (!active && it.href === 'listings.html' && (page.indexOf('listing-') === 0 || page.indexOf('city-') === 0)) active = true;
    html += '<a href="' + it.href + '" class="bnav-item' + (active ? ' active' : '') + '">';
    html += '<span class="bi">' + it.icon + '</span>';
    html += '<span class="bl">' + it.label + '</span>';
    html += '</a>';
  }
  html += '</nav>';

  // Insert before </body>
  document.body.insertAdjacentHTML('beforeend', html);
})();
