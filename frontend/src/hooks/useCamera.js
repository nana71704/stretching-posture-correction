import { useCallback, useEffect, useRef, useState } from 'react';

// 브라우저 오류 이름 → 화면에서 쓸 상태 이름
function toCameraStatus(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied'; // 권한 거부
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'notfound'; // 카메라 없음
    case 'NotReadableError':
    case 'AbortError':
      return 'busy'; // 다른 프로그램이 사용 중
    default:
      return 'error';
  }
}

// status: 'requesting' | 'ready' | 'denied' | 'notfound' | 'busy' | 'error'
export default function useCamera() {
  const streamRef = useRef(null);
  const videoElRef = useRef(null);
  const mountedRef = useRef(false);
  const [status, setStatus] = useState('requesting');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoElRef.current) videoElRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      // 응답이 오기 전에 화면을 떠났으면 바로 끈다
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      stop(); // 이전 스트림이 있으면 정리
      streamRef.current = stream;
      if (videoElRef.current) videoElRef.current.srcObject = stream;
      setStatus('ready');
    } catch (err) {
      if (mountedRef.current) setStatus(toCameraStatus(err));
    }
  }, [stop]);

  // [다시 시도] 버튼용
  const retry = useCallback(() => {
    setStatus('requesting');
    start();
  }, [start]);

  // <video ref={videoRef}>에 붙이는 "콜백 ref"
  // video가 나중에 그려져도(로딩 후 등) 스트림이 자동으로 연결됨
  const videoRef = useCallback((el) => {
    videoElRef.current = el;
    if (el && streamRef.current) el.srcObject = streamRef.current;
  }, []);

  // 화면을 떠나면 카메라 끄기 (노트북 카메라 표시등도 꺼짐)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [stop]);

  return { videoRef, status, start, retry, stop };
}
