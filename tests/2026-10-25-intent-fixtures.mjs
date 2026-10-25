export const entity=(id='a',kind='actor',assetId=null,position=[0,0,0],rotation=null)=>({id,kind,assetId,label:id,color:'#aabbcc',dimensions:{width:null,height:null,depth:null,seatHeight:null},position,rotation,requirementIds:[]});
export const req=(id='r',kind='action',priority='required')=>({id,kind,priority,sourceIds:['source-1'],description:id});
export const action=(kind='wave',extras={})=>({id:'act',actorId:'a',kind,start:0,end:4,targetId:null,from:null,to:null,requirementIds:['r'],...extras});
export const shot=(extras={})=>({id:'shot',start:0,end:4,subjectIds:['a'],framing:'full',viewSide:'front',referenceId:'a',motion:'static',occlusion:'allow',requirementIds:['r'],...extras});
export const relation=(kind,extras={})=>({id:'rel',kind,subjectId:'a',objectId:'b',start:0,end:4,strength:'required',requirementIds:['r'],...extras});
export const fixture=(extras={})=>({schemaVersion:'1.0.0',name:'test',duration:4,entities:[entity()],requirements:[req()],actions:[action()],relations:[],shots:[],unresolved:[],coverage:[{sourceId:'source-1',requirementIds:['r'],status:'interpreted'}],...extras});
