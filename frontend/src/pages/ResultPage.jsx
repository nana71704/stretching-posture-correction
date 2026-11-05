import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, ErrorBanner, Loader } from '../components/common';
import useAsync from '../hooks/useAsync';
import { getSession } from '../services/api';
import { formatDateTime, formatSeconds } from '../utils/format';
import styles from './ResultPage.module.css';

export default function ResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // id가 바뀔 때만 새 함수 (2주차 3일차 useAsync 주의사항)
  const fetchSession = useCallback(() => getSession(id), [id]);
  const { loading, error, data: result, reload } = useAsync(fetchSession);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>운동 결과</h1>

      {loading && <Loader />}
      {error && (
        <ErrorBanner message={error.message} onRetry={error.status === 404 ? undefined : reload} />
      )}

      {result && (
        <>
          <p className={styles.meta}>
            {result.stretch_name} · {formatDateTime(result.started_at)}
          </p>

          {result.status === 'completed' ? (
            <>
              <p className={`${styles.verdict} ${result.success ? styles.success : styles.fail}`}>
                {result.success ? '🎉 목표 달성!' : '아쉬워요. 다음엔 조금 더 유지해 봐요'}
              </p>
              <div className={styles.stats}>
                <Card>
                  <span className={styles.statLabel}>운동 시간</span>
                  <span className={styles.statValue}>{formatSeconds(result.duration_seconds)}</span>
                </Card>
                <Card>
                  <span className={styles.statLabel}>올바른 자세 시간</span>
                  <span className={styles.statValue}>{formatSeconds(result.correct_seconds)}</span>
                </Card>
                {result.score != null && (
                  <Card>
                    <span className={styles.statLabel}>정확도 점수</span>
                    <span className={styles.statValue}>{Math.round(result.score)}점</span>
                  </Card>
                )}
              </div>
            </>
          ) : (
            <p className={styles.notice}>
              {result.status === 'cancelled'
                ? '취소한 운동이라 결과가 없어요.'
                : '아직 끝나지 않은 운동이에요.'}
            </p>
          )}
        </>
      )}

      <div className={styles.actions}>
        {result && (
          <Button onClick={() => navigate(`/stretches/${result.stretch_id}/guide`)}>
            다시 하기
          </Button>
        )}
        <Button variant="secondary" onClick={() => navigate('/stretches')}>
          다른 스트레칭
        </Button>
        <Button variant="secondary" onClick={() => navigate('/history')}>
          기록 보기
        </Button>
      </div>
    </main>
  );
}
