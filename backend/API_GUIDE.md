
# 스트레칭 자세 교정 시스템 — Frontend API 연동 가이드

## 1. Backend 서버 정보

- Framework: FastAPI
- Database: SQLite
- 로컬 서버 주소: http://127.0.0.1:8000
- Swagger API 문서: http://127.0.0.1:8000/docs
- 데이터 형식: JSON
- 문서 기준 버전: 1.1

### CORS 허용 주소

- http://localhost:5173
- http://127.0.0.1:5173
- http://localhost:5174
- http://127.0.0.1:5174

주의: `127.0.0.1`은 현재 컴퓨터 자신을 의미합니다. 프론트엔드와 백엔드를 서로 다른 컴퓨터에서 실행할 경우 서버 접속 주소와 CORS 설정을 별도로 조정해야 합니다.

---

## 2. REST API 목록

| Method | Endpoint | 기능 |
|---|---|---|
| GET | `/` | 서버 기본 응답 |
| GET | `/health` | 서버 상태 확인 |
| GET | `/api/stretches` | 전체 스트레칭 목록 |
| GET | `/api/stretches/{stretch_id}` | 스트레칭 상세 |
| POST | `/api/sessions` | 운동 세션 생성 |
| POST | `/api/sessions/{session_id}/complete` | 운동 완료 및 결과 저장 |
| POST | `/api/sessions/{session_id}/cancel` | 운동 세션 취소 |
| GET | `/api/sessions/{session_id}` | 개별 운동 기록 |
| GET | `/api/sessions` | 전체 운동 기록 |
| GET | `/api/stats/summary` | 전체 운동 통계 |
| GET | `/api/stats/stretches` | 스트레칭별 통계 |

총 11개 엔드포인트이며, 서버 확인용 2개와 주요 기능용 9개로 구성됩니다.

---

## 3. 스트레칭 조회 API

### 3-1. 전체 스트레칭 목록

**요청**

`GET /api/stretches`

**응답 예시**

```json
[
  {
    "id": 1,
    "name": "목/어깨 측면 스트레칭",
    "description": "어깨를 수평으로 유지하는 동작",
    "target_seconds": 5
  },
  {
    "id": 2,
    "name": "팔/어깨 상체 굴곡 스트레칭",
    "description": "팔을 위로 뻗어 유지하는 동작",
    "target_seconds": 5
  },
  {
    "id": 3,
    "name": "스쿼트/하체 스트레칭",
    "description": "무릎과 상체 각도를 유지하는 동작",
    "target_seconds": 5
  }
]
```

프론트엔드의 스트레칭 선택 화면(UI-02)에서 사용합니다.

### 3-2. 스트레칭 상세 조회

**요청**

`GET /api/stretches/1`

선택한 스트레칭의 ID, 이름, 설명, 목표 유지시간을 반환합니다.

존재하지 않는 ID를 요청하면 HTTP 404 오류를 반환합니다.

---

## 4. 운동 세션 API

### 4-1. 운동 세션 생성

**요청**

`POST /api/sessions`

**Request Body**

```json
{
  "stretch_id": 1
}
```

**응답 예시 — HTTP 201**

```json
{
  "session_id": 10,
  "stretch_id": 1,
  "started_at": "2026-11-05T12:00:00+00:00",
  "status": "started"
}
```

프론트엔드는 응답의 `session_id`를 저장하고 이후 완료, 취소, 결과 조회 요청에 사용합니다.

### 4-2. 운동 완료 및 결과 저장

**요청**

`POST /api/sessions/{session_id}/complete`

**Request Body**

```json
{
  "duration_seconds": 15,
  "correct_seconds": 12
}
```

- `duration_seconds`: 전체 운동시간(초)
- `correct_seconds`: 정상 자세 유지시간(초)

**응답 예시 — HTTP 200**

```json
{
  "session_id": 10,
  "status": "completed",
  "duration_seconds": 15,
  "correct_seconds": 12,
  "success": true,
  "score": 80.0,
  "ended_at": "2026-11-05T12:00:15+00:00"
}
```

