"""
동작인식 파이프라인 실행/확인용 스크립트

  python main.py                      # 기본 웹캠
  python main.py --source video.mp4   # 비디오 파일
  python main.py --save out.jsonl     # 프레임별 관절 데이터를 JSON Lines로 저장
  python main.py --print              # 콘솔에 관절 좌표 출력

종료: 영상 창에서 q 또는 ESC
"""
import argparse
import json
import time

import cv2
import numpy as np

import config
from pipeline import MotionPipeline, draw_joints


def parse_args():
    p = argparse.ArgumentParser(description="MediaPipe Pose 관절 데이터 추출")
    p.add_argument("--source", default="0", help="웹캠 번호(0,1,..) 또는 비디오 파일 경로")
    p.add_argument("--save", help="관절 데이터를 저장할 .jsonl 경로")
    p.add_argument("--print", action="store_true", help="콘솔에 관절 좌표 출력")
    p.add_argument("--no-window", action="store_true", help="영상 창 띄우지 않기")
    return p.parse_args()


def main():
    args = parse_args()
    source = int(args.source) if args.source.isdigit() else args.source
    out = open(args.save, "w", encoding="utf-8") if args.save else None

    np.set_printoptions(precision=3, suppress=True)
    prev = time.time()
    try:
        for frame, joints, data in MotionPipeline(source=source).run():
            now = time.time()
            fps = 1.0 / max(now - prev, 1e-6)
            prev = now

            if out:
                out.write(json.dumps(data, ensure_ascii=False) + "\n")
            if args.print and data["detected"]:
                print(f"\n[{data['timestamp']:.2f}]  (x, y, z, visibility)")
                for name, row in zip(config.TARGET_JOINT_NAMES, joints):
                    print(f"  {name:15s} {row}")

            if not args.no_window:
                draw_joints(frame, joints)
                status = "DETECTED" if data["detected"] else "NO PERSON"
                cv2.putText(frame, f"FPS {fps:4.1f}  {status}", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                cv2.imshow("Motion Recognition", frame)
                if cv2.waitKey(1) & 0xFF in (ord("q"), 27):
                    break
    finally:
        if out:
            out.close()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
