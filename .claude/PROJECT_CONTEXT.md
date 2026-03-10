PROJECT: Swanpass Frontend

This repository contains the static frontend for Swanpass, a directory of massage and spa listings in Southeast Asia.

TOP PRIORITY

Preserve the full working site and the full dataset.
Do not reduce listing count.
Do not replace the dataset with an older or partial version.
Do not perform destructive refactors.

IMPORTANT RULES FOR ALL FUTURE CHANGES

1. Do NOT redesign the UI or UX unless explicitly requested.
2. Do NOT change layout, spacing, typography, card designs, or page structure unless instructed.
3. Do NOT refactor CSS or reorganize styling unless specifically asked.
4. Do NOT change visual components, filters, badges, or listing card layouts.
5. Do NOT rename existing CSS classes unless required for functionality.
6. Preserve the current visual appearance of the site.
7. Do NOT rebuild the entire site from scratch unless explicitly instructed.
8. Do NOT switch to a different data source unless explicitly instructed.
9. Do NOT delete listing pages, city pages, country pages, or data files unless explicitly instructed.
10. Do NOT replace full data with sample data, partial data, fallback data, old data, or Thailand-only data.
11. Do NOT change routing or repo structure in a major way unless explicitly instructed.
12. If a task risks reducing listings, breaking links, or changing many pages at once, stop and report first.

The project is already visually finalized. Changes should focus only on functionality, data integrity, and fixing broken references.

SITE ARCHITECTURE

The site uses a static HTML architecture with shared CSS, JS, images, data, and partial templates.

Primary folders:

/css
/js
/images
/data
/partials

Pages are static HTML pages generated or edited from templates.

DATASET PROTECTION

The working dataset contains:

- 737 total listings
- 6 countries

This dataset must be preserved.

Before making structural or data-related changes, Claude must:

1. Count the total number of listings currently represented in the repo
2. Report the count before making changes
3. Make the requested change
4. Count the total again after changes
5. Confirm the count matches

If the before/after count does not match, stop and report the mismatch instead of continuing.

DATA STRUCTURE

Listings are generated from structured data in the /data folder.

Each listing may include:

name
city
country
rating
reviews
images
services
contact information

When modifying listing pages, search behavior, or data references, always preserve the existing full dataset.

IMAGE HANDLING

Images are stored locally in the /images folder when possible.

Rules:
- Do not remove image paths unless necessary to fix a broken reference
- Do not rename image files unless necessary
- If images appear broken, fix paths first before changing anything else

REVIEW DATA

Reviews must match the original Swanpass source data.
Do not truncate, drop, overwrite, or partially regenerate reviews.

PERFORMANCE

Do not add heavy frameworks or dependencies.
The site must remain a fast static site suitable for GitHub Pages hosting.

PERMITTED CHANGES

Claude may:

- fix broken links
- fix broken asset paths
- fix search functionality
- fix data references
- repair scraping errors
- improve data accuracy
- repair templates
- repair shared partials
- repair non-destructive generation logic

Claude may also reorganize file structure only if explicitly instructed and only after reporting risk.

Claude must NOT:

- redesign pages
- change layout
- add frameworks
- restructure CSS
- change UI components
- delete data
- reduce listing count
- regenerate the site from incomplete data
- replace current pages with an older build
- make broad repo-wide structural changes without explicit instruction

SAFE WORKING METHOD

For any non-trivial task, Claude should:

1. Audit the current repo state first
2. Identify exactly which files are affected
3. Explain the planned changes
4. Prefer the smallest possible fix
5. Avoid touching unrelated files
6. Preserve current dataset and page coverage
7. Re-check listing count after changes

OUTPUT EXPECTATION

Before making large or risky changes, Claude should print a plan explaining:

1. Files affected
2. Scripts affected
3. Whether data files will be touched
4. Whether listing counts could be affected
5. How it will verify nothing was lost

Then proceed carefully without altering the UI.

CORE PRINCIPLE

If uncertain, preserve the current behavior, current data, and current UI.

Fix the smallest thing necessary.
Do not perform broad cleanup or refactors unless explicitly requested.