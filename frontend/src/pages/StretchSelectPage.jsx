import { useNavigate } from 'react-router-dom';
import { ErrorBanner, LogoHeader, StepBar } from '../components/common';
import StretchScene from '../components/stretch/StretchScene';
import { STRETCH_INFO } from '../constants/stretchInfo';
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
    <div className={styles.page}>
      <LogoHeader />

      <main>
        <StepBar current={1} />
        <h1 className={styles.title}>어떤 스트레칭을 해 볼까요?</h1>
        <p className={styles.lead}>스트레칭을 하나 골라 주세요</p>

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
            {stretches.map((s) => {
              const info = STRETCH_INFO[s.id] ?? {};
              return (
                <li key={s.id}>
                  <button type="button" className={styles.card} onClick={() => handleSelect(s)}>
                    {info.category && <span className={styles.category}>{info.category}</span>}
                    <span className={styles.picture}>
                      <StretchScene pose={info.pose} />
                    </span>
                    <span className={styles.name}>{s.name}</span>
                    <span className={styles.desc}>{info.desc ?? s.description}</span>
                    <span className={styles.tags}>
                      {info.target && <span className={styles.tag}>🎯 {info.target}</span>}
                      <span className={styles.tag}>⏱ {s.target_seconds}초 유지</span>
                    </span>
                    <span className={styles.cta}>선택하기 →</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className={styles.notice}>🔒 카메라 영상은 자세 분석에만 사용하고 저장하지 않아요.</p>
      </main>
    </div>
  );
}