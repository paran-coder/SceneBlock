import {chromium} from 'playwright';
import assert from 'node:assert/strict';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=process.cwd(),runtime=path.join(root,'2026-10-23-runtime'),evidence=path.join(root,'2026-10-23-verification');
fs.mkdirSync(path.join(runtime,'temp'),{recursive:true});fs.mkdirSync(evidence,{recursive:true});process.env.TEMP=path.join(runtime,'temp');process.env.TMP=process.env.TEMP;
const dist=path.join(root,'dist'),config=JSON.parse(fs.readFileSync('vercel.json','utf8')),checks=[],errors=[],requests=[];
const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1'),target=path.resolve(dist,url.pathname==='/'?'index.html':'.'+decodeURIComponent(url.pathname));if(!target.startsWith(dist+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);return res.end('Not found')}for(const h of config.headers[0].headers)res.setHeader(h.key,h.value);res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.wasm':'application/wasm','.json':'application/json','.svg':'image/svg+xml','.zip':'application/zip'})[path.extname(target)]??'application/octet-stream');fs.createReadStream(target).pipe(res)}catch{res.writeHead(400);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true,downloadsPath:path.join(runtime,'downloads')}),context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});
await context.addInitScript(()=>{window.showSaveFilePicker=undefined;window.showOpenFilePicker=undefined});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
try{
 for(const size of [{width:1280,height:720},{width:1600,height:1000}]){
  await page.setViewportSize(size);await page.goto(origin);await page.waitForFunction(()=>window.__previsTest?.snapshot().diagnostics.filter(x=>x.includes('Character loaded:')).length===4);
  await page.locator('#drawPath').click();const rect=await page.locator('#viewport canvas').boundingBox();await page.mouse.click(rect.x+rect.width*.72,rect.y+rect.height*.7);
  const before=await page.evaluate(()=>window.__previsTest.project().actors[0].path);assert.equal(before.length,3);let point=(await page.evaluate(()=>window.__previsTest.path())).points[2];
  await page.mouse.move(point.screen[0]+12,point.screen[1]+4);await page.mouse.down();await page.mouse.move(point.screen[0]+42,point.screen[1]+20,{steps:7});await page.mouse.up();const drawn=await page.evaluate(()=>window.__previsTest.project().actors[0].path);assert.equal(drawn.length,3);assert.notDeepEqual(drawn[2],before[2]);
  await page.locator('#drawPath').click();point=(await page.evaluate(()=>window.__previsTest.path())).points[2];const camera=await page.evaluate(()=>window.__previsTest.editView());
  await page.mouse.move(point.screen[0]-12,point.screen[1]+4);await page.mouse.down();await page.mouse.move(point.screen[0]+18,point.screen[1]+24,{steps:7});await page.mouse.up();const idle=await page.evaluate(()=>window.__previsTest.project().actors[0].path);assert.equal(idle.length,3);assert.notDeepEqual(idle[2],drawn[2]);assert.deepEqual((await page.evaluate(()=>window.__previsTest.editView())).position,camera.position);
  await page.locator('#topView').click();assert.equal(await page.locator('#topView').innerText(),'이전 시점으로');await page.locator('#topView').click();const restored=await page.evaluate(()=>window.__previsTest.editView());assert.ok(restored.position.every((n,i)=>Math.abs(n-camera.position[i])<1e-8));assert.ok(restored.quaternion.every((n,i)=>Math.abs(n-camera.quaternion[i])<1e-8));
  await page.screenshot({path:path.join(evidence,`2026-10-23-path-patch-${size.width}.png`)});checks.push({size,normalPerspective:true,drawModeDrag:true,idleDrag:true,topViewRestored:true});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(evidence,'2026-10-23-path-patch-result.json'),JSON.stringify({checks,errors,remoteDeploymentVerified:false},null,2));console.log(JSON.stringify({passed:checks,errors}));
}catch(error){await page.screenshot({path:path.join(evidence,'2026-10-23-path-patch-failure.png')});throw error}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
