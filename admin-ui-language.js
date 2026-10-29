/* Interface translations only. Never reads or changes iframe/site content. */
(()=>{'use strict';
 const dictionary=window.ADMIN_UI_TRANSLATIONS||{},locales=['ar','en','he'];
 const storageKey=document.documentElement.dataset.adminUiKey||'visual-admin-ui-language';let language='ar';
 try{const value=localStorage.getItem(storageKey);if(locales.includes(value))language=value;}catch{}
 let observer=null;const observeOptions={childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','alt']};
 const originals=new WeakMap(),attributeOriginals=new WeakMap(),keys=Object.keys(dictionary).sort((a,b)=>b.length-a.length),originalTitle=document.title;
 function translate(text,target=language){if(target==='ar'||typeof text!=='string')return text;const trimmed=text.trim();if(dictionary[trimmed])return text.replace(trimmed,dictionary[trimmed][target]);
  // Dynamic notices contain counters, selected content-language names or bounds.
  let result=text;for(const key of keys)if(result.includes(key))result=result.split(key).join(dictionary[key][target]);
  if(result!==text){result=result.replace(/(\d+) و (\d+)/g,target==='en'?'$1 and $2':'$1 עד $2');}return result;
 }
 window.AdminUI={t:translate,getLanguage:()=>language,setLanguage};
 const bar=document.createElement('div');bar.className='admin-ui-languagebar';bar.setAttribute('data-ui-languagebar','');
 const label=document.createElement('label');label.htmlFor='admin-ui-language';const labelText=document.createElement('span');labelText.textContent='لغة اللوحة';
 const picker=document.createElement('select');picker.id='admin-ui-language';picker.setAttribute('aria-label','Panel language / لغة اللوحة / שפת הממשק');
 for(const [value,text]of [['ar','العربية'],['he','עברית'],['en','English']]){const option=document.createElement('option');option.value=value;option.textContent=text;picker.append(option);}picker.value=language;label.append(labelText,picker);
 const note=document.createElement('span');note.className='admin-ui-language-note';note.textContent='لغة اللوحة مستقلة عن لغة محتوى الموقع.';bar.append(label,note);document.body.prepend(bar);
 const style=document.createElement('style');style.textContent='.admin-ui-languagebar{min-height:48px;padding:7px 22px;display:flex;gap:18px;align-items:center;justify-content:space-between;background:var(--paper,#f3f3ed);color:var(--ink,#10282e);border-bottom:1px solid var(--line,#d8ded6);font-family:inherit}.admin-ui-languagebar label{display:flex;align-items:center;gap:10px;margin:0;font-size:12px}.admin-ui-languagebar select{width:130px;padding:5px 9px;margin:0;font:inherit;background:#fff;color:#10282e;border:1px solid #c5cec5;border-radius:5px}.admin-ui-language-note{font-size:11px;opacity:.75}html[dir=ltr] .workspace{direction:ltr}html[dir=ltr] .edit-panel{border-left:0;border-right:1px solid var(--line)}html[dir=ltr] .login-shell,html[dir=ltr] .builder-panel{direction:ltr}#v-workspace{height:calc(100dvh - 184px)}@media(max-width:1000px){#v-workspace{height:calc(100dvh - 213px)}.admin-ui-languagebar{padding-inline:12px}}@media(max-width:600px){.admin-ui-languagebar{gap:8px}.admin-ui-language-note{max-width:46%;font-size:9px}}';document.head.append(style);
 function skip(el){return !el||el.closest('script,style,textarea,[contenteditable],.b-layers,.field-key,#v-language option,#admin-ui-language,.toolbar-brand strong,.login-brand span');}
 function apply(){observer?.disconnect();document.documentElement.lang=language;document.documentElement.dir=language==='en'?'ltr':'rtl';picker.value=language;if(picker.getAttribute('aria-label')!==translate('لغة اللوحة'))picker.setAttribute('aria-label',translate('لغة اللوحة'));document.title=translate(originalTitle);
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode;if(skip(node.parentElement)||!node.nodeValue.trim())continue;let saved=originals.get(node);if(!saved||node.nodeValue!==saved.last)saved={source:node.nodeValue,last:node.nodeValue};const text=translate(saved.source);if(node.nodeValue!==text)node.nodeValue=text;saved.last=text;originals.set(node,saved);}
  for(const el of document.querySelectorAll('[title],[aria-label],[placeholder],[alt]')){if(skip(el))continue;let saved=attributeOriginals.get(el);if(!saved){saved={};attributeOriginals.set(el,saved);}for(const attr of ['title','aria-label','placeholder','alt']){if(!el.hasAttribute(attr))continue;const value=el.getAttribute(attr);let item=saved[attr];if(!item||value!==item.last)item={source:value,last:value};const text=translate(item.source);if(value!==text)el.setAttribute(attr,text);item.last=text;saved[attr]=item;}}
  observer?.observe(document.body,observeOptions);
 }
 function setLanguage(value){if(!locales.includes(value))return;language=value;try{localStorage.setItem(storageKey,value);}catch{}apply();window.dispatchEvent(new CustomEvent('admin-ui-language-changed',{detail:{language}}));}
 picker.addEventListener('change',()=>setLanguage(picker.value));let scheduled=false;observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;apply();},16);});apply();
})();
