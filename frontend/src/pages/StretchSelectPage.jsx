import { Link, useNavigate } from 'react-router-dom';
import { ErrorBanner, StepBar } from '../components/common';
import StretchScene from '../components/stretch/StretchScene';
import useAsync from '../hooks/useAsync';
import useSession from '../hooks/useSession';
import { getStretches } from '../services/api';
import styles from './StretchSelectPage.module.css';

// 서버에는 이름·설명·목표 시간만 있어서, 화면에만 쓰는 정보는 id별로 여기에 둡니다.
// (id는 backend/seed.py 순서: 1 목/어깨, 2 팔/어깨, 3 스쿼트)
const CARD_INFO = {
  1: {
    category: '목 · 어깨',
    pose: 'neck',
    desc: '오래 앉아 있어 뭉친 목 옆과 어깨 윗부분을 풀어 줘요.',
    target: '목 옆 · 승모근',
  },
  2: {
    category: '팔 · 상체',
    pose: 'arms',
    desc: '두 팔을 위로 쭉 뻗어 굳은 어깨와 상체를 펴 줘요.',
    target: '어깨 · 팔 · 옆구리',
  },
  3: {
    category: '하체',
    pose: 'squat',
    desc: '하체 근육을 늘리고 강화해서 무릎과 골반을 안정시켜요.',
    target: '허벅지 · 엉덩이',
  },
};

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
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true" />
          바른 자세 스트레칭
        </Link>
      </header>

      <main>
        <StepBar current={1} />
        <h1 className={styles.title}>어떤 스트레칭을 해 볼까요?</h1>
        <p className={styles.lead}>뭉친 부위에 맞는 스트레칭을 하나 골라 주세요</p>

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
              const info = CARD_INFO[s.id] ?? {};
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