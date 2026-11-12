import { Link } from 'react-router-dom';
import styles from './LogoHeader.module.css';

// 상단 메뉴 없는 로고 헤더 (UI-02 ~ UI-05 공통). 로고를 누르면 메인으로 가요.
export default function LogoHeader() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo}>
        <span className={styles.logoMark} aria-hidden="true" />
        바른 자세 스트레칭
      </Link>
    </header>
  );
}