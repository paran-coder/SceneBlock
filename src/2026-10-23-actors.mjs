export const ACTOR_PALETTE=['#e9ad70','#77b7e5','#b4ce75','#c294e1','#73cfc1','#ed8ba0','#dfcb79','#8fa7ef'];
function hueColor(h){const s=.55,l=.65,a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0')};return '#'+f(0)+f(8)+f(4);}
export function nextActorColor(actors){const used=new Set(actors.map(a=>a.color?.toLowerCase()));for(const color of ACTOR_PALETTE)if(!used.has(color))return color;for(let i=0;i<10000;i++){const color=hueColor((i*137.508)%360);if(!used.has(color))return color;}throw Error('사용할 수 있는 인물 색상이 없습니다.');}
function letters(n){let result='';do{result=String.fromCharCode(65+n%26)+result;n=Math.floor(n/26)-1}while(n>=0);return result;}
export function nextActorName(actors){const used=new Set(actors.map(a=>a.name));let index=actors.length,name;do{name='인물 '+letters(index++)}while(used.has(name));return name;}
