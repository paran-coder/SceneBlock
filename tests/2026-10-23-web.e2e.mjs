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
 await page.goto(origin);await page.waitForFunction(()=>window.__previsTest?.snapshot().diagnostics.some(x=>x.includes('GLB loaded')));
 assert.ok((await page.locator('header').innerText()).includes('v2.2.0'));
 assert.equal(await page.locator('#engineCode').count(),1,'web app requires its explicit optional local-engine connection UI');
 assert.equal(await page.locator('#kimodoControls').isVisible(),false);assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
 assert.equal(requests.filter(u=>u.startsWith('http://127.0.0.1:8765')).length,0);
 checks.push('static web app starts without Electron/Python/localhost engine request');
 await page.locator('#scenePrompt').fill('카페에서 두 사람이 마주 앉아 대화한다');await page.locator('#compose').click();const cafe=await page.evaluate(()=>window.__previsTest.project());assert.equal(cafe.actors.length,2);assert.equal(cafe.actors[0].action,'sit');
 await page.locator('#shotView').click();await page.locator('#scrub').fill('2.5');await page.locator('#play').click();await page.waitForFunction(()=>window.__previsTest.snapshot().time>2.7);await page.locator('#play').click();checks.push('blocking/camera preview/scrub/playback in actual Chrome');
 const projectDownload=page.waitForEvent('download');await page.locator('#save').click();const saved=await projectDownload;const projectFile=path.join(evidence,'2026-10-23-browser-project.json');await saved.saveAs(projectFile);assert.deepEqual(JSON.parse(fs.readFileSync(projectFile,'utf8')),cafe);
 await page.locator('#addActor').click();const chooserPromise=page.waitForEvent('filechooser');await page.locator('#open').click();await(await chooserPromise).setFiles(projectFile);await page.waitForFunction(()=>window.__previsTest.snapshot().actors===2);checks.push('actual browser Blob project download and file-input restore');
 await page.locator('#sampleMotion').click();await page.waitForFunction(()=>window.__previsTest.project().actors[0].clips[0].motion?.prerecorded===true);assert.equal((await page.evaluate(()=>window.__previsTest.project())).actors[0].clips[0].motion.frames,150);checks.push('local static Kimodo prerecorded example works without local engine');
 assert.equal(requests.filter(u=>u.startsWith('http://127.0.0.1:8765')).length,0);
 await page.locator('#kimodoAdvanced > summary').click();await page.locator('#enableKimodo').click();await page.waitForFunction(()=>!document.querySelector('#enableKimodo').checked);assert.equal(requests.filter(u=>u.startsWith('http://127.0.0.1:8765')).length,0);checks.push('advanced opt-in without connection code makes no local request');
 await page.locator('#kimodoAdvanced > summary').click();await page.locator('#duration').fill('1');await page.locator('#duration').dispatchEvent('change');
 const videoDownload=page.waitForEvent('download',{timeout:30000});await page.locator('#export').click();const video=await videoDownload,videoFile=path.join(evidence,'2026-10-23-browser-export.webm');await video.saveAs(videoFile);
 const probe=spawnSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_name,width,height,nb_read_frames','-show_entries','format=duration','-of','json',videoFile],{encoding:'utf8',windowsHide:true});assert.equal(probe.status,0,probe.stderr);const media=JSON.parse(probe.stdout);assert.equal(+media.streams[0].nb_read_frames,30);assert.equal(+media.format.duration,1);checks.push({name:'actual Chrome WebM download decoded',media,bytes:fs.statSync(videoFile).size});
 await page.screenshot({path:path.join(evidence,'2026-10-23-web-editor.png')});
 assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith(origin)||u.startsWith('blob:')||u.startsWith('data:')),'basic test must not contact external services');
 fs.writeFileSync(path.join(evidence,'2026-10-23-browser-result.json'),JSON.stringify({origin,checks,errors,requestCount:requests.length,remoteVercelVerified:false},null,2));console.log(JSON.stringify({passed:checks.length,errors,video:media.streams[0]}));
}catch(error){await page.screenshot({path:path.join(evidence,'2026-10-23-web-failure.png')});throw error}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}

