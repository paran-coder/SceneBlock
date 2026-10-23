import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),dist=path.join(root,'dist');
const output=path.join(root,'2026-10-23-manual-verification');fs.mkdirSync(output,{recursive:true});
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');const file=path.resolve(dist,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end()}for(const h of config.headers[0].headers)res.setHeader(h.key,h.value);res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm'})[path.extname(file)]??'application/octet-stream');fs.createReadStream(file).pipe(res)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#userManual').waitFor();
 await page.locator('#scenePrompt').fill('매뉴얼을 열어도 유지할 장면 설명');
 assert.equal(await page.locator('#userManual').evaluate(e=>e.previousElementSibling.textContent),'v2.8.1');
 const popup=context.waitForEvent('page');await page.locator('#userManual').click();const manual=await popup;await manual.waitForLoadState();
 assert.match(await manual.title(),/사용자 매뉴얼/);assert.equal(await page.locator('#scenePrompt').inputValue(),'매뉴얼을 열어도 유지할 장면 설명');checks.push('version-adjacent link opens a new tab and preserves editor input');
 await manual.locator('nav a[href="#ai"]').click();assert.equal(new URL(manual.url()).hash,'#ai');
 assert.equal(await manual.locator('a[href^="#"]').evaluateAll(links=>links.filter(a=>!document.getElementById(a.hash.slice(1))).length),0);checks.push('all table-of-contents and shortcut anchors resolve');
 await manual.locator('a[href="#ai-generate"]').first().click();await manual.locator('#ai-generate').scrollIntoViewIfNeeded();await manual.screenshot({path:path.join(output,'2026-10-23-manual-ai.png')});
 for(const width of [1440,768,390]){await manual.setViewportSize({width,height:900});assert.ok(await manual.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`)}
 await manual.evaluate(()=>scrollTo(0,0));await manual.screenshot({path:path.join(output,'2026-10-23-manual-mobile.png'),fullPage:true});checks.push('manual has no horizontal overflow at desktop, tablet and phone widths');
 await page.screenshot({path:path.join(output,'2026-10-23-editor-manual-button.png')});
 assert.deepEqual(errors,[]);checks.push('editor has no JavaScript page errors');
 fs.writeFileSync(path.join(output,'2026-10-23-manual-result.json'),JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
