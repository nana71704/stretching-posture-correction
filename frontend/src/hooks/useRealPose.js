import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { analyzePose } from '../services/api';
import { JOINTS } from '../constants/pose';

// 모델·wasm을 public/ 폴더에 두면 인터넷 없이도 동작 (시연장 대비)
const MODEL_URL = '/models/pose_landmarker_lite.task';
const WASM_URL = '/mediapipe/wasm';

const INTERVAL_MS = 200; // 서버 판정 요청 간격 (초당 5번)

export const LOADING_FEEDBACK = '자세 인식 모델을 준비하고 있어요...';

const INITIAL_POSE = {
  status: 'not_detected',
  feedback: LOADING_FEEDBACK,
  angle: null,
  ready: false, // 모델 로딩이 끝났는지
  error: false, // 판정 요청이 실패했는지
  latencyMs: null, // 관절 추출 + 서버 판정까지 걸린 시간
};

// 반환: { pose, landmarksRef, fps }
// - pose: 화면 표시용 (초당 5번 바뀜)
// - landmarksRef: 매 프레임 바뀌는 관절 좌표. 리렌더 없이 PoseOverlay가 직접 읽음
export default function useRealPose(videoElementRef, running, stretchId) {
  const [pose, setPose] = useState(INITIAL_POSE);
  const [fps, setFps] = useState(0);
  const landmarksRef = useRef(null);

  useEffect(() => {
    if (!running || !stretchId) return undefined;

    let cancelled = false;
    let rafId = null;
    let landmarker = null;
    let lastVideoTime = -1;
    let lastSentAt = 0;
    let busy = false;
    let frameCount = 0;
    let fpsStartedAt = performance.now();

    async function send(landmarks, startedAt) {
      busy = true;
      try {
        const res = await analyzePose(stretchId, landmarks);
        if (cancelled) return;
        setPose({
          status: res.status,
          feedback: res.feedback,
          angle: res.angle ?? null,
          ready: true,
          error: false,
          latencyMs: Math.round(performance.now() - startedAt),
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Pose analysis failed:', err);
        setPose({
          status: 'not_detected',
          feedback: '자세 분석에 실패했어요. 연결을 확인해 주세요.',
          angle: null,
          ready: true,
          error: true,
          latencyMs: null,
        });
      } finally {
        busy = false;
      }
    }

    function loop() {
      if (cancelled) return;
      rafId = requestAnimationFrame(loop);

      const video = videoElementRef.current;
      if (
        !video ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0
      ) {
        return;
      }
      // 새 영상 프레임이 없으면 건너뜀 (같은 프레임을 두 번 분석하지 않기)
      if (video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      const startedAt = performance.now();
      let detected;
      try {
        detected = landmarker.detectForVideo(video, startedAt).landmarks?.[0];
      } catch (err) {
        console.error('detectForVideo failed:', err);
        return;
      }

      const landmarks = {};
      if (detected) {
        for (const index of JOINTS) {
          const joint = detected[index];
          if (!joint) continue;
          landmarks[String(index)] = {
            x: Math.max(0, Math.min(1, joint.x)),
            y: Math.max(0, Math.min(1, joint.y)),
            visibility: Math.max(0, Math.min(1, joint.visibility ?? 0)),
          };
        }
      }
      landmarksRef.current = detected ? landmarks : null;

      // FPS: 1초마다 한 번 갱신
      frameCount += 1;
      if (startedAt - fpsStartedAt >= 1000) {
        setFps(Math.round((frameCount * 1000) / (startedAt - fpsStartedAt)));
        frameCount = 0;
        fpsStartedAt = startedAt;
      }

      // 서버 판정은 INTERVAL_MS마다, 이전 요청이 끝났을 때만
      if (!busy && startedAt - lastSentAt >= INTERVAL_MS) {
        lastSentAt = startedAt;
        send(landmarks, startedAt);
      }
    }

    async function initialize() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        const created = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        if (cancelled) {
          created.close();
          return;
        }
        landmarker = created;
        setPose((prev) => ({
          ...prev,
          ready: true,
          feedback: '카메라에 몸 전체가 보이도록 서 주세요.',
        }));
        loop();
      } catch (err) {
        if (cancelled) return;
        console.error('MediaPipe initialization failed:', err);
        setPose({ ...INITIAL_POSE, feedback: '자세 인식 모델을 불러오지 못했어요.', error: true });
      }
    }

    initialize();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      landmarker?.close();
      landmarksRef.current = null;
    };
  }, [videoElementRef, running, stretchId]);

  return { pose, landmarksRef, fps };
}