위 값은 설명을 위한 예시입니다.

**점수 계산**

`score = (correct_seconds / duration_seconds) * 100`

**성공 판정**

`success = correct_seconds >= target_seconds`

성공 여부와 점수는 백엔드에서 계산하므로 프론트엔드가 요청에 포함하지 않습니다.

**입력 검증**

- 전체 운동시간은 0보다 커야 합니다.
- 정상 자세 유지시간은 0 이상이어야 합니다.
- 정상 자세 유지시간은 전체 운동시간을 초과할 수 없습니다.
- 이미 완료되거나 취소된 세션은 완료 처리할 수 없습니다.

### 4-3. 운동 세션 취소

**요청**

`POST /api/sessions/{session_id}/cancel`

**Request Body**

별도 요청 본문이 필요하지 않습니다.

**상태 변경**

`started → cancelled`

취소 시 운동 결과 점수와 성공 여부를 새로 계산하지 않습니다.

**주의 사항**

- 이미 완료된 세션은 취소할 수 없습니다.
- 이미 취소된 세션을 다시 취소할 수 없습니다.
- 해당 경우 HTTP 409 오류를 반환합니다.
- 존재하지 않는 세션은 HTTP 404 오류를 반환합니다.

취소 API의 정확한 응답 필드 구성은 실행 중인 서버의 Swagger 문서에서 최종 확인합니다.

### 4-4. 운동 세션 상태

| 상태 | 의미 |
|---|---|
| `started` | 운동 시작, 진행 중 |
| `completed` | 운동 완료, 결과 저장 |
| `cancelled` | 운동 취소 |

**정상적인 상태 전이**

```text
          ┌──> completed
started ──┤
          └──> cancelled
```

완료 또는 취소된 세션은 다시 진행 상태로 변경하지 않습니다.

---

## 5. 운동 기록 조회 API

### 5-1. 개별 운동 기록

**요청**

`GET /api/sessions/{session_id}`

**완료 세션 응답 예시**

```json
{
  "session_id": 10,
  "stretch_id": 1,
  "stretch_name": "목/어깨 측면 스트레칭",
  "started_at": "2026-11-05T12:00:00+00:00",
  "ended_at": "2026-11-05T12:00:15+00:00",
  "duration_seconds": 15,
  "correct_seconds": 12,
  "success": true,
  "score": 80.0,
  "status": "completed"
}
```

진행 중이거나 취소된 세션에서는 결과 관련 필드가 `null`일 수 있습니다.

### 5-2. 전체 운동 기록

**요청**

`GET /api/sessions`

**선택적 조회 개수 제한**

`GET /api/sessions?limit=10`

전체 운동 기록을 최신순으로 조회하며 운동 기록 화면(UI-06)에서 사용합니다.

화면에서 `status`를 확인하여 완료, 진행 중, 취소 기록을 구분할 수 있습니다.

---

## 6. 운동 통계 API

### 6-1. 전체 운동 통계

**요청**

`GET /api/stats/summary`

**응답 구조 예시**

```json
{
  "total_sessions": 8,
  "completed_sessions": 7,
  "successful_sessions": 5,
  "success_rate": 71.43,
  "average_score": 75.5
}
```

위 숫자는 예시입니다.

- `total_sessions`: 전체 운동 세션 수
- `completed_sessions`: 완료된 세션 수
- `successful_sessions`: 성공한 세션 수
- `success_rate`: 완료 세션 대비 성공률(%)
- `average_score`: 완료 세션 평균 점수

취소 세션은 완료 세션의 성공률과 평균 점수 계산에 포함하지 않습니다.

### 6-2. 스트레칭별 운동 통계

**요청**

`GET /api/stats/stretches`

스트레칭별 완료 횟수, 평균 점수, 성공률, 운동시간 관련 통계를 조회합니다.

프론트엔드에서 운동 종류별 성과를 표시할 때 사용할 수 있습니다.

정확한 응답 필드명과 배열 구조는 Swagger의 실제 응답을 기준으로 확인합니다.

