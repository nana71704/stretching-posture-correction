import styles from './Loader.module.css';

export default function Loader({ label = '불러오는 중...' }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
