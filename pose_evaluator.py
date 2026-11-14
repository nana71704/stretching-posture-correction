import numpy as np

# MediaPipe Pose 주요 랜드마크 인덱스
LANDMARKS = {
    "NOSE": 0,
    "LEFT_EAR": 7,
    "RIGHT_EAR": 8,
    "LEFT_SHOULDER": 11,
    "RIGHT_SHOULDER": 12,
    "LEFT_ELBOW": 13,
    "RIGHT_ELBOW": 14,
    "LEFT_WRIST": 15,
    "RIGHT_WRIST": 16,
    "LEFT_HIP": 23,
    "RIGHT_HIP": 24,
}

def calculate_angle(a, b, c):
    """세 점(a, b, c) 사이의 각도를 계산 (b가 꼭짓점)"""
    a = np.array(a[:2])
    b = np.array(b[:2])
    c = np.array(c[:2])

    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    if angle > 180.0:
        angle = 360.0 - angle
    return angle

def calculate_tilt_angle(p1, p2):
    """두 점을 잇는 선분의 수직/수평 기울기 각도 계산"""
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    return np.degrees(np.arctan2(dy, dx))

def evaluate_neck_shoulder_stretch(landmarks, target_side="RIGHT"):
    """
    목·어깨 스트레칭 자세 판정 함수
    - 차렷 자세 오판정 방지: 목 기울기 필수 조건(AND) 적용
    - 단일 관절 편향 방지: 목(50%) + 어깨 수평(30%) + 팔 위치/각도(20%) 가중치 분배
    """
    feedback = []
    score = 0

    # 주요 좌표 추출 (x, y)
    l_ear = landmarks[LANDMARKS["LEFT_EAR"]]
    r_ear = landmarks[LANDMARKS["RIGHT_EAR"]]
    l_sh = landmarks[LANDMARKS["LEFT_SHOULDER"]]
    r_sh = landmarks[LANDMARKS["RIGHT_SHOULDER"]]
    l_el = landmarks[LANDMARKS["LEFT_ELBOW"]]
    r_el = landmarks[LANDMARKS["RIGHT_ELBOW"]]
    l_wr = landmarks[LANDMARKS["LEFT_WRIST"]]
    r_wr = landmarks[LANDMARKS["RIGHT_WRIST"]]

    # 1. [핵심 조건] 목의 기울기 계산 (귀 라인과 어깨 라인의 상대 각도)
    ear_angle = calculate_tilt_angle(r_ear, l_ear)
    shoulder_angle = calculate_tilt_angle(r_sh, l_sh)
    neck_tilt = abs(ear_angle - shoulder_angle)

    # 2. 어깨 수평 유지 여부 (스트레칭 시 반대쪽 어깨가 같이 올라가는 보상 동작 체크)
    shoulder_diff_y = abs(l_sh[1] - r_sh[1])
    shoulder_width = abs(l_sh[0] - r_sh[0]) + 1e-6
    shoulder_tilt_ratio = shoulder_diff_y / shoulder_width

    # 3. 팔 각도 및 위치 체크 (단순 차렷 자세와 구분)
    r_arm_angle = calculate_angle(r_sh, r_el, r_wr)
    l_arm_angle = calculate_angle(l_sh, l_el, l_wr)

    # --- [1단계: 차렷 자세 필터링 (필수 Gate 조건)] ---
    # 목이 일정 각도(예: 12도) 이상 기울어지지 않았다면 차렷 자세로 간주하고 점수 제한
    if neck_tilt < 12.0:
        feedback.append("목이 충분히 기울어지지 않았습니다. 스트레칭 방향으로 고개를 당겨주세요.")
        return {
            "is_good": False,
            "score": 20,  # 차렷 자세 기본 점수 상한선 고정
            "feedback": feedback,
            "debug": {
                "neck_tilt": round(neck_tilt, 1),
                "shoulder_tilt_ratio": round(shoulder_tilt_ratio, 3),
                "r_arm_angle": round(r_arm_angle, 1),
            }
        }

    # --- [2단계: 다중 관절 가중치 스코어링 (총 100점)] ---
    # (A) 목 기울기 점수 (최대 50점): 15도 ~ 35도 사이를 적정 스트레칭 범위로 판정
    if 15.0 <= neck_tilt <= 38.0:
        score += 50
    elif neck_tilt > 38.0:
        score += 35
        feedback.append("목을 너무 과도하게 꺾었습니다. 통증이 없는 범위까지만 당겨주세요.")
    else:
        score += 25
        feedback.append("고개를 조금 더 옆으로 기울여주세요.")

    # (B) 어깨 수평 안정성 점수 (최대 30점): 어깨가 솟구치지 않고 고정되어 있는지 확인
    if shoulder_tilt_ratio < 0.08:
        score += 30
    else:
        score += 10
        feedback.append("스트레칭 반대쪽 어깨가 따라 올라가지 않도록 아래로 내려주세요.")

    # (C) 팔 자세 보조 점수 (최대 20점): 기존에 팔만 펴면 통과되던 로직을 보조 지표로 축소
    # 예: 오른쪽으로 목을 당길 때 오른손이 머리 위/측면에 있거나, 반대쪽 팔을 아래로 뻗어 고정하는 경우
    if r_arm_angle > 150.0 or l_arm_angle > 150.0:
        score += 20
    else:
        score += 10
        feedback.append("반대쪽 팔을 아래로 쭉 펴서 어깨가 딸려오지 않게 고정하세요.")

    if not feedback:
        feedback.append("아주 좋은 자세입니다! 현재 상태를 유지하세요.")

    return {
        "is_good": score >= 80,
        "score": score,
        "feedback": feedback,
        "debug": {
            "neck_tilt": round(neck_tilt, 1),
            "shoulder_tilt_ratio": round(shoulder_tilt_ratio, 3),
            "r_arm_angle": round(r_arm_angle, 1),
            "l_arm_angle": round(l_arm_angle, 1),
        }
    }