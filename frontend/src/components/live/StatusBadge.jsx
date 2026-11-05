import styles from './StatusBadge.module.css';

const BADGE = {
  correct: { icon: '✔', text: '올바른 자세' },
  incorrect: { icon: '!', text: '자세 교정 필요' },
  not_detected: { icon: '?', text: '인식 안 됨' },
};

export default function StatusBadge({ status }) {
  const badge = BADGE[status] ?? BADGE.not_detected;
  return (
    <span className={`${styles.badge} ${styles[status] ?? styles.not_detected}`}>
      <span className={styles.icon} aria-hidden="true">
        {badge.icon}
      </span>
      {badge.text}
    </span>
  );
}