---

## 7. React 연동 방법

### 7-1. 환경변수

`frontend/.env.development`

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_USE_MOCK=false
```

프론트엔드에서는 이미 작성된 `src/services/api.js`의 API 호출 함수를 재사용합니다.

### 7-2. 운동 시작

```javascript
const response = await createSession(stretch.id);

dispatch({
  type: 'START_SESSION',
  sessionId: response.session_id,
});
```

운동 시작 API가 성공한 뒤 발급받은 세션 ID를 저장합니다.

### 7-3. 운동 완료

```javascript
await completeSession(
  sessionId,
  durationSeconds,
  correctSeconds
);
```

운동 완료 API가 성공하면 결과 화면에서 저장된 세션 정보를 조회합니다.

### 7-4. 운동 취소

```javascript
await cancelSession(sessionId);

dispatch({ type: 'RESET' });
```

운동 취소 API가 성공한 뒤 프론트엔드 세션 상태를 초기화합니다.

### 7-5. 운동 결과 조회

```javascript
const result = await getSession(sessionId);
```

결과 화면에서는 `score`, `success`, `correct_seconds` 등을 표시할 수 있습니다.

주의: 위 코드는 호출 흐름을 설명하는 예시입니다. 실제 페이지에서 사용하는 변수와 import 경로는 프론트엔드 구현에 맞춰 연결해야 합니다.

---

## 8. MediaPipe 및 자세 판정 연동

### 현재 확인된 구현

**화면인식 모듈**

- MediaPipe 기반 관절 인식
- 관절 좌표 추출
- 관절 연결선 시각화

**알고리즘 모듈**

- 관절 각도 계산
- 정상 자세 여부 판정
- 자세 교정 피드백 문구 출력

현재 `detector.py`는 Python OpenCV 웹캠 기반 프로토타입입니다.

### 권장 통합 구조

```text
React 카메라
    ↓
브라우저 MediaPipe
    ↓
관절 좌표 추출
    ↓
자세 판정 알고리즘
    ↓
정상 자세 유지시간 누적
    ↓
운동 종료
    ↓
FastAPI /complete
    ↓
SQLite 결과 저장
    ↓
