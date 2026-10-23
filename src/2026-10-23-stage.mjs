import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { evaluateActor, evaluateCamera } from '../2026-10-23-core.mjs';
import * as motionTools from '../2026-10-23-motion.mjs';

const colors=[0xd7b078,0x9aa8be];
export class Stage {
  constructor(container,onSelect,onTransform,onStatus){
    this.container=container;this.onSelect=onSelect;this.onTransform=onTransform;this.onStatus=onStatus;this.objects=new Map();this.cameraMode=false;this.time=0;this.diagnostics=[];
    this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;container.prepend(this.renderer.domElement);
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#252b33');this.scene.fog=new THREE.Fog('#252b33',20,65);
    this.camera=new THREE.PerspectiveCamera(45,1,.05,150);this.camera.position.set(9,7,11);this.shotCamera=new THREE.PerspectiveCamera(45,1,.05,150);
    this.orbit=new OrbitControls(this.camera,this.renderer.domElement);this.orbit.target.set(0,1,0);this.orbit.enableDamping=true;
    this.scene.add(new THREE.HemisphereLight(0xdde9ff,0x655c4b,2.4));const sun=new THREE.DirectionalLight(0xffead2,3);sun.position.set(5,9,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;this.scene.add(sun);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:0x30363c,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;this.scene.add(floor);this.scene.add(new THREE.GridHelper(30,30,0x60676c,0x3c4349));
    this.gizmo=new TransformControls(this.camera,this.renderer.domElement);this.scene.add(this.gizmo.getHelper());this.gizmo.addEventListener('dragging-changed',e=>{this.orbit.enabled=!e.value;if(!e.value&&this.gizmo.object)this.onTransform(this.gizmo.object.userData.entityId,this.gizmo.object.position.toArray(),this.gizmo.object.rotation.y)});
    this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.renderer.domElement.addEventListener('pointerdown',e=>{this.down=[e.clientX,e.clientY]});this.renderer.domElement.addEventListener('pointerup',e=>{if(!this.down||Math.hypot(e.clientX-this.down[0],e.clientY-this.down[1])>4||this.gizmo.dragging)return;const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.pointer,this.cameraMode?this.shotCamera:this.camera);let hit=this.ray.intersectObjects([...this.objects.values()],true)[0]?.object;while(hit&&!hit.userData.entityId)hit=hit.parent;if(hit)this.onSelect(hit.userData.entityId)});
    new ResizeObserver(()=>this.resize()).observe(container);this.loadAsset();
  }
  async loadAsset(){try{const draco=new DRACOLoader();draco.setDecoderPath('/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);const gltf=await loader.loadAsync('/topview-assets/characters/a3d_char_30ec53c93eae4173946b38639691ebe0.glb');this.template=gltf.scene;this.diagnostics.push('Topview official character GLB loaded');if(this.project)this.sync(this.project);this.onStatus('Topview 캐릭터 준비 완료')}catch(error){this.diagnostics.push(`Character asset: ${error.message}`);this.onStatus('캐릭터 자산 로드 실패 · 기본 인체로 편집 가능합니다')}}
  actorModel(index){if(this.template){const imported=clone(this.template),model=new THREE.Group();model.add(imported);model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox()}});const bounds=new THREE.Box3().setFromObject(model);const height=bounds.max.y-bounds.min.y;if(!Number.isFinite(height)||height<.01)throw new Error('Invalid character bounds');model.scale.multiplyScalar(1.75/height);model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model);model.position.y-=box.min.y;model.updateWorldMatrix(true,true);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}if(o.isBone){o.userData.restQuaternion=o.quaternion.clone();o.userData.restPosition=o.position.clone()}});this.diagnostics.push(`Character normalized height ${height.toFixed(4)}m; factor ${(1.75/height).toFixed(4)}`);return model}const model=new THREE.Group();const mat=new THREE.MeshStandardMaterial({color:colors[index%2],roughness:.8});for(const [name,x,y,z,w,h,d]of [['body',0,1.1,0,.42,.62,.23],['head',0,1.6,0,.28,.3,.26],['leftarm',-.31,1.1,0,.12,.58,.12],['rightarm',.31,1.1,0,.12,.58,.12],['leftleg',-.13,.42,0,.16,.82,.17],['rightleg',.13,.42,0,.16,.82,.17]]){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;model.add(mesh)}return model}
  sync(project){
    this.project=project;this.gizmo.detach();
    const live=new Set([...project.actors,...project.props].map(o=>o.id));
    for(const [id,obj]of this.objects)if(!live.has(id)){this.removeObject(obj);this.objects.delete(id)}
    project.actors.forEach((actor,i)=>{let root=this.objects.get(actor.id);if(root&&root.userData.hasTemplate!==Boolean(this.template)){this.removeObject(root);this.objects.delete(actor.id);root=null}if(!root){root=new THREE.Group();root.userData.entityId=actor.id;root.userData.hasTemplate=Boolean(this.template);root.userData.model=this.actorModel(i);root.add(root.userData.model);this.scene.add(root);this.objects.set(actor.id,root)}});
    for(const prop of project.props){let root=this.objects.get(prop.id);if(!root){root=new THREE.Group();root.userData.entityId=prop.id;root.userData.ownedResources=true;const material=new THREE.MeshStandardMaterial({color:prop.color||'#77818c',roughness:.8});if(prop.kind==='table'){const top=new THREE.Mesh(new THREE.BoxGeometry(1.6,.12,.85),material);top.position.y=.82;root.add(top);for(const x of [-.65,.65])for(const z of [-.3,.3]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.08,.8,.08),material);leg.position.set(x,.4,z);root.add(leg)}}else{const mesh=new THREE.Mesh(new THREE.BoxGeometry(prop.kind==='wall'?5:1,prop.kind==='wall'?3:1,prop.kind==='wall'?.15:1),material);mesh.position.y=prop.kind==='wall'?1.5:.5;root.add(mesh)}root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});this.scene.add(root);this.objects.set(prop.id,root)}root.position.fromArray(prop.position);root.rotation.y=prop.rotation||0;root.scale.fromArray(prop.scale||[1,1,1])}
    this.update(this.time)
  }
  removeObject(root){this.scene.remove(root);if(root.userData.ownedResources||!root.userData.hasTemplate){const materials=new Set();root.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)});materials.forEach(m=>m.dispose())}}
  select(id){const obj=this.objects.get(id);if(obj&&!this.cameraMode)this.gizmo.attach(obj);else this.gizmo.detach()}
  mode(value){this.cameraMode=value;this.orbit.enabled=!value;this.gizmo.detach();this.container.classList.toggle('camera-mode',value)}
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
  update(time){this.time=time;if(!this.project)return;for(const actor of this.project.actors){const root=this.objects.get(actor.id);if(!root||this.gizmo.dragging&&this.gizmo.object===root)continue;const state=evaluateActor(actor,time);root.position.fromArray(state.position);root.rotation.y=state.rotation;const model=root.userData.model;model.traverse(o=>{if(o.isBone&&o.userData.restQuaternion)o.quaternion.copy(o.userData.restQuaternion)});if(actor.motion&&state.active){try{motionTools.applyKimodoMotion(model,actor.motion,state.localTime,{inPlace:true})}catch(error){if(!this.motionError){this.motionError=error.message;this.onStatus(`모션 적용 오류: ${error.message}`)}}}else this.pose(model,state.action,state.localTime)}const shot=evaluateCamera(this.project,time);if(shot){this.shotCamera.position.fromArray(shot.position);this.shotCamera.lookAt(new THREE.Vector3().fromArray(shot.target));this.shotCamera.fov=shot.fov||45;this.shotCamera.updateProjectionMatrix()}this.orbit.update();this.renderer.render(this.scene,this.cameraMode?this.shotCamera:this.camera)}
  pose(model,action,t){const swing=Math.sin(t*6)*.45;let rigged=false;model.traverse(o=>{if(o.isBone)rigged=true});if(rigged){motionTools.applyBasicAction(model,action,t,{speed:1})}else{for(const child of model.children){child.rotation.set(0,0,0);if(action==='walk'&&/leg|arm/.test(child.name))child.rotation.x=(child.name.startsWith('left')?1:-1)*swing;if(action==='wave'&&child.name==='rightarm')child.rotation.z=2+Math.sin(t*7)*.25}model.position.y=action==='sit'?-.4:0}}
  inspectActors(){return this.project.actors.map(actor=>{const root=this.objects.get(actor.id),model=root?.userData.model;if(!model)return {id:actor.id};model.updateWorldMatrix(true,true);model.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox()}});const box=new THREE.Box3().setFromObject(model);let hips;model.traverse(o=>{if(/hips/i.test(o.name))hips={local:o.position.toArray(),world:o.getWorldPosition(new THREE.Vector3()).toArray()}});return {id:actor.id,scale:model.scale.toArray(),position:model.position.toArray(),min:box.min.toArray(),max:box.max.toArray(),hips}})}
  currentShot(){return {position:this.camera.position.toArray(),target:this.orbit.target.toArray(),fov:this.camera.fov}}
  dispose(){this.renderer.dispose();this.orbit.dispose()}
}

