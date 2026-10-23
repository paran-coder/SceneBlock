import {Output,BufferTarget,WebMOutputFormat,CanvasSource} from 'mediabunny';
// Deterministic timestamped frame export, using the same encoder/muxer as Topview.
export async function encodeStageVideo(stage,project,onFrame){
 if(!globalThis.VideoEncoder)throw new Error('이 환경에서는 WebCodecs 영상 인코딩을 지원하지 않습니다.');
 const canvas=stage.renderer.domElement;
 const capture=document.createElement('canvas');capture.width=canvas.width;capture.height=canvas.height;
 const context=capture.getContext('2d',{alpha:false});
 const target=new BufferTarget(),output=new Output({format:new WebMOutputFormat(),target});
 const source=new CanvasSource(capture,{codec:'vp8',bitrate:6000000,keyFrameInterval:1});
 output.addVideoTrack(source,{frameRate:project.fps});
 const count=Math.max(1,Math.ceil(project.duration*project.fps));
 try{await output.start();for(let i=0;i<count;i++){const time=i/project.fps;stage.update(time);context.drawImage(canvas,0,0);await source.add(time,1/project.fps);onFrame(time,(i+1)/count);if(i%10===0)await new Promise(resolve=>setTimeout(resolve,0))}source.close();await output.finalize();if(!target.buffer||target.buffer.byteLength<512)throw new Error('영상 프레임 인코딩에 실패했습니다.');return new Blob([target.buffer],{type:'video/webm'})}catch(error){if(output.state!=='canceled'&&output.state!=='finalized')await output.cancel().catch(()=>{});throw error}
}

