import {parseConfig,createSession,metadataRequest,scanDrive,summarize,selectFiles,driveURL} from './core.js';
const $=id=>document.getElementById(id);
const KEY='zhixuan-workspace.public-config.v1';
const session=createSession();
let config=null, snapshot=null, account=null, authGeneration=0, expiry=null, category='', view='list';
function clearPrivate(message='尚未登入；私人資料不會顯示。'){
 authGeneration++; clearTimeout(expiry);session.clear();snapshot=null;account=null;category='';
 $('search').value='';$('backups').checked=false;
 for(const id of ['docs','other','backup-count','folders'])$(id).textContent='—';
 for(const id of ['refresh','search','backups'])$(id).disabled=true;
 $('content').replaceChildren();$('categories').replaceChildren();$('account').textContent='';
 $('scope').textContent='範圍：尚未讀取。';$('result-note').textContent='尚未登入，無可顯示的私人項目。';
 $('login').hidden=false;$('login').disabled=false;$('logout').hidden=true;$('status').textContent=message;
}
function openSetup(){
 $('client-id').value=config?.clientId||'';$('root-id').value=config?.rootId||'';$('setup-error').textContent='';
 if(!$('setup').open)$('setup').showModal();
}
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved)config=parseConfig(saved.clientId,saved.rootId);}catch{config=null;}
$('configure').addEventListener('click',openSetup);
$('cancel-setup').addEventListener('click',()=>$('setup').close());
$('setup-form').addEventListener('submit',event=>{
 event.preventDefault();
 try{
  const next=parseConfig($('client-id').value,$('root-id').value);
  clearPrivate();config=null;
  localStorage.setItem(KEY,JSON.stringify(next));config=next;$('setup').close();$('status').textContent='設定已儲存。請使用 Google 登入；尚未讀取私人資料。';
 }catch(error){$('setup-error').textContent=error.message;}
});
$('forget').addEventListener('click',()=>{
 clearPrivate('設定已清除，請重新設定。');config=null;
 try{localStorage.removeItem(KEY);}catch{$('setup-error').textContent='無法清除瀏覽器設定，請從瀏覽器網站資料手動刪除。';return;}
 openSetup();
});
const SCOPE='https://www.googleapis.com/auth/drive.metadata.readonly';
function node(tag,text,className){
 const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;
}
function link(file,text=file.name){
 const href=driveURL(file);if(!href)return node('span',text);
 const el=node('a',text);el.href=href;el.target='_blank';el.rel='noopener noreferrer';return el;
}
function fileRow(file){
 const row=node('article',undefined,'file');row.append(link(file),node('small',`${file.path} · ${file.modifiedTime?new Date(file.modifiedTime).toLocaleDateString('zh-TW'):'無修改時間'}`));return row;
}
function renderExplore(){
 if(!snapshot)return;
 const counts=summarize(snapshot.files),names=[...new Set([...snapshot.folders.filter(f=>f.parentId===snapshot.root.id).map(f=>f.name),...counts.categories.map(c=>c.name)])].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
 $('categories').replaceChildren();
 const addCategory=(name,label)=>{
  const button=node('button',label);button.classList.toggle('active',category===name);button.setAttribute('aria-pressed',String(category===name));
  button.addEventListener('click',()=>{category=name;renderExplore();$('categories').querySelector('button[aria-pressed="true"]')?.focus();});$('categories').append(button);
 };
 addCategory('','全部分類');
 for(const name of names){const count=counts.categories.find(c=>c.name===name)||{files:0,backups:0};addCategory(name,`${name} · ${count.files} 檔案 / ${count.backups} 備份`);}
 const filtered=selectFiles(snapshot.files,{query:$('search').value,category,backups:$('backups').checked});
 $('content').replaceChildren();$('results-title').textContent=view==='tree'?'樹狀地圖':'近期檔案';
 $('result-note').textContent=filtered.length?`符合 ${filtered.length} 個檔案${snapshot.complete?'':'（僅已掃描部分）'}。`:snapshot.files.length?'沒有符合條件的檔案。':snapshot.complete?'此範圍沒有可存取檔案。':'掃描未完整；目前尚未讀到檔案，不能判定為空。';
 $('list-view').setAttribute('aria-pressed',String(view==='list'));$('tree-view').setAttribute('aria-pressed',String(view==='tree'));
 if(view==='list'){
  for(const file of [...filtered].sort((a,b)=>(b.modifiedTime||'').localeCompare(a.modifiedTime||'')||a.name.localeCompare(b.name,'zh-Hant')).slice(0,100))$('content').append(fileRow(file));
  if(filtered.length>100)$('result-note').textContent+=' 近期清單僅顯示前 100 筆；可搜尋縮小範圍或切換樹狀地圖。';
 }else{
  const rootLink=link(snapshot.root,'在 Drive 開啟根資料夾');rootLink.className='tree-root';$('content').append(rootLink);
  const containers=new Map([[snapshot.root.id,$('content')]]),visible=new Set();
  const folderById=new Map(snapshot.folders.map(f=>[f.id,f]));
  for(const file of filtered){let id=file.parentId;while(folderById.has(id)&&!visible.has(id)){visible.add(id);id=folderById.get(id).parentId;}}
  const query=$('search').value.trim().toLocaleLowerCase();
  for(const f of snapshot.folders){
   if(category&&f.category!==category)continue;
   if(query&&!visible.has(f.id)&&!f.path.toLocaleLowerCase().includes(query))continue;
   const parent=containers.get(f.parentId);if(!parent)continue;
   const details=node('details');const summary=node('summary',f.name);const open=link(f,'在 Drive 開啟此資料夾');open.className='tree-folder-link';
   const children=node('div',undefined,'tree-children');details.append(summary,open,children);parent.append(details);containers.set(f.id,children);
  }
  for(const file of filtered)containers.get(file.parentId)?.append(fileRow(file));
 }
}
for(const id of ['search','backups'])$(id).addEventListener(id==='search'?'input':'change',renderExplore);
$('list-view').addEventListener('click',()=>{view='list';renderExplore();});
$('tree-view').addEventListener('click',()=>{view='tree';renderExplore();});
function renderSnapshot(){
 renderExplore();
 const counts=summarize(snapshot.files);
 $('docs').textContent=String(counts.docs);$('other').textContent=String(counts.other);$('backup-count').textContent=String(counts.backups);$('folders').textContent=String(snapshot.folders.length);
 $('scope').textContent=`範圍：${snapshot.root.name} 與可存取子項目｜${snapshot.complete?'完整掃描':'未完整掃描（達上限或 Google 回傳不完整結果）'}｜快照 ${new Date(snapshot.at).toLocaleString('zh-TW')}`;
}
$('login').addEventListener('click',()=>{
 if(!config){openSetup();return;}
 clearPrivate('正在等待 Google 授權…');
 const gis=globalThis.google?.accounts?.oauth2;
 if(!gis){$('status').textContent='Google 登入元件尚未載入或被阻擋，請稍後重試。';return;}
 const attempt=authGeneration;
 $('login').disabled=true;$('logout').hidden=false;
 try{
  const client=gis.initTokenClient({client_id:config.clientId,scope:SCOPE,include_granted_scopes:false,
   callback:async response=>{
    if(attempt!==authGeneration)return;
    if(response.error||!response.access_token||!gis.hasGrantedAllScopes(response,SCOPE)){clearPrivate('未取得所需的中繼資料唯讀授權，請重新登入。');return;}
    const ticket=session.start(response.access_token);
    const seconds=Number(response.expires_in);
    if(!Number.isFinite(seconds)||seconds<=0){clearPrivate('授權有效期限不正確，請重新登入。');return;}
    expiry=setTimeout(()=>clearPrivate('授權已到期，私人內容已清除。請重新登入。'),Math.min(seconds*1000,2147483647));
    try{
     const data=await metadataRequest(session.token,ticket.signal)('about',{fields:'user(displayName,emailAddress)'});
     if(!session.current(ticket))return;
     account=data.user;$('account').textContent=`${account?.displayName||'Google 帳戶'}${account?.emailAddress?' · '+account.emailAddress:''}`;
     $('login').hidden=true;$('logout').hidden=false;$('refresh').disabled=false;
     $('status').textContent='已登入。按「即時重新整理」讀取所選範圍。';
    }catch(error){if(session.current(ticket))clearPrivate(error.status===401?'授權已失效。私人內容已清除，請重新登入。':'無法確認 Google 帳戶。請重新登入，並檢查 API 與權限設定。');}
   },error_callback:()=>{if(attempt===authGeneration)clearPrivate('登入視窗已關閉或遭阻擋，請重試。');}});
  client.requestAccessToken({prompt:'select_account'});
 }catch{clearPrivate('無法啟動 Google 登入，請檢查 Web 用戶端與授權來源。');}
});
$('refresh').addEventListener('click',async()=>{
 if(!session.token||!config)return;
 const ticket=session.start(session.token);
 snapshot=null;$('content').replaceChildren();$('categories').replaceChildren();
 for(const id of ['docs','other','backup-count','folders'])$(id).textContent='—';
 for(const id of ['refresh','search','backups'])$(id).disabled=true;
 $('scope').textContent='正在掃描選定範圍…';$('result-note').textContent='讀取中…';$('status').textContent='正在即時讀取 Google Drive 中繼資料…';
 try{
  const result=await scanDrive(metadataRequest(session.token,ticket.signal),config.rootId,{signal:ticket.signal});
  if(!session.current(ticket))return;
  snapshot=result;renderSnapshot();
  for(const id of ['refresh','search','backups'])$(id).disabled=false;
  $('status').textContent=result.complete?'本次讀取完成。資料只保留在本頁記憶體。':'掃描未完整，數量僅為已讀取項目，不代表全部資料。';
 }catch(error){
  if(session.current(ticket))clearPrivate(error.status===401?'授權已失效。私人內容已清除，請重新登入。':'讀取失敗（權限、網路或逾時）。私人內容已清除，請重新登入。');
 }
});
window.addEventListener('pagehide',()=>clearPrivate());
$('logout').addEventListener('click',()=>clearPrivate());
clearPrivate(config?'尚未登入；請登入並授權後讀取私人資料。':'需要初次設定：請填入 Web 公開用戶端 ID 與私人根資料夾。');
if(!config)openSetup();
