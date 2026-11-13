import styles from './HoldRing.module.css';

const SIZE = 200; // 그림 크기 (가로·세로)
const STROKE = 18; // 링 두께
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // 원 둘레

// 올바른 자세 유지 시간을 동그란 링으로 보여 줘요. (UI-04 오른쪽 위)
// value: 지금까지 올바른 자세 시간(초), target: 목표 시간(초)
export default function HoldRing({ value, target }) {
  const ratio = Math.min(value / target, 1); // 0 ~ 1
  const done = ratio >= 1;

  return (
    <div
      className={styles.ring}
      role="progressbar"
      aria-label="올바른 자세 유지 시간"
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.min(value, target)}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle className={styles.track} cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} />
        <circle
          className={`${styles.fill} ${done ? styles.done : ''}`}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
        />
      </svg>
      <p className={styles.text}>
        <strong>{Math.min(value, target).toFixed(1)}</strong>
        <span>/ {target}초</span>
      </p>
    </div>
  );
}