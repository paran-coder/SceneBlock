import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
assert.equal(config.outputDirectory,'dist');
for(const file of ['dist/index.html','dist/motions/2026-10-23-kimodo-example.json','dist/downloads/2026-10-23-local-engine-v2.0.0.zip']) assert.ok(fs.existsSync(file),file);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.relative(root,path.join(dir,x.name))]);}
const files=walk('dist');
assert.ok(files.some(x=>x.endsWith('.glb')));
assert.ok(files.some(x=>x.endsWith('.wasm')));
assert.ok(!files.some(x=>/\.(exe|safetensors|pth|pt|bin)$/i.test(x)),'no model weights or executables in static deployment');
assert.ok(!JSON.parse(fs.readFileSync('package.json')).dependencies.electron);
console.log(JSON.stringify({passed:true,staticFiles:files.length,remoteDeploymentVerified:false}));

for(const link of fs.readFileSync('src/2026-10-23-app.mjs','utf8').matchAll(/\/downloads\/[^\" ]+\.zip/g))assert.ok(fs.existsSync('dist'+link[0]),'download link must exist: '+link[0]);
assert.equal(files.filter(x=>x.endsWith('.glb')).length,4);
