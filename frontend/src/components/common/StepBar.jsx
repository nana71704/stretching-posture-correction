import styles from './StepBar.module.css';

const STEPS = ['스트레칭 선택', '운동 안내', '자세 잡기', '결과 확인'];

// 상단 진행 단계 표시. current는 1~4 (UI-02=1, UI-03=2, UI-04=3, UI-05=4)
export default function StepBar({ current }) {
  return (
    <ol className={styles.steps} aria-label="진행 단계">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const isCurrent = step === current;
        return (
          <li
            key={label}
            className={isCurrent ? styles.current : undefined}
            aria-current={isCurrent ? 'step' : undefined}
          >
            {step}. {label}
          </li>
        );
      })}
    </ol>
  );
}