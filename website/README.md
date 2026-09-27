# Inverso Labs public feature pages

These files update the existing NOVA-SERVER homepage deployment at `C:/Users/justi/Documents/inversolabs-homepage`. The origin retains its existing legacy module, main.js, favicon.svg, and newsroom directory; this folder is not a standalone server distribution.

Upload public/index.html, public/conductor.html, and public/products.css into the existing public folder. server.py adds /conductor, /conductor/, and /products.css, and includes the feature pages in the sitemap. Back up the existing files before deployment. Compile the server, then restart only the verified Python origin on port 8099 through its existing supervisor. Do not restart the tunnel or model services.

The homepage stylesheet is kept here as a design reference. The illustrated office on the feature page is explicitly labeled as a concept, not a live status display.

## Designed Not Cloned

New page: /designed-not-cloned/. Source files: public/designed-not-cloned.html,
public/audio-research.css, public/distortion.svg. Homepage revision features the
project as the lead experiment. Copy emphasizes an original DSP + ML instrument,
harmonics, intermodulation and playing response. Development status is explicit.

2026-09-26: assets and server routes uploaded; server passes Python compilation.
Origin restart was denied by automatic approval review. Live homepage was restored
to its previous version to avoid dead navigation. After an authorized origin restart,
upload public/index.html, then verify page and assets at desktop/mobile widths.

Deployment completed after user-authorized restart. Public homepage, project page,
stylesheet and SVG all returned HTTP 200. Origin health and newsroom route passed.
The homepage now links to /designed-not-cloned/ and leads with the new project.
