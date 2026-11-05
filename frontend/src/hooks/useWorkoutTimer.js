import { useEffect, useRef, useState } from 'react';

// running 동안 0.1초마다 전체 시간과 "올바른 자세" 시간을 누적 (단위: 초, 소수)
export default function useWorkoutTimer(running, status) {
  const [time, setTime] = useState({ elapsed: 0, correct: 0 });
  const statusRef = useRef(status);

  // 타이머를 다시 만들지 않고 최신 상태만 읽기 위해 ref에 보관
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!running) return undefined;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000; // 지난번 이후 실제로 흐른 초
      last = now;
      setTime((prev) => ({
        elapsed: prev.elapsed + dt,
        correct: statusRef.current === 'correct' ? prev.correct + dt : prev.correct,
      }));
    }, 100);
    return () => clearInterval(timer);
  }, [running]);

  return time; // { elapsed, correct }
}
