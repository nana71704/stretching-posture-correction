import { useNavigate } from 'react-router-dom';
import { ErrorBanner, LogoHeader } from '../components/common';
import useAsync from '../hooks/useAsync';
import { getSessions, getStatsSummary, getStretchStats } from '../services/api';
import styles from './HistoryPage.module.css';

// 기록 하나의 상태 → 태그 글자와 색
function resultLabel(s) {
  if (s.status === 'cancelled') return { text: '취소', tone: 'muted' };
  if (s.status === 'started') return { text: '미종료', tone: 'muted' };
  return s.success ? { text: '성공', tone: 'success' } : { text: '미달성', tone: 'fail' };
}

// "팔/어깨 상체 굴곡 스트레칭" → "팔/어깨 상체 굴곡" (표가 좁아서 뒤의 "스트레칭"은 뺌)
function shortName(name) {
  return name.replace(/\s*스트레칭$/, '');
}

// 서버 시간(UTC) → "11월 13일 02:31" (한국 시간, 24시간제)
function formatShortDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`;
}

// 총 운동 시간: 60초 미만은 "54초", 넘으면 "3분"처럼 [숫자, 단위]로 나눔
function splitTotal(sec) {
  if (sec < 60) return [Math.round(sec), '초'];
  return [Math.floor(sec / 60), '분'];
}

// 위쪽 숫자 카드 한 칸 (숫자는 크게, 단위는 작게)
function Stat({ label, value, unit }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd>
        <strong>{value}</strong>
        <small>{unit}</small>
      </dd>
    </div>
  );
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { loading, error, data: sessions, reload } = useAsync(getSessions);
  const summary = useAsync(getStatsSummary);
  const stretchStats = useAsync(getStretchStats);

  // 끝까지 한 운동들의 시간을 더함
  const totalSeconds = (sessions ?? [])
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
  const [totalValue, totalUnit] = splitTotal(totalSeconds);

  // 한 번이라도 끝낸 스트레칭만 막대로 보여 줌
  const bars = (stretchStats.data ?? []).filter((st) => st.completed_sessions > 0);

  return (
    <main className={styles.page}>
      <LogoHeader />

      <h1 className={styles.title}>운동 기록</h1>
      <p className={styles.lead}>지금까지 한 스트레칭 결과를 모아 봤어요</p>

      {/* 요약 숫자 카드 4개: 실패해도 목록은 보이도록 데이터가 있을 때만 그림 */}
      {summary.data && (
        <dl className={styles.stats}>
          <Stat label="완료한 운동" value={summary.data.completed_sessions} unit="회" />
          <Stat label="성공률" value={Math.round(summary.data.success_rate)} unit="%" />
          <Stat label="평균 점수" value={Math.round(summary.data.average_score)} unit="점" />
          <Stat label="총 운동 시간" value={totalValue} unit={totalUnit} />
        </dl>
      )}

      {loading && <div className={styles.skeleton} aria-busy="true" aria-label="불러오는 중" />}

      {error && <ErrorBanner message={error.message} onRetry={reload} />}

      {!loading && !error && sessions.length === 0 && (
        <div className={styles.empty}>
          <p>아직 운동 기록이 없어요.</p>
          <button type="button" className={styles.startBtn} onClick={() => navigate('/stretches')}>
            첫 운동 시작하기 →
          </button>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className={styles.layout}>
          {/* 왼쪽: 기록 표 (줄을 누르면 그 운동의 결과 화면으로) */}
          <section className={styles.card}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>스트레칭</th>
                    <th>날짜</th>
                    <th>점수</th>
                    <th>올바른 자세 시간</th>
                    <th>결과</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const label = resultLabel(s);
                    const done = s.status === 'completed';
                    const open = () => navigate(`/sessions/${s.session_id}`);
                    return (
                      <tr
                        key={s.session_id}
                        className={styles.row}
                        tabIndex={0}
                        onClick={open}
                        onKeyDown={(e) => e.key === 'Enter' && open()}
                      >
                        <td className={styles.name}>{shortName(s.stretch_name)}</td>
                        <td>{formatShortDate(s.started_at)}</td>
                        <td>{done ? `${Math.round(s.score)}점` : '—'}</td>
                        <td>{done ? `${s.correct_seconds.toFixed(1)}초` : '—'}</td>
                        <td>
                          <span className={`${styles.tag} ${styles[label.tone]}`}>
                            {label.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 오른쪽: 스트레칭별 평균 점수 막대 + 새 운동 버튼 */}
          <aside className={`${styles.card} ${styles.side}`}>
            <h2 className={styles.sideTitle}>스트레칭별 평균 점수</h2>
            {bars.length === 0 && <p className={styles.sideEmpty}>끝까지 한 운동이 아직 없어요.</p>}
            <ul className={styles.bars}>
              {bars.map((st) => {
                const avg = Math.round(st.average_score);
                return (
                  <li key={st.stretch_id} className={styles.barRow}>
                    <span className={styles.barName}>{shortName(st.stretch_name)}</span>
                    <span className={styles.track}>
                      <span
                        className={`${styles.fill} ${avg >= 60 ? styles.good : styles.low}`}
                        style={{ width: `${avg}%` }}
                      />
                    </span>
                    <span className={styles.barValue}>{avg}</span>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className={styles.startBtn}
              onClick={() => navigate('/stretches')}
            >
              새 운동 시작하기 →
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}