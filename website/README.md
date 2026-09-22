# Inverso Labs public feature pages

These files update the existing NOVA-SERVER homepage deployment at `C:/Users/justi/Documents/inversolabs-homepage`. The origin retains its existing legacy module, main.js, favicon.svg, and newsroom directory; this folder is not a standalone server distribution.

Upload public/index.html, public/conductor.html, and public/products.css into the existing public folder. server.py adds /conductor, /conductor/, and /products.css, and includes the feature pages in the sitemap. Back up the existing files before deployment. Compile the server, then restart only the verified Python origin on port 8099 through its existing supervisor. Do not restart the tunnel or model services.

The homepage stylesheet is kept here as a design reference. The illustrated office on the feature page is explicitly labeled as a concept, not a live status display.
