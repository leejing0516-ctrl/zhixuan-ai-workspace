// Real Chromium DOM integration harness; no npm dependency and no user browser profile.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url));
export const chromePath=process.env.CHROME_PATH||['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/chromium','/usr/bin/google-chrome'].find(existsSync);
export async function openBrowser({seedConfig}={}){
 const base=join(project,'.browser-profile');await mkdir(base,{recursive:true});const profile=await mkdtemp(join(base,'integration-'));
 const server=createServer(async(req,res)=>{
  const name=req.url==='/'?'index.html':req.url.slice(1).split('?')[0];
  if(!['index.html','app.js','core.js','styles.css'].includes(name)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(await readFile(join(project,name)));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const child=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','about:blank'],{stdio:'ignore'});
 let ws;const pending=new Map();let seq=0;
 async function close(){
  ws?.close();child.kill();await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,1500))]);
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
 try{
  let port;
  for(let i=0;i<150;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
  if(!port)throw new Error('Isolated Chrome CDP startup timed out');
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  const exceptions=[];
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);if(!p)return;pending.delete(message.id);message.error?p.reject(new Error(message.error.message)):p.resolve(message.result);}else if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(JSON.stringify(response.exceptionDetails));return response.result.value;};
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  // The only mocked components: Google GIS and Google network responses.
  await send('Network.setBlockedURLs',{urls:['https://accounts.google.com/*']});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`
   ${seedConfig?`localStorage.setItem('zhixuan-workspace.public-config.v1', ${JSON.stringify(JSON.stringify(seedConfig))});`:''}
   window.google={accounts:{oauth2:{initTokenClient(options){window.oauthOptions=options;return {requestAccessToken(overrideConfig){window.tokenRequests=(window.tokenRequests||[]);window.tokenRequests.push(overrideConfig);}};},hasGrantedAllScopes(response,scope){return response.scope===scope;}}}};
   window.networkCalls=[];
   window.fetch=async(url,options)=>{window.networkCalls.push({url,options});return {ok:true,json:async()=>String(url).includes('/about?')?{user:{displayName:'Synthetic User',emailAddress:'synthetic@example.invalid'}}:String(url).includes('/files/')?{id:'synthetic_root_123456789',name:'Synthetic root',mimeType:'application/vnd.google-apps.folder'}:{files:[]}};};
  `});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
  for(let i=0;i<100;i++){if(await evaluate("document.getElementById('setup')?.open===true"))break;await new Promise(resolve=>setTimeout(resolve,50));}
  return {send,evaluate,exceptions,close};
 }catch(error){await close();throw error;}
}
