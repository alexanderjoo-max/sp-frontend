PROJECT: Swanpass Frontend

This repository contains the static frontend for Swanpass, a directory of massage and spa listings in Southeast Asia.

TOP PRIORITY

Preserve the full working site and the full dataset.

The site currently contains:

737 listings

This number must NEVER change unless explicitly instructed by the user.

If any operation would reduce or increase listing count, STOP and report the issue before continuing.

------------------------------------------------

IMPORTANT RULES FOR ALL FUTURE CHANGES

1. Do NOT redesign the UI or UX unless explicitly requested.
2. Do NOT change layout, spacing, typography, card designs, or page structure unless instructed.
3. Do NOT refactor CSS or reorganize styling unless specifically asked.
4. Do NOT change visual components, filters, badges, or listing card layouts.
5. Do NOT rename existing CSS classes unless required for functionality.
6. Preserve the current visual appearance of the site.
7. Do NOT modify UI/UX anywhere on the site unless the user explicitly asks for it.

The design and layout of the website are considered FINAL.

All changes must focus only on functionality, routing, data integrity, or fixing broken links.

------------------------------------------------

CURRENT DEVELOPMENT FOCUS

Current development work will focus on:

City pages  
Country pages  

Do NOT modify homepage layout or listing page UI unless explicitly instructed.

------------------------------------------------

SITE ARCHITECTURE

The site uses a static HTML architecture with shared CSS, JS, and partial templates.

Primary folders:

/css  
/js  
/images  
/data  
/partials  

Pages are static HTML pages generated or edited from templates.

------------------------------------------------

DATA STRUCTURE

Listings are generated from structured data in the /data folder.

Each listing includes fields such as:

name  
city  
country  
rating  
reviews  
images  
services  
contact information  

When modifying listing pages or generating new pages, always use this dataset.

------------------------------------------------

DATASET PROTECTION

Before making structural or data-related changes, Claude must:

1. Count the total number of listings currently represented in the repo
2. Report the count before making changes
3. Make the requested change
4. Count the total again after changes
5. Confirm the count remains exactly 737

If the count changes, STOP and report the mismatch.

------------------------------------------------

IMAGE HANDLING

Images are stored locally in the /images folder when possible.

Rules:

Do not remove image paths unless necessary  
Do not rename image files unless required  
Fix broken paths instead of replacing images  

------------------------------------------------

REVIEW DATA

Reviews must match the original Swanpass source data.

Do NOT truncate or drop reviews.

------------------------------------------------

PERFORMANCE

Do not add heavy frameworks or dependencies.

The site must remain a fast static site suitable for GitHub Pages hosting.

------------------------------------------------

PERMITTED CHANGES

Claude may:

• fix broken links  
• fix broken asset paths  
• update routing logic  
• repair data references  
• improve data accuracy  
• build city pages  
• build country pages  

------------------------------------------------

DISALLOWED CHANGES

Claude must NOT:

• redesign pages  
• change layout or styling  
• add frameworks  
• restructure CSS  
• modify UI components  
• delete listings  
• change the dataset structure  
• rebuild the site from scratch  

------------------------------------------------

SAFE WORKING METHOD

For any non-trivial task:

1. Audit the repo first
2. Identify exactly which files will change
3. Explain the plan
4. Make the smallest change possible
5. Avoid touching unrelated files
6. Verify listing count remains 737

------------------------------------------------

OUTPUT EXPECTATION

Before making large structural changes, Claude should print a plan explaining:

1. Files affected
2. Scripts affected
3. Routing changes
4. Data changes

Then proceed carefully without altering the UI.

------------------------------------------------

CORE PRINCIPLE

Preserve the dataset.  
Preserve the UI.  
Make minimal targeted fixes.