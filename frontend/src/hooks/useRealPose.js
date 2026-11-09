
import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { analyzePose } from '../services/api';

const JOINTS = [
  11, 12, 13, 14, 15, 16,
  23, 24, 25, 26, 27, 28,
  31, 32,
];

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm';

const INTERVAL_MS = 200;

const INITIAL_POSE = {
  status: 'not_detected',
  feedback: '자세를 인식하는 중이에요...',
  angle: null,
};

export default function useRealPose(videoElementRef, running, stretchId) {
  const [pose, setPose] = useState(INITIAL_POSE);
  const landmarkerRef = useRef(null);

  useEffect(() => {
    if (!running || !stretchId) {
      return undefined;
    }

    let cancelled = false;
    let timerId = null;
    let busy = false;

    async function initialize() {
      try {
        setPose({
          status: 'not_detected',
          feedback: '자세 인식 모델을 준비하고 있어요...',
          angle: null,
        });

        const vision = await FilesetResolver.forVisionTasks(WASM_URL);

        const landmarker = await PoseLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          }
        );

        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;

        async function analyzeFrame() {
          if (cancelled || busy) return;

          const video = videoElementRef.current;

          if (
            !video ||
            video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
            video.videoWidth === 0
          ) {
            return;
          }

          busy = true;

          try {
            const result = landmarker.detectForVideo(
              video,
              performance.now()
            );

            const detected = result.landmarks?.[0];

            const landmarks = {};

            if (detected) {
              for (const index of JOINTS) {
                const joint = detected[index];

                if (!joint) continue;

                landmarks[String(index)] = {
                  x: Math.max(0, Math.min(1, joint.x)),
                  y: Math.max(0, Math.min(1, joint.y)),
                  visibility: Math.max(
                    0,
                    Math.min(1, joint.visibility ?? 0)
                  ),
                };
              }
            }

            const response = await analyzePose(
              stretchId,
              landmarks
            );

            if (!cancelled) {
              setPose({
                status: response.status,
                feedback: response.feedback,
                angle: response.angle,
              });
            }
          } catch (error) {
            if (!cancelled) {
              console.error('Pose analysis failed:', error);

              setPose({
                status: 'not_detected',
                feedback: '자세 분석에 실패했어요. 연결을 확인해 주세요.',
                angle: null,
              });
            }
          } finally {
            busy = false;
          }
        }

        // 요청 중복을 방지하면서 주기적으로 분석
        timerId = window.setInterval(analyzeFrame, INTERVAL_MS);
      } catch (error) {
        if (!cancelled) {
          console.error('MediaPipe initialization failed:', error);

          setPose({
            status: 'not_detected',
            feedback: '자세 인식 모델을 불러오지 못했어요.',
            angle: null,
          });
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;

      if (timerId !== null) {
        window.clearInterval(timerId);
      }

      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [videoElementRef, running, stretchId]);

  return pose;
}
