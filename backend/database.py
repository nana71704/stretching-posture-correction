
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "stretching.db"


def create_tables():
    conn = sqlite3.connect(DB_PATH)

    try:
        conn.execute("PRAGMA foreign_keys = ON")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS stretches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                target_seconds INTEGER NOT NULL
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stretch_id INTEGER NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                duration_seconds REAL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'started',
                FOREIGN KEY (stretch_id)
                    REFERENCES stretches(id)
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS session_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL UNIQUE,
                correct_seconds REAL DEFAULT 0,
                success INTEGER DEFAULT 0,
                score REAL,
                FOREIGN KEY (session_id)
                    REFERENCES sessions(id)
            )
        """)

        # 기존 DB에도 status 컬럼 추가
        columns = [
            row[1]
            for row in conn.execute(
                "PRAGMA table_info(sessions)"
            ).fetchall()
        ]

        if "status" not in columns:
            conn.execute("""
                ALTER TABLE sessions
                ADD COLUMN status TEXT NOT NULL
                DEFAULT 'started'
            """)

        # 기존 완료 기록은 completed 상태로 변경
        conn.execute("""
            UPDATE sessions
            SET status = 'completed'
            WHERE id IN (
                SELECT session_id FROM session_results
            )
            AND status = 'started'
        """)

        conn.commit()
        print("SQLite 데이터베이스 준비 완료!")

    finally:
        conn.close()


if __name__ == "__main__":
    create_tables()
