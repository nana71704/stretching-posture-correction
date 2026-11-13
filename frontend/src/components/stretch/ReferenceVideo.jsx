import { useRef, useState } from 'react';
import StretchScene from './StretchScene';
import styles from './ReferenceVideo.module.css';

// 영상 속 "자세를 유지하는 구간" 시각(초). 끝나면 이 장면에 멈춰서 기준 자세가 계속 보이게 해요.
const HOLD_FRAME_SEC = 3.0;

// 기준 자세 영상 (public/videos/reference/ref_<pose>.mp4)
// pose: 'neck' | 'arms' | 'squat'
// crop: true면 세로로 잘라서 사람만 크게 보여 줘요 (UI-03 카드용)
// 처음 한 번만 자동 재생 → 끝나면 자세 유지 장면에서 멈춤 → 영상을 클릭하면 처음부터 다시 재생
// 영상을 못 불러오면 예전처럼 SVG 그림(StretchScene)을 대신 보여 줘요.
export default function ReferenceVideo({ pose, crop = false }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(true); // autoPlay라서 처음엔 재생 중
  const [failed, setFailed] = useState(false);

  if (failed) return <StretchScene pose={pose} crop={crop} />;

  const src = `/videos/reference/ref_${pose}`;

  // 끝나면 자세 유지 장면으로 이동해서 멈춰 둬요
  const handleEnded = () => {
    videoRef.current.currentTime = HOLD_FRAME_SEC;
    setPlaying(false);
  };

  // 클릭하면 처음부터 다시 재생
  const handleClick = () => {
    const video = videoRef.current;
    video.currentTime = 0;
    video.play();
    setPlaying(true);
  };

  return (
    <button
      type="button"
      className={`${styles.wrap} ${crop ? styles.crop : ''}`}
      onClick={handleClick}
      aria-label="기준 자세 영상 처음부터 다시 보기"
    >
      <video
        ref={videoRef}
        className={styles.video}
        src={`${src}.mp4`}
        poster={`${src}.jpg`}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={handleEnded}
        onError={() => setFailed(true)}
      />
      {!playing && <span className={styles.replay}>▶ 다시 보기</span>}
    </button>
  );
}