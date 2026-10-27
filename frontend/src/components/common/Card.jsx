import styles from './Card.module.css';

// onClick이 있으면 클릭 가능한 카드(button), 없으면 표시용(div)
export default function Card({ onClick, children, className = '' }) {
  if (onClick) {
    return (
      <button
        type="button"
        className={`${styles.card} ${styles.clickable} ${className}`}
        onClick={onClick}
      >
        {children}
      </button>
    );
  }
  return <div className={`${styles.card} ${className}`}>{children}</div>;
}
