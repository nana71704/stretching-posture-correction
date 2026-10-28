import Button from './Button';
import styles from './ErrorBanner.module.css';

export default function ErrorBanner({ message, onRetry, retryLabel = '다시 시도' }) {
  return (
    <div className={styles.banner} role="alert">
      <span aria-hidden="true">⚠️</span>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
