import { useNavigate } from 'react-router-dom';
import { Card, ErrorBanner } from '../components/common';
import useAsync from '../hooks/useAsync';
import useSession from '../hooks/useSession';
import { getStretches } from '../services/api';
import styles from './StretchSelectPage.module.css';

export default function StretchSelectPage() {
  const navigate = useNavigate();
  const { dispatch } = useSession();
  const { loading, error, data: stretches, reload } = useAsync(getStretches);

  const handleSelect = (s) => {
    dispatch({
      type: 'SELECT_STRETCH',
      stretch: { id: s.id, name: s.name, target_seconds: s.target_seconds },
    });
    navigate(`/stretches/${s.id}/guide`);
  };

  return (
    <main className={styles.page}>
      <h1>스트레칭 선택</h1>

      {loading && (
        <ul className={styles.grid} aria-busy="true" aria-label="불러오는 중">
          {[1, 2, 3].map((n) => (
            <li key={n} className={styles.skeleton} />
          ))}
        </ul>
      )}

      {error && <ErrorBanner message={error.message} onRetry={reload} />}

      {!loading && !error && stretches.length === 0 && (
        <p className={styles.empty}>아직 등록된 스트레칭이 없어요.</p>
      )}

      {!loading && !error && stretches.length > 0 && (
        <ul className={styles.grid}>
          {stretches.map((s) => (
            <li key={s.id}>
              <Card onClick={() => handleSelect(s)}>
                <span className={styles.name}>{s.name}</span>
                <span className={styles.desc}>{s.description}</span>
                <span className={styles.time}>목표 {s.target_seconds}초 유지</span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
