
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

// status:
// 'requesting' | 'ready' | 'denied'
// 'notfound' | 'busy' | 'error'
export default function useCamera() {
  const streamRef = useRef(null);
  const videoElRef = useRef(null);
  const mountedRef = useRef(false);

  const [status, setStatus] = useState('requesting');

  // 카메라 스트림 종료
  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;

    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
    }
  }, []);

  // 카메라 실행
  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      // 카메라 응답 전에 화면을 떠났다면 즉시 종료
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        return;
      }

      // 기존 카메라 스트림 정리
      stop();

      streamRef.current = stream;

      // video 요소에 카메라 영상 연결
      if (videoElRef.current) {
        videoElRef.current.srcObject = stream;
      }

      setStatus('ready');
    } catch (err) {
      if (mountedRef.current) {
        setStatus(toCameraStatus(err));
      }
    }
  }, [stop]);

  // 카메라 다시 시도
  const retry = useCallback(() => {
    setStatus('requesting');
    start();
  }, [start]);

  // React <video> 요소 연결용 콜백 ref
  const videoRef = useCallback((el) => {
    videoElRef.current = el;

    // video 요소가 나중에 생성되어도
    // 기존 카메라 스트림을 자동 연결
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
    }
  }, []);

  // 컴포넌트가 사라지면 카메라 종료
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [stop]);

  return {
    // 기존 React 카메라 연결
    videoRef,

    // 신규: MediaPipe가 영상 요소에 접근할 때 사용
    videoElementRef: videoElRef,

    // 기존 카메라 상태 및 제어 함수
    status,
    start,
    retry,
    stop,
  };
}


