export const CAMERA_MOVES = [
 ['static','고정','카메라 위치와 시선을 고정합니다.'],['linear','시작 → 끝','시작 위치와 끝 위치 사이를 이동합니다.'],['dolly','전진·후진','피사체를 향해 이동합니다. 거리의 부호로 방향을 바꿉니다.'],['truck','좌우 이동','시선을 유지하며 카메라를 옆으로 이동합니다.'],['pedestal','상승·하강','카메라와 시선을 함께 위아래로 이동합니다.'],['pan','좌우 팬','위치를 고정하고 시선을 좌우로 돌립니다.'],['tilt','상하 틸트','위치를 고정하고 시선을 위아래로 돌립니다.'],['orbit','좌우 오빗','피사체를 중심으로 원을 그리며 이동합니다.'],['zoom','줌 인·아웃','위치를 유지하고 화각만 변경합니다.'],['dollyZoom','돌리 줌','이동과 화각을 함께 조절해 피사체 크기를 유지합니다.'],['crashZoom','빠른 줌','초반에 화각을 빠르게 변경합니다.'],['handheld','핸드헬드','시간에 따라 일정하게 재현되는 흔들림을 더합니다.'],['path','카메라 동선','지정한 경유점을 일정한 거리 비율로 이동합니다.']
].map(([id,label,description])=>({id,label,description}));
// Preview points are [camera, subject] in a 100 × 100 plan view.
export function cameraMovePreview(type,ratio){const t=Math.max(0,Math.min(1,ratio)),a=t*Math.PI*1.5;let p=[25,75],target=[65,35];if(type==='truck')p[0]+=t*40;else if(type==='pedestal'||type==='tilt')p[1]-=t*40;else if(['dolly','dollyZoom'].includes(type))p=p.map((v,i)=>v+(target[i]-v)*t*.6);else if(type==='orbit')p=[65+Math.cos(a)*30,35+Math.sin(a)*30];else if(type==='pan')target=[50+Math.sin(a)*30,40+Math.cos(a)*25];else if(type==='handheld')p=[25+Math.sin(t*43)*3,75+Math.sin(t*57)*3];else if(['linear','path'].includes(type))p=[20+t*60,75-Math.sin(t*Math.PI)*40];else if(['zoom','crashZoom'].includes(type))target=[65,35+12*t];return [p,target];}

// A different motion starts with its own defaults; same-motion edits keep explicit zeros.
export function cameraMotionForType(current,type,fov=45){
 if(!CAMERA_MOVES.some(m=>m.id===type))throw Error('알 수 없는 카메라 운용입니다.');
 if(current?.type===type)return {...current};
 const motion={type,easing:current?.easing??'linear',angle:90};
 if(['dolly','dollyZoom','truck','pedestal'].includes(type))motion.distance=3;
 if(type==='handheld')motion.strength=.15;
 if(['zoom','crashZoom'].includes(type))motion.endFov=fov>10.1?Math.max(10,fov*.6):Math.min(120,fov*1.6);
 return motion;
}
