import {Line2} from 'three/addons/lines/Line2.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {routeDisplayPoints} from './2026-10-23-path-curves.mjs';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { evaluateActor, evaluateCamera } from '../2026-10-23-core.mjs';
import * as motionTools from '../2026-10-23-motion.mjs';
import {applyActorOverlays} from './2026-10-23-layer-renderer.mjs';
import { POSES, CHARACTERS, applyLibraryPose, applyJointOffsets } from './2026-10-23-poses.mjs';

import { createPropModel, cloneActorMaterials, tintActorMaterials } from './2026-10-23-props.mjs';

const colors=[0xd7b078,0x9aa8be];
export class Stage {
  constructor(container,onSelect,onTransform,onStatus){
    this.container=container;this.onSelect=onSelect;this.onTransform=onTransform;this.onStatus=onStatus;this.objects=new Map();this.cameraMode=false;this.previewCameraId=null;this.time=0;this.diagnostics=[];this.templates=new Map();this.poseCache=new Map();this.posePending=new Map();this.selectedId=null;this.pathEditingId=null;
    this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;container.prepend(this.renderer.domElement);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#252b33');this.scene.fog=new THREE.Fog('#252b33',20,65);
    this.camera=new THREE.PerspectiveCamera(45,1,.05,150);this.camera.position.set(9,7,11);this.shotCamera=new THREE.PerspectiveCamera(45,1,.05,150);
    this.orbit=new OrbitControls(this.camera,this.renderer.domElement);this.orbit.target.set(0,1,0);this.orbit.enableDamping=true;
    this.scene.add(new THREE.HemisphereLight(0xdde9ff,0x655c4b,2.4));const sun=new THREE.DirectionalLight(0xffead2,3);sun.position.set(5,9,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;this.scene.add(sun);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:0x30363c,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;this.scene.add(floor);this.scene.add(new THREE.GridHelper(30,30,0x60676c,0x3c4349));
    this.gizmo=new TransformControls(this.camera,this.renderer.domElement);this.scene.add(this.gizmo.getHelper());this.gizmo.addEventListener('dragging-changed',e=>{this.orbit.enabled=!e.value&&!this.pathEditingId&&!this.cameraMode;if(!e.value&&this.gizmo.object)this.onTransform(this.gizmo.object.userData.entityId,this.gizmo.object.position.toArray(),this.gizmo.object.rotation.y)});
    this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.renderer.domElement.addEventListener('pointerdown',e=>{if(this.pathEditingId)return;this.down=[e.clientX,e.clientY]});this.renderer.domElement.addEventListener('pointerup',e=>{if(this.pathEditingId||!this.down||Math.hypot(e.clientX-this.down[0],e.clientY-this.down[1])>4||this.gizmo.dragging)return;const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.pointer,this.cameraMode?this.shotCamera:this.camera);let hit=this.ray.intersectObjects([...this.objects.values()],true)[0]?.object;while(hit&&!hit.userData.entityId)hit=hit.parent;if(hit)this.onSelect(hit.userData.entityId)});
    this.pathGuide=new THREE.Group();this.scene.add(this.pathGuide);this.installPathEvents();new ResizeObserver(()=>this.resize()).observe(container);this.assetsReady=this.loadAsset();
  }
  async loadAsset(){
    const draco=new DRACOLoader();draco.setDecoderPath('/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);
    const keys=CHARACTERS.map(c=>c.key);
    await Promise.all(keys.map(async key=>{try{const gltf=await loader.loadAsync(`/topview-assets/characters/${key}`);this.templates.set(key,gltf.scene);if(key===keys[0])this.template=gltf.scene;this.diagnostics.push(`Character loaded: ${key}`);if(key===keys[0])this.diagnostics.push('Topview official character GLB loaded');if(this.project)this.sync(this.project)}catch(error){this.diagnostics.push(`Character ${key}: ${error.message}`)}}));
    this.onStatus(this.templates.size?'캐릭터 준비 완료':'캐릭터 자산 로드 실패 · 기본 인체로 편집 가능합니다');
  }
  actorModel(index,key){const template=this.templates.get(key);if(template){const imported=cloneActorMaterials(clone(template)),model=new THREE.Group();model.add(imported);model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox()}});const bounds=new THREE.Box3().setFromObject(model);const height=bounds.max.y-bounds.min.y;if(!Number.isFinite(height)||height<.01)throw new Error('Invalid character bounds');model.scale.multiplyScalar(1.75/height);model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model);model.position.y-=box.min.y;model.updateWorldMatrix(true,true);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}if(o.isBone){o.userData.restQuaternion=o.quaternion.clone();o.userData.restPosition=o.position.clone()}});this.diagnostics.push(`Character normalized height ${height.toFixed(4)}m; factor ${(1.75/height).toFixed(4)}`);return model}const model=new THREE.Group();const mat=new THREE.MeshStandardMaterial({color:colors[index%2],roughness:.8});for(const [name,x,y,z,w,h,d]of [['body',0,1.1,0,.42,.62,.23],['head',0,1.6,0,.28,.3,.26],['leftarm',-.31,1.1,0,.12,.58,.12],['rightarm',.31,1.1,0,.12,.58,.12],['leftleg',-.13,.42,0,.16,.82,.17],['rightleg',.13,.42,0,.16,.82,.17]]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;model.add(mesh)}return model}
  sync(project){
    this.project=project;this.gizmo.detach();
    const live=new Set([...project.actors,...project.props].map(o=>o.id));
    for(const [id,obj]of this.objects)if(!live.has(id)){this.removeObject(obj);this.objects.delete(id)}
    project.actors.forEach((actor,i)=>{let root=this.objects.get(actor.id);if(root&&root.userData.modelKey!==actor.modelKey||root&&root.userData.hasTemplate!==this.templates.has(actor.modelKey||CHARACTERS[0].key)){this.removeObject(root);this.objects.delete(actor.id);root=null}if(!root){root=new THREE.Group();root.userData.entityId=actor.id;root.userData.modelKey=actor.modelKey;root.userData.hasTemplate=this.templates.has(actor.modelKey||CHARACTERS[0].key);root.userData.model=this.actorModel(i,actor.modelKey||CHARACTERS[0].key);root.add(root.userData.model);this.scene.add(root);this.objects.set(actor.id,root)}tintActorMaterials(root.userData.model,actor.color);root.userData.color=actor.color});
    for(const prop of project.props){let root=this.objects.get(prop.id);if(root&&root.userData.propKind!==prop.kind){this.removeObject(root);this.objects.delete(prop.id);root=null}if(!root){root=createPropModel(prop.kind,prop.color);root.userData.entityId=prop.id;root.userData.propKind=prop.kind;this.scene.add(root);this.objects.set(prop.id,root)}tintActorMaterials(root,prop.color);root.position.fromArray(prop.position);root.rotation.y=prop.rotation||0;root.scale.fromArray(prop.scale||[1,1,1])}
    this.refreshPathGuide();this.select(this.selectedId);this.update(this.time)
  }
  removeObject(root){this.scene.remove(root);const materials=new Set();root.traverse(o=>{if(root.userData.ownedResources||!root.userData.hasTemplate){o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}for(const m of o.userData.ownedActorMaterials||[])materials.add(m)});materials.forEach(m=>m.dispose())}
  select(id){this.selectedId=id;this.refreshPathGuide();const obj=this.objects.get(id);if(obj&&!this.cameraMode&&!this.pathEditingId)this.gizmo.attach(obj);else this.gizmo.detach()}
  mode(value){this.cameraMode=value;this.orbit.enabled=!value&&!this.pathEditingId;this.pathGuide.visible=!value&&Boolean(this.pathEditingId);this.gizmo.detach();this.container.classList.toggle('camera-mode',value)}
  setTransformMode(mode){this.gizmo.setMode(mode)}
  resize(){
    const availableW=this.container.clientWidth,availableH=this.container.clientHeight;
    const units=Math.max(1,Math.floor(Math.min(availableW/16,availableH/9)));
    const w=units*16,h=units*9,left=(availableW-w)/2,top=(availableH-h)/2;
    this.renderer.setSize(w,h,false);
    Object.assign(this.renderer.domElement.style,{position:'absolute',width:`${w}px`,height:`${h}px`,left:`${left}px`,top:`${top}px`});
    const guide=this.container.querySelector('.frame-guide');
    if(guide)Object.assign(guide.style,{inset:'auto',width:`${w}px`,height:`${h}px`,left:`${left}px`,top:`${top}px`});
    for(const camera of [this.camera,this.shotCamera]){camera.aspect=16/9;camera.updateProjectionMatrix()}
  }
  update(time){
    this.time=time;if(!this.project)return;
    for(const actor of this.project.actors){
      const root=this.objects.get(actor.id);if(!root||this.gizmo.dragging&&this.gizmo.object===root)continue;
      const state=evaluateActor(actor,time);root.position.fromArray(state.position);root.rotation.y=state.rotation;
      const model=root.userData.model;motionTools.resetCharacterPose(model);
      if(state.poseId){const document=this.poseCache.get(state.poseId);if(document){try{applyLibraryPose(model,document)}catch(error){this.reportPoseError(error)}}else this.loadPose(state.poseId)}
      else if((state.motion??(!actor.clips?.length?actor.motion:null))&&state.active){try{motionTools.applyKimodoMotion(model,state.motion??actor.motion,state.localTime,{inPlace:true})}catch(error){if(!this.motionError){this.motionError=error.message;this.onStatus(`Motion error: ${error.message}`)}}}
      else this.pose(model,state.action,state.localTime);
      if(state.jointOffsets){try{applyJointOffsets(model,state.jointOffsets)}catch(error){this.reportPoseError(error)}}
      try{applyActorOverlays(model,state.overlays,{applyPose:(target,id)=>{const document=this.poseCache.get(id);if(!document){this.loadPose(id);return false}applyLibraryPose(target,document);return true}})}catch(error){this.reportPoseError(error)}
    }
    const preview=this.project.cameras.find(c=>c.id===this.previewCameraId);const shot=evaluateCamera(preview?{...this.project,cuts:[{cameraId:preview.id,start:0,end:this.project.duration}]}:this.project,time);if(shot){this.shotCamera.position.fromArray(shot.position);this.shotCamera.lookAt(new THREE.Vector3().fromArray(shot.target));this.shotCamera.fov=shot.fov||45;this.shotCamera.updateProjectionMatrix()}
    this.orbit.update();this.renderer.render(this.scene,this.cameraMode?this.shotCamera:this.camera)
  }
  pose(model,action,t){const swing=Math.sin(t*6)*.45;let rigged=false;model.traverse(o=>{if(o.isBone)rigged=true});if(rigged){motionTools.applyBasicAction(model,action,t,{speed:1})}else{for(const child of model.children){child.rotation.set(0,0,0);if(action==='walk'&&/leg|arm/.test(child.name))child.rotation.x=(child.name.startsWith('left')?1:-1)*swing;if(action==='wave'&&child.name==='rightarm')child.rotation.z=2+Math.sin(t*7)*.25}model.position.y=action==='sit'?-.4:0}}
  reportPoseError(error){if(this.poseError!==error.message){this.poseError=error.message;this.diagnostics.push(`Pose: ${error.message}`);this.onStatus(`Pose error: ${error.message}`)}}
  loadPose(id,{force=false}={}){
    if(this.poseCache.has(id))return Promise.resolve(this.poseCache.get(id));
    if(this.posePending.has(id))return this.posePending.get(id);
    this.poseFailures??=new Map();const failure=this.poseFailures.get(id);
    if(!force&&failure&&Date.now()-failure.time<5000)return Promise.resolve();
    const entry=POSES.find(p=>p.id===id);
    if(!entry){const error=new Error(`Unknown pose: ${id}`);this.poseFailures.set(id,{time:Date.now(),error});this.reportPoseError(error);return Promise.resolve()}
    // Rendering calls this without awaiting: requests always settle safely; export
    // checks the resulting cache and turns a missing pose into an explicit failure.
    const request=(async()=>{try{const response=await fetch(entry.file);if(!response.ok)throw new Error(`Pose ${id}: HTTP ${response.status}`);const document=await response.json();this.poseCache.set(id,document);this.poseFailures.delete(id);if(this.project)this.update(this.time);return document}catch(error){this.poseFailures.set(id,{time:Date.now(),error});this.reportPoseError(error)}finally{this.posePending.delete(id)}})();
    this.posePending.set(id,request);return request;
  }
  async preparePoses(){
    await this.assetsReady;const ids=new Set(this.project?.actors.flatMap(a=>[a.poseId,...(a.clips||[]).map(c=>c.poseId),...(a.layers||[]).flatMap(layer=>(layer.clips||[]).flatMap(c=>[c.poseId,...(c.poseKeys??[]).map(k=>k.poseId)]))]).filter(Boolean)||[]);
    await Promise.all([...ids].map(async id=>{await this.loadPose(id,{force:true});if(!this.poseCache.has(id)){const failure=this.poseFailures?.get(id);throw new Error(`Pose preparation failed: ${failure?.error?.message||id}`)}}));
  }
  setPathEditing(actorId,onChange){this.pathEditingId=actorId&&[...(this.project?.actors??[]),...(this.project?.cameras??[])].some(a=>a.id===actorId)?actorId:null;if(typeof onChange==='function')this.onPathChange=onChange;this.pathGesture=null;this.orbit.enabled=!this.cameraMode&&!this.pathEditingId;this.renderer.domElement.style.touchAction=this.pathEditingId?'none':'';this.gizmo.detach();this.refreshPathGuide();if(!this.pathEditingId)this.select(this.selectedId)}
  setTopView(){
    const previous={position:this.camera.position.clone(),quaternion:this.camera.quaternion.clone(),target:this.orbit.target.clone(),up:this.camera.up.clone(),zoom:this.camera.zoom};
    const damping=this.orbit.enableDamping;this.orbit.enableDamping=false;this.orbit.update();this.orbit.enableDamping=damping;
    if(this.topViewActive&&this.previousEditView){const v=this.previousEditView;this.camera.position.copy(v.position);this.camera.up.copy(v.up);this.camera.zoom=v.zoom;this.orbit.target.copy(v.target);this.camera.quaternion.copy(v.quaternion);this.topViewActive=false;this.previousEditView=null;}
    else{this.previousEditView=previous;this.topViewActive=true;this.camera.position.set(0,18,.001);this.orbit.target.set(0,0,0);this.camera.lookAt(this.orbit.target);}
    this.camera.updateProjectionMatrix();this.orbit.update();this.update(this.time);return this.topViewActive;
  }
  inspectEditView(){return {topView:!!this.topViewActive,position:this.camera.position.toArray(),target:this.orbit.target.toArray(),quaternion:this.camera.quaternion.toArray()};}

  clearPathGuide(){if(!this.pathGuide)return;for(const child of [...this.pathGuide.children]){child.geometry?.dispose();if(child.material){child.material.map?.dispose();child.material.dispose()}this.pathGuide.remove(child)}}
  refreshPathGuide(){this.clearPathGuide();if(!this.project)return;const actor=[...this.project.actors,...this.project.cameras].find(a=>a.id===this.pathEditingId);this.pathGuide.visible=!this.cameraMode&&Boolean(actor);if(!actor)return;const points=this.pathGesture?.points||actor.path||[];if(points.length>1){const geometry=new LineGeometry().setPositions(routeDisplayPoints(points,actor.pathCurve).flatMap(p=>[p[0],p[1]+.045,p[2]]));const line=new Line2(geometry,new LineMaterial({color:0x66d9c5,linewidth:2.5,depthTest:false,depthWrite:false,transparent:true,opacity:.95}));line.renderOrder=40;this.pathGuide.add(line)}
    points.forEach((p,index)=>{const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#102e33';ctx.beginPath();ctx.arc(48,48,42,0,Math.PI*2);ctx.fill();ctx.lineWidth=6;ctx.strokeStyle='#7ee8d0';ctx.stroke();ctx.fillStyle='#ffffff';ctx.font='bold 44px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(index+1),48,50);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));sprite.position.set(p[0],p[1]+.15,p[2]);sprite.scale.set(.45,.45,1);sprite.userData.pathIndex=index;sprite.renderOrder=50;this.pathGuide.add(sprite)})
  }
  pathGround(event){const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-(this.project?.cameras.find(c=>c.id===this.pathEditingId)?.position[1]??0)),new THREE.Vector3())}
  pickPathHandle(event){
    if(!this.pathGuide?.visible)return -1;let nearest=-1,distance=18;
    for(const point of this.pathGuide.children){if(!Number.isInteger(point.userData.pathIndex))continue;const [x,y]=this.pathScreen(point.position),d=Math.hypot(event.clientX-x,event.clientY-y);if(d<distance){distance=d;nearest=point.userData.pathIndex;}}
    return nearest;
  }
  installPathEvents(){
    const canvas=this.renderer.domElement,stop=e=>{e.preventDefault();e.stopImmediatePropagation()};
    canvas.addEventListener('pointerdown',event=>{
      if(this.cameraMode||event.button!==0)return;
      const actor=[...(this.project?.actors??[]),...(this.project?.cameras??[])].find(a=>a.id===this.pathEditingId);if(!actor)return;
      const index=this.pickPathHandle(event);if(!this.pathEditingId&&index<0)return;
      const ground=this.pathGround(event);if(!ground)return;stop(event);this.onPathGestureStart?.();
      const points=(actor.path?.length?actor.path:[actor.position]).map(p=>[...p]);
      this.pathGesture={actorId:actor.id,pointerId:event.pointerId,index,points,groundStart:ground.clone(),original:index>=0?[...points[index]]:null,start:[event.clientX,event.clientY],moved:false,drawing:!!this.pathEditingId};
      this.orbit.enabled=false;this.gizmo.detach();canvas.style.cursor=index>=0?'grabbing':'crosshair';canvas.setPointerCapture(event.pointerId);
    },true);
    canvas.addEventListener('pointermove',event=>{
      const gesture=this.pathGesture;
      if(!gesture){if(!this.cameraMode)canvas.style.cursor=this.pickPathHandle(event)>=0?'grab':this.pathEditingId?'crosshair':'';return;}
      stop(event);if(gesture.pointerId!==event.pointerId||gesture.index<0)return;
      const point=this.pathGround(event);if(!point)return;gesture.moved=gesture.moved||Math.hypot(event.clientX-gesture.start[0],event.clientY-gesture.start[1])>3;
      if(gesture.moved){gesture.points[gesture.index]=[gesture.original[0]+point.x-gesture.groundStart.x,gesture.original[1],gesture.original[2]+point.z-gesture.groundStart.z];this.refreshPathGuide();this.update(this.time);}
    },true);
    const finish=(event,cancel=false)=>{
      const gesture=this.pathGesture;if(!gesture||gesture.pointerId!==event.pointerId)return;stop(event);
      const point=this.pathGround(event),clicked=Math.hypot(event.clientX-gesture.start[0],event.clientY-gesture.start[1])<=4;let changed=gesture.moved;
      if(gesture.drawing&&gesture.index<0&&clicked&&point&&gesture.points.length<512){gesture.points.push([point.x,point.y,point.z]);changed=true;}
      this.pathGesture=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      this.orbit.enabled=!this.cameraMode&&!this.pathEditingId;canvas.style.cursor=this.pathEditingId?'crosshair':'';
      if(!cancel&&changed)this.onPathChange?.(gesture.points.map(p=>[...p]),gesture.actorId);
      this.refreshPathGuide();this.update(this.time);if(!this.pathEditingId)this.select(this.selectedId);
    };
    canvas.addEventListener('pointerup',event=>finish(event),true);canvas.addEventListener('pointercancel',event=>finish(event,true),true);
  }

  inspectPathGuide(){return {actorId:this.pathEditingId||this.selectedId,editing:Boolean(this.pathEditingId),visible:this.pathGuide.visible,lineVertices:this.pathGuide.children.find(c=>c.isLine2)?.geometry.attributes.instanceStart?.count??0,orbitEnabled:this.orbit.enabled,points:this.pathGuide.children.filter(c=>Number.isInteger(c.userData.pathIndex)).map(c=>({index:c.userData.pathIndex,world:c.position.toArray(),screen:this.pathScreen(c.position)}))}}
  pathScreen(point){const p=point.clone().project(this.camera),r=this.renderer.domElement.getBoundingClientRect();return [r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2]}
  inspectActors(){return this.project.actors.map(actor=>{const root=this.objects.get(actor.id),model=root?.userData.model;if(!model)return {id:actor.id};model.updateWorldMatrix(true,true);model.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox()}});const box=new THREE.Box3().setFromObject(model);let hips;model.traverse(o=>{if(/hips/i.test(o.name))hips={local:o.position.toArray(),world:o.getWorldPosition(new THREE.Vector3()).toArray()}});const materialColors=new Set();model.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])if(m.color)materialColors.add('#'+m.color.getHexString())});return {id:actor.id,color:actor.color,materialColors:[...materialColors],scale:model.scale.toArray(),position:model.position.toArray(),worldPosition:root.position.toArray(),min:box.min.toArray(),max:box.max.toArray(),hips}})}
  inspectBones(id=this.selectedId){const root=this.objects.get(id),model=root?.userData.model;if(!model)return [];model.updateWorldMatrix(true,true);const bones=[];model.traverse(b=>{if(b.isBone)bones.push({name:b.name,localPosition:b.position.toArray(),localQuaternion:b.quaternion.toArray(),worldPosition:b.getWorldPosition(new THREE.Vector3()).toArray(),worldQuaternion:b.getWorldQuaternion(new THREE.Quaternion()).toArray()})});return bones}
  inspectShot(){this.shotCamera.updateWorldMatrix(true,false);return {position:this.shotCamera.position.toArray(),quaternion:this.shotCamera.quaternion.toArray(),direction:this.shotCamera.getWorldDirection(new THREE.Vector3()).toArray(),fov:this.shotCamera.fov}}
  currentShot(){return {position:this.camera.position.toArray(),target:this.orbit.target.toArray(),fov:this.camera.fov}}
  dispose(){for(const root of this.objects.values())this.removeObject(root);this.objects.clear();this.clearPathGuide();this.renderer.dispose();this.orbit.dispose()}
}


