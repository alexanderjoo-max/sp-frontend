/* nearby-shops.js — re-renders hardcoded .nearby-card blocks as harmonized .sp-card cards
   Requires: card-helpers.js loaded first */
(function () {
  var grid = document.querySelector('.nearby-grid');
  if (!grid) return;

  // Extract slugs from existing hardcoded links
  var links = grid.querySelectorAll('.nearby-card');
  var slugs = [];
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href') || '';
    var m = href.match(/listing-(.+)\.html/);
    if (m) slugs.push(m[1]);
  }
  if (!slugs.length) return;

  // Fetch listings.json and re-render
  var xhr = new XMLHttpRequest();
  xhr.open('GET', 'data/listings.json');
  xhr.onload = function () {
    if (xhr.status !== 200) return;
    var listings;
    try { listings = JSON.parse(xhr.responseText); } catch (e) { return; }

    var garbageSet = (typeof buildGarbageSet === 'function') ? buildGarbageSet(listings) : new Set();
    var slugMap = {};
    for (var j = 0; j < listings.length; j++) {
      slugMap[listings[j].slug] = listings[j];
    }

    var html = '';
    for (var k = 0; k < slugs.length; k++) {
      var l = slugMap[slugs[k]];
      if (!l) continue;
      html += spCardHTML(normalizeShop(l, garbageSet, { flatUrls: true }));
    }

    if (html) {
      // Replace grid class and content
      grid.className = 'sp-grid';
      grid.innerHTML = html;
    }
  };
  xhr.send();
})();
