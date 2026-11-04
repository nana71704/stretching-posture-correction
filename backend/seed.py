
import sqlite3
from database import DB_PATH, create_tables

# 테스트용 스트레칭 데이터
stretches = [
    ("목/어깨 측면 스트레칭", "어깨를 수평으로 유지하는 동작", 5),
    ("팔/어깨 상체 굴곡 스트레칭", "팔을 위로 뻗어 유지하는 동작", 5),
    ("스쿼트/하체 스트레칭", "무릎과 상체 각도를 유지하는 동작", 5),
]


def insert_sample_data():
    create_tables()

    with sqlite3.connect(DB_PATH) as conn:
        for name, description, target_seconds in stretches:
            # 같은 이름의 테스트 데이터 중복 등록 방지
            existing = conn.execute(
                "SELECT id FROM stretches WHERE name = ?",
                (name,)
            ).fetchone()

            if existing is None:
                conn.execute(
                    """
                    INSERT INTO stretches
                        (name, description, target_seconds)
                    VALUES (?, ?, ?)
                    """,
                    (name, description, target_seconds)
                )

        conn.commit()

        rows = conn.execute(
            "SELECT id, name, target_seconds FROM stretches"
        ).fetchall()

        print("\n등록된 스트레칭 목록:")
        for row in rows:
            print(row)


if __name__ == "__main__":
    insert_sample_data()
