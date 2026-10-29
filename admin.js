(function(){
  const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
  let client,doc,defaults,revision=0,dirty=false,busy=false,authorized=false,editLang='he',groupsCollapsed=false,publishedAt=null,user=null;
  function feedback(text,error=false){$('feedback').textContent=text;$('feedback').classList.toggle('error',error);}
  function changed(){dirty=true;$('save-state').textContent='יש שינויים שלא נשמרו · تغييرات غير محفوظة';}
  function setBusy(value){busy=value;document.body.classList.toggle('busy',value);document.querySelectorAll('#editor input,#editor textarea,#editor select,#editor button,#login-button').forEach(el=>{if(value){el.dataset.cmsLocked=String(el.disabled);el.disabled=true;}else if(el.dataset.cmsLocked!==undefined){el.disabled=el.dataset.cmsLocked==='true';delete el.dataset.cmsLocked;}});}
  async function task(fn){if(busy)return;setBusy(true);try{await fn();}catch(e){feedback(e.message||'הפעולה נכשלה. נסו שוב.',true);}finally{setBusy(false);}}
  function check(result){if(result.error)throw Error(result.error.message);return result.data;}
  function setupError(error){return /wagi_|schema cache|does not exist|42P01/.test(error.message)?'יש להפעיל תחילה את קובץ ההגדרה wagi-cms.sql ב-Supabase. شغّل ملف الإعداد أولاً.':error.message;}
  function showTab(name){
    if(!authorized)return;
    document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==name);
    document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===name){b.setAttribute('aria-current','page');$('page-name').textContent=b.querySelector('span').textContent;}else b.removeAttribute('aria-current');});
  }
  function status(){
    $('photo-count').textContent=doc.gallery.filter(x=>x.visible).length;
    $('publish-state').textContent=publishedAt?'פורסם':'טרם פורסם';
    $('published-date').textContent=publishedAt?'פרסום אחרון: '+new Date(publishedAt).toLocaleString('he-IL'):'האתר מציג את התוכן המובנה';
    $('save-state').textContent=dirty?'יש שינויים שלא נשמרו · تغييرات غير محفوظة':revision?'הטיוטה נשמרה · גרסה '+revision:'מוכן לעריכה · התוכן המקורי של האתר';
  }
  async function load(){
    const session=check(await client.auth.getSession())?.session;
    user=session?.user;if(!user){lock();return;}
    const allowed=check(await client.from('wagi_admins').select('user_id').eq('user_id',user.id));
    if(!allowed.length){await client.auth.signOut();lock();throw Error('לחשבון הזה אין הרשאה לניהול אתר החברה. الحساب لا يملك صلاحية إدارة هذا الموقع.');}
    defaults=await fetch('content-defaults.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Cannot load built-in website content.');return r.json();});
    const [draft,pub]=await Promise.all([client.from('wagi_drafts').select('*').eq('id','main').maybeSingle(),client.from('wagi_published').select('*').eq('id','main').maybeSingle()]);
    const d=check(draft),p=check(pub);doc=WagiCMSShared.hydrate(clone(d?.content||p?.content||defaults),defaults);revision=d?.revision||0;publishedAt=p?.published_at||null;dirty=false;authorized=true;
    $('session-email').textContent=user.email;$('logout').hidden=false;$('login-panel').hidden=true;$('editor').hidden=false;
    renderTexts();renderSettings();renderGallery();status();showTab('overview');feedback('');
  }
  function lock(){authorized=false;user=null;doc=null;dirty=false;$('editor').hidden=true;$('login-panel').hidden=false;$('logout').hidden=true;$('session-email').textContent='';}
  const groups=[['hero','עמוד הבית',/^(hero|quote$|explore$|builtLine|surfaceLine)/],['about','אודות החברה',/^(about|company)/],['services','שירותים',/^(services|s[1-4]|strip)/],['feature','התמונה המרכזית והכיתוב עליה',/^(feature|stamp|talkProject)/],['process','דרך העבודה — שלושת השלבים',/^(process|p[1-3])/],['faq','שאלות ותשובות',/^(faq|q[1-3]$|a[1-3]$)/],['gallery','גלריית עבודות',/^(work|watch|filter|closeImage|previousImage|nextImage)/],['contact','יצירת קשר',/^(contact|call$|email$|form|name$|phone$|service$|details$|send$|wa|other$)/],['navigation','ניווט וטקסטים נוספים',/.*/]];
  const fieldTitles={"aboutTitle": "כותרת אודות החברה", "aboutText": "תיאור החברה", "company1Name": "השם המלא של החברה הראשונה", "company2Name": "השם המלא של החברה השנייה", "featureTitle": "הכותרת ליד התמונה המרכזית", "featureText": "התיאור ליד התמונה המרכזית", "stampPrepare": "המילה הראשונה על התמונה", "stampProtect": "המילה השנייה על התמונה", "stampPerform": "המילה השלישית על התמונה", "contactTitle": "הכותרת הגדולה ביצירת קשר", "contactText": "תיאור יצירת קשר", "formTitle": "כותרת טופס הצעת המחיר", "name": "תווית שדה שם הלקוח", "phone": "תווית שדה הטלפון", "service": "תווית בחירת השירות", "details": "תווית פירוט הפרויקט", "send": "טקסט כפתור שליחת הטופס"};
  function renderTexts(){
    const parent=$('text-fields');parent.replaceChildren();const search=$('text-search').value.trim().toLowerCase();const assigned=new Set();
    for(const [,title,pattern] of groups){
      const keys=Object.keys(doc.translations[editLang]).filter(key=>{if(assigned.has(key)||!pattern.test(key))return false;assigned.add(key);const haystack=(key+' '+(fieldTitles[key]||'')+' '+doc.translations[editLang][key]+' '+defaults.translations.he[key]).toLowerCase();return !search||search.split(/\s+/).every(term=>haystack.includes(term));});
      if(!keys.length)continue;const group=document.createElement('details');group.className='field-group';group.open=!!search||!groupsCollapsed;const summary=document.createElement('summary');summary.textContent=title+' · '+keys.length;group.append(summary);const fields=document.createElement('div');fields.className='fields-grid';
      for(const key of keys){const label=document.createElement('label');const title=document.createElement('span');title.textContent=(fieldTitles[key]||defaults.translations.he[key]||key).replace(/<\/?em>/g,'').slice(0,65);const code=document.createElement('small');code.className='field-key';code.textContent=key;label.append(title,code);const input=document.createElement('textarea');input.value=doc.translations[editLang][key];input.maxLength=6000;input.dir=editLang==='en'?'ltr':'rtl';input.rows=input.value.length>120?4:2;input.addEventListener('input',()=>{doc.translations[editLang][key]=input.value;changed();});label.append(input);fields.append(label);}group.append(fields);parent.append(group);
    }
  }
  function field(label,value,onInput,options={}){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.value=value;input.dir=options.dir||'auto';input.type=options.type||'text';input.maxLength=options.max||200;input.addEventListener('input',()=>{onInput(input.value);changed();});wrap.append(input);return wrap;}
  function renderSettings(){
    const p=$('settings-fields');p.replaceChildren();
    for(const [key,label] of Object.entries({brand:'שם החברה בראש האתר',phone:'טלפון לחיוג, כולל קידומת',phoneDisplay:'טלפון לתצוגה',whatsapp:'מספר WhatsApp, ספרות בלבד',email:'אימייל',tiktok:'קישור לפרופיל TikTok',instagram:'קישור Instagram',facebook:'קישור Facebook'}))p.append(field(label,doc.settings[key]||'',v=>doc.settings[key]=v,{dir:key==='brand'?'rtl':'ltr',max:key==='brand'?100:200}));
    const images=$('image-settings');images.replaceChildren();
    for(const [key,label] of Object.entries({logo:'לוגו החברה',hero:'תמונה ראשית',feature:'תמונת אודות / תהליך'})){
      const block=document.createElement('div');block.className='image-setting';const heading=document.createElement('b');heading.textContent=label;const img=document.createElement('img');img.src=doc.settings[key];img.alt=label;const upload=document.createElement('input');upload.type='file';upload.accept='image/jpeg,image/png,image/webp';upload.setAttribute('aria-label',label);upload.addEventListener('change',()=>task(async()=>{if(!upload.files[0])return;doc.settings[key]=await uploadImage(upload.files[0]);changed();img.src=doc.settings[key];feedback('התמונה הועלתה. שמרו טיוטה ופרסמו כדי להציג אותה באתר.');}));block.append(heading,img,upload);images.append(block);
    }
  }
  function renderGallery(){
    const p=$('gallery-list');p.replaceChildren();
    doc.gallery.forEach((item,index)=>{
      const card=document.createElement('article');card.className='photo-editor'+(item.visible?'':' is-hidden');const img=document.createElement('img');img.src=item.src;img.alt=item.caption.he||'תמונת עבודה';img.loading='lazy';card.append(img);
      const category=document.createElement('label');category.textContent='קטגוריה';const select=document.createElement('select');for(const [value,text] of Object.entries({pipes:'צנרת ומתקנים',steel:'קונסטרוקציות מתכת',floors:'רצפות'})){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}select.value=item.category;select.addEventListener('change',()=>{item.category=select.value;changed();});category.append(select);card.append(category);
      for(const [l,label] of Object.entries({he:'כיתוב בעברית',ar:'وصف بالعربية',en:'English caption'}))card.append(field(label,item.caption[l],v=>item.caption[l]=v,{dir:l==='en'?'ltr':'rtl',max:500}));
      const visible=document.createElement('label');visible.className='toggle-label';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=item.visible;checkbox.addEventListener('change',()=>{item.visible=checkbox.checked;changed();renderGallery();status();});visible.append(checkbox,document.createTextNode('הצגה באתר'));card.append(visible);
      const tools=document.createElement('div');tools.className='photo-tools';for(const [action,text] of [['up','↑ קודם'],['down','↓ הבא'],['remove','הסרה']]){const b=document.createElement('button');b.type='button';b.textContent=text;if(action==='remove')b.className='danger';b.disabled=action==='up'&&index===0||action==='down'&&index===doc.gallery.length-1;b.addEventListener('click',()=>{if(action==='remove'){if(!confirm('להסיר את התמונה מהגלריה? השינוי ייכנס לתוקף רק בפרסום.'))return;doc.gallery.splice(index,1);}else{const next=index+(action==='up'?-1:1);[doc.gallery[index],doc.gallery[next]]=[doc.gallery[next],doc.gallery[index]];}changed();renderGallery();status();});tools.append(b);}card.append(tools);p.append(card);
    });$('photo-count').textContent=doc.gallery.filter(x=>x.visible).length;
  }
  async function uploadImage(file){
    if(!authorized)throw Error('Sign in first.');if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('בחרו JPG, PNG או WEBP בגודל עד 10 MB.');
    const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>60000000){bitmap.close();throw Error('התמונה גדולה מדי. בחרו תמונה קטנה יותר.');}
    const ratio=Math.min(1,2000/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.86));if(!blob||blob.size>4*1024*1024)throw Error('התמונה גדולה מדי גם לאחר דחיסה.');
    const extension=blob.type==='image/png'?'png':blob.type==='image/jpeg'?'jpg':'webp';const path=user.id+'/'+crypto.randomUUID()+'.'+extension;check(await client.storage.from('wagi-media').upload(path,blob,{contentType:blob.type,upsert:false}));return client.storage.from('wagi-media').getPublicUrl(path).data.publicUrl;
  }
  async function save(){
    if(!authorized)throw Error('Sign in first.');WagiCMSShared.validate(doc);
    const next=revision+1,payload={id:'main',content:doc,revision:next,updated_at:new Date().toISOString()};
    const result=revision?await client.from('wagi_drafts').update(payload).eq('id','main').eq('revision',revision).select('revision'):await client.from('wagi_drafts').insert(payload).select('revision');
    const rows=check(result);if(!rows.length)throw Error('הטיוטה עודכנה במכשיר אחר. ייצאו גיבוי מהדפדפן לפני רענון ונסו שוב. כדי לא לדרוס עבודה, השמירה נעצרה.');revision=rows[0].revision;dirty=false;status();
  }
  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.jump)));
  document.querySelectorAll('[data-find-text]').forEach(button=>button.addEventListener('click',()=>{$('text-search').value=button.dataset.findText;renderTexts();}));
  $('toggle-groups').addEventListener('click',()=>{groupsCollapsed=!groupsCollapsed;$('toggle-groups').textContent=groupsCollapsed?'פתיחת כל הסעיפים':'צמצום כל הסעיפים';renderTexts();});
  $('edit-language').addEventListener('change',()=>{editLang=$('edit-language').value;renderTexts();});$('text-search').addEventListener('input',()=>{if(doc)renderTexts();});
  $('login-form').addEventListener('submit',e=>{e.preventDefault();task(async()=>{if(!client)throw Error('לא ניתן לטעון את מערכת הכניסה. רעננו את הדף.');check(await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}));$('password').value='';try{await load();}catch(error){throw Error(setupError(error));}});});
  $('logout').addEventListener('click',()=>{if(dirty&&!confirm('יש שינויים שלא נשמרו. לצאת?'))return;task(async()=>{check(await client.auth.signOut());lock();feedback('יצאתם מהחשבון.');});});
  $('export-backup').addEventListener('click',()=>{if(!doc)return;const url=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='wagi-content-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('save').addEventListener('click',()=>task(async()=>{await save();feedback('הטיוטה נשמרה בענן. האתר הציבורי לא השתנה.');}));
  $('preview').addEventListener('click',()=>{try{WagiCMSShared.validate(doc);sessionStorage.setItem('wagi-preview',JSON.stringify(doc));window.open('index.html?preview=draft','_blank');}catch(e){feedback(e.message,true);}});
  $('publish').addEventListener('click',()=>{try{WagiCMSShared.validate(doc);$('publish-dialog').showModal();}catch(e){feedback(e.message,true);}});$('cancel-publish').addEventListener('click',()=>$('publish-dialog').close());
  $('confirm-publish').addEventListener('click',()=>{$('publish-dialog').close();task(async()=>{await save();const result=check(await client.rpc('wagi_publish',{expected_revision:revision}));publishedAt=result.published_at;status();feedback('השינויים פורסמו באתר בהצלחה. افتح الموقع وحدّث الصفحة لمشاهدة التغييرات.');});});
  $('gallery-files').addEventListener('change',()=>{const files=[...$('gallery-files').files];task(async()=>{if(doc.gallery.length+files.length>200)throw Error('ניתן לשמור עד 200 תמונות.');let count=0;try{for(const file of files){feedback('מעלה תמונה '+(count+1)+' / '+files.length+'…');const src=await uploadImage(file);doc.gallery.push({id:crypto.randomUUID(),src,category:'pipes',caption:{he:'',ar:'',en:''},visible:true});count++;changed();}}finally{renderGallery();$('gallery-files').value='';}feedback('הועלו '+count+' תמונות. שמרו טיוטה ופרסמו כשאתם מוכנים.');});});
  $('password-form').addEventListener('submit',e=>{e.preventDefault();task(async()=>{const password=$('new-password').value;if(password!==$('confirm-password').value)throw Error('הסיסמאות אינן תואמות.');check(await client.auth.updateUser({password}));e.target.reset();feedback('הסיסמה עודכנה בהצלחה.');});});
  window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
  try{
    if(!window.supabase)throw Error('לא ניתן לטעון את מערכת הכניסה. בדקו את החיבור ורעננו.');client=supabase.createClient(WAGI_CMS.url,WAGI_CMS.key,{auth:{storageKey:'wagi-cms-'+new URL(WAGI_CMS.url).hostname.split('.')[0],persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')lock();});task(async()=>{try{await load();}catch(e){feedback(setupError(e),true);}});
  }catch(e){feedback(e.message,true);}
})();
