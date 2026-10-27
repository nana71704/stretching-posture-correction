import cv2
import mediapipe as mp
import numpy as np

# 1. MediaPipe 및 그리기 도구 초기화
mp_drawing = mp.solutions.drawing_utils
mp_pose = mp.solutions.pose


# 2. 기술 명세서 기준 각도 계산 함수 (벡터 내적과 arccos 이용)
def calculate_angle(a, b, c):
  a = np.array(a)  # 어깨 (Shoulder)
  b = np.array(b)  # 팔꿈치 (Elbow)
  c = np.array(c)  # 손목 (Wrist)

  # 벡터 AB, CB 구하기
  ab = a - b
  cb = c - b

  # 내적 및 크기(Norm) 계산
  dot_product = np.dot(ab, cb)
  norm_ab = np.linalg.norm(ab)
  norm_cb = np.linalg.norm(cb)

  # 영벡터 예외 처리
  if norm_ab == 0 or norm_cb == 0:
    return 0.0

  # 코사인 값 계산 (-1 ~ 1 사이로 클리핑하여 math domain error 방지)
  cosine_angle = np.clip(dot_product / (norm_ab * norm_cb), -1.0, 1.0)
  angle = np.arccos(cosine_angle)

  # 라디안을 각도(degree)로 변환
  return np.degrees(angle)


def main():
  # 웹캠 연결 (0번 카메라)
  cap = cv2.VideoCapture(0)

  # MediaPipe Pose 모델 선언
  with mp_pose.Pose(
      min_detection_confidence=0.5, min_tracking_confidence=0.5
  ) as pose:
    while cap.isOpened():
      success, frame = cap.read()
      if not success:
        print("웹캠을 불러올 수 없습니다.")
        break

      # 성능 향상을 위해 BGR 이미지를 RGB로 변환
      image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
      image.flags.writeable = False
      results = pose.process(image)

      # 다시 BGR로 변환 후 화면에 그리기 준비
      image.flags.writeable = True
      image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

      # 기본 상태값 설정
      status = "not_detected"
      feedback = "사람이 인식되지 않았습니다."
      elbow_angle = 0.0

      # 관절이 인식된 경우
      if results.pose_landmarks:
        # 화면에 스켈레톤(뼈대) 라인 그려주기
        mp_drawing.draw_landmarks(
            image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS
        )

        landmarks = results.pose_landmarks.landmark
        h, w, _ = image.shape

        # [예시: 오른쪽 팔 상체 펴기 스트레칭]
        # 어깨(12), 팔꿈치(14), 손목(16)의 픽셀 좌표 추출
        shoulder = [
            landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x * w,
            landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y * h,
        ]
        elbow = [
            landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x * w,
            landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y * h,
        ]
        wrist = [
            landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x * w,
            landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y * h,
        ]

        # 1. 관절 각도 계산
        elbow_angle = calculate_angle(shoulder, elbow, wrist)

        # 2. 동작별 기준 범위와 비교 (예: 팔꿈치 각도가 160도 이상이면 정상이 펴진 상태로 판정)
        target_min_angle = 160.0

        if elbow_angle >= target_min_angle:
          status = "correct"
          feedback = "자세가 아주 좋습니다! 유지하세요."
        else:
          status = "incorrect"
          feedback = "오른쪽 팔을 조금 더 펴주세요!"

      # 3. 화면에 판정 결과, 각도, 피드백 텍스트 렌더링
      color = (0, 255, 0) if status == "correct" else (0, 0, 255)  # 초록색 / 빨간색
      cv2.putText(
          image,
          f"Status: {status}",
          (30, 50),
          cv2.FONT_HERSHEY_SIMPLEX,
          1,
          color,
          2,
      )
      cv2.putText(
          image,
          f"Angle: {elbow_angle:.1f} deg",
          (30, 90),
          cv2.FONT_HERSHEY_SIMPLEX,
          1,
          (255, 255, 255),
          2,
      )
      cv2.putText(
          image,
          f"Feedback: {feedback}",
          (30, 130),
          cv2.FONT_HERSHEY_SIMPLEX,
          0.8,
          (255, 255, 0),
          2,
      )

      # 화면 출력 ('q'를 누르면 종료)
      cv2.imshow("Stretching Posture Analyzer", image)
      if cv2.waitKey(10) & 0xFF == ord("q"):
        break

  cap.release()
  cv2.destroyAllWindows()


if __name__ == "__main__":
  main()