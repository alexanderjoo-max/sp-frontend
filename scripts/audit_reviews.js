#!/usr/bin/env node
const reviews = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'reviews.json'), 'utf8'));
const listings = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'listings.json'), 'utf8'));

const slugs = Object.keys(reviews);
const totalReviews = Object.values(reviews).reduce((s, a) => s + a.length, 0);

let mismatches = 0, missing = 0;
const withReviews = listings.filter(l => (l.review_count || 0) > 0);
const noReviewsInJson = [];
const mismatchList = [];

withReviews.forEach(l => {
  const fetched = (reviews[l.slug] || []).length;
  const expected = l.review_count || 0;
  if (reviews[l.slug] === undefined) {
    noReviewsInJson.push(l.slug + ' (' + expected + ')');
    missing++;
  } else if (fetched !== expected) {
    mismatchList.push(l.slug + ': ' + fetched + '/' + expected);
    mismatches++;
  }
});

console.log('=== Reviews Audit ===');
console.log('Slugs in reviews.json:', slugs.length);
console.log('Total reviews:', totalReviews);
console.log('Listings with review_count > 0:', withReviews.length);
console.log('Missing from reviews.json:', missing);
console.log('Count mismatches:', mismatches);

if (noReviewsInJson.length > 0) {
  console.log('\n--- Missing listings (have reviews but not in reviews.json) ---');
  noReviewsInJson.forEach(s => console.log('  ' + s));
}
if (mismatchList.length > 0) {
  console.log('\n--- Mismatches (fetched/expected counts differ) ---');
  mismatchList.forEach(s => console.log('  ' + s));
}

// Check for zero-review entries in reviews.json
const zeroReviewEntries = slugs.filter(s => reviews[s].length === 0);
if (zeroReviewEntries.length > 0) {
  console.log('\n--- Empty entries in reviews.json (0 reviews) ---');
  console.log('Count:', zeroReviewEntries.length);
}

// Check for featured shops
const featured = ['chairman-nuru-massage-bangkok', 'g2g-massage-bangkok', 'jspot-bangkok', 'amor888', 'the333-bangkok', '666-class', 'suwon-man-s-spa-bangkok', 'drake-luxury-lounge-bangkok', 'exotic-massage-bangkok-bangkok', 'body-bliss'];
console.log('\n--- Featured shop reviews ---');
featured.forEach(slug => {
  const listing = listings.find(l => l.slug === slug);
  const count = (reviews[slug] || []).length;
  const expected = listing ? listing.review_count || 0 : '?';
  console.log('  ' + slug + ': ' + count + '/' + expected + (count === expected ? ' OK' : ' MISMATCH'));
});
