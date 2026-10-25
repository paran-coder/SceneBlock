# SceneBlock v2.14.0
현재 개발폴더: 2026-10-23-SceneBlock-v2.8.0. 웹 v2.14.0 / 기존 연결기 v2.10.3.
포즈블럭에서 저장한 범용 JSON을 기존 인물에게 적용하고, 카메라 생성부터 촬영 구간 배치까지 이어지는 흐름과 설정 ? 도움말을 제공합니다. 기존 캐릭터/수동 편집은 유지했습니다.
- 사용법: docs/2026-10-25-v214-user-guide.md
- 결과: 개발폴더 docs/2026-10-25-v214-results.md
- 변경 목록/백업: 2026-10-25-SceneBlock-v2.14.0-work
- 변경파일 ZIP: 2026-10-25-SceneBlock-releases-v1.0.0/2026-10-25-SceneBlock-v2.14.0/2026-10-25-SceneBlock-v2.14.0-changed-files.zip
ZIP은 v2.13.3 소스 위에 경로를 유지해 적용하고 npm run build로 빌드합니다. 개발은 개발폴더에서 npm run dev입니다. 공개 사이트와 설치기는 이번에 변경하지 않았습니다. 포즈는 원본 뼈대 정보 한계로 근사 변환입니다.

---

# SceneBlock v2.13.2 · 연결기 v2.10.2

사용 중 오탐을 수정하고 명시적 확인을 받는 SceneBlock 연결기 종료 버튼을 추가했습니다. 실제 사용자PC 종료는 미실행. 상세 docs/2026-10-25-installer-busy-results.md.

# SceneBlock v2.13.1 · 연결기 v2.10.1

구버전 설치와 실행 로그·설정만 남은 폴더의 표시를 구분합니다. AI 생성/수동 기능/캐릭터 외형은 v2.13.0 그대로입니다. 새 설치기 파일로 실행해야 관리창 표시가 바뀝니다.

# SceneBlock v2.13.0

AI 초안 표현 범위·설명 재작성·동일 탭 연결 복구를 개선했습니다. 캐릭터 외형과 수동 편집 UI는 유지했습니다. 새 연결기 v2.10.0을 설치 · 업데이트한 뒤 사용하세요.

# SceneBlock v2.13.0 AI 프리비즈 개선

사용자가 승인한 범위는 AI 생성·설명 수정·동일 탭 연결 유지/복구다. 캐릭터 모델/크기/외형, 수동 편집 UI와 기존 기능은 유지했다. 별도 SceneBlock 저장소/실제 설치/계정/공개 배포는 변경하지 않았다. 기존 파일 백업: dev/2026-10-25-ai-previs-v2.12.1-backup.


상세 변경/제한: docs/2026-10-25-ai-previs-results.md. 실행 npm run dev / 빌드 npm run build / 검증 npm test 및 npm run check:package. 실제 제공자 품질과 공개 배포는 별도 검증이 필요합니다.
