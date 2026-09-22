import {purchaseUrl, disclosure, validateCatalog} from './core.js?v=2';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const front=document.querySelector('#front-page');
if(front){
  Promise.all(['catalog','config'].map(async name=>{const r=await fetch(`/newsroom/hardware/${name}.json`,{cache:'no-cache'});if(!r.ok)throw Error('Unavailable');return r.json();})).then(([catalog,config])=>{
    const products=validateCatalog(catalog,config).filter(p=>p.active&&p.featured&&!p.unavailable);
    if(!products.length)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let index=0,paused=reduced.matches,host;
    function draw(){
      if(!host?.isConnected)return;
      const p=products[index];
      host.innerHTML=`<div class="spotlight-top"><span>THE HARDWARE SHELF</span><span>${index+1} / ${products.length}</span></div><a class="spotlight-product" href="${esc(purchaseUrl(p,config))}" target="_blank" rel="sponsored noopener noreferrer"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"><h3>${esc(p.name)}</h3><span>Buy on Seeed ↗</span></a><div class="spotlight-controls"><button type="button" data-step="-1" aria-label="Previous product">←</button><button type="button" data-pause aria-pressed="${paused}">${paused?'Play':'Pause'}</button><button type="button" data-step="1" aria-label="Next product">→</button><a href="/newsroom/hardware/">Browse all ↗</a></div><p>${disclosure}</p>`;
    }
    function mount(){const next=front.querySelector('[data-hardware-spotlight]');if(next===host)return;host=next;if(!host)return;host.className='hardware-spotlight';host.setAttribute('aria-label','Featured hardware');host.addEventListener('click',e=>{const step=e.target.closest('[data-step]'),pause=e.target.closest('[data-pause]');if(!step&&!pause)return;if(step)index=(index+Number(step.dataset.step)+products.length)%products.length;if(pause)paused=!paused;const focus=step?`[data-step="${step.dataset.step}"]`:'[data-pause]';draw();host.querySelector(focus)?.focus();});draw();}
    new MutationObserver(mount).observe(front,{childList:true});
    mount();
    setInterval(()=>{if(paused||reduced.matches||document.hidden||!host?.isConnected||host.matches(':hover')||host.contains(document.activeElement))return;index=(index+1)%products.length;draw();},8000);
  }).catch(()=>{});
}
