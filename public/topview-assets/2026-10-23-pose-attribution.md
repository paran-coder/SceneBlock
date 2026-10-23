# SceneBlock v2.1.0 pose asset attribution

Scene3D built-in assets © Topview, CC BY 4.0.
https://creativecommons.org/licenses/by/4.0/

The 121 poses and 121 pose cover images were copied without modification from the locally supplied Topview source builtin-assets folder. Original LICENSE and NOTICE are preserved in poses/2026-10-23-LICENSE.txt and poses/2026-10-23-NOTICE.txt. Catalog metadata is derived from its manifest.json.

Pose conversion implementation is first-party SceneBlock code based on inspection of the upstream world-space delta semantics. applyLibraryPose receives a model root and original pose document, with the caller responsible for resetting bones and positions before each evaluation. Library hip translations subtract the source T-pose reference and convert metre offsets through the actor/model frame into the hips parent space. Offsets scale by bind-pose leg length when identifiable. applyJointOffsets accepts XYZ degrees by exact or normalized Mixamo bone name and multiplies onto the current pose. These controls are local joint adjustments, not IK or anatomical constraints.
