import { useEffect, useState } from 'react';
import { POSE_STATUS, STATUS_MESSAGE } from '../constants/status';

// 4주차에 실제 판정 훅으로 바꿀 때까지 쓰는 가짜 결과
// 모양은 명세서 7장 실시간 메시지의 { status, feedback }과 같게 맞춤
const SAMPLES = [
  { status: POSE_STATUS.CORRECT, feedback: STATUS_MESSAGE.correct },
  { status: POSE_STATUS.CORRECT, feedback: STATUS_MESSAGE.correct },
  { status: POSE_STATUS.INCORRECT, feedback: '팔을 조금 더 위로 뻗어 주세요.' },
  { status: POSE_STATUS.NOT_DETECTED, feedback: STATUS_MESSAGE.not_detected },
];

// enabled가 true인 동안 intervalMs마다 결과를 무작위로 바꿈
export default function useMockPose(enabled, intervalMs = 2000) {
  const [result, setResult] = useState(SAMPLES[0]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(() => {
      setResult(SAMPLES[Math.floor(Math.random() * SAMPLES.length)]);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);

  return result; // { status, feedback }
}
