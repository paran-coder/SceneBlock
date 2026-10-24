// Legacy rotation remains the authoritative yaw for route-facing compatibility.
export function entityRotation(entity,yaw=entity.rotation??0){return [entity.rotation3D?.[0]??0,yaw,entity.rotation3D?.[2]??0];}
