import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HeroScene from '../components/main/HeroScene';
import styles from './MainPage.module.css';

// 실제 영상을 public/media/hero.mp4 에 넣으면 그림 대신 영상이 나옵니다
const HERO_VIDEO = '/media/hero.mp4';

const HIGHLIGHTS = [
  { title: '설치 없이', desc: '브라우저에서 바로 시작' },
  { title: '웹캠 하나', desc: '별도 장비가 필요 없어요' },
  { title: '5초', desc: '목표 자세 유지 시간' },
  { title: '실시간', desc: '색 · 자막 · 음성 피드백' },
];

const FEATURES = [
  {
    icon: '🦴',
    title: '실시간 관절 인식',
    desc: '브라우저에서 바로 관절 위치를 찾아 화면에 점과 선으로 보여 줘요.',
  },
  {
    icon: '🔊',
    title: '색 · 자막 · 음성 피드백',
    desc: '맞으면 초록, 틀리면 주황색으로 표시하고 소리로도 알려 줘요.',
  },
  {
    icon: '📊',
    title: '기록과 점수',
    desc: '올바른 자세 유지 시간을 점수로 남겨서 꾸준히 확인할 수 있어요.',
  },
];

export default function MainPage() {
  const navigate = useNavigate();
  const [videoOk, setVideoOk] = useState(true);

  return (
    <div className={styles.page}>
      {/* 상단 메뉴 */}
      <header className={styles.nav}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true" />
          바른 자세 스트레칭
        </Link>
        <nav className={styles.menu} aria-label="주 메뉴">
          <Link to="/" className={styles.active} aria-current="page">홈</Link>
          <Link to="/stretches">스트레칭</Link>
          <Link to="/history">운동 기록</Link>
        </nav>
        <button type="button" className={styles.navButton} onClick={() => navigate('/stretches')}>
          시작하기
        </button>
      </header>

      <main>
        {/* 히어로 */}
        <section className={styles.hero}>
          <HeroScene />
          {videoOk && (
            <video
              className={styles.heroVideo}
              src={HERO_VIDEO}
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
              onError={() => setVideoOk(false)}
            />
          )}
          <div className={styles.shade} />

          <span className={styles.live}>LIVE 자세 분석 예시</span>
          <span className={`${styles.feedback} ${styles.feedbackNg}`} aria-hidden="true">
            팔을 머리 위로 쭉 뻗어 주세요
          </span>
          <span className={`${styles.feedback} ${styles.feedbackOk}`} aria-hidden="true">
            자세가 아주 좋습니다! 유지하세요
          </span>

          <div className={styles.heroText}>
            <p className={styles.eyebrow}>AI REAL-TIME POSE COACH</p>
            <h1 className={styles.title}>하루 5분, 몸을 깨우는 스트레칭</h1>
            <p className={styles.lead}>
              카메라 앞에 서기만 하면 AI가 관절을 읽고
              <br />
              자세가 맞는지 색과 자막, 음성으로 알려 드려요.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => navigate('/stretches')}>
                스트레칭 시작하기 →
              </button>
              <button type="button" className={styles.ghost} onClick={() => navigate('/history')}>
                운동 기록
              </button>
            </div>
          </div>
        </section>

        {/* 장점 4개 */}
        <ul className={styles.highlights}>
          {HIGHLIGHTS.map((h) => (
            <li key={h.title}>
              <strong>{h.title}</strong>
              <span>{h.desc}</span>
            </li>
          ))}
        </ul>

        {/* 이렇게 도와드려요 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>이렇게 도와드려요</h2>
          <p className={styles.sectionDesc}>혼자 해도 코치가 옆에 있는 것처럼</p>
          <div className={styles.features}>
            {FEATURES.map((f) => (
              <article key={f.title} className={styles.feature}>
                <span className={styles.featureIcon} aria-hidden="true">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}