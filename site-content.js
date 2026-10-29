(async function(){
  let content=null;
  function apply(doc){
    WagiCMSShared.validate(doc);content=doc;
    for(const l of ['he','ar','en'])for(const key of Object.keys(copy[l]))if(typeof doc.translations[l][key]==='string')copy[l][key]=doc.translations[l][key];
    render();applyDetails();window.dispatchEvent(new CustomEvent('wagi-content',{detail:doc}));
  }
  function applyDetails(){
    if(!content)return;window.VisualBuilder?.prepare(document);const s=content.settings;
    document.querySelectorAll('.brand-words>b').forEach(el=>el.textContent=s.brand);
    document.querySelectorAll('.company-logo').forEach(el=>{el.src=s.logo;el.alt=s.brand;});
    const hero=document.querySelector('.hero-photo'),feature=document.querySelector('.feature-image>img');if(hero)hero.src=s.hero;if(feature)feature.src=s.feature;
    document.querySelectorAll('a[href^="tel:"]').forEach(a=>{a.href='tel:'+s.phone.replace(/[^+\d]/g,'');const strong=a.querySelector('strong');if(strong)strong.textContent=s.phoneDisplay;else{a.replaceChildren(document.createTextNode(s.phoneDisplay+' ↗'));}});
    document.querySelectorAll('a[href^="mailto:"]').forEach(a=>{a.href='mailto:'+s.email;const strong=a.querySelector('strong');if(strong)strong.textContent=s.email;});
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a=>a.href='https://wa.me/'+s.whatsapp);
    document.querySelectorAll('a[href*="tiktok.com/"]').forEach(a=>{a.href=s.tiktok;const handle=a.querySelector('small');if(handle)handle.textContent=s.tiktok.split('/').filter(Boolean).pop();});
    for(const key of ['instagram','facebook']){const value=s[key];if(typeof value==='string'&&/^https:\/\/(www\.)?(instagram|facebook)\.com\//.test(value))document.querySelectorAll('a[href*="'+key+'.com/"]').forEach(a=>a.href=value);}
    const grid=document.querySelector('.work-grid');if(grid){grid.replaceChildren();
      content.gallery.filter(item=>item.visible).forEach((item,i)=>{
        const card=document.createElement('button');card.type='button';card.className='work-card';card.dataset.category=item.category;card.dataset.image=item.src;card.dataset.galleryId=item.id;card.dataset.builderId='gallery-'+item.id;
        const photo=document.createElement('div');photo.className='work-photo';const img=document.createElement('img');img.src=item.src;img.alt=item.caption[lang]||copy[lang]['filter'+item.category];img.loading='lazy';img.dataset.builderId='gallery-img-'+item.id;photo.append(img);
        const caption=document.createElement('div');caption.className='work-caption';const text=document.createElement('span');text.dataset.builderId='gallery-cap-'+item.id;text.dataset.builderPlain='';text.textContent=item.caption[lang]||copy[lang]['filter'+item.category];const no=document.createElement('small');no.textContent=String(i+1).padStart(2,'0');caption.append(text,no);card.append(photo,caption);grid.append(card);
      });window.dispatchEvent(new Event('wagi-gallery-updated'));
    }
    window.WagiLiveSettings=s;
    window.VisualBuilder?.render(document,content,lang);
    if(new URLSearchParams(location.search).get('preview')==='draft')document.querySelectorAll('a[href]').forEach(a=>{const u=new URL(a.getAttribute('href'),location.href);if(u.origin===location.origin&&/\/(?:index|work)\.html$/.test(u.pathname)){u.searchParams.set('preview','draft');a.href=u.href;}});
  }
  selector.addEventListener('change',applyDetails);
  // Same-origin visual preview only. This bridge never writes to the database.
  // The parent admin2 page authenticates and owns all draft/publish operations.
  let visualFrame=false;
  try{visualFrame=new URLSearchParams(location.search).get('edit')==='visual'&&window.parent!==window&&window.parent.location.origin===location.origin&&/\/admin2\.html$/.test(window.parent.location.pathname);}catch{}
  if(visualFrame){
    window.WagiVisualBridge={apply,setLanguage(value){if(!copy[value])return;lang=value;render();applyDetails();},getLanguage(){return lang;}};
    return;
  }
  try{
    if(new URLSearchParams(location.search).get('preview')==='draft'){
      const draft=sessionStorage.getItem('wagi-preview');if(!draft)throw Error('Draft preview expired.');apply(JSON.parse(draft));
      const banner=document.createElement('div');banner.className='draft-banner';banner.textContent='תצוגה מקדימה · معاينة مسودة · Draft preview — השינויים טרם פורסמו';document.body.prepend(banner);return;
    }
    const cfg=window.WAGI_CMS;if(!cfg?.url||!cfg?.key)return;
    const r=await fetch(cfg.url+'/rest/v1/wagi_published?id=eq.main&select=content',{headers:{apikey:cfg.key},cache:'no-store',signal:AbortSignal.timeout(7000)});
    if(!r.ok)return;const rows=await r.json();if(rows[0]?.content)apply(rows[0].content);
  }catch(error){console.warn('Website uses its built-in content; CMS unavailable.',error.message);}
})();
