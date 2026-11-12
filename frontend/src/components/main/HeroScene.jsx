import styles from './HeroScene.module.css';

// UI-01 히어로 배경: 사람이 팔을 올렸다 내리고, 관절선 색이 주황 ↔ 초록으로 바뀌는 6초 반복 애니메이션
// (실제 영상 파일이 생기면 MainPage에서 <video>가 이 위를 덮습니다)
export default function HeroScene() {
  return (
    <svg
      className={styles.scene}
      viewBox="-50 -60 1300 620"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* 방 */}
      <rect className={styles.wall} x="-500" y="-200" width="2200" height="900" />
      <g className={styles.window}>
        <rect x="740" y="40" width="300" height="330" rx="6" />
        <line x1="890" y1="40" x2="890" y2="370" />
        <line x1="740" y1="205" x2="1040" y2="205" />
      </g>
      <rect className={styles.floor} x="-500" y="440" width="2200" height="300" />
      <rect className={styles.mat} x="470" y="458" width="260" height="22" rx="8" />
      <g>
        <rect className={styles.pot} x="160" y="370" width="60" height="75" rx="8" />
        <ellipse className={styles.leaf} cx="190" cy="330" rx="26" ry="60" transform="rotate(-25 190 360)" />
        <ellipse className={styles.leaf} cx="200" cy="320" rx="24" ry="66" transform="rotate(18 200 360)" />
        <ellipse className={styles.leaf} cx="188" cy="300" rx="18" ry="60" />
      </g>

      {/* 사람: 다리·몸통 */}
      <polyline className={styles.leg} points="572,300 570,470" />
      <polyline className={styles.leg} points="628,300 630,470" />
      <path className={styles.shirt} d="M548,150 L652,150 L640,310 L560,310 Z" />

      {/* 왼팔·오른팔 (어깨를 중심으로 회전) */}
      <g className={styles.armLeft}>
        <polyline className={styles.arm} points="552,158 562,100 576,40" />
        <polyline className={styles.bone} points="552,158 562,100 576,40" />
        <circle className={styles.joint} cx="562" cy="100" r="7" />
        <circle className={styles.joint} cx="576" cy="40" r="7" />
      </g>
      <g className={styles.armRight}>
        <polyline className={styles.arm} points="648,158 638,100 624,40" />
        <polyline className={styles.bone} points="648,158 638,100 624,40" />
        <circle className={styles.joint} cx="638" cy="100" r="7" />
        <circle className={styles.joint} cx="624" cy="40" r="7" />
      </g>

      {/* 머리 */}
      <circle className={styles.skin} cx="600" cy="100" r="32" />
      <path className={styles.hair} d="M568,94 Q600,56 632,94" />

      {/* 몸통·다리 관절선 */}
      <line className={styles.bone} x1="552" y1="158" x2="648" y2="158" />
      <polyline className={styles.bone} points="552,158 565,305 570,390 570,470" />
      <polyline className={styles.bone} points="648,158 635,305 630,390 630,470" />
      <line className={styles.bone} x1="565" y1="305" x2="635" y2="305" />
      {[
        [552, 158], [648, 158], [565, 305], [635, 305],
        [570, 390], [630, 390], [570, 470], [630, 470],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} className={styles.joint} cx={cx} cy={cy} r="7" />
      ))}
    </svg>
  );
}