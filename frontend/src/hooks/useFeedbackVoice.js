import { useEffect, useRef } from 'react';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
const REPEAT_MS = 5000; // 교정 필요 상태가 계속되면 5초마다 다시 말함

// 문장 하나를 한국어로 읽기 (이전에 읽던 문장은 끊음)
export function speak(text) {
  if (!synth || !text) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  utterance.rate = 1.05;
  const korean = synth.getVoices().find((voice) => voice.lang.startsWith('ko'));
  if (korean) utterance.voice = korean;
  synth.speak(utterance);
}

// 자막(feedback)이 바뀔 때마다 음성으로 읽어 줌
// enabled가 false면 (음소거, 모델 로딩 중) 읽지 않음
export default function useFeedbackVoice(status, feedback, enabled) {
  const lastSpokenRef = useRef('');

  useEffect(() => {
    if (!enabled || !feedback) return undefined;

    if (lastSpokenRef.current !== feedback) {
      speak(feedback);
      lastSpokenRef.current = feedback;
    }

    if (status !== 'incorrect') return undefined;
    const timer = setInterval(() => speak(feedback), REPEAT_MS);
    return () => clearInterval(timer);
  }, [status, feedback, enabled]);

  // 음소거하면 읽던 문장도 바로 멈추고, 다시 켜면 지금 문장부터 읽음
  useEffect(() => {
    if (enabled) return;
    synth?.cancel();
    lastSpokenRef.current = '';
  }, [enabled]);

  // 화면을 떠나면 멈춤
  useEffect(() => () => synth?.cancel(), []);
}