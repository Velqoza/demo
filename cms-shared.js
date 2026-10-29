(function(){
  const allowedCategories = ['pipes','steel','floors'];
  function imageURL(value){
    if(typeof value!=='string')return '';
    if(/^assets\/[a-zA-Z0-9_./-]+$/.test(value)&&!value.includes('..'))return value;
    try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
  }
  function validate(doc){
    if(!doc||doc.schema!==1||!doc.translations||!doc.settings||!Array.isArray(doc.gallery))throw Error('Invalid website content.');
    if(doc.gallery.length>200)throw Error('Maximum 200 photographs.');
    for(const l of ['he','ar','en']){
      if(!doc.translations[l]||typeof doc.translations[l]!=='object')throw Error('Missing translation: '+l);
      for(const value of Object.values(doc.translations[l]))if(typeof value!=='string'||value.length>6000)throw Error('Text must be under 6,000 characters.');
    }
    const s=doc.settings;
    for(const key of ['brand','phone','phoneDisplay','whatsapp','email','tiktok','logo','hero','feature'])if(typeof s[key]!=='string')throw Error('Missing setting: '+key);
    if(s.brand.length<1||s.brand.length>100||!/^[+\d ()-]{6,30}$/.test(s.phone)||!/^\d{8,15}$/.test(s.whatsapp)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email))throw Error('Check the business name and contact details.');
    if(!/^https:\/\/(www\.)?tiktok\.com\//.test(s.tiktok))throw Error('Enter a valid TikTok profile URL.');
    for(const key of ['logo','hero','feature'])if(!imageURL(s[key]))throw Error('Invalid image: '+key);
    const ids=new Set();
    for(const item of doc.gallery){
      if(!item||typeof item.id!=='string'||ids.has(item.id)||!allowedCategories.includes(item.category)||!imageURL(item.src)||typeof item.visible!=='boolean')throw Error('Invalid gallery photograph.');
      ids.add(item.id);
      for(const l of ['he','ar','en'])if(typeof item.caption?.[l]!=='string'||item.caption[l].length>500)throw Error('Invalid photograph caption.');
    }
    window.VisualBuilder?.validate(doc.layout);
    if(new Blob([JSON.stringify(doc)]).size>900000)throw Error('Content is too large.');
    return doc;
  }
  // The hero supports only literal <em> markers. Arbitrary HTML is always text.
  function heroText(el,text){
    el.replaceChildren();let emphasis=false;
    for(const part of String(text).split(/(<\/?em>)/g)){
      if(part==='<em>'){emphasis=true;continue;}if(part==='</em>'){emphasis=false;continue;}
      if(emphasis){const node=document.createElement('em');node.textContent=part;el.append(node);}else el.append(document.createTextNode(part));
    }
  }
  // Add fields introduced by newer site files without overwriting saved edits.
  function hydrate(doc,defaults){
    validate(doc);validate(defaults);
    const next=JSON.parse(JSON.stringify(doc));
    for(const l of ['he','ar','en'])next.translations[l]={...defaults.translations[l],...next.translations[l]};
    return validate(next);
  }
  window.WagiCMSShared={validate,imageURL,heroText,hydrate};
})();
