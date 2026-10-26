# 스트레칭 자세 교정 시스템 — Frontend API 연동 가이드

## 1. Backend 서버 정보

- Framework: FastAPI
- Database: SQLite
- 로컬 서버 주소: `http://127.0.0.1:8000`
- Swagger API 문서: `http://127.0.0.1:8000/docs`
- 데이터 형식: JSON

프론트엔드 개발 서버 `http://localhost:5173`에서 요청할 수 있도록 CORS 설정 및 사전 요청 테스트를 완료했습니다.

**주의:** `127.0.0.1`은 해당 컴퓨터 자신을 의미하므로, 프론트엔드와 백엔드를 서로 다른 컴퓨터에서 실행할 경우 서버 주소를 변경해야 합니다.

## 2. REST API 목록

| HTTP Method | Endpoint | 기능 |
|---|---|---|
| GET | `/api/stretches` | 전체 스트레칭 목록 조회 |
| GET | `/api/stretches/{stretch_id}` | 스트레칭 상세 조회 |
| POST | `/api/sessions` | 운동 세션 생성 |
| POST | `/api/sessions/{session_id}/complete` | 운동 세션 종료 및 결과 저장 |
| GET | `/api/sessions/{session_id}` | 개별 운동 기록 조회 |
| GET | `/api/sessions` | 전체 운동 기록 조회 |

## 3. 주요 API 사용 예시

### 3-1. 스트레칭 목록 조회

**요청**

`GET /api/stretches`

**등록된 스트레칭**

- ID 1: 목/어깨 측면 스트레칭
- ID 2: 팔/어깨 상체 굴곡 스트레칭
- ID 3: 스쿼트/하체 스트레칭

### 3-2. 운동 세션 생성

**요청**

`POST /api/sessions`

```json
{
  "stretch_id": 1
}
```

**응답에 포함되는 주요 필드**

- `session_id`: 생성된 운동 세션 ID
- `stretch_id`: 스트레칭 종류 ID
- `started_at`: 운동 시작 시각
- `status`: `"started"`

생성된 `session_id`는 이후 운동 종료 및 결과 조회 요청에 사용합니다.

### 3-3. 운동 세션 종료 및 결과 저장

**요청**

`POST /api/sessions/{session_id}/complete`

```json
{
  "duration_seconds": 15,
  "correct_seconds": 12,
  "success": true
}
```

**응답에 포함되는 주요 필드**

- `session_id`: 운동 세션 ID
- `status`: `"completed"`
- `score`: 계산된 운동 점수
- `ended_at`: 운동 종료 시각

**점수 계산 공식**

`score = (correct_seconds / duration_seconds) × 100`

예시: 15초 중 12초 동안 정상 자세를 유지했다면 80점입니다.

현재 `success` 값은 요청 데이터로 전달됩니다. 실제 자세 인식 알고리즘과 연동할 때는 정상 자세 유지 조건을 기준으로 성공 여부를 검증하거나 서버에서 결정하도록 보완해야 합니다.

### 3-4. 개별 운동 기록 조회

**요청**

`GET /api/sessions/{session_id}`

운동 시작 시각, 종료 시각, 운동시간, 정상 자세 유지시간, 성공 여부, 점수 등 저장된 기록을 조회합니다.

### 3-5. 전체 운동 기록 조회

**요청**

`GET /api/sessions`

저장된 운동 세션 목록을 최신 기록부터 조회합니다.

## 4. React 연동 예시

아래 코드는 브라우저에서 스트레칭 목록을 조회하는 간단한 예시입니다.

```javascript
const API_BASE_URL = "http://127.0.0.1:8000";

async function getStretches() {
  const response = await fetch(`${API_BASE_URL}/api/stretches`);

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status}`);
  }

  return await response.json();
}
```

운동 시작 시 세션을 생성하는 예시입니다.

```javascript
async function createSession(stretchId) {
  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      stretch_id: stretchId
    })
  });

  if (!response.ok) {
    throw new Error(`세션 생성 실패: ${response.status}`);
  }

  return await response.json();
}
```

## 5. 오류 처리

| HTTP 상태 코드 | 발생 상황 |
|---|---|
| 400 | 정상 자세 유지시간이 전체 운동시간보다 큰 경우 |
| 404 | 존재하지 않는 운동 기록 조회 |
| 409 | 이미 종료된 운동 세션을 다시 종료하는 경우 |
| 422 | 음수 운동시간 등 유효하지 않은 입력값 |

## 6. 현재 개발 상태

**구현 및 테스트 완료**

- FastAPI 서버 구축
- SQLite 데이터베이스 연동
- 스트레칭 초기 데이터 3종 등록
- REST API 6개 구현 및 정상 동작 확인
- 주요 예외 처리 테스트
- 운동 결과 점수 계산 및 저장
- React 개발 서버를 위한 CORS 사전 요청 테스트
- Backend 실행 환경 및 문서 정리

**추후 연동 필요**

- React 화면과 실제 REST API 연결
- MediaPipe 기반 자세 인식 결과 연동
- 정상 자세 유지시간과 성공 여부의 판정 로직 연동
- 프론트엔드와 백엔드 통합 테스트

## 7. Backend 실행 명령어

`backend` 폴더에서 실행합니다.

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload
```

새로운 개발 환경에서는 `requirements.txt` 설치 및 데이터베이스 초기화가 먼저 필요합니다. 자세한 실행 방법은 `README.md`를 참고합니다.