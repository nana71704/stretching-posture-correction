
import sqlite3
from pathlib import Path

# database.py가 있는 폴더에 DB 파일 생성
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

        conn.commit()
        print("SQLite 데이터베이스 생성 완료!")

    finally:
        conn.close()


if __name__ == "__main__":
    create_tables()
