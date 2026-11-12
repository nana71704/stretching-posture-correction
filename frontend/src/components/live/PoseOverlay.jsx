import { useEffect, useRef } from 'react';
import { CONNECTIONS, JOINTS } from '../../constants/pose';
import styles from './PoseOverlay.module.css';

const MIN_VISIBILITY = 0.5;
const COLOR_VAR = {
  correct: '--color-correct',
  incorrect: '--color-incorrect',
  not_detected: '--color-undetected',
};

// video가 object-fit: cover로 잘려 보이므로, 화면에 보이는 영역 기준으로 좌표를 바꿈
function getCoverBox(video, width, height) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(width / vw, height / vh);
  return {
    scale,
    offsetX: (width - vw * scale) / 2,
    offsetY: (height - vh * scale) / 2,
    vw,
    vh,
  };
}

export default function PoseOverlay({ videoElementRef, landmarksRef, status }) {
  const canvasRef = useRef(null);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    let rafId;

    function draw() {
      rafId = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const video = videoElementRef.current;
      if (!canvas || !video || video.videoWidth === 0) return;

      // 캔버스 크기를 화면 크기(고해상도 화면 포함)에 맞춤
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const pixelW = Math.round(width * dpr);
      const pixelH = Math.round(height * dpr);
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
      }

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const landmarks = landmarksRef.current;
      if (!landmarks) return;

      const box = getCoverBox(video, width, height);
      const toPoint = (j) => ({
        x: box.offsetX + j.x * box.vw * box.scale,
        y: box.offsetY + j.y * box.vh * box.scale,
      });
      const visible = (j) => j && j.visibility >= MIN_VISIBILITY;

      const colorVar = COLOR_VAR[statusRef.current] ?? COLOR_VAR.not_detected;
      const color = getComputedStyle(canvas).getPropertyValue(colorVar).trim() || '#9ca3af';

      // 연결선
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (const [a, b] of CONNECTIONS) {
        const ja = landmarks[a];
        const jb = landmarks[b];
        if (!visible(ja) || !visible(jb)) continue;
        const pa = toPoint(ja);
        const pb = toPoint(jb);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // 관절 점
      for (const index of JOINTS) {
        const j = landmarks[index];
        if (!visible(j)) continue;
        const p = toPoint(j);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [videoElementRef, landmarksRef]);

  return <canvas ref={canvasRef} className={styles.overlay} aria-hidden="true" />;
}