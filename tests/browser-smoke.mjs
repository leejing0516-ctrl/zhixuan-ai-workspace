// Optional real-browser smoke test. Uses ONLY a fresh isolated Chrome CDP profile.
// Start static server on 127.0.0.1:8765 and isolated Chrome on CDP port 9224.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const targets=await (await fetch('http://127.0.0.1:9224/json/list')).json();
const target=targets.find(t=>t.type==='page');assert.ok(target,'isolated Chrome page required');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let seq=0;const pending=new Map(),errors=[],driveRequests=[];
ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);else if(m.method==='Network.requestWillBeSent'&&m.params.request.url.includes('www.googleapis.com/drive/'))driveRequests.push(m.params.request.url);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));return result.result.value;};
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.navigate',{url:'http://127.0.0.1:8765/'});
 for(let i=0;i<50;i++){if(await evaluate("document.getElementById('setup')?.open===true"))break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(await evaluate("document.getElementById('setup').open"),true);
 assert.deepEqual(await evaluate("['docs','other','backup-count','folders'].map(id=>document.getElementById(id).textContent)"),['—','—','—','—']);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 await evaluate("document.getElementById('client-id').value='secret';document.getElementById('root-id').value='synthetic_root_123456789';document.getElementById('setup-form').requestSubmit()");
 assert.ok(await evaluate("document.getElementById('setup-error').textContent.length>0"));
 await evaluate("document.getElementById('client-id').value='123456789-synthetic.apps.googleusercontent.com';document.getElementById('setup-form').requestSubmit()");
 assert.equal(await evaluate("document.getElementById('setup').open"),false);
 assert.equal(await evaluate("document.getElementById('refresh').disabled"),true);
 await evaluate("document.getElementById('configure').click()");
 const screenshot=await send('Page.captureScreenshot',{format:'png'});
 await writeFile(new URL('../.browser-profile/signed-out-mobile.png',import.meta.url),Buffer.from(screenshot.data,'base64'));
 await evaluate("document.getElementById('cancel-setup').click()");
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 assert.equal(await evaluate("getComputedStyle(document.querySelector('.workspace')).gridTemplateColumns.split(' ').length"),2);
 assert.equal(driveRequests.length,0);assert.deepEqual(errors,[]);
 await evaluate("document.getElementById('configure').click();document.getElementById('forget').click()");
 assert.equal(await evaluate('localStorage.length'),0);
 console.log(JSON.stringify({mobile:'390×844 PASS',desktop:'1440×1000 PASS',configuration:'PASS',signedOutCounts:'PASS',driveRequests:driveRequests.length,runtimeErrors:errors.length,syntheticSettingsRemoved:true},null,2));
}finally{ws.close();}
