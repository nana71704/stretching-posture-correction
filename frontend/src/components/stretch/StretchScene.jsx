import styles from './StretchScene.module.css';

// 스트레칭별 사람 그림 (SVG). pose: 'neck' | 'arms' | 'squat'
// 좌표는 "x,y x,y ..." 순서로 이어지는 선이에요. (그림 크기 540 x 360 기준)
const POSES = {
  // 1. 목/어깨 측면: 왼손으로 머리를 감싸 옆으로 당김
  neck: {
    head: [262, 92],
    shirt: 'M236,122 L298,122 L292,222 L242,222 Z',
    legs: ['250,222 250,322', '284,222 284,322'],
    arms: ['238,126 214,100 240,74', '296,126 302,172 304,214'],
    bones: [
      '214,100 238,126 296,126 302,172',
      '238,126 244,220 290,220 296,126',
      '244,220 250,272 250,322',
      '290,220 284,272 284,322',
    ],
    joints: [
      [214, 100],
      [238, 126],
      [296, 126],
      [302, 172],
      [244, 220],
      [290, 220],
      [250, 272],
      [284, 272],
      [250, 322],
      [284, 322],
    ],
  },
  // 2. 팔/어깨 상체 굴곡: 두 팔을 머리 위로 쭉
  arms: {
    head: [268, 92],
    shirt: 'M236,122 L300,122 L294,222 L242,222 Z',
    legs: ['250,222 250,322', '286,222 286,322'],
    arms: ['238,126 244,86 252,46', '298,126 292,86 284,46'],
    bones: [
      '252,46 244,86 238,126 298,126 292,86 284,46',
      '238,126 244,220 292,220 298,126',
      '244,220 250,272 250,322',
      '292,220 286,272 286,322',
    ],
    joints: [
      [252, 46],
      [284, 46],
      [244, 86],
      [292, 86],
      [238, 126],
      [298, 126],
      [244, 220],
      [292, 220],
      [250, 272],
      [286, 272],
      [250, 322],
      [286, 322],
    ],
  },
  // 3. 스쿼트: 옆모습, 엉덩이를 뒤로 빼고 팔은 앞으로
  squat: {
    head: [304, 120],
    torso: '298,156 254,248',
    legs: ['254,248 330,270 306,322'],
    arms: ['296,166 330,172 378,172'],
    bones: ['378,172 330,172 296,166 254,248 330,270 306,322'],
    joints: [
      [378, 172],
      [330, 172],
      [296, 166],
      [254, 248],
      [330, 270],
      [306, 322],
    ],
  },
};

export default function StretchScene({ pose, crop = false }) {
  const p = POSES[pose] ?? POSES.arms;
  const [hx, hy] = p.head;

  return (
    <svg 
      className={styles.scene} 
      viewBox={crop ? '150 20 260 340' : '0 0 540 360'}
      aria-hidden="true"
    >
      {/* 방: 벽, 창문, 바닥, 매트, 화분 */}
      <rect className={styles.wall} width="540" height="360" />
      <g className={styles.window}>
        <rect x="358" y="50" width="220" height="214" />
        <line x1="456" y1="50" x2="456" y2="264" />
        <line x1="358" y1="156" x2="578" y2="156" />
      </g>
      <rect className={styles.floor} y="308" width="540" height="52" />
      <rect className={styles.mat} x="184" y="318" width="168" height="12" rx="6" />
      <rect className={styles.pot} x="0" y="272" width="24" height="38" rx="4" />
      <ellipse
        className={styles.leaf}
        cx="16"
        cy="230"
        rx="12"
        ry="44"
        transform="rotate(20 16 270)"
      />
      <ellipse
        className={styles.leaf}
        cx="4"
        cy="232"
        rx="10"
        ry="40"
        transform="rotate(-8 4 270)"
      />

      {/* 사람 */}
      {p.legs.map((pts) => (
        <polyline key={pts} className={styles.leg} points={pts} />
      ))}
      {p.shirt && <path className={styles.shirt} d={p.shirt} />}
      {p.torso && <polyline className={styles.torso} points={p.torso} />}
      {p.arms.map((pts) => (
        <polyline key={pts} className={styles.arm} points={pts} />
      ))}
      <circle className={styles.skin} cx={hx} cy={hy} r="20" />
      {pose !== 'squat' && (
        <path
          className={styles.hair}
          d={`M${hx - 20},${hy - 2} Q${hx},${hy - 28} ${hx + 20},${hy - 2}`}
        />
      )}

      {/* 관절선 (평소엔 숨김, 카드에 마우스를 올리면 보임) */}
      <g className={styles.skeleton}>
        {p.bones.map((pts) => (
          <polyline key={pts} className={styles.bone} points={pts} />
        ))}
        {p.joints.map(([x, y]) => (
          <circle key={`${x}-${y}`} className={styles.joint} cx={x} cy={y} r="4.5" />
        ))}
      </g>
    </svg>
  );
}