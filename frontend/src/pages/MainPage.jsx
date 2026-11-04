import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common';
import styles from './MainPage.module.css';

const STEPS = [
  { no: 1, title: '스트레칭 선택', desc: '하고 싶은 스트레칭을 골라요' },
  { no: 2, title: '자세 잡기', desc: '카메라 앞에서 실시간 피드백을 받아요' },
  { no: 3, title: '결과 확인', desc: '올바른 자세 유지 시간을 확인해요' },
];

export default function MainPage() {
  const navigate = useNavigate();
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>바른 자세 스트레칭</h1>
      <p className={styles.intro}></p>

      <ol className={styles.steps}>
        {STEPS.map((s) => (
          <li key={s.no} className={styles.step}>
            <span className={styles.no}>{s.no}</span>
            <strong>{s.title}</strong>
            <span>{s.desc}</span>
          </li>
        ))}
      </ol>

      <div className={styles.actions}>
        <Button onClick={() => navigate('/stretches')}>시작하기</Button>
        <Button variant="secondary" onClick={() => navigate('/history')}>
          운동 기록
        </Button>
      </div>
    </main>
  );
}