React 결과 화면
```

실시간 프레임마다 FastAPI로 영상을 전송하는 방식은 기본 설계로 사용하지 않습니다.

브라우저 내부에서 자세를 판정하고 운동 완료 시 결과를 서버에 전달하는 구조를 우선 검토합니다.

### 추가 협의 사항

- 관절 좌표 데이터 형식
- 관절별 visibility 임계값
- 운동 종류별 정상 자세 기준
- 정상 자세 유지시간 계산 방식
- `not_detected` 상태에서 시간 처리 방식
- FPS 및 피드백 지연시간 측정
- Python 알고리즘의 JavaScript 이식 또는 별도 실행 방식

위 항목은 팀원 간 규격 확정이 필요합니다.

---

## 9. 오류 처리

| HTTP 코드 | 발생 상황 |
|---|---|
| 400 | 운동시간과 정상 자세 유지시간의 관계가 잘못된 경우 |
| 404 | 존재하지 않는 스트레칭 또는 세션 |
| 409 | 이미 완료·취소된 세션에 대한 중복 상태 변경 |
| 422 | 필수 값 누락 또는 잘못된 입력 형식 |

프론트엔드는 응답의 `detail`을 확인하여 사용자에게 오류를 안내합니다.

API 요청이 실패한 경우 성공한 것으로 간주하여 화면 상태를 변경하지 않습니다.

---

## 10. 현재 개발 상태

### 구현 완료

- FastAPI 서버 구축
- SQLite 데이터베이스 연동
- 스트레칭 3종 초기 데이터
- 스트레칭 조회 API
- 운동 세션 생성 API
- 운동 완료 및 결과 저장 API
- 운동 취소 API
- 개별 및 전체 기록 조회 API
- 전체 및 운동별 통계 API
- CORS 설정
- Swagger 문서 제공
- React API 호출 함수 작성

### 기존에 확인된 테스트

- 서버 Health Check
- 운동 세션 생성
- 운동 완료 및 결과 저장
- 점수 및 성공 여부 계산
- 저장된 운동 결과 재조회

### 추가 테스트 필요

- 운동 취소 API의 실제 요청·응답
- 취소 후 중복 요청 처리
- 스트레칭별 통계 응답 검증
- React 화면과 API의 실제 연결
- MediaPipe 판정 결과 자동 저장
- 정상 자세 유지시간 측정
- 전체 시스템 통합 테스트
- FPS 및 피드백 지연시간 측정

주의: 기존 Swagger 테스트의 운동시간과 정상 자세 유지시간은 수동으로 입력한 값입니다. 실제 AI 모듈과의 자동 연동은 아직 검증되지 않았습니다.

---

## 11. Backend 실행 방법

VS Code에서 `backend` 폴더로 이동합니다.

```powershell
cd backend
```

필요한 패키지가 설치되어 있지 않다면 다음 명령어를 실행합니다.

```powershell
python -m pip install -r requirements.txt
```

데이터베이스 초기화가 필요한 경우:

```powershell
python database.py
python seed.py
```

서버 실행:

```powershell
python -m uvicorn main:app --reload
```

접속 주소:

- 서버: http://127.0.0.1:8000
- Swagger: http://127.0.0.1:8000/docs
- Health Check: http://127.0.0.1:8000/health

기존 데이터베이스를 사용 중이라면 초기화 명령어의 실행 필요 여부를 먼저 확인합니다.

---

## 12. 팀원별 연동 역할

### 백엔드 — 나린

- REST API 제공 및 유지보수
- 운동 세션 생성·완료·취소
- SQLite 결과 저장 및 조회
- 운동 통계 제공
- 프론트엔드 API 연동 지원

### 알고리즘 — 상옥

- 관절 각도 계산
- 운동별 정상 자세 판정
- 정상 자세 유지시간 계산
- 자세 교정 피드백 생성
- 판정 데이터 형식 협의

### 프론트엔드 — 교명

- 스트레칭 목록 및 상세 화면 연동
- 운동 시작 시 세션 생성
- 운동 완료·취소 API 호출
- 실시간 피드백 화면 구현
- 운동 결과 및 기록 화면 연동

### 화면인식 및 처리 — 호중

- 카메라 영상 입력
- MediaPipe 관절 좌표 추출
- 관절 인식 신뢰도 확인
- 알고리즘에 랜드마크 전달
- FPS 및 영상처리 성능 측정 지원

---

## 13. 발표 준비 일정

| 날짜 | 목표 |
|---|---|
| 11월 8일 | API 및 데이터 규격 확정 |
| 11월 12일 | 최소 1개 동작 전체 시연 흐름 완성 |
| 11월 14일 | 시연 프로그램 안정화 |
| 11월 16일 | 시연영상 및 발표자료 완성 |
| 11월 17~18일 | 발표 리허설 |
| 11월 25일 | 컴공인의 날 본 발표 |

실시간 시연이 불안정할 경우를 대비해 정상 작동하는 프로그램의 시연영상을 사전에 제작합니다.

---

## 14. 통합 전 최종 확인사항

- [ ] 프론트엔드가 실제 FastAPI 서버에 연결되는가?
- [ ] 운동 시작 시 `session_id`가 정상 저장되는가?
- [ ] 카메라 영상에서 관절이 검출되는가?
- [ ] 자세 판정 결과가 실시간으로 표시되는가?
- [ ] 정상 자세 유지시간이 정확히 누적되는가?
- [ ] 운동 완료 시 결과가 SQLite에 저장되는가?
- [ ] 운동 취소 시 상태가 `cancelled`로 변경되는가?
- [ ] 완료·취소 중복 요청이 차단되는가?
- [ ] 결과 화면과 운동 기록 화면이 정상 표시되는가?
- [ ] 실제 FPS와 피드백 지연시간이 측정되는가?

