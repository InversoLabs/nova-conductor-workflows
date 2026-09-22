# Hardware storefront

Live route: https://inversolabs.us/newsroom/hardware/

The newsroom navigation has one Hardware link beside Open source. The right-hand front-page column now includes a compact rotating product spotlight beneath the newsroom note, added at the user’s request. Article recommendations remain deferred. The storefront is a static page in the existing site, with responsive cards, search, category filters and external Seeed checkout. No cart, payments, inventory service or new runtime dependencies.

## Maintenance

Edit `newsroom/site/hardware/catalog.json`. Each record has a stable ID, name, manufacturer, description, local image, category, tags, supplier, original seeedUrl, featured/active flags and dates. Optional badge, priceDisplay and unavailable fields control presentation. Set active=false to hide a product, featured=true to include it in Featured. Tags can include category names for cross-listing. Keep descriptions specific to the linked variant. Prices are omitted by default; Seeed is authoritative for price, availability, compatibility and fulfillment.

Add a verified product by copying one record, choosing a unique lowercase hyphenated ID, saving its verified supplier image as `images/<id>.jpg`, and updating imageSource/sourceVerifiedAt for provenance. Images are manufacturer/supplier product imagery from the linked Seeed listings; they are not generated images. Verify changes with `node --test test/hardware.test.mjs`. No build step required.

The single affiliate setting is SEEED_AFFILIATE_CODE in `newsroom/site/hardware/config.json`. `core.js` uses URL/searchParams.set to replace tracking safely, preserving other query parameters and fragments. It accepts only HTTPS Seeed hosts and adds sensecap_affiliate plus referring_service=link to every outbound product link. Supplier dispatch is isolated in purchaseUrl for future expansion. Links carry sponsored/noopener/noreferrer and open Seeed externally. Disclosure appears above the cards.

Expanded catalog checked September 22, 2026: 32 active products covering Raspberry Pi boards, cooling, power and cables; Arduino UNO Mini; XIAO microcontrollers; Grove creator kits, sensors and OLED displays; camera boards; Coral and Jetson systems. DGX Spark was removed at the user’s request. Newly added listings with unavailable status were excluded. All hardware is the default view, with a smaller Featured selection. Every record includes its official source URL and product-image provenance. No standalone RTX graphics-card product was verified, so none is advertised. Category shelves without curated products show an explicit empty state.

## Deployment

Copy the hardware directory into the server's `C:\Users\justi\Documents\inversolabs-homepage\newsroom\public\hardware`, and the updated newsroom/site/index.html to public/index.html. Also copy those source files into the server Conductor checkout at `C:\Users\justi\Documents\Nova Conductor Studio\newsroom\site` so later deployments preserve the change. Upload assets before navigation. Back up existing index.html first. Do not deploy local stories.json or replace runtime news, videos, images or queues. Existing Python hosting supports these routes/extensions; no service restart required.

Article relationships are deferred by user request. Future automation can assign stable catalog IDs once that feature is wanted; it should never duplicate product details into story prose or silently add affiliate recommendations.

## Front-page spotlight

spotlight.js reuses the catalog and affiliate helper. It rotates active, featured, available products every eight seconds, pauses on hover/focus or a hidden tab, respects reduced motion, and provides previous/next and pause controls. The app.js render includes its slot under the right-hand newsroom note, including after topic/search rerenders. Deploy app.js and index.html along with hardware assets for this feature. Catalog defaults to All hardware (32 products); Featured remains a curated subset.
