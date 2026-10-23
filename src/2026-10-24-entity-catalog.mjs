export const VEHICLES=[['car','자동차'],['suv','SUV'],['van','승합차'],['bus','버스'],['truck','트럭'],['motorcycle','오토바이'],['bicycle','자전거']].map(([kind,name])=>({kind,name,nameKorean:name,category:'vehicles'}));
export const FURNITURE=[['table','테이블'],['box','상자'],['wall','벽'],['chair','의자'],['bench','벤치'],['sofa','소파'],['door','문'],['window','창문'],['stairs','계단']].map(([kind,name])=>({kind,name,nameKorean:name,category:'props'}));
export const PROP_CATALOG=[...FURNITURE,...VEHICLES];
export function characterProfile(key=''){if(key.includes('461b'))return {height:1.2,headScale:.82};if(key.includes('de378'))return {height:1.55,headScale:.9};return {height:1.75,headScale:1};}
export function pathEditingStart(actor){return (actor.clips?.filter(c=>['walk','run'].includes(c.action)).sort((a,b)=>a.start-b.start)[0]?.start)??(['walk','run'].includes(actor.action)?actor.start:0);}
