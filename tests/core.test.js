import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.js';
test('safe links ignore server URLs and reject unsafe IDs',()=>{
 assert.equal(core.driveURL({id:ROOT,mimeType:core.FOLDER,webViewLink:'javascript:alert(1)'}),`https://drive.google.com/drive/folders/${ROOT}`);
 assert.equal(core.driveURL({id:'../evil',mimeType:'text/plain'}),null);
 assert.equal(core.driveURL({id:ROOT,mimeType:'text/plain'}),`https://drive.google.com/file/d/${ROOT}/view`);
});
test('classification keeps Markdown backups separate and counts descendant category files',()=>{
 const files=[{id:ROOT+'a',name:'paper',mimeType:'application/vnd.google-apps.document',category:'A',path:'A/sub/paper'},{id:ROOT+'b',name:'paper.MD',mimeType:'text/plain',category:'A',path:'A/paper.MD'},{id:ROOT+'c',name:'link',mimeType:'application/vnd.google-apps.shortcut',category:'B',path:'B/link'}];
 const result=core.summarize(files);
 assert.deepEqual(result,{docs:1,other:1,backups:1,categories:[{name:'A',files:1,backups:1},{name:'B',files:1,backups:0}]});
 assert.equal(core.selectFiles(files,{query:'sub',category:'A',backups:false}).length,1);
 assert.equal(core.selectFiles(files,{query:'',category:'A',backups:false}).length,1);
});
test('scan pages only descendants, verifies root and never follows shortcuts',async()=>{
 const calls=[];
 const request=async(path,params)=>{calls.push([path,params]); if(path===`files/${ROOT}`)return {id:ROOT,name:'Root',mimeType:core.FOLDER};
 const child=params.q.startsWith(`'${ROOT}'`);
 if(child&&!params.pageToken)return {files:[{id:ROOT+'folder',name:'A',mimeType:core.FOLDER}],nextPageToken:'page2'};
 if(child)return {files:[{id:ROOT+'shortcut',name:'Shortcut',mimeType:'application/vnd.google-apps.shortcut'}]};
 return {files:[{id:ROOT+'doc',name:'Doc',mimeType:'application/vnd.google-apps.document'}]};};
 const result=await core.scanDrive(request,ROOT,{signal:new AbortController().signal});
 assert.equal(result.complete,true); assert.equal(result.folders.length,1); assert.equal(result.files.length,2);
 assert.equal(result.files.find(f=>f.name==='Doc').category,'A');
 assert.equal(calls.length,4); assert.ok(calls.slice(1).every(([,p])=>p.q.endsWith('and trashed = false')));
 await assert.rejects(core.scanDrive(async()=>({mimeType:'text/plain'}),ROOT),/資料夾/);
});
test('bounded scans distinguish partial results and stop aborted work',async()=>{
 let pages=0;
 const request=async path=>path.startsWith('files/')?{id:ROOT,name:'Root',mimeType:core.FOLDER}:++pages===1?{files:Array.from({length:4},(_,i)=>({id:ROOT+i,name:'file'+i,mimeType:'text/plain'})),nextPageToken:'again'}:{files:[]};
 const result=await core.scanDrive(request,ROOT,{maxFiles:2});
 assert.equal(result.complete,false);assert.equal(result.files.length,2);
 const c=new AbortController();c.abort();let calls=0;
 await assert.rejects(core.scanDrive(async()=>{calls++;return {};},ROOT,{signal:c.signal}),{name:'AbortError'});assert.equal(calls,0);
 const partial=await core.scanDrive(async path=>path.startsWith('files/')?{id:ROOT,mimeType:core.FOLDER}:{files:[],incompleteSearch:true},ROOT);
 assert.equal(partial.complete,false);
});
test('session clears token, aborts prior requests and rejects stale generations',()=>{
 const session=core.createSession(); const first=session.start('synthetic-token');
 assert.equal(session.token,'synthetic-token'); assert.equal(session.current(first),true);
 session.clear(); assert.equal(session.token,null); assert.equal(first.signal.aborted,true); assert.equal(session.current(first),false);
 const second=session.start('synthetic-new'); assert.equal(session.current(second),true);session.clear();
});
test('metadata transport is read-only, no-store, authorized and abortable; HTTP errors never expose body',async()=>{
 let observed;
 const request=core.metadataRequest('synthetic-token',new AbortController().signal,async(url,options)=>{observed={url,options};return {ok:true,json:async()=>({files:[]})};});
 await request('files',{q:'synthetic'});
 assert.equal(observed.options.cache,'no-store');assert.equal(observed.options.method,'GET'); assert.equal(observed.options.headers.Authorization,'Bearer synthetic-token');
 assert.ok(observed.url.startsWith('https://www.googleapis.com/drive/v3/files?')); assert.ok(observed.options.signal);
 await assert.rejects(request('../evil',{}));
 const denied=core.metadataRequest('synthetic-token',undefined,async()=>({ok:false,status:401}));
 await assert.rejects(denied('about',{fields:'user(displayName,emailAddress)'}),e=>e.status===401&&!e.message.includes('token'));
});
// All identifiers and names in tests are synthetic, never real Google data.
const ROOT='synthetic_root_123456789';
const CLIENT='123456789-synthetic.apps.googleusercontent.com';
test('configuration accepts only strict public web client shape and official folder URL',()=>{
 assert.deepEqual(core.parseConfig(CLIENT,`https://drive.google.com/drive/u/0/folders/${ROOT}?usp=sharing`),{clientId:CLIENT,rootId:ROOT});
 for(const folder of ['https://evil.test/drive/folders/'+ROOT,'https://drive.google.com.evil.test/drive/folders/'+ROOT,'x',ROOT+"'",'https://drive.google.com/drive/folders/'+ROOT+'#bad']) assert.throws(()=>core.parseConfig(CLIENT,folder));
 assert.throws(()=>core.parseConfig('secret',ROOT));
});
