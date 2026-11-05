import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, ErrorBanner, Loader, Modal } from '../components/common';
import useAsync from '../hooks/useAsync';
import useCamera from '../hooks/useCamera';
import useSession from '../hooks/useSession';
import { createSession, getStretch } from '../services/api';
import styles from './GuidePage.module.css';

const CAMERA_MESSAGE = {
  requesting: '카메라를 켜는 중이에요. 권한 요청 창이 뜨면 [허용]을 눌러 주세요.',
  notfound: '카메라를 찾을 수 없어요. 웹캠이 연결되어 있는지 확인해 주세요.',
  busy: '다른 프로그램이 카메라를 쓰고 있어요. 줌·팀즈·OBS 등을 끄고 다시 시도해 주세요.',
  error: '카메라를 켜지 못했어요. 다시 시도해 주세요.',
};

const TIPS = [
  '머리부터 발목까지 전신이 화면에 들어오도록 2m 정도 떨어져 주세요.',
  '창문을 등지지 말고, 얼굴 쪽에 빛이 오도록 서 주세요.',
  '몸에 붙는 옷이 관절 인식에 좋아요.',
];

export default function GuidePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useSession();

  // id가 바뀔 때만 새 함수 (2주차 3일차 useAsync 주의사항)
  const fetchStretch = useCallback(() => getStretch(id), [id]);
  const { loading, error, data: stretch, reload } = useAsync(fetchStretch);

  const { videoRef, status: cameraStatus, start: startCamera, retry: retryCamera } = useCamera();
  const [deniedClosed, setDeniedClosed] = useState(false); // 권한 거부 Modal을 사용자가 닫았는지

  const [starting, setStarting] = useState(false); // 세션 생성 요청 중
  const [startError, setStartError] = useState(null); // 세션 생성 실패
  const [countdown, setCountdown] = useState(null); // null = 카운트다운 전

  // 화면에 들어오면 카메라 권한 요청
  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // 3 → 2 → 1 → 0이 되면 UI-04로
  useEffect(() => {
    if (countdown === null) return undefined;
    if (countdown === 0) {
      navigate(`/sessions/${state.sessionId}/live`);
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, navigate, state.sessionId]);

  const handleStart = async () => {
    setStarting(true);
    setStartError(null);
    try {
      // 새로고침으로 Context가 비었거나 다른 스트레칭이면 다시 저장
      if (state.stretch?.id !== stretch.id) {
        dispatch({
          type: 'SELECT_STRETCH',
          stretch: { id: stretch.id, name: stretch.name, target_seconds: stretch.target_seconds },
        });
      }
      const res = await createSession(stretch.id);
      dispatch({ type: 'START_SESSION', sessionId: res.session_id });
      setCountdown(3);
    } catch (err) {
      setStartError(err); // 실패하면 화면 상태는 그대로 두고 오류만 표시
    } finally {
      setStarting(false);
    }
  };

  const handleRetryCamera = () => {
    setDeniedClosed(false);
    retryCamera();
  };

  const canStart = !!stretch && cameraStatus === 'ready' && !starting && countdown === null;

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        {/* 왼쪽: 스트레칭 안내 */}
        <section className={styles.info}>
          {loading && <Loader />}
          {error && (
            <ErrorBanner
              message={error.message}
              onRetry={error.status === 404 ? undefined : reload}
            />
          )}
          {stretch && (
            <>
              <h1 className={styles.title}>{stretch.name}</h1>
              <p className={styles.desc}>{stretch.description}</p>
              <p className={styles.target}>목표: 올바른 자세 {stretch.target_seconds}초 유지</p>
              {/* 기준 자세 이미지: API에 이미지 필드가 없어서 자리만 둠 */}
              <div className={styles.imagePlaceholder}>기준 자세 이미지 (준비 중)</div>
            </>
          )}

          <h2 className={styles.subtitle}>카메라 위치 안내</h2>
          <ul className={styles.tips}>
            {TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          <p className={styles.privacy}>🔒 카메라 영상은 자세 분석에만 사용하고 저장하지 않아요.</p>
        </section>

        {/* 오른쪽: 카메라 미리보기 */}
        <section>
          <div className={styles.preview}>
            <video ref={videoRef} className={styles.video} autoPlay muted playsInline />
            {cameraStatus !== 'ready' && cameraStatus !== 'denied' && (
              <p className={styles.cameraMessage}>{CAMERA_MESSAGE[cameraStatus]}</p>
            )}
            {countdown !== null && countdown > 0 && (
              <div className={styles.countdown} aria-live="assertive">
                {countdown}
              </div>
            )}
          </div>

          {['notfound', 'busy', 'error'].includes(cameraStatus) && (
            <ErrorBanner
              message="카메라를 확인한 뒤 다시 시도해 주세요."
              onRetry={handleRetryCamera}
            />
          )}
          {startError && (
            <ErrorBanner
              message={`운동을 시작하지 못했어요: ${startError.message}`}
              onRetry={handleStart}
            />
          )}

          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => navigate('/stretches')}>
              다른 스트레칭
            </Button>
            <Button onClick={handleStart} disabled={!canStart}>
              {starting ? '시작하는 중...' : '준비 완료'}
            </Button>
          </div>
        </section>
      </div>

      <Modal
        open={cameraStatus === 'denied' && !deniedClosed}
        title="카메라 권한이 필요해요"
        onClose={() => setDeniedClosed(true)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeniedClosed(true)}>
              닫기
            </Button>
            <Button onClick={handleRetryCamera}>다시 시도</Button>
          </>
        }
      >
        <p>자세를 분석하려면 카메라가 필요해요.</p>
        <ol>
          <li>주소창 왼쪽의 아이콘을 누르세요.</li>
          <li>카메라를 [허용]으로 바꾸세요.</li>
          <li>[다시 시도]를 누르거나 페이지를 새로고침하세요.</li>
        </ol>
      </Modal>
    </main>
  );
}
