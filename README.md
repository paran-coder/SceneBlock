# FRAME Previs Web v2.0.0

브라우저에서 장면·인물 동선·동작·카메라 컷을 편집하는 프리비즈 도구입니다. 기본 편집에는 CMD, Blender, Electron, Python, 모델 다운로드가 필요하지 않습니다. Chrome 데스크톱을 기준으로 검증했습니다.

## GitHub → Vercel 배포

1. 이 폴더의 **내용 전체**를 GitHub 저장소 최상위에 올립니다. `package.json`, `index.html`, `vercel.json`이 저장소 바로 아래 있어야 합니다.
2. Vercel에서 Add New → Project → 해당 GitHub 저장소를 Import합니다.
3. Framework: **Vite**, Root Directory: **./**, Install: **npm ci**, Build: **npm run build**, Output: **dist**. Node.js는 **24.x**를 선택합니다.
4. Deploy 후 제공되는 HTTPS 주소로 접속합니다. 기본 기능에는 환경변수나 API 키가 필요하지 않습니다.

`node_modules`, `dist`, 실행 환경, 모델, 검증 영상은 업로드하지 않습니다. 배포 소스 ZIP에 필요한 소스·자산·라이선스가 포함됩니다. 실제 GitHub 업로드 및 Vercel 배포는 아직 수행하지 않았습니다.

## 사용법

장면 설명에 “카페에서 두 사람이 마주 앉아 대화한다”를 입력하고 장면 구성하기를 누릅니다. 현재 설명 해석은 한국어 규칙 파서이며 GPT 호출이 아닙니다. 지원 범위를 벗어난 문장은 원하는 장면을 만들지 못할 수 있습니다.

인물을 선택하고 위치·방향·기본 행동·시작/종료·이동 종료 위치를 조정합니다. 마우스로 편집 시점을 잡아 카메라로 저장하고, 카메라 컷 편집에서 시간을 정합니다. 촬영 미리보기와 타임라인으로 결과를 확인합니다.

프로젝트 저장은 JSON 파일을 PC에 저장합니다. 열기로 복원하며 자동 저장은 제공하지 않습니다. 영상 내보내기는 촬영 화면을 30fps WebM으로 내려받습니다. 브라우저 WebCodecs 지원이 필요하며 화면 크기에 따라 영상 해상도가 달라집니다. 고해상도·긴 장면은 시간이 걸릴 수 있습니다.

“미리 생성된 공식 예제 적용”은 포함된 Kimodo 결과를 적용하며 새 AI 생성이 아닙니다. 파일과 장면은 서버로 업로드하지 않습니다.

## 선택형 Kimodo

새 AI 동작 생성은 별도 로컬 Python/CUDA 엔진, GPU, 모델 약 17.55GB 및 Hugging Face의 Llama 모델 접근 승인이 필요합니다. 기본 기능과 분리되어 있으며 자동 설치하지 않습니다. [엔진 안내](docs/2026-10-23-local-engine.md)를 참고하세요. 웹 화면에서 엔진 소스를 ZIP으로 받을 수도 있습니다.

정확한 배포 주소를 허용 Origin으로 지정해 엔진을 실행하고 터미널의 연결 코드를 웹앱에 입력한 뒤 고급 기능을 켭니다. 연결 코드와 HF 키는 메모리에서만 사용합니다. 모델 설치를 누르면 키가 사용자 PC의 로컬 엔진으로 전달됩니다. 브라우저의 로컬 네트워크 권한 승인이 필요할 수 있습니다. 실제 배포 HTTPS 주소에서 로컬 엔진 연결 및 새 모델 추론은 미검증입니다.

## 개발 검증

```powershell
npm ci
npm test
npm run build
npm run check:package
npm run dev
```

`npm run test:browser`는 설치된 Chrome 및 ffprobe가 있는 개발 환경에서 통합 검증하며 일반 사용자에게 필요하지 않습니다. 선택 엔진 테스트는 `python -B local-engine/2026-10-23-connector-test.py`입니다.

## 출처와 라이선스

Topview 3D Builder의 캐릭터 자산을 사용하는 독립 Three.js 편집기이며 Topview Studio 전체를 이식한 제품은 아닙니다. 자산의 CC BY 4.0 출처는 `public/topview-assets/NOTICE`와 동봉 LICENSE를 확인하세요. Kimodo 예제와 선택 엔진 소스, Three.js/DRACO 라이선스도 각 폴더에 동봉했습니다. 상위 프로젝트 링크: [Topview](https://github.com/topviewai/topview-3d-builder), [Kimodo](https://github.com/nv-tlabs/kimodo).
