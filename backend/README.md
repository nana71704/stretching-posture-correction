
# 스트레칭 자세 교정 시스템 - Backend

## 프로젝트 소개
FastAPI와 SQLite를 이용하여 스트레칭 운동 종류 및 운동 세션 기록을 관리하는 백엔드 서버입니다.

## 사용 기술
- Python
- FastAPI
- Uvicorn
- SQLite

## 프로젝트 파일
- `main.py`: REST API 엔드포인트
- `database.py`: SQLite 데이터베이스 및 테이블 생성
- `seed.py`: 초기 스트레칭 데이터 등록
- `stretching.db`: 로컬 데이터베이스 (Git 공유 제외)
- `requirements.txt`: Python 패키지 목록

## 실행 방법

### 1. backend 폴더로 이동
프로젝트 최상위 폴더에서 실행합니다.

```powershell
cd backend
```

### 2. 가상환경 생성 및 활성화 (Windows PowerShell)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. 라이브러리 설치
```powershell
python -m pip install -r requirements.txt
```

### 4. 데이터베이스 초기화
```powershell
python database.py
python seed.py
```

### 5. 서버 실행
```powershell
python -m uvicorn main:app --reload
```

### 6. API 문서 확인
브라우저에서 http://127.0.0.1:8000/docs 접속

## 주요 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/stretches` | 운동 목록 조회 |
| GET | `/api/stretches/{stretch_id}` | 운동 상세 조회 |
| POST | `/api/sessions` | 운동 세션 생성 |
| POST | `/api/sessions/{session_id}/complete` | 운동 세션 종료 및 결과 저장 |
| GET | `/api/sessions/{session_id}` | 개별 운동 기록 조회 |
| GET | `/api/sessions` | 전체 운동 기록 조회 |

## 참고 사항
- `.venv/`와 `*.db` 파일은 Git 공유 대상에서 제외합니다.
- 데이터베이스는 각 개발 환경에서 별도로 초기화합니다.
- 현재 API는 운동 기록 관리 기능을 제공하며, 실시간 자세 판정 연동은 별도 작업입니다.


## 8. 운동 기록 통계 API

### GET /api/stats/summary

SQLite에 저장된 운동 기록을 집계하여
전체 운동 횟수, 완료 횟수, 성공 횟수,
성공률 및 평균 점수를 반환합니다.

**응답 예시 (2026-10-26 테스트 결과)**

```json
{
  "total_sessions": 7,
  "completed_sessions": 5,
  "successful_sessions": 4,
  "success_rate": 80.0,
  "average_score": 49.33
}
```

**계산 기준**

- total_sessions: 생성된 전체 세션 수
- completed_sessions: 결과 저장이 완료된 세션 수
- successful_sessions: 성공으로 저장된 세션 수
- success_rate: 성공 세션 수 / 완료 세션 수 × 100
- average_score: 완료된 세션의 평균 점수

※ 기존 테스트 기록도 통계에 포함됩니다.
