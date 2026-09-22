export const categories = ['Featured', 'All hardware', 'Raspberry Pi', 'NVIDIA Jetson / Edge AI', 'Arduino / Microcontrollers', 'AI Accelerators', 'Robotics', 'Cameras / Computer Vision', 'Storage', 'Power', 'Accessories'];
export const disclosure = 'InversoLabs may earn a commission from purchases made through hardware links.';
export function affiliateUrl(raw, config) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !['seeedstudio.com', 'www.seeedstudio.com'].includes(url.hostname) || url.username || url.password || url.port) throw Error('Expected a Seeed HTTPS URL');
  if (!config.SEEED_AFFILIATE_CODE?.trim()) throw Error('Missing affiliate code');
  url.searchParams.set('sensecap_affiliate', config.SEEED_AFFILIATE_CODE.trim());
  url.searchParams.set('referring_service', 'link');
  return url.href;
}
export function purchaseUrl(product, config) {
  if (product.supplier !== 'seeed') throw Error('Unsupported supplier');
  return affiliateUrl(product.seeedUrl, config);
}
export function validateCatalog(products, config) {
  if (!Array.isArray(products)) throw Error('Catalog must be an array');
  const ids = new Set();
  for (const p of products) {
    if (!/^[a-z0-9-]+$/.test(p.id) || ids.has(p.id)) throw Error('Invalid or duplicate product ID');
    ids.add(p.id);
    for (const field of ['name','manufacturer','description','image','createdAt','updatedAt']) if (typeof p[field] !== 'string' || !p[field].trim()) throw Error('Missing '+field);
    if (!/^\/newsroom\/hardware\/images\/[a-z0-9-]+\.jpg$/.test(p.image)) throw Error('Use a local product JPEG');
    if (!categories.slice(1).includes(p.category) || !Array.isArray(p.tags) || p.tags.some(t => typeof t !== 'string') || typeof p.active !== 'boolean' || typeof p.featured !== 'boolean') throw Error('Invalid product metadata');
    purchaseUrl(p, config);
  }
  return products;
}
