import { useNavigate } from 'react-router-dom';
import { Button, Card, ErrorBanner } from '../components/common';
import useAsync from '../hooks/useAsync';
import { getSessions, getStatsSummary } from '../services/api';
import { formatDateTime, formatSeconds } from '../utils/format';
import styles from './HistoryPage.module.css';

// 기록 하나의 상태 → 태그 글자와 색
function resultLabel(s) {
  if (s.status === 'cancelled') return { text: '취소', tone: 'muted' };
  if (s.status === 'started') return { text: '미종료', tone: 'muted' };
  return s.success ? { text: '성공', tone: 'success' } : { text: '미달성', tone: 'fail' };
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { loading, error, data: sessions, reload } = useAsync(getSessions);
  const summary = useAsync(getStatsSummary);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <h1>운동 기록</h1>
        <Button variant="secondary" onClick={() => navigate('/')}>
          처음으로
        </Button>
      </div>

      {/* 요약 통계: 실패해도 목록은 보이도록 데이터가 있을 때만 그림 */}
      {summary.data && (
        <dl className={styles.summary}>
          <div className={styles.summaryItem}>
            <dt>완료한 운동</dt>
            <dd>{summary.data.completed_sessions}회</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>성공률</dt>
            <dd>{Math.round(summary.data.success_rate)}%</dd>
          </div>
          <div className={styles.summaryItem}>
            <dt>평균 점수</dt>
            <dd>{Math.round(summary.data.average_score)}점</dd>
          </div>
        </dl>
      )}

      {loading && (
        <ul className={styles.list} aria-busy="true" aria-label="불러오는 중">
          {[1, 2, 3].map((n) => (
            <li key={n} className={styles.skeleton} />
          ))}
        </ul>
      )}

      {error && <ErrorBanner message={error.message} onRetry={reload} />}

      {!loading && !error && sessions.length === 0 && (
        <div className={styles.empty}>
          <p>아직 운동 기록이 없어요.</p>
          <Button onClick={() => navigate('/stretches')}>첫 운동 시작하기</Button>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <ul className={styles.list}>
          {sessions.map((s) => {
            const label = resultLabel(s);
            return (
              <li key={s.session_id}>
                <Card onClick={() => navigate(`/sessions/${s.session_id}`)}>
                  <span className={styles.row}>
                    <span className={styles.date}>{formatDateTime(s.started_at)}</span>
                    <span className={styles.name}>{s.stretch_name}</span>
                    <span className={styles.duration}>
                      {s.status === 'completed' ? formatSeconds(s.duration_seconds) : '-'}
                    </span>
                    <span className={`${styles.tag} ${styles[label.tone]}`}>{label.text}</span>
                  </span>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
