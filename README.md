# defaultMD

Windows에서 `.md` 파일을 더블클릭하면 바로 열리는 가벼운 Markdown 뷰어 · 편집기입니다.
Edge에 설치하는 웹 앱(PWA)이라 별도 설치 파일이 없고, 한 번 설치하면 오프라인에서도 동작합니다.

*A lightweight Markdown viewer & editor for Windows, installed as an Edge web app (PWA). Korean / English UI.*

## 주요 기능

| 기능 | 설명 |
|---|---|
| 보기 · 수정 | **[Raw / 나란히 / 미리보기] × [읽기 / 수정]** 모든 조합. 미리보기 상태에서 바로 편집(WYSIWYG)도 가능 |
| 파일 | 새 파일 · 열기 · 저장 · 다른 이름으로 저장, 최근 파일, 마지막에 열어 둔 탭 복원 |
| 인코딩 | UTF-8(BOM) · UTF-16 · CRLF/LF 유지, EUC-KR 문서 열기 |
| 탭 · 화면 분할 | 여러 파일을 탭으로, 1 · 2 · 3 · 4(十) 분할, 탭을 다른 화면으로 끌어 옮기기 |
| 드래그 & 드롭 | 파일 · 폴더를 창에 끌어다 놓아 열기 |
| 표 | 칸을 골라 표 만들기, `Tab`/`Enter`로 칸 이동하며 자동 정렬(한글 폭 고려), 행 · 열 편집 메뉴, 표 편집기, Excel/웹 표 붙여넣기 변환 |
| 문법 도움 | 서식 툴바, 문법 가이드(F1), 줄 처음에서 `/` 입력 → 요소 목록(`/표`, `/코드` …) |
| 이미지 · 수식 · 다이어그램 | 상대경로 이미지, KaTeX 수식(`$…$`), Mermaid 다이어그램 |
| PDF | `Ctrl+P` → 인쇄 대화상자에서 "PDF로 저장" (`<!-- pagebreak -->`로 쪽 나누기) |
| 테마 · 언어 | 시스템 / 라이트 / 다크, 한국어 / English |

## 설치하고 기본 앱으로 지정하기

1. **Edge**에서 앱 주소를 엽니다.
2. 주소창 오른쪽의 **앱 설치** 아이콘을 누르거나, `⋯` 메뉴 → 앱 → **이 사이트를 앱으로 설치**를 선택합니다.
   (앱 안의 `⋯` 메뉴 → "앱으로 설치…"도 가능)
3. **Windows 설정 → 앱 → 기본 앱**에서 위쪽 검색 칸에 `.md`를 입력하고 **defaultMD**를 선택합니다.
   (앱 안의 `⋯` 메뉴 → ".md 기본 앱으로 설정…"에서 설정 화면을 바로 열 수 있습니다. `.markdown`도 같은 방법)
4. 탐색기에서 `.md` 파일을 더블클릭하면 처음 한 번 Edge가 파일 열기 허용을 묻습니다. **허용**을 선택하세요.

이미 앱 창이 열려 있으면 새 창 대신 그 창의 새 탭으로 열립니다. 새 버전은 앱을 열 때 자동으로 적용됩니다.

## 단축키

| 키 | 동작 |
|---|---|
| `Ctrl+N` / `Ctrl+O` / `Ctrl+S` | 새 파일 / 열기 / 저장 |
| `Ctrl+Shift+S` | 다른 이름으로 저장 |
| `Ctrl+P` | PDF로 저장 (인쇄) |
| `Ctrl+W` | 탭 닫기 |
| `Ctrl+E` | 읽기 ⇄ 수정 |
| `Ctrl+/` · `Ctrl+Shift+/` | Raw ⇄ 미리보기 · 나란히 보기 |
| `Ctrl+\` | 옆 화면에서 열기 |
| `Ctrl+Tab` · `Ctrl+1~9` · `F6` | 탭 전환 · n번째 탭 · 분할 화면 이동 |
| `Ctrl+B` / `I` / `K` | 굵게 / 기울임 / 링크 |
| `Tab` · `Shift+Tab` · `Enter` (표 안) | 다음 칸 · 이전 칸 · 아래 칸 (자동 정렬) |
| `F1` | 문법 가이드 |

## 알아 둘 점 (웹 앱 버전의 제약)

- **상대경로 이미지**는 처음 한 번 "폴더 접근 허용"이 필요합니다. 폴더를 통째로 끌어다 놓으면 자동으로 허용됩니다.
- **EUC-KR** 문서는 열 수 있지만 저장하면 UTF-8로 저장됩니다(브라우저에 EUC-KR 인코더가 없음).
- 미리보기 상태 편집은 바뀐 블록만 다시 쓰고 나머지는 원문을 그대로 둡니다. 참조 링크 정의(`[id]: url`)가 있는 문서는 내용 손실을 막기 위해 미리보기 편집이 잠깁니다(Raw에서 편집).
- 다이어그램 · 수식 라이브러리는 크기가 커서 **처음 사용할 때** 내려받습니다. 오프라인에서는 한 번 이상 열어 본 뒤부터 표시됩니다.

## 개발

```bash
npm install
npm run dev        # http://localhost:1420
npm run check      # 타입 검사
npm test           # 단위 테스트 (Vitest)
npm run build      # dist/ (PWA)
npm run preview    # http://localhost:4173 (빌드 결과, 서비스 워커 포함)
```

- 스택: Svelte 5 · TypeScript · Vite · CodeMirror 6 · markdown-it · Milkdown · KaTeX · Mermaid
- `main` 브랜치에 push하면 GitHub Actions가 테스트 → 빌드 → GitHub Pages에 배포합니다 (`.github/workflows/deploy.yml`).
- 설계와 진행 상황: [PLAN.md](PLAN.md). Tauri 네이티브 버전(`src-tauri/`)은 코드 서명 인증서를 확보한 뒤 진행 예정(M10).
