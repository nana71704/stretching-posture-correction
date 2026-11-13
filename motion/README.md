# 동작인식 영상처리 모듈 (화면인식 및 처리)

## 백엔드와 연동해 실행하기 (Python 웹캠 클라이언트)

웹캠 → 관절 14개 추출 → 백엔드 `/api/pose/analyze` 판정 → 세션 결과 저장까지 Python으로 실행합니다.
웹 화면(frontend)과 같은 관절 규격·같은 백엔드 API를 사용하므로, 웹 시연이 안 될 때의 백업 경로로도 쓸 수 있습니다.

```bash
# 1) backend 폴더에서 서버 실행 (backend/README.md 참고)
python -m uvicorn main:app --reload

# 2) 새 터미널, motion 폴더에서
pip install -r requirements.txt
python api_client.py --stretch 1     # 스트레칭 ID 1~3
```

- `q`: 종료하고 결과 저장 (`/api/sessions/{id}/complete`), `ESC`: 저장하지 않고 취소
- 인식 예외처리: 사람 없음 / 화면 이탈 / 관절 가려짐을 구분해 안내 (`landmark_extractor.frame_status`)
- 좌표 떨림 보정: 지수이동평균 (`landmark_extractor.LandmarkSmoother`, 세기는 `config.SMOOTHING_ALPHA`)
- 기존 `pose_api_integration.py`와 같은 흐름이지만 최신 MediaPipe(Tasks API)에서 동작합니다.

---


카메라 영상에서 사용자의 신체 관절 데이터를 추출해 자세판정 파트(2번 역할)로 넘기는 모듈입니다.

## 처리 과정

```
웹캠 → OpenCV 영상 입력 → MediaPipe Pose → 33개 Landmark 인식 → 타겟 관절 14개 추출 → 자세판정 파트
       (캡처, BGR→RGB)     (자세 추론)                            (x, y, z, visibility)   (NumPy / JSON)
```

| 파일 | 역할 |
|---|---|
| `config.py` | 33개 랜드마크 이름, 타겟 관절 14개, 모델·신뢰도 설정 |
| `pose_detector.py` | OpenCV 프레임(BGR→RGB 변환) → MediaPipe PoseLandmarker 추론 |
| `landmark_extractor.py` | 33개 → 타겟 14개 추출, NumPy 배열 / JSON 변환 |
| `pipeline.py` | 웹캠부터 데이터 출력까지 연결한 `MotionPipeline` |
| `main.py` | 관절 인식 확인용 스크립트 (`--all`: 33개 점 전체 표시) |
| `api_client.py` | 백엔드 판정·세션 저장 연동 클라이언트 |
| `view_data.py` | 저장한 .jsonl 데이터 보기 / CSV 변환 |

## 설치 및 실행

```bash
pip install -r requirements.txt
python main.py                 # 웹캠 (q 또는 ESC로 종료)
python main.py --print         # 관절 좌표를 콘솔에 출력
python main.py --save out.jsonl  # 프레임별 데이터를 파일로 저장
python main.py --source test.mp4 # 비디오 파일로 테스트
```

첫 실행 시 MediaPipe 모델(`models/pose_landmarker_full.task`, 약 9MB)을 자동으로 내려받습니다.
속도가 느리면 `config.py`의 `MODEL_VARIANT`를 `"lite"`로 바꾸세요.

> 참고: MediaPipe 0.10.x 최신 버전에서는 인터넷 예제에 많이 나오는 `mp.solutions.pose`가 제거되었습니다.
> 이 코드는 현재 공식 방식인 Tasks API(`PoseLandmarker`)를 사용합니다.

## 타겟 관절 (출력 배열의 행 순서)

| 행 | 관절 | MediaPipe 번호 |
|---|---|---|
| 0, 1 | left/right_shoulder (어깨) | 11, 12 |
| 2, 3 | left/right_elbow (팔꿈치) | 13, 14 |
| 4, 5 | left/right_wrist (손목) | 15, 16 |
| 6, 7 | left/right_hip (골반) | 23, 24 |
| 8, 9 | left/right_knee (무릎) | 25, 26 |
| 10, 11 | left/right_ankle (발목) | 27, 28 |
| 12, 13 | left/right_foot_index (발끝) | 31, 32 |

※ left/right는 **사용자 본인 기준**입니다. 거울 모드(좌우 반전)에서도 MediaPipe가 사람 기준으로 판정합니다.

## 출력 데이터 형식 (자세판정 파트 전달용)

**NumPy 배열** — shape `(14, 4)`, 열 = `[x, y, z, visibility]`. 사람이 없으면 전부 `NaN`.

**JSON**
```json
{
  "timestamp": 1792055376.98,
  "detected": true,
  "frame_size": [640, 480],
  "joints": {
    "left_shoulder": {"x": 0.412, "y": 0.318, "z": -0.121, "visibility": 0.998},
    "...": {}
  }
}
```

- `x, y`: 프레임 너비·높이 기준 0.0~1.0 정규화 좌표 (좌상단이 원점). 픽셀이 필요하면 `landmark_extractor.to_pixel()`
- `z`: 골반 중심 기준 상대 깊이, 값이 작을수록 카메라에 가까움
- `visibility`: 화면에 보이는 정도 0.0~1.0. `landmark_extractor.visible_mask()`로 0.5 미만 관절을 걸러낼 수 있음

## 자세판정 파트에서 쓰는 방법

```python
from pipeline import MotionPipeline
import config

for frame, joints, data in MotionPipeline(source=0).run():
    if not data["detected"]:
        continue
    i = {n: k for k, n in enumerate(config.TARGET_JOINT_NAMES)}
    shoulder, elbow, wrist = joints[i["left_shoulder"]], joints[i["left_elbow"]], joints[i["left_wrist"]]
    # → 여기서 각도 계산 (2번 역할)
```

저장된 `.jsonl`을 읽을 때는 `landmark_extractor.from_dict()`로 같은 `(14, 4)` 배열로 복원됩니다.
