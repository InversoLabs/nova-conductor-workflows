import { categories, disclosure, purchaseUrl, validateCatalog } from './core.js?v=2';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data;
async function load() {
  return data ||= Promise.all(['catalog','config'].map(async name => {
    const r = await fetch(`/newsroom/hardware/${name}.json`, {cache:'no-cache'});
    if (!r.ok) throw Error('Hardware unavailable');
    return r.json();
  })).then(([products, config]) => ({products:validateCatalog(products, config), config}));
}
function card(p, config) {
  return `<article class="hardware-card"><div class="hardware-photo"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">${p.badge?`<span>${esc(p.badge)}</span>`:''}</div><div class="hardware-details"><span class="eyebrow">${esc(p.manufacturer)}</span><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="hardware-purchase"><small>${esc(p.priceDisplay || 'Price & availability on Seeed')}</small><a href="${esc(purchaseUrl(p,config))}" target="_blank" rel="sponsored noopener noreferrer">${p.unavailable?'View listing on Seeed ↗':'Buy on Seeed ↗'}</a><small>External checkout on Seeed</small></div></div></article>`;
}
async function start() {
  const shop=document.querySelector('#hardware-shop');
  if (shop) {
    try {
      const {products,config}=await load();
      if (shop) {
        let category='All hardware', query='';
        shop.innerHTML=`<div class="hardware-tools"><label>Find your next build<input id="hardware-search" type="search" placeholder="Search boards, cameras, robotics…"></label><div class="hardware-filters" aria-label="Hardware categories">${categories.map(c=>`<button type="button" data-category="${esc(c)}" aria-pressed="${c===category}">${esc(c)}</button>`).join('')}</div></div><p class="affiliate-disclosure">${disclosure} Purchases, shipping and support are handled by Seeed.</p><p id="hardware-count" role="status"></p><div id="hardware-results" class="hardware-grid"></div>`;
        const render=()=>{
          const filtered=products.filter(p=>p.active&&(category==='All hardware'||(category==='Featured'?p.featured:p.category===category||p.tags.includes(category)))&&[p.name,p.description,p.manufacturer,...p.tags].join(' ').toLowerCase().includes(query));
          document.querySelector('#hardware-count').textContent=`${filtered.length} ${filtered.length===1?'product':'products'} / ${category}`;
          document.querySelector('#hardware-results').innerHTML=filtered.length?filtered.map(p=>card(p,config)).join(''):'<p class="hardware-empty">No products in this selection yet. Try another category or clear your search.</p>';
        };
        shop.querySelector('#hardware-search').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render();});
        shop.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;shop.querySelectorAll('[data-category]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
        render();
      }
    } catch { shop.textContent='Hardware is temporarily unavailable. Please try again later.'; }
  }
}
start();
