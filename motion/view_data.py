"""
저장된 관절 데이터(.jsonl)를 필요한 부분만 골라 보기

  python view_data.py sample.jsonl                       # 전체 관절, 화면에 표로 출력
  python view_data.py sample.jsonl --joints left_elbow right_knee
  python view_data.py sample.jsonl --fields x y          # x, y 값만
  python view_data.py sample.jsonl --csv                 # 엑셀용 sample.csv 로 저장
  python view_data.py sample.jsonl --every 10            # 10프레임마다 하나씩만

관절 이름:
  left_shoulder right_shoulder left_elbow right_elbow left_wrist right_wrist
  left_hip right_hip left_knee right_knee left_ankle right_ankle
  (간단히 shoulder, elbow, wrist, hip, knee, ankle 처럼 쓰면 좌우 모두 선택)
"""
import argparse
import csv
import json
import os
import sys

import config


def resolve_joints(names):
    if not names:
        return config.TARGET_JOINT_NAMES
    out = []
    for n in names:
        n = n.lower()
        if n in config.TARGET_JOINTS:
            out.append(n)
        elif f"left_{n}" in config.TARGET_JOINTS:
            out += [f"left_{n}", f"right_{n}"]
        else:
            sys.exit(f"알 수 없는 관절 이름: {n}\n가능한 이름: {', '.join(config.TARGET_JOINT_NAMES)}")
    return out


def load(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def main():
    p = argparse.ArgumentParser(description="관절 데이터(.jsonl) 보기")
    p.add_argument("file", help=".jsonl 파일 경로")
    p.add_argument("--joints", nargs="+", help="보고 싶은 관절 (기본: 전체 12개)")
    p.add_argument("--fields", nargs="+", default=config.FIELDS,
                   choices=config.FIELDS, help="보고 싶은 값 (기본: x y z visibility)")
    p.add_argument("--every", type=int, default=1, help="N프레임마다 하나씩만 보기")
    p.add_argument("--csv", action="store_true", help="엑셀용 CSV 파일로 저장")
    p.add_argument("--all-frames", action="store_true", help="사람이 감지되지 않은 프레임도 포함")
    args = p.parse_args()

    joints = resolve_joints(args.joints)
    records = load(args.file)
    if not records:
        sys.exit("파일에 데이터가 없습니다.")
    t0 = records[0]["timestamp"]

    header = ["frame", "time(s)"] + [f"{j}.{f}" for j in joints for f in args.fields]
    rows = []
    for i, r in enumerate(records):
        if i % args.every:
            continue
        if not r["detected"] and not args.all_frames:
            continue
        row = [i, round(r["timestamp"] - t0, 2)]
        for j in joints:
            for f in args.fields:
                row.append(r["joints"][j][f] if r["detected"] else "")
        rows.append(row)

    detected = sum(r["detected"] for r in records)
    print(f"파일: {args.file}  |  전체 {len(records)}프레임, 사람 감지 {detected}프레임, "
          f"길이 {records[-1]['timestamp'] - t0:.1f}초")

    if args.csv:
        out = os.path.splitext(args.file)[0] + ".csv"
        # utf-8-sig: 엑셀에서 한글/열 이름이 깨지지 않게
        with open(out, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(header)
            w.writerows(rows)
        print(f"CSV 저장 완료: {out}  ({len(rows)}행)  → 엑셀로 열어 보세요.")
        return

    # 화면 출력: 관절별로 묶어서 보기 좋게
    for row in rows:
        print(f"\n[frame {row[0]}  {row[1]:.2f}s]")
        vals = row[2:]
        k = len(args.fields)
        for n, j in enumerate(joints):
            v = vals[n * k:(n + 1) * k]
            print(f"  {j:15s} " + "  ".join(f"{f}={x:7.3f}" for f, x in zip(args.fields, v)))


if __name__ == "__main__":
    main()
