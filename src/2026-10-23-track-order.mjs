export function reorderTimeline(project,from,to,after=false){
 const a=project.actors.find(a=>a.id===from.actor),b=project.actors.find(a=>a.id===to.actor);if(!a||!b)throw Error('인물을 찾을 수 없습니다.');
 if(Boolean(from.layer)!==Boolean(to.layer)||from.layer&&a!==b)throw Error('레이어는 같은 인물 안에서 이동하세요.');
 const list=from.layer?a.layers.slice().reverse():project.actors.slice(),id=from.layer??from.actor,target=to.layer??to.actor;
 if(id===target)return;const i=list.findIndex(x=>x.id===id),item=list[i];if(i<0)throw Error('행을 찾을 수 없습니다.');list.splice(i,1);const j=list.findIndex(x=>x.id===target);if(j<0)throw Error('대상 행을 찾을 수 없습니다.');list.splice(j+(after?1:0),0,item);if(from.layer)a.layers=list.reverse();else project.actors=list;
}
