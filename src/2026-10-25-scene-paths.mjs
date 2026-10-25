import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {routeDisplayPoints} from './2026-10-23-path-curves.mjs';

// Read-only scene overlays; stored routes remain owned by the project/editor.
export function installScenePaths(stage){
 const group=new THREE.Group();stage.scenePathGuides=group;stage.scene.add(group);stage.scenePathsVisible=true;
 const clear=()=>{for(const child of [...group.children]){child.geometry?.dispose();child.material?.dispose();group.remove(child)}};
 const visibility=()=>{group.visible=stage.scenePathsVisible&&!stage.cameraMode;stage.pathGuide.visible=stage.scenePathsVisible&&!stage.cameraMode&&Boolean(stage.pathEditingId)};
 const refresh=()=>{clear();for(const entity of [...(stage.project?.actors??[]),...(stage.project?.cameras??[])]){if(entity.id===stage.pathEditingId||entity.path?.length<2||!entity.path)continue;const points=routeDisplayPoints(entity.path,entity.pathCurve),geometry=new LineGeometry().setPositions(points.flatMap(p=>[p[0],p[1]+.045,p[2]]));const line=new Line2(geometry,new LineMaterial({color:0x66d9c5,linewidth:2.5,depthTest:false,depthWrite:false,transparent:true,opacity:.8}));line.renderOrder=40;line.raycast=()=>{};line.userData.entityId=entity.id;group.add(line)}visibility()};
 const originalRefresh=stage.refreshPathGuide.bind(stage),originalMode=stage.mode.bind(stage),originalEditing=stage.setPathEditing.bind(stage),originalInspect=stage.inspectPathGuide.bind(stage),originalDispose=stage.dispose.bind(stage);
 stage.refreshPathGuide=()=>{originalRefresh();refresh()};
 stage.mode=value=>{originalMode(value);visibility()};
 stage.setPathEditing=(id,...args)=>{if(id)stage.scenePathsVisible=true;return originalEditing(id,...args)};
 stage.setScenePathsVisible=value=>{stage.scenePathsVisible=Boolean(value);visibility()};
 stage.inspectPathGuide=()=>({...originalInspect(),pathsVisible:stage.scenePathsVisible,scenePathsVisible:group.visible,sceneRoutes:group.children.map(line=>line.userData.entityId)});
 stage.dispose=()=>{clear();stage.scene.remove(group);originalDispose()};refresh();
}
