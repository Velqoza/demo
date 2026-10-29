(function(){
  const $=id=>document.getElementById(id),clone=value=>JSON.parse(JSON.stringify(value));
  const languages=['he','ar','en'],frame=$('v-frame');
  let client,doc,initial,defaults,user,revision=0,dirty=false,busy=false,authorized=false,preview=false,language='he',selection=null,savedJSON='',history=[],groupRecorded=false,frameSerial=0;
  const fieldNames={heroTitle:'العنوان الرئيسي',heroText:'وصف الصفحة الرئيسية',aboutTitle:'عنوان عن الشركة',aboutText:'وصف الشركة',company1Name:'اسم الشركة الأولى',company2Name:'اسم الشركة الثانية',featureTitle:'العنوان بجانب الصورة',featureText:'الوصف بجانب الصورة',stampPrepare:'السطر الأول فوق الصورة',stampProtect:'السطر الثاني فوق الصورة',stampPerform:'السطر الثالث فوق الصورة',contactTitle:'عنوان التواصل',contactText:'وصف التواصل',formTitle:'عنوان النموذج',name:'عنوان حقل الاسم',phone:'عنوان حقل الهاتف',service:'عنوان اختيار الخدمة',details:'عنوان تفاصيل المشروع',send:'نص زر الإرسال'};
  const settingNames={brand:'اسم الشركة أعلى الموقع',phone:'رقم الهاتف للاتصال',phoneDisplay:'الهاتف الظاهر للزائر',whatsapp:'رقم واتساب',email:'البريد الإلكتروني',tiktok:'رابط تيك توك',logo:'لوغو الشركة',hero:'الصورة الرئيسية',feature:'صورة قسم الشركة'};
  function check(result){if(result.error)throw Error(result.error.message);return result.data;}
  function feedback(text,error=false){const el=authorized?$('v-feedback'):$('v-login-feedback');el.textContent=text;el.classList.toggle('error',error);if(authorized)el.hidden=!text;}
  function status(){if(!doc)return;dirty=JSON.stringify(doc)!==savedJSON;$('v-state').textContent=busy?'جاري الحفظ…':dirty?'● تعديلات غير محفوظة':revision?'✓ المسودة محفوظة · '+revision:'الموقع جاهز للتعديل';$('v-undo').disabled=busy||history.length===0;}
  function setBusy(value){busy=value;document.body.classList.toggle('busy',value);for(const id of ['v-save','v-publish','v-logout','v-page','v-language','v-section','v-login-button'])$(id).disabled=value;$('v-fields').querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=value);status();}
  async function task(fn){if(busy)return;setBusy(true);try{await fn();}catch(e){feedback(e.message||'تعذّرت العملية. جرّب مرة ثانية.',true);}finally{setBusy(false);}}
  function remember(){if(groupRecorded)return;history.push(clone(doc));if(history.length>30)history.shift();groupRecorded=true;}
  function changed(){status();feedback('');}
  function closePanel(){frameDocument()?.querySelectorAll('[contenteditable]').forEach(el=>{el.removeAttribute('contenteditable');el.blur();});selection=null;groupRecorded=false;$('v-panel').hidden=true;markSelection();}
  function lock(){authorized=false;doc=null;user=null;dirty=false;selection=null;history=[];frame.src='about:blank';$('v-editor').hidden=true;$('v-login').hidden=false;$('v-panel').hidden=true;}
  async function load(){
    user=check(await client.auth.getSession())?.session?.user;if(!user){lock();return;}
    const allowed=check(await client.from('wagi_admins').select('user_id').eq('user_id',user.id));
    if(!allowed.length){await client.auth.signOut();lock();throw Error('هذا الحساب لا يملك صلاحية إدارة موقع الشركة.');}
    const response=await fetch('content-defaults.json',{cache:'no-store'});if(!response.ok)throw Error('تعذّر تحميل محتوى الموقع الأساسي.');defaults=await response.json();
    const [draftResult,pubResult]=await Promise.all([client.from('wagi_drafts').select('*').eq('id','main').maybeSingle(),client.from('wagi_published').select('*').eq('id','main').maybeSingle()]);
    const draft=check(draftResult),published=check(pubResult);doc=WagiCMSShared.hydrate(clone(draft?.content||published?.content||defaults),defaults);initial=clone(doc);revision=draft?.revision||0;savedJSON=JSON.stringify(doc);history=[];dirty=false;authorized=true;
    $('v-editor').hidden=false;$('v-login').hidden=true;feedback('');status();navigate($('v-page').value);
  }
  function navigate(page,hash=''){
    if(!authorized||!['index.html','work.html'].includes(page))return;closePanel();$('v-page').value=page;$('v-section').disabled=page!=='index.html';
    const url=new URL(page,document.baseURI);url.searchParams.set('edit','visual');url.hash=hash;frame.src=url.href;
  }
  function currentPage(){try{return frame.contentWindow.location.pathname.endsWith('/work.html')?'work.html':'index.html';}catch{return $('v-page').value;}}
  function frameDocument(){try{return frame.contentDocument;}catch{return null;}}
  function bridge(){try{return frame.contentWindow.WagiVisualBridge;}catch{return null;}}
  function refreshFrame(){
    if(!authorized||!bridge())return;const win=frame.contentWindow,x=win.scrollX,y=win.scrollY;try{bridge().apply(doc);bridge().setLanguage(language);decorate();win.scrollTo(x,y);}catch(error){feedback(error.message,true);}
  }
  function decorate(){
    const d=frameDocument();if(!d)return;d.body.classList.toggle('v-edit-mode',!preview);
    d.querySelectorAll('[data-t],.brand-words>b,.company-logo,.hero-photo,.feature-image>img,.work-card,.work-photo img,a[href^="tel:"],a[href^="mailto:"],a[href*="tiktok.com/"],a[href^="https://wa.me/"]').forEach(el=>{el.setAttribute('data-visual-editable','');el.setAttribute('tabindex','0');});
    // Preserve visual-editor navigation inside the same two site pages.
    d.querySelectorAll('a[href]').forEach(a=>{const url=new URL(a.getAttribute('href'),frame.contentWindow.location.href);if(url.origin===location.origin&&/\/(index|work)\.html$/.test(url.pathname)){url.searchParams.set('edit','visual');a.href=url.href;}});
    markSelection();
  }
  function descriptor(element){
    const img=element.closest('img');
    if(img){if(img.matches('.company-logo'))return{type:'image',key:'logo'};if(img.matches('.hero-photo'))return{type:'image',key:'hero'};if(img.matches('.feature-image>img'))return{type:'image',key:'feature'};const card=img.closest('.work-card');if(card){const item=doc.gallery.find(x=>x.id===card.dataset.galleryId)||doc.gallery.find(x=>x.src===card.dataset.image);if(item)return{type:'gallery',id:item.id};}}
    const translated=element.closest('[data-t]');if(translated&&typeof doc.translations[language][translated.dataset.t]==='string')return{type:'text',key:translated.dataset.t};
    const card=element.closest('.work-card');if(card){const item=doc.gallery.find(x=>x.id===card.dataset.galleryId)||doc.gallery.find(x=>x.src===card.dataset.image);if(item)return{type:element.closest('.work-photo')?'gallery':'gallery-caption',id:item.id};}
    if(element.closest('.brand-words>b'))return{type:'setting',key:'brand'};
    const link=element.closest('a[href]');if(link){const href=link.getAttribute('href');if(href.startsWith('tel:'))return{type:'contact',key:'phoneDisplay'};if(href.startsWith('mailto:'))return{type:'setting',key:'email'};if(href.includes('tiktok.com/'))return{type:'setting',key:'tiktok'};if(href.startsWith('https://wa.me/'))return{type:'setting',key:'whatsapp'};const label=link.querySelector('[data-t]');if(label)return{type:'text',key:label.dataset.t};}
    if(element.closest('.feature-image'))return{type:'image',key:'feature'};if(element.closest('.hero'))return{type:'image',key:'hero'};
    return null;
  }
  function sameSelection(a,b){return !!a&&!!b&&a.type===b.type&&a.key===b.key&&a.id===b.id;}
  function markSelection(){
    const d=frameDocument();if(!d)return;d.querySelectorAll('[data-visual-selected]').forEach(el=>el.removeAttribute('data-visual-selected'));
    if(!selection||preview)return;
    d.querySelectorAll('[data-visual-editable]').forEach(el=>{if(sameSelection(descriptor(el),selection))el.setAttribute('data-visual-selected','');});
  }
  function editableTextTarget(element,selected){return selected?.type==='text'?element.closest('[data-t]'):null;}
  function choose(selected,element){
    if(!sameSelection(selection,selected))groupRecorded=false;selection=selected;$('v-panel').hidden=false;renderPanel();markSelection();
    const text=editableTextTarget(element,selected);
    if(text?.hasAttribute('contenteditable'))return;
    if(text){text.setAttribute('contenteditable','plaintext-only');text.setAttribute('spellcheck','false');text.focus({preventScroll:true});const range=text.ownerDocument.createRange();range.selectNodeContents(text);range.collapse(false);const s=text.ownerDocument.getSelection();s.removeAllRanges();s.addRange(range);}
  }
  function field(title,value,onChange,{multiline=false,dir='auto',max=6000}={}){
    const label=document.createElement('label');label.textContent=title;const input=document.createElement(multiline?'textarea':'input');input.value=value;input.dir=dir;input.maxLength=max;input.addEventListener('input',()=>{remember();onChange(input.value);changed();refreshFrame();});label.append(input);return label;
  }
  function addImageTools(parent,src,onReplace){
    const img=document.createElement('img');img.className='image-preview';img.src=src;img.alt='الصورة الحالية';const label=document.createElement('label');label.textContent='اختار صورة بديلة';const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.addEventListener('change',()=>{const file=input.files[0];if(!file)return;input.value='';task(async()=>{const url=await uploadImage(file);groupRecorded=false;remember();onReplace(url);changed();refreshFrame();renderPanel();feedback('تغيّرت الصورة في المسودة. احفظ وانشر لما تكون جاهز.');});});label.append(input);const note=document.createElement('p');note.className='inline-note';note.textContent='JPG / PNG / WEBP، حتى 10 MB. منصغّر الصورة قبل الرفع.';parent.append(img,label,note);
  }
  function renderPanel(){
    const parent=$('v-fields');parent.replaceChildren();if(!selection||!doc)return;const s=selection;
    $('v-selection-note').textContent='لغة التعديل: '+$('v-language').selectedOptions[0].textContent+' · التعديلات تبقى مسودة حتى النشر.';
    if(s.type==='text'){
      $('v-selection-title').textContent=fieldNames[s.key]||'تعديل النص';const key=document.createElement('span');key.className='field-key';key.textContent=s.key;parent.append(key,field('النص — أو اكتبه مباشرة على الموقع',doc.translations[language][s.key],v=>doc.translations[language][s.key]=v,{multiline:true,dir:language==='en'?'ltr':'rtl'}));
    }else if(s.type==='image'){
      $('v-selection-title').textContent=settingNames[s.key];addImageTools(parent,doc.settings[s.key],v=>doc.settings[s.key]=v);
    }else if(s.type==='gallery'||s.type==='gallery-caption'){
      const item=doc.gallery.find(x=>x.id===s.id);if(!item){closePanel();return;}$('v-selection-title').textContent='صورة من أعمالنا';
      if(s.type==='gallery')addImageTools(parent,item.src,v=>item.src=v);
      parent.append(field('وصف الصورة باللغة المختارة',item.caption[language],v=>item.caption[language]=v,{multiline:true,dir:language==='en'?'ltr':'rtl',max:500}));
      const label=document.createElement('label');label.textContent='التصنيف';const select=document.createElement('select');for(const [value,text] of Object.entries({pipes:'أنابيب ومنشآت',steel:'هياكل معدنية',floors:'أرضيات'})){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.value=item.category;select.addEventListener('change',()=>{remember();item.category=select.value;changed();refreshFrame();});label.append(select);parent.append(label);
      const actions=document.createElement('div');actions.className='gallery-actions';const hide=document.createElement('button');hide.className='secondary';hide.textContent='إخفاء هذه الصورة';hide.addEventListener('click',()=>{remember();item.visible=false;changed();closePanel();refreshFrame();});actions.append(hide);const hint=document.createElement('p');hint.className='inline-note';hint.textContent='إضافة الصور وترتيبها وإظهار المخفي متاح كمان في اللوحة القديمة.';parent.append(actions,hint);
    }else{
      $('v-selection-title').textContent=settingNames[s.key]||'معلومات التواصل';const keys=s.type==='contact'?['phoneDisplay','phone']:[s.key];for(const key of keys)parent.append(field(settingNames[key],doc.settings[key],v=>doc.settings[key]=v,{dir:key==='brand'?'rtl':'ltr',max:200}));
    }
  }
  function bindFrame(){
    const win=frame.contentWindow,d=frameDocument();if(!authorized||!d||!bridge()){if(authorized)feedback('تعذّر فتح صفحة التعديل. تأكّد أنك رفعت كل ملفات النسخة الجديدة.',true);return;}
    frameSerial++;$('v-page').value=currentPage();$('v-section').disabled=currentPage()!=='index.html';refreshFrame();
    const style=d.createElement('style');style.textContent='body.v-edit-mode [data-visual-editable]{cursor:text}body.v-edit-mode img[data-visual-editable],body.v-edit-mode .work-card{cursor:pointer}body.v-edit-mode [data-visual-editable]:hover{outline:1px dashed #ed6c32;outline-offset:4px}body.v-edit-mode [data-visual-selected]{outline:2px solid #ed6c32!important;outline-offset:5px;border-radius:2px}body.v-edit-mode [contenteditable]{caret-color:#ed6c32;min-width:1em}';d.head.append(style);
    d.addEventListener('click',event=>{
      const el=event.target instanceof win.Element?event.target:null;if(!el)return;
      const siteLanguage=el.closest('#language');if(siteLanguage||el.closest('.menu'))return;
      if(preview){const link=el.closest('a[href]');if(link){const target=new URL(link.href,win.location.href);if(target.origin!==location.origin||!(/\/(?:index|work)\.html$/.test(target.pathname))){event.preventDefault();event.stopImmediatePropagation();feedback('هذا رابط خارجي. افتح الموقع العادي لاستخدامه.');}}return;}
      if(el.closest('input,textarea,select')){event.preventDefault();event.stopImmediatePropagation();feedback('لتغيير عنوان الحقل، اكبس على الكتابة اللي فوقه. النموذج هون للعرض.');return;}
      const selected=descriptor(el);event.stopImmediatePropagation();
      if(selected){if(el.closest('a,button'))event.preventDefault();choose(selected,el);}else if(el.closest('a,button,form'))event.preventDefault();
    },true);
    d.addEventListener('input',event=>{if(preview||busy)return;const el=event.target;if(!el.matches?.('[contenteditable][data-t]'))return;const key=el.dataset.t;if(!selection||selection.type!=='text'||selection.key!==key)return;remember();doc.translations[language][key]=el.innerText.replace(/\u00a0/g,' ').slice(0,6000);const input=$('v-fields').querySelector('textarea');if(input)input.value=doc.translations[language][key];changed();},true);
    d.addEventListener('focusout',event=>{if(event.target.matches?.('[contenteditable][data-t]')){event.target.removeAttribute('contenteditable');refreshFrame();}},true);
    d.addEventListener('paste',event=>{if(!event.target.matches?.('[contenteditable]'))return;event.preventDefault();const text=event.clipboardData.getData('text/plain');const selection=d.getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);range.deleteContents();const node=d.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);event.target.dispatchEvent(new win.Event('input',{bubbles:true}));},true);
    d.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation();feedback('إرسال النموذج متاح على الموقع العادي؛ هون وضع تعديل ومعاينة فقط.');},true);
    const languagePicker=d.getElementById('language');languagePicker?.addEventListener('change',()=>{language=languagePicker.value;$('v-language').value=language;closePanel();decorate();});
    win.addEventListener('wagi-content',decorate);win.addEventListener('wagi-gallery-updated',decorate);
    d.addEventListener('keydown',event=>{if(event.key==='Escape')closePanel();if(event.key==='Enter'&&!preview&&!event.target.hasAttribute?.('contenteditable')&&event.target.hasAttribute?.('data-visual-editable')){const chosen=descriptor(event.target);if(chosen){event.preventDefault();choose(chosen,event.target);}}});
  }
  async function save(){
    if(!authorized)throw Error('سجّل الدخول أولًا.');WagiCMSShared.validate(doc);const payload={id:'main',content:doc,revision:revision+1,updated_at:new Date().toISOString()};
    const result=revision?await client.from('wagi_drafts').update(payload).eq('id','main').eq('revision',revision).select('revision'):await client.from('wagi_drafts').insert(payload).select('revision');
    if(result.error?.code==='23505')throw Error('في مسودة أحدث محفوظة من لوحة ثانية. احفظ نسخة من شغلك قبل تحديث الصفحة.');const rows=check(result);if(!rows.length)throw Error('تعدّلت المسودة من لوحة ثانية. ما تم استبدال شغلها. احتفظ بتعديلاتك قبل تحديث الصفحة.');revision=rows[0].revision;savedJSON=JSON.stringify(doc);status();
  }
  function randomID(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);}
  async function uploadImage(file){
    if(!authorized)throw Error('سجّل الدخول أولًا.');if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('اختار JPG أو PNG أو WEBP بحجم حتى 10 MB.');
    const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>60000000){bitmap.close();throw Error('أبعاد الصورة كبيرة جدًا.');}const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.86));if(!blob||blob.size>4*1024*1024)throw Error('الصورة كبيرة حتى بعد التصغير.');const extension=blob.type==='image/png'?'png':blob.type==='image/jpeg'?'jpg':'webp',path=user.id+'/'+randomID()+'.'+extension;check(await client.storage.from('wagi-media').upload(path,blob,{contentType:blob.type,upsert:false}));return client.storage.from('wagi-media').getPublicUrl(path).data.publicUrl;
  }
  function mode(value){preview=value;if(preview){frameDocument()?.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));closePanel();}$('v-edit-mode').setAttribute('aria-pressed',String(!preview));$('v-preview-mode').setAttribute('aria-pressed',String(preview));$('v-hint').hidden=preview;decorate();}
  $('v-login-form').addEventListener('submit',event=>{event.preventDefault();task(async()=>{if(!client)throw Error('تعذّر تحميل تسجيل الدخول. حدّث الصفحة.');check(await client.auth.signInWithPassword({email:$('v-email').value.trim(),password:$('v-password').value}));$('v-password').value='';await load();});});
  $('v-logout').addEventListener('click',()=>{if(dirty&&!confirm(window.AdminUI?.t('في تعديلات غير محفوظة. بدك تطلع؟')||'في تعديلات غير محفوظة. بدك تطلع؟'))return;task(async()=>{check(await client.auth.signOut());lock();feedback('تم تسجيل الخروج.');});});
  $('v-save').addEventListener('click',()=>task(async()=>{await save();feedback('حُفظت المسودة. الموقع العام ما تغيّر.');}));
  $('v-publish').addEventListener('click',()=>{try{WagiCMSShared.validate(doc);$('v-publish-dialog').showModal();}catch(e){feedback(e.message,true);}});
  $('v-confirm-publish').addEventListener('click',()=>{$('v-publish-dialog').close();task(async()=>{await save();check(await client.rpc('wagi_publish',{expected_revision:revision}));feedback('تم نشر التعديلات على الموقع.');});});$('v-cancel-publish').addEventListener('click',()=>$('v-publish-dialog').close());
  $('v-undo').addEventListener('click',()=>{if(!history.length||busy)return;doc=history.pop();groupRecorded=false;closePanel();refreshFrame();changed();});
  $('v-reset-field').addEventListener('click',()=>{if(!selection)return;groupRecorded=false;remember();const s=selection;if(s.type==='text')doc.translations[language][s.key]=initial.translations[language][s.key];else if(s.id){const current=doc.gallery.find(x=>x.id===s.id),old=initial.gallery.find(x=>x.id===s.id);if(current&&old)Object.assign(current,clone(old));}else if(s.type==='contact'){doc.settings.phone=initial.settings.phone;doc.settings.phoneDisplay=initial.settings.phoneDisplay;}else doc.settings[s.key]=initial.settings[s.key];changed();refreshFrame();renderPanel();});
  $('v-close-panel').addEventListener('click',closePanel);$('v-dismiss-hint').addEventListener('click',()=>$('v-hint').hidden=true);
  $('v-page').addEventListener('change',()=>navigate($('v-page').value));$('v-section').addEventListener('change',()=>{const value=$('v-section').value;const target=value==='feature'?frameDocument()?.querySelector('.feature'):value==='footer'?frameDocument()?.querySelector('footer'):frameDocument()?.getElementById(value);target?.scrollIntoView({block:'start',behavior:'smooth'});});
  $('v-language').addEventListener('change',()=>{language=$('v-language').value;closePanel();refreshFrame();});
  $('v-edit-mode').addEventListener('click',()=>mode(false));$('v-preview-mode').addEventListener('click',()=>mode(true));
  document.querySelectorAll('[data-width]').forEach(button=>button.addEventListener('click',()=>{$('v-canvas').dataset.device=button.dataset.width;document.querySelectorAll('[data-width]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
  frame.addEventListener('load',()=>{if(authorized)bindFrame();});window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});

  window.VBuilderAdapter={
    get:()=>doc, allowed:()=>authorized&&!busy, page:()=>currentPage(),language:()=>language,
    feedback,placeholder:'assets/hero.jpg',
    textKey(el){return el.closest('[data-t]')?.dataset.t||null;},
    getText(key){return doc.translations[language][key];},
    setText(content,key,value){content.translations[language][key]=value.slice(0,6000);},
    async upload(file){return uploadImage(file);},
    change(fn){if(!authorized||busy)throw Error('انتظر انتهاء العملية وسجّل الدخول.');const next=clone(doc);fn(next);WagiCMSShared.validate(next);remember(true);doc=next;groupRecorded=false;changed();refreshFrame();window.dispatchEvent(new Event('builder-refreshed'));}
  };
  try{if(!window.supabase)throw Error('تعذّر تحميل نظام الدخول. حدّث الصفحة.');client=supabase.createClient(WAGI_CMS.url,WAGI_CMS.key,{auth:{storageKey:'wagi-cms-'+new URL(WAGI_CMS.url).hostname.split('.')[0],persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')lock();});task(load);}catch(e){feedback(e.message,true);}
})();
