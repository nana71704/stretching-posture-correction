import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button, ErrorBanner, Modal } from '../components/common';
import StatusBadge from '../components/live/StatusBadge';
import useCamera from '../hooks/useCamera';
import useMockPose from '../hooks/useMockPose';
import useSession from '../hooks/useSession';
import useWorkoutTimer from '../hooks/useWorkoutTimer';
import { ApiError, cancelSession, completeSession } from '../services/api';
import styles from './LiveAnalysisPage.module.css';

export default function LiveAnalysisPage() {
  const { id } = useParams();
  const sessionId = Number(id);
  const navigate = useNavigate();
  const { state, dispatch } = useSession();

  const { videoRef, status: cameraStatus, start: startCamera } = useCamera();
  const [phase, setPhase] = useState('running'); // running | saving | error
  const [saveError, setSaveError] = useState(null);

  const running = cameraStatus === 'ready' && phase === 'running';
  const pose = useMockPose(running); // 4주차: 실제 판정 훅으로 교체
  const { elapsed, correct } = useWorkoutTimer(running, pose.status);

  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // 운동 중 새로고침·탭 닫기 시 브라우저 확인 창
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase]);

  // 진입 가드: UI-03에서 시작한 세션이 아니면 돌려보냄 (명세서 4장)
  if (!state.stretch || state.sessionId !== sessionId) {
    const back = state.stretch ? `/stretches/${state.stretch.id}/guide` : '/stretches';
    return <Navigate to={back} replace />;
  }

  const target = state.stretch.target_seconds;
  const progress = Math.min(correct / target, 1) * 100;
  const guidePath = `/stretches/${state.stretch.id}/guide`;

  const handleFinish = async () => {
    const duration = Math.round(elapsed * 10) / 10;
    if (duration <= 0) return;
    const correctSec = Math.min(Math.round(correct * 10) / 10, duration);

    setPhase('saving');
    setSaveError(null);
    try {
      await completeSession(sessionId, duration, correctSec);
      navigate(`/sessions/${sessionId}`, { replace: true });
    } catch (err) {
      // 409 = 이미 저장된 세션 → 결과 화면으로
      if (err instanceof ApiError && err.status === 409) {
        navigate(`/sessions/${sessionId}`, { replace: true });
        return;
      }
      setSaveError(err);
      setPhase('error');
    }
  };

  const handleCancel = async () => {
    setPhase('saving');
    try {
      await cancelSession(sessionId);
    } catch {
      // 초안: 취소 실패는 무시 (세션이 'started'로 남을 뿐 결과에는 영향 없음)
    }
    dispatch({ type: 'RESET' });
    navigate('/stretches', { replace: true });
  };

  return (
    <main className={styles.page}>
      <section className={styles.stage}>
        <video ref={videoRef} className={styles.video} autoPlay muted playsInline />
        {/* 4주차: 여기에 PoseOverlay(canvas)를 겹쳐 그림 */}
        {cameraStatus === 'requesting' && (
          <p className={styles.stageMessage}>카메라를 켜는 중이에요...</p>
        )}
        {['notfound', 'busy', 'error'].includes(cameraStatus) && (
          <p className={styles.stageMessage}>
            카메라를 사용할 수 없어요. [취소]를 누르고 운동 안내 화면에서 다시 시도해 주세요.
          </p>
        )}
      </section>

      <aside className={styles.panel}>
        <p className={styles.stretchName}>{state.stretch.name}</p>
        <StatusBadge status={pose.status} />
        <p className={styles.feedback} aria-live="polite">
          {pose.feedback}
        </p>

        <div>
          <p className={styles.label}>올바른 자세 시간</p>
          <p className={styles.time}>
            {correct.toFixed(1)}초 <span className={styles.timeTarget}>/ {target}초</span>
          </p>
          <div
            className={styles.bar}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={target}
            aria-valuenow={Math.min(correct, target)}
          >
            <div className={styles.barFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
        <p className={styles.label}>전체 운동 시간 {elapsed.toFixed(1)}초</p>

        {saveError && (
          <ErrorBanner
            message={`결과 저장에 실패했어요: ${saveError.message}`}
            onRetry={handleFinish}
            retryLabel="다시 저장"
          />
        )}

        <div className={styles.actions}>
          <Button
            variant="danger"
            onClick={handleFinish}
            disabled={phase !== 'running' || elapsed <= 0}
          >
            {phase === 'saving' ? '저장 중...' : '종료'}
          </Button>
          <Button variant="secondary" onClick={handleCancel} disabled={phase === 'saving'}>
            취소
          </Button>
        </div>
        <p className={styles.mockNote}>※ 초안: 자세 판정은 목 데이터(2초마다 무작위)예요.</p>
      </aside>

      <Modal
        open={cameraStatus === 'denied'}
        title="카메라 권한이 필요해요"
        onClose={() => navigate(guidePath, { replace: true })}
        actions={
          <Button onClick={() => navigate(guidePath, { replace: true })}>
            운동 안내로 돌아가기
          </Button>
        }
      >
        <p>카메라 권한이 꺼져 있어 분석을 진행할 수 없어요.</p>
      </Modal>
    </main>
  );
}
