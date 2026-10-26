
import sqlite3
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import DB_PATH


# ==========================================
# 1. FastAPI 서버 설정
# ==========================================

app = FastAPI(
    title="Stretching Posture Correction API",
    description="기연프 스트레칭 자세 교정 시스템 백엔드",
    version="1.0.0"
)

# React 프론트엔드 연동을 위한 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


# ==========================================
# 2. 서버 상태 확인
# ==========================================

@app.get("/")
def read_root():
    return {
        "message": "Stretching Backend Server Running!"
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


# ==========================================
# 3. 스트레칭 목록 조회
# ==========================================

@app.get("/api/stretches")
def get_stretches():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute(
            """
            SELECT id, name, description, target_seconds
            FROM stretches
            ORDER BY id
            """
        ).fetchall()

    return [dict(row) for row in rows]


# ==========================================
# 4. 스트레칭 상세 조회
# ==========================================

@app.get("/api/stretches/{stretch_id}")
def get_stretch(stretch_id: int):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute(
            """
            SELECT id, name, description, target_seconds
            FROM stretches
            WHERE id = ?
            """,
            (stretch_id,)
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="해당 스트레칭을 찾을 수 없습니다."
        )

    return dict(row)


# ==========================================
# 5. 운동 세션 생성
# ==========================================

class SessionCreate(BaseModel):
    stretch_id: int


@app.post("/api/sessions", status_code=201)
def create_session(data: SessionCreate):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.row_factory = sqlite3.Row

        stretch = conn.execute(
            "SELECT id FROM stretches WHERE id = ?",
            (data.stretch_id,)
        ).fetchone()

        if stretch is None:
            raise HTTPException(
                status_code=404,
                detail="해당 스트레칭을 찾을 수 없습니다."
            )

        started_at = datetime.now(timezone.utc).isoformat()

        cursor = conn.execute(
            """
            INSERT INTO sessions
                (stretch_id, started_at, duration_seconds)
            VALUES (?, ?, ?)
            """,
            (data.stretch_id, started_at, 0)
        )

        conn.commit()

        return {
            "session_id": cursor.lastrowid,
            "stretch_id": data.stretch_id,
            "started_at": started_at,
            "status": "started"
        }


# ==========================================
# 6. 운동 세션 종료 및 결과 저장
# ==========================================

class SessionComplete(BaseModel):
    duration_seconds: float = Field(gt=0)
    correct_seconds: float = Field(ge=0)


@app.post("/api/sessions/{session_id}/complete")
def complete_session(
    session_id: int,
    data: SessionComplete
):
    # 정상 자세 유지시간 검증
    if data.correct_seconds > data.duration_seconds:
        raise HTTPException(
            status_code=400,
            detail="정상 자세 유지시간은 전체 운동시간보다 클 수 없습니다."
        )

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.row_factory = sqlite3.Row

        # 세션 및 스트레칭 목표 유지시간 조회
        session = conn.execute(
            """
            SELECT
                s.*,
                st.target_seconds
            FROM sessions s
            JOIN stretches st
                ON s.stretch_id = st.id
            WHERE s.id = ?
            """,
            (session_id,)
        ).fetchone()

        # 세션 존재 여부 확인
        if session is None:
            raise HTTPException(
                status_code=404,
                detail="해당 운동 세션을 찾을 수 없습니다."
            )

        # 이미 종료한 세션인지 확인
        if session["ended_at"] is not None:
            raise HTTPException(
                status_code=409,
                detail="이미 종료된 운동 세션입니다."
            )

        ended_at = datetime.now(timezone.utc).isoformat()

        # 운동 점수 계산
        score = round(
            data.correct_seconds / data.duration_seconds * 100,
            2
        )

        # 목표 유지시간에 따른 성공 여부 자동 판정
        success = (
            data.correct_seconds >= session["target_seconds"]
        )

        # 운동 세션 종료 처리
        conn.execute(
            """
            UPDATE sessions
            SET ended_at = ?, duration_seconds = ?
            WHERE id = ?
            """,
            (
                ended_at,
                data.duration_seconds,
                session_id
            )
        )

        # 운동 결과 저장
        conn.execute(
            """
            INSERT INTO session_results
                (session_id, correct_seconds, success, score)
            VALUES (?, ?, ?, ?)
            """,
            (
                session_id,
                data.correct_seconds,
                int(success),
                score
            )
        )

        conn.commit()

    return {
        "session_id": session_id,
        "status": "completed",
        "duration_seconds": data.duration_seconds,
        "correct_seconds": data.correct_seconds,
        "success": success,
        "score": score,
        "ended_at": ended_at
    }


# ==========================================
# 7. 개별 운동 기록 조회
# ==========================================

@app.get("/api/sessions/{session_id}")
def get_session(session_id: int):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute(
            """
            SELECT
                s.id AS session_id,
                s.stretch_id,
                st.name AS stretch_name,
                s.started_at,
                s.ended_at,
                s.duration_seconds,
                r.correct_seconds,
                r.success,
                r.score
            FROM sessions s
            JOIN stretches st
                ON s.stretch_id = st.id
            LEFT JOIN session_results r
                ON s.id = r.session_id
            WHERE s.id = ?
            """,
            (session_id,)
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="해당 운동 기록을 찾을 수 없습니다."
        )

    result = dict(row)

    if result["success"] is not None:
        result["success"] = bool(result["success"])

    return result


# ==========================================
# 8. 전체 운동 기록 조회
# ==========================================

@app.get("/api/sessions")
def get_sessions():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute(
            """
            SELECT
                s.id AS session_id,
                s.stretch_id,
                st.name AS stretch_name,
                s.started_at,
                s.ended_at,
                s.duration_seconds,
                r.correct_seconds,
                r.success,
                r.score
            FROM sessions s
            JOIN stretches st
                ON s.stretch_id = st.id
            LEFT JOIN session_results r
                ON s.id = r.session_id
            ORDER BY s.started_at DESC, s.id DESC
            """
        ).fetchall()

    results = []

    for row in rows:
        result = dict(row)

        if result["success"] is not None:
            result["success"] = bool(result["success"])

        results.append(result)

    return results


# ==========================================
# 9. 운동 기록 통계 조회
# ==========================================

@app.get("/api/stats/summary")
def get_stats_summary():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute(
            """
            SELECT
                COUNT(*) AS total_sessions,
                COUNT(r.session_id) AS completed_sessions,
                COALESCE(
                    SUM(CASE WHEN r.success = 1 THEN 1 ELSE 0 END),
                    0
                ) AS successful_sessions,
                COALESCE(AVG(r.score), 0) AS average_score
            FROM sessions s
            LEFT JOIN session_results r
                ON s.id = r.session_id
            """
        ).fetchone()

    total_sessions = row["total_sessions"]
    completed_sessions = row["completed_sessions"]
    successful_sessions = row["successful_sessions"]

    success_rate = (
        round(successful_sessions / completed_sessions * 100, 2)
        if completed_sessions > 0
        else 0.0
    )

    return {
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "successful_sessions": successful_sessions,
        "success_rate": success_rate,
        "average_score": round(row["average_score"], 2)
    }

