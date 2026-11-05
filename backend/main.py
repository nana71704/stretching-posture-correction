
import sqlite3
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import DB_PATH


# ==========================================
# 1. FastAPI 서버 설정
# ==========================================

app = FastAPI(
    title="Stretching Posture Correction API",
    description="기연프 스트레칭 자세 교정 시스템 백엔드",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
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

        rows = conn.execute("""
            SELECT id, name, description, target_seconds
            FROM stretches
            ORDER BY id
        """).fetchall()

    return [dict(row) for row in rows]


# ==========================================
# 4. 스트레칭 상세 조회
# ==========================================

@app.get("/api/stretches/{stretch_id}")
def get_stretch(stretch_id: int):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute("""
            SELECT id, name, description, target_seconds
            FROM stretches
            WHERE id = ?
        """, (stretch_id,)).fetchone()

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

        cursor = conn.execute("""
            INSERT INTO sessions
                (stretch_id, started_at, duration_seconds, status)
            VALUES (?, ?, ?, ?)
        """, (
            data.stretch_id,
            started_at,
            0,
            "started"
        ))

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
def complete_session(session_id: int, data: SessionComplete):
    if data.correct_seconds > data.duration_seconds:
        raise HTTPException(
            status_code=400,
            detail="정상 자세 유지시간은 전체 운동시간보다 클 수 없습니다."
        )

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.row_factory = sqlite3.Row

        # 동시 요청을 순차 처리하여 중복 종료 방지
        conn.execute("BEGIN IMMEDIATE")

        session = conn.execute("""
            SELECT
                s.*,
                st.target_seconds
            FROM sessions s
            JOIN stretches st
                ON s.stretch_id = st.id
            WHERE s.id = ?
        """, (session_id,)).fetchone()

        if session is None:
            raise HTTPException(
                status_code=404,
                detail="해당 운동 세션을 찾을 수 없습니다."
            )

        if session["status"] != "started":
            raise HTTPException(
                status_code=409,
                detail="이미 종료되거나 취소된 운동 세션입니다."
            )

        ended_at = datetime.now(timezone.utc).isoformat()

        score = round(
            data.correct_seconds / data.duration_seconds * 100,
            2
        )

        success = (
            data.correct_seconds >= session["target_seconds"]
        )

        conn.execute("""
            UPDATE sessions
            SET
                ended_at = ?,
                duration_seconds = ?,
                status = 'completed'
            WHERE id = ?
        """, (
            ended_at,
            data.duration_seconds,
            session_id
        ))

        conn.execute("""
            INSERT INTO session_results
                (session_id, correct_seconds, success, score)
            VALUES (?, ?, ?, ?)
        """, (
            session_id,
            data.correct_seconds,
            int(success),
            score
        ))

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
# 7. 운동 세션 취소
# 신규 API
# ==========================================

@app.post("/api/sessions/{session_id}/cancel")
def cancel_session(session_id: int):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.row_factory = sqlite3.Row

        conn.execute("BEGIN IMMEDIATE")

        session = conn.execute("""
            SELECT id, status
            FROM sessions
            WHERE id = ?
        """, (session_id,)).fetchone()

        if session is None:
            raise HTTPException(
                status_code=404,
                detail="해당 운동 세션을 찾을 수 없습니다."
            )

        if session["status"] != "started":
            raise HTTPException(
                status_code=409,
                detail="이미 종료되거나 취소된 운동 세션입니다."
            )

        ended_at = datetime.now(timezone.utc).isoformat()

        conn.execute("""
            UPDATE sessions
            SET
                ended_at = ?,
                status = 'cancelled'
            WHERE id = ?
        """, (ended_at, session_id))

        conn.commit()

    return {
        "session_id": session_id,
        "status": "cancelled",
        "ended_at": ended_at
    }


# ==========================================
# 8. 개별 운동 기록 조회
# ==========================================

@app.get("/api/sessions/{session_id}")
def get_session(session_id: int):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute("""
            SELECT
                s.id AS session_id,
                s.stretch_id,
                st.name AS stretch_name,
                s.started_at,
                s.ended_at,
                s.duration_seconds,
                s.status,
                r.correct_seconds,
                r.success,
                r.score
            FROM sessions s
            JOIN stretches st
                ON s.stretch_id = st.id
            LEFT JOIN session_results r
                ON s.id = r.session_id
            WHERE s.id = ?
        """, (session_id,)).fetchone()

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
# 9. 전체 운동 기록 조회
# limit 기능 유지
# ==========================================

@app.get("/api/sessions")
def get_sessions(
    limit: int | None = Query(
        default=None,
        ge=1,
        description="조회할 최근 운동 기록 개수"
    )
):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        query = """
            SELECT
                s.id AS session_id,
                s.stretch_id,
                st.name AS stretch_name,
                s.started_at,
                s.ended_at,
                s.duration_seconds,
                s.status,
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

        if limit is not None:
            query += " LIMIT ?"
            rows = conn.execute(query, (limit,)).fetchall()
        else:
            rows = conn.execute(query).fetchall()

    results = []

    for row in rows:
        result = dict(row)

        if result["success"] is not None:
            result["success"] = bool(result["success"])

        results.append(result)

    return results


# ==========================================
# 10. 전체 운동 통계 조회
# ==========================================

@app.get("/api/stats/summary")
def get_stats_summary():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        row = conn.execute("""
            SELECT
                COUNT(*) AS total_sessions,
                COUNT(r.session_id) AS completed_sessions,
                COALESCE(
                    SUM(
                        CASE
                            WHEN r.success = 1 THEN 1
                            ELSE 0
                        END
                    ), 0
                ) AS successful_sessions,
                COALESCE(AVG(r.score), 0) AS average_score
            FROM sessions s
            LEFT JOIN session_results r
                ON s.id = r.session_id
        """).fetchone()

    completed = row["completed_sessions"]
    successful = row["successful_sessions"]

    success_rate = (
        round(successful / completed * 100, 2)
        if completed > 0
        else 0.0
    )

    return {
        "total_sessions": row["total_sessions"],
        "completed_sessions": completed,
        "successful_sessions": successful,
        "success_rate": success_rate,
        "average_score": round(row["average_score"], 2)
    }


# ==========================================
# 11. 스트레칭 종류별 통계 조회
# ==========================================

@app.get("/api/stats/stretches")
def get_stretch_stats():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute("""
            SELECT
                st.id AS stretch_id,
                st.name AS stretch_name,
                COUNT(r.session_id) AS completed_sessions,
                COALESCE(AVG(r.score), 0) AS average_score,
                COALESCE(
                    SUM(
                        CASE
                            WHEN r.success = 1 THEN 1
                            ELSE 0
                        END
                    ), 0
                ) AS successful_sessions,
                COALESCE(
                    SUM(
                        CASE
                            WHEN r.session_id IS NOT NULL
                            THEN s.duration_seconds
                            ELSE 0
                        END
                    ), 0
                ) AS total_duration_seconds
            FROM stretches st
            LEFT JOIN sessions s
                ON st.id = s.stretch_id
            LEFT JOIN session_results r
                ON s.id = r.session_id
            GROUP BY st.id, st.name
            ORDER BY st.id
        """).fetchall()

    results = []

    for row in rows:
        completed = row["completed_sessions"]
        successful = row["successful_sessions"]

        success_rate = (
            round(successful / completed * 100, 2)
            if completed > 0
            else 0.0
        )

        results.append({
            "stretch_id": row["stretch_id"],
            "stretch_name": row["stretch_name"],
            "completed_sessions": completed,
            "average_score": round(row["average_score"], 2),
            "success_rate": success_rate,
            "total_duration_seconds": (
                row["total_duration_seconds"]
            )
        })

    return results
