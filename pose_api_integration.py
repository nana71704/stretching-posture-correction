
import json
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

import cv2
import mediapipe as mp


API_BASE_URL = "http://127.0.0.1:8000"
STRETCH_ID = 1
REQUEST_INTERVAL = 0.2

mp_pose = mp.solutions.pose

JOINTS = [
    11, 12, 13, 14, 15, 16,
    23, 24, 25, 26, 27, 28,
    31, 32
]


def api_request(method, endpoint, data=None):
    body = None

    if data is not None:
        body = json.dumps(data).encode("utf-8")

    request = Request(
        API_BASE_URL + endpoint,
        data=body,
        headers={"Content-Type": "application/json"},
        method=method
    )

    with urlopen(request, timeout=3) as response:
        return json.loads(
            response.read().decode("utf-8")
        )


def extract_landmarks(results):
    if not results.pose_landmarks:
        return {}

    points = results.pose_landmarks.landmark

    return {
        str(index): {
            "x": min(1.0, max(0.0, points[index].x)),
            "y": min(1.0, max(0.0, points[index].y)),
            "visibility": points[index].visibility
        }
        for index in JOINTS
    }


def main():
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("ERROR: Cannot open webcam.")
        return

    session_id = None
    completed = False

    try:
        session = api_request(
            "POST",
            "/api/sessions",
            {"stretch_id": STRETCH_ID}
        )

        session_id = session["session_id"]

        print(f"Session started: {session_id}")
        print("Press Q to finish and save.")

        status = "not_detected"
        angle = None

        correct_seconds = 0.0
        start_time = time.monotonic()
        previous_time = start_time
        last_request = 0.0

        with mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        ) as pose:

            while cap.isOpened():
                success, frame = cap.read()

                if not success:
                    print("ERROR: Cannot read webcam.")
                    break

                frame = cv2.flip(frame, 1)

                rgb = cv2.cvtColor(
                    frame, cv2.COLOR_BGR2RGB
                )

                results = pose.process(rgb)

                now = time.monotonic()
                delta = now - previous_time
                previous_time = now

                # API 응답을 받은 뒤에만 자세 유지 시간 누적
                # 요청 전에는 직전 판정 결과를 사용
                if status == "correct":
                    correct_seconds += min(delta, 0.25)

                if now - last_request >= REQUEST_INTERVAL:
                    landmarks = extract_landmarks(results)

                    try:
                        result = api_request(
                            "POST",
                            "/api/pose/analyze",
                            {
                                "stretch_id": STRETCH_ID,
                                "landmarks": landmarks
                            }
                        )

                        status = result["status"]
                        angle = result["angle"]

                    except (
                        HTTPError,
                        URLError,
                        TimeoutError
                    ) as error:
                        print(f"API ERROR: {error}")
                        status = "error"
                        angle = None

                    last_request = time.monotonic()

                elapsed = time.monotonic() - start_time

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
                    2
                )

                angle_text = (
                    f"Angle: {angle:.1f}"
                    if angle is not None
                    else "Angle: N/A"
                )

                cv2.putText(
                    frame,
                    angle_text,
                    (20, 75),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2
                )

                cv2.putText(
                    frame,
                    f"Total: {elapsed:.1f}s",
                    (20, 110),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2
                )

                cv2.putText(
                    frame,
                    f"Correct: {correct_seconds:.1f}s",
                    (20, 145),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 255),
                    2
                )

                cv2.imshow(
                    "Pose API + Session Integration",
                    frame
                )

                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

        duration_seconds = time.monotonic() - start_time

        correct_seconds = min(
            correct_seconds,
            duration_seconds
        )

        if duration_seconds <= 0:
            print("No valid session duration.")
            return

        result = api_request(
            "POST",
            f"/api/sessions/{session_id}/complete",
            {
                "duration_seconds": round(
                    duration_seconds, 2
                ),
                "correct_seconds": round(
                    correct_seconds, 2
                )
            }
        )

        completed = True

        print("\n=== Saved Result ===")
        print(
            json.dumps(
                result,
                ensure_ascii=False,
                indent=2
            )
        )

    except Exception as error:
        print(f"ERROR: {error}")

    finally:
        cap.release()
        cv2.destroyAllWindows()

        if session_id is not None and not completed:
            try:
                api_request(
                    "POST",
                    f"/api/sessions/{session_id}/cancel"
                )
                print("Unfinished session cancelled.")

            except Exception as error:
                print(f"Cleanup failed: {error}")


if __name__ == "__main__":
    main()
