import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorBanner, Loader, LogoHeader, StepBar } from '../components/common';
import useAsync from '../hooks/useAsync';
import { getSession } from '../services/api';
import { formatDateTime } from '../utils/format';
import styles from './ResultPage.module.css';

// 스트레칭별 한 줄 조언 (id는 stretchInfo.js와 같아요: 1 목/어깨, 2 팔/어깨, 3 스쿼트)
const TIPS = {
  1: '어깨가 따라 올라가지 않게 내리면 점수가 더 올라가요.',
  2: '팔꿈치를 끝까지 펴면 점수가 더 올라가요.',
  3: '허리를 곧게 펴고 무릎이 발끝을 넘지 않게 해 보세요.',
};

// "오늘 오전 2:31" (오늘이 아니면 "11월 12일 오후 04:45")
function formatWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  if (!isToday) return formatDateTime(iso);
  return `오늘 ${date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}`;
}

// 초를 [숫자, 단위]로 나눠요. 숫자는 크게, 단위는 작게 보여 주려고요.
// (5, 1) → ['5.0', '초'],  (18, 0) → ['18', '초'],  (75, 0) → ['1분 15', '초']
function splitSeconds(sec, digits) {
  if (sec == null) return ['-', ''];
  if (sec >= 60) return [`${Math.floor(sec / 60)}분 ${Math.floor(sec % 60)}`, '초'];
  return [sec.toFixed(digits), '초'];
}

// 결과 카드 한 칸
function Stat({ label, value, unit, tone }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${tone ? styles[tone] : ''}`}>
        {value}
        {unit && <small className={styles.unit}>{unit}</small>}
      </span>
    </div>
  );
}

export default function ResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // id가 바뀔 때만 새 함수 (2주차 3일차 useAsync 주의사항)
  const fetchSession = useCallback(() => getSession(id), [id]);
  const { loading, error, data: result, reload } = useAsync(fetchSession);

  const done = result?.status === 'completed';
  // 올바른 자세 비율 = 올바른 자세 시간 ÷ 운동 시간 (0~100%)
  const ratio =
    done && result.duration_seconds > 0
      ? Math.min(100, Math.round((result.correct_seconds / result.duration_seconds) * 100))
      : 0;
  const [correctNum, correctUnit] = splitSeconds(result?.correct_seconds, 1);
  const [durationNum, durationUnit] = splitSeconds(result?.duration_seconds, 0);

  return (
    <div className={styles.page}>
      <LogoHeader />

      <main>
        <StepBar current={4} />

        <div className={styles.content}>
          {loading && <Loader />}
          {error && (
            <ErrorBanner
              message={error.message}
              onRetry={error.status === 404 ? undefined : reload}
            />
          )}

          {result && (
            <>
              {/* ===== 갈색 결과 카드 ===== */}
              <section className={styles.hero}>
                <div
                  className={`${styles.icon} ${done && result.success ? styles.iconOk : styles.iconRetry}`}
                  aria-hidden="true"
                >
                  {done && result.success ? '✔' : '!'}
                </div>
                <h1 className={styles.title}>
                  {result.status === 'cancelled'
                    ? '취소한 운동이에요'
                    : !done
                      ? '아직 끝나지 않은 운동이에요'
                      : result.success
                        ? '목표를 달성했어요!'
                        : '조금만 더 버텨 봐요!'}
                </h1>
                <p className={styles.meta}>
                  {result.stretch_name} · {formatWhen(result.started_at)}
                </p>
              </section>

              {done ? (
                <>
                  {/* ===== 숫자 카드 4개 ===== */}
                  <div className={styles.stats}>
                    <Stat
                      label="결과"
                      value={result.success ? '성공' : '아쉬워요'}
                      tone={result.success ? 'ok' : 'retry'}
                    />
                    <Stat
                      label="정확도 점수"
                      value={result.score != null ? Math.round(result.score) : '-'}
                      unit={result.score != null ? '점' : ''}
                    />
                    <Stat label="올바른 자세 시간" value={correctNum} unit={correctUnit} />
                    <Stat label="운동 시간" value={durationNum} unit={durationUnit} />
                  </div>

                  {/* ===== 올바른 자세 비율 막대 ===== */}
                  <section className={styles.ratioCard}>
                    <div className={styles.ratioHead}>
                      <h2 className={styles.ratioTitle}>올바른 자세 비율</h2>
                      <span className={styles.ratioValue}>{ratio}%</span>
                    </div>
                    <div
                      className={styles.track}
                      role="progressbar"
                      aria-valuenow={ratio}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="올바른 자세 비율"
                    >
                      <div className={styles.fill} style={{ width: `${ratio}%` }} />
                    </div>
                    {TIPS[result.stretch_id] && (
                      <p className={styles.tip}>💡 {TIPS[result.stretch_id]}</p>
                    )}
                  </section>
                </>
              ) : (
                <p className={styles.notice}>
                  결과는 운동을 끝까지 마친 뒤에 볼 수 있어요. [한 번 더 하기]로 다시 해 보세요.
                </p>
              )}
            </>
          )}

          {/* ===== 아래 버튼 3개 ===== */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.outlineBtn}
              onClick={() => navigate('/history')}
            >
              운동 기록 보기
            </button>
            <button
              type="button"
              className={styles.outlineBtn}
              onClick={() => navigate('/stretches')}
            >
              다른 스트레칭
            </button>
            {result && (
              <button
                type="button"
                className={styles.againBtn}
                onClick={() => navigate(`/stretches/${result.stretch_id}/guide`)}
              >
                한 번 더 하기 →
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}