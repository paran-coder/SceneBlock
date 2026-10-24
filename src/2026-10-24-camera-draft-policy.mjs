export function cameraDraftMatches(draft,cameraId,time){return Boolean(draft&&draft.id===cameraId&&Number.isFinite(draft.time)&&Number.isFinite(time)&&Math.abs(draft.time-time)<1e-6);}
