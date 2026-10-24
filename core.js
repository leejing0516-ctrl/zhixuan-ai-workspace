export function metadataRequest(token,signal,fetcher=fetch){
 return async(path,params={})=>{
  if(!token||! /^(?:about|files(?:\/[A-Za-z0-9_-]{10,200})?)$/.test(path)||params.alt==='media') throw new Error('禁止的 API 請求。');
  const timeout=AbortSignal.timeout(20000);
  const combined=signal?AbortSignal.any([signal,timeout]):timeout;
  combined.throwIfAborted();
  const response=await fetcher(`https://www.googleapis.com/drive/v3/${path}?${new URLSearchParams(params)}`,{method:'GET',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',headers:{Authorization:`Bearer ${token}`},signal:combined});
  if(!response.ok){const error=new Error(`Google Drive 請求失敗（${response.status}）。`);error.status=response.status;throw error;}
  return response.json();
 };
}
export function createSession(){
 let token=null,generation=0,controller=new AbortController();
 return {
  get token(){return token;},
  clear(){token=null;generation++;controller.abort();controller=new AbortController();},
  start(value){this.clear();token=value;return {generation,signal:controller.signal};},
  current(ticket){return Boolean(token)&&ticket.generation===generation&&!ticket.signal.aborted;}
 };
}
export async function scanDrive(request,rootId,{signal,maxFiles=10000,maxFolders=1000,maxPages=500}={}){
 signal?.throwIfAborted();
 let complete=true,pages=0;
 const root=await request(`files/${rootId}`,{fields:'id,name,mimeType',supportsAllDrives:'true'});
 if(root.mimeType!==FOLDER) throw new Error('選定項目不是資料夾。');
 const folders=[],files=[],queue=[{...root,path:'',category:''}],seen=new Set([rootId]);
 scan: while(queue.length){
  const parent=queue.shift(); let pageToken;
  do{
   signal?.throwIfAborted();
   if(++pages>maxPages){complete=false;break scan;}
   const page=await request('files',{q:`'${parent.id}' in parents and trashed = false`,pageSize:'1000',fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,modifiedTime)',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(pageToken?{pageToken}:{})});
   signal?.throwIfAborted();
   if(page.incompleteSearch)complete=false;
   for(const f of page.files||[]){
    if(seen.has(f.id))continue; seen.add(f.id);
    const item={...f,parentId:parent.id,path:parent.path?`${parent.path}/${f.name}`:f.name,category:parent.category||(f.mimeType===FOLDER?f.name:'根目錄檔案')};
    if(f.mimeType===FOLDER){
     if(folders.length>=maxFolders){complete=false;break scan;}
     folders.push(item);queue.push(item);
    }else{
     if(files.length>=maxFiles){complete=false;break scan;}
     files.push(item);
    }
   }
   pageToken=page.nextPageToken;
  }while(pageToken);
 }
 return {root,folders,files,complete,at:new Date().toISOString()};
}
export const isBackup=f=>/\.md$/i.test(f.name);
export function summarize(files){
 const result={docs:0,other:0,backups:0,categories:[]}, cats=new Map();
 for(const f of files){
  const backup=isBackup(f); result[backup?'backups':f.mimeType==='application/vnd.google-apps.document'?'docs':'other']++;
  if(!cats.has(f.category)) cats.set(f.category,{name:f.category,files:0,backups:0});
  cats.get(f.category)[backup?'backups':'files']++;
 }
 result.categories=[...cats.values()].sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant')); return result;
}
export function selectFiles(files,{query='',category='',backups=false}={}){
 const q=query.trim().toLocaleLowerCase();
 return files.filter(f=>(backups||!isBackup(f))&&(!category||f.category===category)&&(!q||`${f.name} ${f.path}`.toLocaleLowerCase().includes(q)));
}
export function driveURL(file){
 if(!ID.test(file.id)) return null;
 return file.mimeType===FOLDER ? `https://drive.google.com/drive/folders/${file.id}` : `https://drive.google.com/file/d/${file.id}/view`;
}
export const FOLDER='application/vnd.google-apps.folder';
const ID=/^[A-Za-z0-9_-]{10,200}$/;
export function parseConfig(clientId, folder){
 clientId=clientId.trim(); folder=folder.trim();
 if(!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId)) throw new Error('請輸入 Web 應用程式的公開用戶端 ID。');
 let rootId=folder;
 if(!ID.test(rootId)){
  let u; try{u=new URL(folder);}catch{throw new Error('資料夾 ID 或網址格式不正確。');}
  const m=u.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,200})\/?$/);
  if(u.origin!=='https://drive.google.com'||u.username||u.password||u.hash||!m||[...u.searchParams.keys()].some(k=>!['usp','resourcekey'].includes(k))) throw new Error('只接受官方 Google Drive 資料夾網址。');
  rootId=m[1];
 }
 return {clientId,rootId};
}
