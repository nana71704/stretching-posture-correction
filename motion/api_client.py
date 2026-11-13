"""
Python 웹캠 클라이언트: 영상처리 모듈(MotionPipeline) → 백엔드 자세 판정 → 세션 저장

기존 pose_api_integration.py 와 같은 흐름이지만,
  - 옛 API(mp.solutions) 대신 영상처리 모듈(PoseDetector, Tasks API)을 사용 → 최신 MediaPipe에서 동작
  - 관절 14개 규격(config.TARGET_JOINTS)을 그대로 사용 → 프론트엔드(constants/pose.js)와 동일
  - 인식 예외처리: 사람 없음 / 화면 이탈 / 가려짐 을 구분해 안내
  - 좌표 떨림 보정(지수이동평균)으로 판정과 유지시간이 끊기는 현상 완화
  - 화면에 한글 피드백 표시

실행 (백엔드 서버를 먼저 켠 뒤, motion 폴더에서):
  python api_client.py                 # 1번 스트레칭
  python api_client.py --stretch 3     # 3번 스트레칭
  python api_client.py --source test.mp4
종료 및 결과 저장: 영상 창에서 q (ESC는 저장 없이 취소)
"""
import argparse
import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import cv2
import numpy as np

import config
import landmark_extractor as le
from pipeline import MotionPipeline, draw_joints

REQUEST_INTERVAL = 0.2   # 서버 판정 요청 간격(초) — 프론트엔드와 동일하게 초당 5번
MAX_HOLD_STEP = 0.25     # 한 프레임에 누적할 유지시간 상한(초). 프레임이 멈췄을 때 과다 누적 방지


# ── 백엔드 API ──────────────────────────────────────────────────────────
class Api:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def request(self, method, endpoint, data=None, timeout=3):
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = Request(self.base_url + endpoint, data=body, method=method,
                      headers={"Content-Type": "application/json"})
        try:
            with urlopen(req, timeout=timeout) as res:
                return json.loads(res.read().decode("utf-8"))
        except HTTPError as e:
            raise RuntimeError(f"API 오류 {e.code}: {e.read().decode('utf-8', 'replace')}") from e
        except URLError as e:
            raise RuntimeError(f"백엔드 서버에 연결할 수 없습니다 ({self.base_url}): {e.reason}") from e

    def stretch(self, stretch_id):
        return self.request("GET", f"/api/stretches/{stretch_id}")

    def start_session(self, stretch_id):
        return self.request("POST", "/api/sessions", {"stretch_id": stretch_id})

    def analyze(self, stretch_id, landmarks):
        return self.request("POST", "/api/pose/analyze",
                            {"stretch_id": stretch_id, "landmarks": landmarks})

    def complete(self, session_id, duration, correct):
        return self.request("POST", f"/api/sessions/{session_id}/complete",
                            {"duration_seconds": round(duration, 2),
                             "correct_seconds": round(correct, 2)})

    def cancel(self, session_id):
        return self.request("POST", f"/api/sessions/{session_id}/cancel")


# ── 한글 표시 (OpenCV putText는 한글을 못 그림 → Pillow 사용) ───────────
_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\malgun.ttf",                       # Windows 맑은 고딕
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",         # macOS
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
]


def _load_font(size):
    try:
        from PIL import ImageFont
    except ImportError:
        return None
    for path in _FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return None


