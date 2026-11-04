
# 스트레칭 자세 교정 시스템 — Frontend API 연동 가이드

## 1. Backend 서버 정보

- Framework: FastAPI
- Database: SQLite
- 로컬 서버 주소: `http://127.0.0.1:8000`
- Swagger API 문서: `http://127.0.0.1:8000/docs`
- 데이터 형식: JSON
- API 버전: 1.0.0

프론트엔드 개발 서버에서 요청할 수 있도록 다음 주소에 대한 CORS 설정이 적용되어 있습니다.

- `http://localhost:5173`
- `http://127.0.0.1:5173`

**주의:** `127.0.0.1`은 현재 컴퓨터 자신을 의미합니다. 프론트엔드와 백엔드를 서로 다른 컴퓨터에서 실행할 경우 백엔드 서버의 접속 주소 및 CORS 설정을 변경해야 합니다.

---

## 2. REST API 목록

| HTTP Method | Endpoint | 기능 |
|---|---|---|
| GET | `/` | 서버 기본 응답 |
| GET | `/health` | 서버 상태 확인 |
| GET | `/api/stretches` | 전체 스트레칭 목록 조회 |
| GET | `/api/stretches/{stretch_id}` | 스트레칭 상세 조회 |
| POST | `/api/sessions` | 운동 세션 생성 |
| POST | `/api/sessions/{session_id}/complete` | 운동 세션 종료 및 결과 저장 |
| GET | `/api/sessions/{session_id}` | 개별 운동 기록 조회 |
| GET | `/api/sessions` | 전체 운동 기록 조회 |
| GET | `/api/stats/summary` | 운동 통계 조회 |

---

## 3. 주요 API 사용 예시

### 3-1. 스트레칭 목록 조회

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

현재 데이터베이스에는 스트레칭 3종이 등록되어 있습니다.

### 3-2. 스트레칭 상세 조회

**요청**

`GET /api/stretches/1`

선택한 스트레칭의 ID, 이름, 설명, 목표 유지시간을 조회합니다.

존재하지 않는 ID를 요청하면 HTTP 404 오류를 반환합니다.

### 3-3. 운동 세션 생성

**요청**

`POST /api/sessions`

**Request Body**

```json
{
  "stretch_id": 1
}
```

**Response 예시 — HTTP 201**

```json
{
  "session_id": 8,
  "stretch_id": 1,
  "started_at": "2026-11-04T12:00:51.918607+00:00",
  "status": "started"
}
```

- `session_id`: 생성된 운동 세션 번호
- `stretch_id`: 선택한 스트레칭 번호
- `started_at`: 운동 시작 시각(UTC)
- `status`: 운동 시작 상태

프론트엔드는 반환된 `session_id`를 보관하고 운동 종료 및 결과 조회에 사용합니다.

### 3-4. 운동 세션 종료 및 결과 저장

**요청**

`POST /api/sessions/{session_id}/complete`

**Request Body**

```json
{
  "duration_seconds": 12,
  "correct_seconds": 8
}
```

- `duration_seconds`: 전체 운동시간(초)
- `correct_seconds`: 정상 자세 유지시간(초)

**주의:** `success`와 `score`는 요청 데이터에 포함하지 않습니다. 백엔드에서 자동 계산합니다.

**Response 예시 — HTTP 200**

```json
{
  "session_id": 8,
  "status": "completed",
  "duration_seconds": 12,
  "correct_seconds": 8,
  "success": true,
  "score": 66.67,
  "ended_at": "2026-11-04T12:02:03.387315+00:00"
}
```

**점수 계산 공식**

`score = (correct_seconds / duration_seconds) * 100`

예시: 전체 운동시간 12초 중 8초 동안 정상 자세를 유지하면 66.67점입니다.

**성공 여부 판정**

`success = correct_seconds >= target_seconds`

스트레칭별 목표 유지시간 이상 정상 자세를 유지하면 성공으로 판정합니다.

현재 등록된 스트레칭 3종의 목표 유지시간은 각각 5초입니다.

**입력값 검증**

- 전체 운동시간은 0보다 커야 합니다.
- 정상 자세 유지시간은 0 이상이어야 합니다.
- 정상 자세 유지시간은 전체 운동시간을 초과할 수 없습니다.
- 이미 종료된 세션은 다시 종료할 수 없습니다.

### 3-5. 개별 운동 기록 조회

**요청**

`GET /api/sessions/{session_id}`

**응답 예시**

```json
{
  "session_id": 8,
  "stretch_id": 1,
  "stretch_name": "목/어깨 측면 스트레칭",
  "started_at": "2026-11-04T12:00:51.918607+00:00",
  "ended_at": "2026-11-04T12:02:03.387315+00:00",
  "duration_seconds": 12,
  "correct_seconds": 8,
  "success": true,
  "score": 66.67
}
```

운동 종료 후 저장된 결과를 조회하는 기능입니다.

운동이 아직 종료되지 않은 세션은 종료 시각, 정상 자세 유지시간, 성공 여부, 점수가 `null`일 수 있습니다.

### 3-6. 전체 운동 기록 조회

**요청**

`GET /api/sessions`

전체 운동 기록을 최신순으로 조회합니다.

운동 기록 화면(UI-06)에서 사용할 수 있습니다.

### 3-7. 운동 통계 조회

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

위 숫자는 예시이며 실제 데이터베이스 기록에 따라 달라집니다.

