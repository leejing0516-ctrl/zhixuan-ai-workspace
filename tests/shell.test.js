import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
test('public shell is semantic, default-private, restrictive and mobile ready',async()=>{
 const html=await read('index.html'); const css=await read('styles.css');
 assert.match(html,/lang="zh-Hant"/);assert.match(html,/<dialog/);assert.match(html,/Content-Security-Policy/);
 assert.match(html,/阿軒 AI 工作站/);assert.match(html,/id="docs">—/);assert.match(html,/id="status"[^>]*role="status"/);
 assert.match(html,/https:\/\/accounts.google.com\/gsi\/client/);assert.doesNotMatch(html,/onclick=|style=|unsafe-inline|fonts.googleapis/);
 assert.match(css,/@media/);assert.match(css,/44px/);assert.match(css,/:focus-visible/);
});
