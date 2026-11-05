
import json
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import cv2
import mediapipe as mp

# 상옥이의 기존 각도 계산 함수를 그대로 사용
from detector import calculate_angle

API_BASE_URL = "http://127.0.0.1:8000"
STRETCH_ID = 1
TARGET_MIN_ANGLE = 160.0
MIN_VISIBILITY = 0.5

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils


def api_request(method, endpoint, data=None):
    url = API_BASE_URL + endpoint

    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")

    request = Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method=method,
    )

    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))

    except HTTPError as error:
        detail = error.read().decode("utf-8")
        raise RuntimeError(
            f"API error {error.code}: {detail}"
        ) from error

    except URLError as error:
        raise RuntimeError(
            f"Cannot connect to FastAPI: {error.reason}"
        ) from error


def analyze_pose(results, width, height):
    if not results.pose_landmarks:
        return "not_detected", 0.0

    landmarks = results.pose_landmarks.landmark

    indices = [
        mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
        mp_pose.PoseLandmark.RIGHT_ELBOW.value,
        mp_pose.PoseLandmark.RIGHT_WRIST.value,
    ]

    joints = [landmarks[index] for index in indices]

    # 관절이 충분히 인식되지 않으면 판정하지 않음
    if any(
        joint.visibility < MIN_VISIBILITY
        for joint in joints
    ):
        return "not_detected", 0.0

    points = [
        [joint.x * width, joint.y * height]
        for joint in joints
    ]

    angle = float(calculate_angle(*points))

    if angle >= TARGET_MIN_ANGLE:
        return "correct", angle

    return "incorrect", angle


def main():
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("ERROR: Cannot open webcam.")
        return

    session_id = None
    completed = False

    try:
        # FastAPI에서 실제 운동 세션 생성
        session = api_request(
            "POST",
            "/api/sessions",
            {"stretch_id": STRETCH_ID},
        )

        session_id = session["session_id"]
        print(f"Session started: {session_id}")
        print("Press Q to finish and save the session.")

        correct_seconds = 0.0
        start_time = time.monotonic()
        previous_time = start_time

        with mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as pose:

            while cap.isOpened():
                success, frame = cap.read()

                if not success:
                    print("ERROR: Cannot read webcam frame.")
                    break

                frame = cv2.flip(frame, 1)
                height, width = frame.shape[:2]

                rgb = cv2.cvtColor(
                    frame, cv2.COLOR_BGR2RGB
                )
                rgb.flags.writeable = False

                results = pose.process(rgb)

                status, angle = analyze_pose(
                    results, width, height
                )

                now = time.monotonic()
                elapsed = now - start_time
                delta = now - previous_time
                previous_time = now

                # 프레임이 오래 멈췄을 때 과도한 누적 방지
                if status == "correct":
                    correct_seconds += min(delta, 0.25)

                if results.pose_landmarks:
                    mp_drawing.draw_landmarks(
                        frame,
                        results.pose_landmarks,
                        mp_pose.POSE_CONNECTIONS,
                    )

                color = (
                    (0, 255, 0)
                    if status == "correct"
                    else (0, 0, 255)
                )

                cv2.putText(
                    frame,
                    f"Status: {status}",
                    (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    color,
                    2,
                )

                cv2.putText(
                    frame,
                    f"Angle: {angle:.1f}",
                    (20, 75),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2,
                )

                cv2.putText(
                    frame,
                    f"Total: {elapsed:.1f}s",
                    (20, 110),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2,
                )

                cv2.putText(
                    frame,
                    f"Correct: {correct_seconds:.1f}s",
                    (20, 145),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 255),
                    2,
                )

                cv2.imshow(
                    "Algorithm + FastAPI Integration",
                    frame,
                )

                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

        duration_seconds = time.monotonic() - start_time

        # 서버 입력값 조건에 맞도록 보정
        correct_seconds = min(
            correct_seconds, duration_seconds
        )

        if duration_seconds <= 0:
            print("No valid session duration.")
            return

        # 운동 완료 결과를 FastAPI에 저장
        result = api_request(
            "POST",
            f"/api/sessions/{session_id}/complete",
            {
                "duration_seconds": round(
                    duration_seconds, 2
                ),
                "correct_seconds": round(
                    correct_seconds, 2
                ),
            },
        )

        completed = True

        print("\n=== Saved Result ===")
        print(
            json.dumps(
                result,
                ensure_ascii=False,
                indent=2,
            )
        )

    except Exception as error:
        print(f"ERROR: {error}")

    finally:
        cap.release()
        cv2.destroyAllWindows()

        # 저장되지 않은 세션은 취소 처리 시도
        if session_id is not None and not completed:
            try:
                api_request(
                    "POST",
                    f"/api/sessions/{session_id}/cancel",
                )
                print("Unfinished session cancelled.")
            except Exception as error:
                print(
                    f"Session cleanup failed: {error}"
                )


if __name__ == "__main__":
    main()
