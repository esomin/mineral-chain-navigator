# 시뮬레이션 결과와 AI 인사이트 연동 설계

## 1. 개요 및 설계 목적
* **연동 대상**: 충격 시뮬레이션 결과(공급 결손 및 병목 데이터)와 Gemini 2.5 Flash 기반의 AI 인사이트 채팅 패널
* **설계 목적**: 사용자가 시뮬레이션을 실행하여 공급 부족 현상을 파악한 후, 이를 해결하기 위한 대체 수송로 및 비즈니스 리스크 완화 조치를 단 한번의 클릭으로 AI에게 추천받을 수 있도록 유기적인 사용자 경험(UX)을 구축하기 위함

---

## 2. 세부 구성 및 설계 사양

### 가. 결과 패널 내 AI 연동 트리거 (AI Recommendation Trigger)
시뮬레이션 완료 후 2열 결과 패널 내에서 AI 대안 분석을 즉시 요청할 수 있는 트리거 버튼 구현
1. **연동 버튼 배치 및 스타일**
   - **위치**: 2열 결과 요약 카드(`SimulationResultSection`)의 부족률 테이블 하단에 배치
   - **스타일**: `🪄 AI에게 대안 공급망 및 조치 추천받기` (배경색: `bg-emerald-600`, 텍스트: `text-white font-bold`, 높이: `h-8`)
2. **이벤트 디스패치 메커니즘 (CustomEvent)**
   - 버튼 클릭 시 React 컴포넌트 간의 직접적인 참조 관계를 피하고 독립성을 유지하기 위해 표준 DOM CustomEvent인 `trigger-ai-recommendation`을 전역(`window`)에 발행합니다.
   - **이벤트 상세 데이터**: `{ detail: { simulationId: result.scenarioId } }`

### 나. AI 인사이트 패널 자동 활성화 (Auto-activation Panel)
이벤트 수신을 통한 AI 채팅 패널의 동적 슬라이드인(Slide-in) 활성화
1. **이벤트 리스닝 및 상태 동기화**
   - 메인 대시보드 뷰(`GraphView.tsx`)에서 `trigger-ai-recommendation` 이벤트를 구독합니다.
   - 이벤트 감지 시 AI 인사이트 패널의 열림 상태(`showAIPanel`)를 `true`로 자동 전환하여 패널을 화면 우측에서 스무스하게 렌더링합니다.

### 다. 백엔드 대안 추천 API 연동 (Alternative Recommendation API)
시뮬레이션 ID를 기반으로 백엔드 추천 서비스와 통신하여 대화 이력에 결과를 추가
1. **추천 API 호출 및 비동기 처리**
   - AI 인사이트 패널(`AIInsightPanel.tsx`)에서 이벤트를 수신하면 `fetchAlternativeRecommendations(simulationId)` 비동기 함수를 호출합니다.
   - **엔드포인트**: `POST /api/insights/recommend`
   - **요청 데이터**: `{ sessionId, simulationId }`
2. **UI/UX 흐름 연출**
   - **사용자 요청 메시지 기록**: API 호출과 동시에 사용자의 질문 말풍선(예: `[시뮬레이션 결과 연동] 시나리오(ID: ...)에 기반한 대체 공급망 경로...`)을 대화방 리스트에 선제 등록하고 타이핑 로딩 바(`TypingIndicator`)를 활성화합니다.
   - **Gemini 분석 답변 출력**: 추천 완료 시 Gemini가 제안한 대체 수송 경로 목록, 타당성 점수 및 비즈니스 근거가 담긴 마크다운 줄글 답변과 참고 출처 인용(`citations`) 카드들을 말풍선 리스트에 부드럽게 출력합니다.
   - **에러/재시도 처리**: 통신 에러 발생 시 에러 정보 블록과 함께 재시도(`onRetry`) 버튼을 동적으로 매핑합니다.

---

## 3. 핵심 아키텍처 및 구현 요건
* **비동기 이벤트 기반 결합 (Decoupled Decoupling)**:
  - 2열 제어 패널과 AI 사이드 패널은 직접적인 의존성 없이 `trigger-ai-recommendation` 이벤트를 매개로 통신해야 합니다.
* **대안 경로 구조화 및 예외 처리 (Robust Alternative Parsing)**:
  - 백엔드가 전송하는 `AlternativeRoute[]` 구조(대안 설명, 수송 경로 노드 배열, 타당성 스코어)를 무결하게 파싱하며, LLM 응답 실패 시에도 공급망 데이터 내 정상 노드들을 활용한 폴백 데이터가 부드럽게 프론트엔드로 전달되도록 설계합니다.
* **시각적 완성도 확보 (Visual Opacity)**:
  - AI 인사이트 패널 및 시뮬레이션 2열 패널의 배경을 투명도가 없는 불투명 `bg-white` 또는 `bg-slate-50`으로 정립하여, 뒷배경의 복잡한 공급망 네트워크 그래프가 텍스트 위로 비쳐 보이는 시각적 간섭 현상을 완전히 차단합니다.
