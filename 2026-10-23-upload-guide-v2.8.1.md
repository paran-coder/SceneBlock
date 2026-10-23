# SceneBlock v2.8.1 업로드 안내

1. ZIP을 압축 해제합니다.
2. 2026-10-23-SceneBlock-v2.8.1-github-upload 폴더 안의 내용 전체를 GitHub 저장소 루트에 올립니다. 폴더 자체를 한 단계 더 넣지 마세요.
3. public 폴더와 숨김 파일 .gitignore, .vercelignore를 포함합니다. ZIP 자체를 소스 대신 올리지 않습니다.
4. Vercel 설정은 Build: npm run build / Output: dist 입니다. 저장소에 연동된 배포가 완료되는지 확인합니다.
5. 공개 페이지에서 v2.8.1 표시와 사용자 매뉴얼 버튼을 확인합니다. 매뉴얼 URL은 /2026-10-23-user-manual.html 입니다.

매뉴얼, OG 이미지, 정적 자산, 기존 v2.6.0 AI 설치기를 포함합니다.
node_modules, dist, runtime, 로컬 검증 캡처, .git, 환경 파일은 포함하지 않습니다.
기존 설치자는 이번 매뉴얼 추가만으로 연결 프로그램을 재설치할 필요가 없습니다.
실제 AI 생성과 공개 배포는 이 패키징 작업에서 검증하지 않았습니다.