- `total_sessions`: 전체 운동 세션 수
- `completed_sessions`: 완료된 운동 세션 수
- `successful_sessions`: 성공한 운동 세션 수
- `success_rate`: 완료 세션 대비 성공률(%)
- `average_score`: 완료 세션 평균 점수

---

## 4. React 연동 예시

### 4-1. API 기본 주소

```javascript
const API_BASE_URL = "http://127.0.0.1:8000";
```

### 4-2. 스트레칭 목록 조회

```javascript
async function getStretches() {
  const response = await fetch(
    `${API_BASE_URL}/api/stretches`
  );

  if (!response.ok) {
    throw new Error(
      `API 요청 실패: ${response.status}`
    );
  }

  return await response.json();
}
```

### 4-3. 운동 세션 생성

```javascript
async function createSession(stretchId) {
  const response = await fetch(
    `${API_BASE_URL}/api/sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        stretch_id: stretchId
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `세션 생성 실패: ${response.status}`
    );
  }

  return await response.json();
}
```

### 4-4. 운동 세션 종료

```javascript
async function completeSession(
  sessionId,
  durationSeconds,
  correctSeconds
) {
  const response = await fetch(
    `${API_BASE_URL}/api/sessions/${sessionId}/complete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        duration_seconds: durationSeconds,
        correct_seconds: correctSeconds
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `세션 종료 실패: ${response.status}`
    );
  }

  return await response.json();
}
```

### 4-5. 개별 운동 기록 조회

```javascript
async function getSession(sessionId) {
  const response = await fetch(
    `${API_BASE_URL}/api/sessions/${sessionId}`
  );

  if (!response.ok) {
    throw new Error(
      `운동 기록 조회 실패: ${response.status}`
    );
  }

  return await response.json();
}
```

---

## 5. 오류 처리

| HTTP 상태 코드 | 발생 상황 |
|---|---|
| 400 | 정상 자세 유지시간이 전체 운동시간보다 큰 경우 |
| 404 | 존재하지 않는 스트레칭 또는 운동 세션 |
| 409 | 이미 종료된 운동 세션을 다시 종료하는 경우 |
| 422 | 음수 운동시간, 필수 필드 누락 등 입력값 오류 |

프론트엔드는 오류 발생 시 서버에서 반환한 `detail` 메시지를 참고하여 사용자에게 적절한 안내를 표시합니다.

---

## 6. 현재 개발 상태

### 구현 및 테스트 완료

- FastAPI 서버 구축
- SQLite 데이터베이스 연동
- 스트레칭 초기 데이터 3종 등록
- REST API 9개 엔드포인트 구현
- 스트레칭 목록 조회 테스트
- 운동 세션 생성 테스트
- 운동 세션 종료 및 결과 저장 테스트
- 운동 정확도 자동 계산 테스트
- 저장된 운동 결과 재조회 테스트
- CORS 설정 적용
- Swagger API 문서 제공

### 추후 연동 및 테스트 필요

- React 프론트엔드와 실제 REST API 연결
- MediaPipe 기반 자세 인식 결과 연동
- AI 판정 결과로부터 정상 자세 유지시간 전달
- 실시간 자세 피드백 통신 방식 확정
- 전체 시스템 통합 테스트
- 시연영상 촬영 및 발표 준비

**주의:** 현재 테스트에서 사용한 운동시간과 정상 자세 유지시간은 Swagger를 통해 직접 입력한 값입니다. 실제 AI 모듈과의 자동 연동은 아직 검증되지 않았습니다.

---

## 7. Backend 실행 방법

VS Code에서 `backend` 폴더로 이동합니다.

```powershell
cd backend
```

가상환경이 활성화되지 않은 경우 다음 명령어를 실행합니다.

```powershell
.\.venv\Scripts\Activate.ps1
```

서버 실행:

```powershell
python -m uvicorn main:app --reload
```

정상 실행 후 접속:

- API 서버: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/health`

새로운 개발 환경에서는 `requirements.txt`에 명시된 패키지를 설치하고 데이터베이스를 초기화해야 합니다.

자세한 사항은 `README.md`를 참고합니다.

---

## 8. 팀원별 연동 참고사항

### 백엔드 (나린)

- REST API 제공 및 관리
- 운동 세션 생성·종료
- 운동 결과 DB 저장 및 조회
- 프론트엔드 연동 지원

### 알고리즘 (상옥)

- 관절 각도 계산
- 정상 자세 여부 판정
- 정상 자세 유지시간 및 정확도 관련 데이터 산출
- 자세 교정 피드백 제공

### 프론트엔드 (교명)

- 스트레칭 목록 API 연동
- 운동 시작 시 세션 생성 API 호출
- 운동 종료 시 결과 저장 API 호출
- 운동 결과 및 기록 화면 표시
- 실시간 자세 피드백 화면 연동

### 화면인식 및 처리 (호중)

- 웹캠 영상 입력
- MediaPipe 기반 관절 좌표 추출
- 자세판정 알고리즘에 랜드마크 데이터 전달
- 실시간 영상처리 모듈 연동

---

## 9. 발표 준비 목표

- 11월 8일: API 및 데이터 규격 확정
- 11월 12일: 최소 1개 동작 전체 시연 흐름 완성
- 11월 14일: 시연용 프로그램 안정화
- 11월 16일: 시연영상 및 발표자료 완성
- 11월 17~18일: 발표 리허설
- 11월 25일: 컴공인의 날 본 발표

실시간 시연이 불안정할 경우를 대비하여 정상 작동하는 프로그램의 시연영상을 사전에 제작합니다.
