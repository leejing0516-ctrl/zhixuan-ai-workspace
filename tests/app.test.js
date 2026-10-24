import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {chromePath,openBrowser} from './browser-helper.mjs';
let browser;
before(async()=>{if(chromePath)browser=await openBrowser();});
after(async()=>{await browser?.close();});
const options={skip:!chromePath?'Set CHROME_PATH to run real-browser integration tests':false};
const evaluate=expression=>browser.evaluate(expression);
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,20));}assert.fail('Browser condition timed out: '+expression);}
const login=()=>evaluate(`(async()=>{document.getElementById('login').click();await oauthOptions.callback({access_token:'synthetic-token',scope:oauthOptions.scope,expires_in:3600});})()`);
const refresh=async()=>{await evaluate("document.getElementById('refresh').click()");await until("document.getElementById('refresh').disabled===false");};
// Every identifier, account and response is synthetic. Only GIS and network are mocked.
test('first use opens working configuration, saves only validated public settings and stays signed out',options,async()=>{
 assert.equal(await evaluate("document.getElementById('setup').open"),true);
 assert.match(await evaluate("document.getElementById('status').textContent"),/設定/);
 await evaluate("document.getElementById('client-id').value='secret';document.getElementById('root-id').value='synthetic_root_123456789';document.getElementById('setup-form').requestSubmit()");
 assert.equal(await evaluate('localStorage.length'),0);assert.ok(await evaluate("document.getElementById('setup-error').textContent.length"));
 await evaluate("document.getElementById('client-id').value='123456789-synthetic.apps.googleusercontent.com';document.getElementById('setup-form').requestSubmit()");
 assert.equal(await evaluate("document.getElementById('setup').open"),false);
 assert.deepEqual(await evaluate('JSON.parse(localStorage.getItem(localStorage.key(0)))'),{clientId:'123456789-synthetic.apps.googleusercontent.com',rootId:'synthetic_root_123456789'});
 assert.equal(await evaluate("document.getElementById('docs').textContent"),'—');assert.equal(await evaluate("document.getElementById('refresh').disabled"),true);
});
test('popup auth requests only metadata scope, rejects missing grant, then reads account and explicit manual snapshot',options,async()=>{
 await evaluate("document.getElementById('login').click()");
 assert.equal(await evaluate('oauthOptions.scope'),'https://www.googleapis.com/auth/drive.metadata.readonly');assert.equal(await evaluate('oauthOptions.include_granted_scopes'),false);
 await evaluate("oauthOptions.callback({access_token:'synthetic-denied',scope:''})");assert.equal(await evaluate('networkCalls.length'),0);
 await login();assert.equal(await evaluate('networkCalls.length'),1);assert.match(await evaluate("document.getElementById('account').textContent"),/Synthetic User/);
 assert.doesNotMatch(await evaluate("document.getElementById('result-note').textContent"),/尚未登入/,'signed-in empty state must not claim signed out');
 await refresh();assert.equal(await evaluate("document.getElementById('docs').textContent"),'0');assert.match(await evaluate("document.getElementById('scope').textContent"),/完整/);
 assert.match(await evaluate("document.getElementById('result-note').textContent"),/沒有可存取檔案/);
 await evaluate("document.getElementById('logout').click()");
 assert.equal(await evaluate("document.getElementById('docs').textContent"),'—');assert.equal(await evaluate("document.getElementById('content').children.length"),0);assert.equal(await evaluate("document.getElementById('account').textContent"),'');
 assert.equal(await evaluate('localStorage.length'),1);assert.equal(await evaluate("localStorage.getItem(localStorage.key(0)).includes('synthetic-token')"),false);
});
test('explore renders safe text links, actual categories, filtered backups and expandable tree',options,async()=>{
 await evaluate(`window.fetch=async url=>({ok:true,json:async()=>String(url).includes('/about?')?{user:{displayName:'Synthetic'}}:String(url).includes('/files/')?{id:'synthetic_root_123456789',name:'Root',mimeType:'application/vnd.google-apps.folder'}:new URL(url).searchParams.get('q').startsWith("'synthetic_root_123456789'")?{files:[{id:'synthetic_root_123456789folder',name:'A',mimeType:'application/vnd.google-apps.folder'}]}:{files:[{id:'synthetic_root_123456789doc',name:'<img onerror=evil>',mimeType:'application/vnd.google-apps.document',modifiedTime:'2026-01-01T00:00:00Z'},{id:'synthetic_root_123456789backup',name:'copy.md',mimeType:'text/plain'}]}})`);
 await login();await refresh();
 assert.equal(await evaluate("document.getElementById('content').children.length"),1);assert.equal(await evaluate("document.querySelector('#content a').textContent"),'<img onerror=evil>');assert.equal(await evaluate("document.querySelectorAll('#content img').length"),0);
 assert.equal(await evaluate("document.querySelector('#content a').rel"),'noopener noreferrer');assert.equal(await evaluate("document.getElementById('categories').children.length"),2);
 await evaluate("document.getElementById('backups').click()");assert.equal(await evaluate("document.getElementById('content').children.length"),2);
 await evaluate("document.getElementById('search').value='nothing';document.getElementById('search').dispatchEvent(new Event('input'))");assert.equal(await evaluate("document.getElementById('content').children.length"),0);assert.match(await evaluate("document.getElementById('result-note').textContent"),/沒有符合/);
 await evaluate("document.getElementById('search').value='';document.getElementById('search').dispatchEvent(new Event('input'));document.getElementById('tree-view').click()");assert.equal(await evaluate("document.querySelectorAll('#content details').length"),1);
 await browser.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate("document.querySelector('#content details').open=true");assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
});
test('category selection retains keyboard focus after rebuilding filters',options,async()=>{
 await evaluate("document.querySelectorAll('#categories button')[1].focus();document.querySelectorAll('#categories button')[1].click()");
 assert.match(await evaluate('document.activeElement.textContent'),/^A ·/);
});
test('pagehide clears rendered private state before browser history caching',options,async()=>{
 assert.match(await evaluate("document.getElementById('account').textContent"),/Synthetic/);
 await evaluate("window.dispatchEvent(new Event('pagehide'))");
 assert.equal(await evaluate("document.getElementById('account').textContent"),'');assert.equal(await evaluate("document.getElementById('content').children.length"),0);assert.equal(await evaluate("document.getElementById('docs').textContent"),'—');assert.deepEqual(browser.exceptions,[]);
});
test('Drive read failure keeps the valid login and exposes an actionable status for retry',options,async()=>{
 await evaluate("window.fetch=async url=>String(url).includes('/about?')?({ok:true,json:async()=>({user:{displayName:'Synthetic User'}})}):({ok:false,status:403})");
 await login();
 await evaluate("document.getElementById('refresh').click()");
 await until("!document.getElementById('refresh').disabled || !document.getElementById('login').hidden");
 assert.equal(await evaluate("document.getElementById('login').hidden"),true,'HTTP 403 is a read error, not proof that authentication expired');
 assert.match(await evaluate("document.getElementById('account').textContent"),/Synthetic/);
 assert.equal(await evaluate("document.getElementById('refresh').disabled"),false);
 assert.match(await evaluate("document.getElementById('status').textContent"),/403/);
 assert.doesNotMatch(await evaluate("document.getElementById('result-note').textContent"),/尚未登入/);
 await evaluate("document.getElementById('logout').click()");
});
test('Drive read HTTP 401 still clears private state and requires Google sign-in',options,async()=>{
 await evaluate("window.fetch=async url=>String(url).includes('/about?')?({ok:true,json:async()=>({user:{displayName:'Synthetic User'}})}):({ok:false,status:401})");
 await login();
 await evaluate("document.getElementById('refresh').click()");
 await until("document.getElementById('login').hidden===false");
 assert.equal(await evaluate("document.getElementById('account').textContent"),'');
 assert.equal(await evaluate("document.getElementById('docs').textContent"),'—');
 assert.equal(await evaluate("document.getElementById('refresh').disabled"),true);
 assert.match(await evaluate("document.getElementById('status').textContent"),/授權已失效/);
});
test('expired account token clears private state and presents explicit re-login status',options,async()=>{
 await evaluate("window.fetch=async()=>({ok:false,status:401})");await login();
 assert.match(await evaluate("document.getElementById('status').textContent"),/授權已失效/);
 assert.equal(await evaluate("document.getElementById('account').textContent"),'');assert.equal(await evaluate("document.getElementById('docs').textContent"),'—');assert.equal(await evaluate("document.getElementById('login').hidden"),false);
});