class TextPainter:
    def __init__(self):
        self.big = _load_font(28)
        self.small = _load_font(22)

    def draw(self, frame, lines):
        """lines: [(text, (B,G,R), big:bool), ...] 를 왼쪽 위부터 차례로 그림."""
        if self.big is None:  # 한글 폰트가 없으면 영어 상태만 OpenCV로
            y = 30
            for text, color, _ in lines:
                ascii_text = text.encode("ascii", "ignore").decode().strip()
                if ascii_text:
                    cv2.putText(frame, ascii_text, (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
                    y += 30
            return frame
        from PIL import Image, ImageDraw
        img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        d = ImageDraw.Draw(img)
        y = 12
        for text, (b, g, r), big in lines:
            font = self.big if big else self.small
            d.text((12, y), text, font=font, fill=(r, g, b), stroke_width=3, stroke_fill=(0, 0, 0))
            y += (font.size if hasattr(font, "size") else 24) + 10
        frame[:] = cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2BGR)
        return frame


STATUS_COLOR = {
    "correct": (0, 220, 0),
    "incorrect": (0, 140, 255),
    "not_detected": (0, 0, 255),
    "error": (0, 0, 255),
}


# ── 실행 ────────────────────────────────────────────────────────────────
def parse_args():
    p = argparse.ArgumentParser(description="영상처리 모듈 + 백엔드 자세 판정 연동")
    p.add_argument("--stretch", type=int, default=1, help="스트레칭 ID (1, 2, 3)")
    p.add_argument("--api", default="http://127.0.0.1:8000", help="백엔드 주소")
    p.add_argument("--source", default="0", help="웹캠 번호 또는 비디오 파일 경로")
    p.add_argument("--no-smooth", action="store_true", help="좌표 떨림 보정 끄기")
    return p.parse_args()


def main():
    args = parse_args()
    source = int(args.source) if args.source.isdigit() else args.source
    api = Api(args.api)
    painter = TextPainter()
    smoother = None if args.no_smooth else le.LandmarkSmoother()

    try:
        stretch = api.stretch(args.stretch)
        session = api.start_session(args.stretch)
    except RuntimeError as e:
        sys.exit(f"[오류] {e}\n백엔드 서버(python -m uvicorn main:app)가 켜져 있는지 확인하세요.")

    session_id = session["session_id"]
    target = stretch.get("target_seconds")
    print(f"세션 시작: #{session_id}  {stretch.get('name', '')}  (목표 유지 {target}초)")
    print("q: 종료 후 결과 저장   ESC: 저장하지 않고 취소")

    result = {"status": "not_detected", "feedback": "준비 중...", "angle": None}
    correct_seconds = 0.0
    start = prev = time.monotonic()
    last_request = 0.0
    save = False

    try:
        for frame, joints, _ in MotionPipeline(source=source).run():
            now = time.monotonic()
            delta, prev = now - prev, now

            if smoother is not None:
                joints = smoother.update(joints)
            status = le.frame_status(joints)

            # 판정 요청 (일정 간격으로만)
            if now - last_request >= REQUEST_INTERVAL:
                last_request = now
                if status["code"] == "no_person":
                    result = {"status": "not_detected", "feedback": status["message"], "angle": None}
                else:
                    try:
                        result = api.analyze(args.stretch, le.to_api_landmarks(joints))
                    except RuntimeError as e:
                        print(f"[판정 오류] {e}")
                        result = {"status": "error", "feedback": "서버 판정에 실패했습니다.", "angle": None}

            # 정자세일 때만 유지시간 누적
            if result["status"] == "correct":
                correct_seconds += min(delta, MAX_HOLD_STEP)

            # 화면 표시
            draw_joints(frame, joints)
            elapsed = now - start
            angle = result.get("angle")
            lines = [
                (f"{result['status'].upper()}", STATUS_COLOR.get(result["status"], (255, 255, 255)), True),
                (result.get("feedback") or "", (255, 255, 255), False),
            ]
            # 판정이 정상이어도 화면 이탈·가려짐이면 안내를 추가로 보여줌
            if status["code"] in ("out_of_frame", "occluded") and status["message"] != result.get("feedback"):
                lines.append((status["message"], (0, 220, 255), False))
            lines.append((f"각도 {angle:.1f}°" if angle is not None else "각도 -", (255, 255, 255), False))
            lines.append((f"정자세 유지 {correct_seconds:.1f}s / 목표 {target}s   전체 {elapsed:.1f}s",
                          (0, 255, 255), False))
            painter.draw(frame, lines)
            cv2.imshow("Stretching Posture - Python Client", frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                save = True
                break
            if key == 27:
                break
        else:
            save = True  # 비디오 파일이 끝까지 재생된 경우 저장
    except RuntimeError as e:  # 카메라를 열 수 없는 경우 등
        print(f"[오류] {e}")
        save = False
    finally:
        cv2.destroyAllWindows()

    duration = time.monotonic() - start
    correct_seconds = min(correct_seconds, duration)
    try:
        if save and duration > 0:
            saved = api.complete(session_id, duration, correct_seconds)
            print("\n=== 결과 저장 완료 ===")
            print(json.dumps(saved, ensure_ascii=False, indent=2))
        else:
            api.cancel(session_id)
            print("세션을 취소했습니다 (저장 안 함).")
    except RuntimeError as e:
        print(f"[저장 오류] {e}")


if __name__ == "__main__":
    main()
