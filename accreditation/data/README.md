# 기관평가인증 편람 데이터 — 새 연도 편람 추가 방법

웹페이지는 `data/handbooks.json`에 적힌 편람 목록을 읽고, 고른 편람의 데이터 파일로 화면 전체를 만듭니다.
제목·연도 표기, "○○○○ 변경" 탭, 심사대상 기간, 백문백답 안내문, 설명회 자료 쪽 그림은 모두 이 목록과 데이터에서 계산되므로,
새 편람이 나오면 **코드는 고치지 않고 파일만 추가**하면 됩니다.

## 1. 추가할 파일 (예: 2028년 편람)

| 파일 | 내용 |
|---|---|
| `data/accreditation-2028.json` | 2028 편람 본문 데이터(아래 3. 형식) |
| `docs/2028/briefing/s{쪽}.jpg` | 2028 설명회 자료 쪽 그림(설명회 해설 팝업용, 선택) |
| `data/qa-2027.json`, `docs/2027/qa/p{쪽}.jpg` | 새 백문백답 자료집이 나오면(선택) |

## 2. `data/handbooks.json`에 한 줄 추가

맨 위에 둔 편람(또는 `"default": true`)이 처음 열립니다. 이용자가 설정 > 기준 편람에서 다른 연도를 고르면 그 선택을 기억합니다.

```json
[
  {
    "id": "2028",
    "year": 2028,
    "name": "2028년 편람 (4주기)",
    "data": "data/accreditation-2028.json",
    "docs": "docs/2028/",
    "qa": "data/qa-2026.json",
    "qaYear": 2026,
    "qaDocs": "docs/2026/qa/"
  },
  { "id": "2027", "year": 2027, "name": "2027년 편람 (4주기)", "data": "data/accreditation-2027.json", "docs": "docs/2027/", "qa": "data/qa-2026.json", "qaYear": 2026, "qaDocs": "docs/2026/qa/" }
]
```

- `year`: 평가(심사) 연도. 심사대상 기간(직전 2개 학년도 등)은 이 값으로 계산합니다.
- `fullPdf`, `fullPages`: 편람 원문 PDF 파일 이름(`docs/YYYY/` 안)과 쪽수. 있으면 첫 화면·설정에 'PDF 받기' 버튼이 생깁니다.
- `pages`, `pageOffset`: 편람 쪽 그림 폴더(`docs/YYYY/pages/p{인쇄쪽}.png`)와 PDF 쪽 − 인쇄 쪽 차이(2027은 4). 있으면 '편람 N쪽' 표시가 원문 쪽 팝업 버튼이 되고, 'PDF로 열기'는 그 쪽으로 바로 열립니다. 쪽 그림은 PDF에서 130dpi로 만들어 여백을 자르고 64색으로 줄입니다.
- `qa`, `qaYear`: 백문백답 자료와 그 기준 연도. `qaYear`가 `year`보다 이르면 "자료범위가 N년 늦춰진다"는 안내가 자동으로 붙습니다. 백문백답이 없으면 `qa`를 빼면 됩니다.

## 3. 편람 데이터 형식 (`accreditation-YYYY.json`)

`accreditation-2027.json`과 같은 구조를 따릅니다.

- `meta`: `title`, `cycle`(예: 4주기), `publisher`, `published`(발간일), `briefing`(설명회 이름과 날짜)
- `notice`: 일러두기 문장 목록
- `areaList`: 평가영역 → `criteria`(평가준거) → `elements`(평가요소)
  - 평가요소: `id`, `q`(평가요소 질문), `page`(편람 쪽), `type`(정성/정량), `items`(판단항목 a·b·c, `tags`에 "사후"), `quant`(정량 기준), `refs`(평가활용 참고자료), `notes`(주요 확인 및 유의사항, 작성양식, 산출식)
- `short`: 평가요소 짧은 이름(목차용)
- `brief`: 평가요소별 설명회 해설(`kind` 변경 종류, `slides` 설명회 쪽, `pts` 요점)
- `slideTitles`: 설명회 자료 쪽 번호 → 제목. **여기에 없는 쪽을 가리키는 버튼은 화면에서 자동으로 숨겨집니다.**
- `guide`(선택): 평가 안내 화면의 그해 일정(`schedule`)과 입증자료 제출 방식(`submit`). 없으면 그 칸만 빠집니다. 제출 방식 표는 평가인증 절차 6단계 안에 표시됩니다.
- `process`(선택): 평가인증 절차 화면. `intro`, `chain`(심사→검토→심의→판정), `phases`(준비·평가·판정·후속) → `steps`(`n` 번호, `name`, `who` 주관, `when` 그해 일정, `page` 편람 쪽, `slides` 설명회 쪽, `pts` 요점, `todo` 우리 대학 할 일). 없으면 목차에서 화면만 비어 보입니다.

## 4. 만드는 순서

1. 새 편람 PDF와 설명회 자료(pptx)를 프로젝트에 올리고 Claude에게 "2028 편람 데이터 만들어줘"라고 요청합니다. 2027 데이터를 만든 방식(쪽별 텍스트 추출 → 평가요소 단위 정리 → 원문 대조)대로 `accreditation-2028.json`을 만듭니다.
2. `handbooks.json`에 위 예시처럼 한 줄을 추가합니다.
3. 미리보기에서 확인한 뒤 GitHub `accreditation/data/`, `accreditation/docs/`에 올립니다. 이전 연도 파일은 지우지 않고 그대로 두면, 설정에서 지난 편람도 계속 볼 수 있습니다.

※ `data/refs.json`과 `refs/`(참고자료)는 관리자 화면에서 GitHub에 직접 올리는 파일이므로 이 작업과 상관없습니다.
