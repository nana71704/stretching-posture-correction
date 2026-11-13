
import { useEffect, useRef, useState } from 'react';
import { analyzePoseFrame } from '../services/api';

const INTERVAL_MS = 300;
const INITIAL_POSE = {
  status: 'not_detected',
  feedback: 'Python 자세 인식 서버를 준비하고 있어요...',
  angle: null,
  ready: false,
  error: false,
  latencyMs: null,
};

export default function usePythonPose(videoElementRef, running, stretchId) {
  const [pose, setPose] = useState(INITIAL_POSE);
  const [fps, setFps] = useState(0);
  const landmarksRef = useRef(null);

  useEffect(() => {
    if (!running || !stretchId) return undefined;

    let cancelled = false;
    let timerId = null;
    let busy = false;
    let frameCount = 0;
    let fpsStartedAt = performance.now();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setPose({
        ...INITIAL_POSE,
        feedback: '카메라 영상을 처리할 수 없어요.',
        error: true,
      });
      return undefined;
    }

    async function captureAndAnalyze() {
      if (cancelled || busy) return;

      const video = videoElementRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;

      busy = true;
      const startedAt = performance.now();

      try {
        // 전송량과 서버 부하를 줄이기 위해 영상 크기 축소
        const width = Math.min(video.videoWidth, 640);
        const height = Math.round(width * video.videoHeight / video.videoWidth);

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0, width, height);

        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', 0.7);
        });

        if (!blob) throw new Error('JPEG 변환 실패');

        const result = await analyzePoseFrame(blob);
        if (cancelled) return;

        landmarksRef.current =
          result.landmarks && Object.keys(result.landmarks).length > 0
            ? result.landmarks
            : null;

        setPose({
          status: result.status,
          feedback: result.feedback,
          angle: result.angle ?? null,
          ready: true,
          error: false,
          latencyMs: Math.round(performance.now() - startedAt),
        });

        frameCount += 1;
        const now = performance.now();

        if (now - fpsStartedAt >= 1000) {
          setFps(Math.round(frameCount * 1000 / (now - fpsStartedAt)));
          frameCount = 0;
          fpsStartedAt = now;
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Python pose analysis failed:', err);

        landmarksRef.current = null;
        setPose({
          status: 'not_detected',
          feedback: 'Python 영상 분석에 실패했어요. 서버 연결을 확인해 주세요.',
          angle: null,
          ready: true,
          error: true,
          latencyMs: null,
        });
      } finally {
        busy = false;
      }
    }

    timerId = window.setInterval(captureAndAnalyze, INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
      landmarksRef.current = null;
    };
  }, [videoElementRef, running, stretchId]);

  return { pose, landmarksRef, fps };
}
