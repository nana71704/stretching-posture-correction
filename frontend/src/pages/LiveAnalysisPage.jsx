
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { Button, ErrorBanner, LogoHeader, Modal, StepBar } from '../components/common';
import HoldRing from '../components/live/HoldRing';
import PoseOverlay from '../components/live/PoseOverlay';
import StatusBadge from '../components/live/StatusBadge';
import StretchScene from '../components/stretch/StretchScene';
import { STRETCH_INFO } from '../constants/stretchInfo';

import useCamera from '../hooks/useCamera';
import useFeedbackVoice, { speak } from '../hooks/useFeedbackVoice';
import useRealPose, { LOADING_FEEDBACK } from '../hooks/useRealPose';
import usePythonPose from '../hooks/usePythonPose';
import useSession from '../hooks/useSession';
import useStableValue from '../hooks/useStableValue';
import useWorkoutTimer from '../hooks/useWorkoutTimer';

import { ApiError, cancelSession, completeSession } from '../services/api';

import styles from './LiveAnalysisPage.module.css';

// 12.3초 → "00:12" (경과 시간 표시용)
function toClock(sec) {
  const s = Math.floor(sec);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function LiveAnalysisPage() {
  const { id } = useParams();
  const sessionId = Number(id);
  const navigate = useNavigate();

  const { state, dispatch } = useSession();

  const {
    videoRef,
    videoElementRef,
    status: cameraStatus,
    start: startCamera,
  } = useCamera();

  const [phase, setPhase] = useState('running');
  const [saveError, setSaveError] = useState(null);

  const running = cameraStatus === 'ready' && phase === 'running';

  const stretchId = state.stretch?.id ?? null;

  // ==========================================
  // 영상 인식 방식 선택
  // python  : 호중이의 Python MediaPipe
  // browser : 기존 브라우저 MediaPipe
  // ==========================================

  const usePythonMode = import.meta.env.VITE_POSE_MODE === 'python';

  // 두 Hook은 항상 호출하여 React Hooks 규칙 준수
  // 선택되지 않은 방식은 running=false로 비활성화
  const browserPose = useRealPose(
    videoElementRef,
    running && !usePythonMode,
    stretchId
  );

  const pythonPose = usePythonPose(
    videoElementRef,
    running && usePythonMode,
    stretchId
  );

  const { pose, landmarksRef, fps } = usePythonMode
    ? pythonPose
    : browserPose;

  // ==========================================
  // 자세 판정 화면 표시
  // ==========================================

  // 화면 표시는 0.5초 이상 유지된 상태만 (깜빡임 방지)
  const shown = useStableValue(
    `${pose.status}|${pose.feedback}`,
    500
  );

  const [shownStatus, shownFeedback] = shown.split('|');

  // ==========================================
  // 음성 피드백
  // ==========================================

  const [voiceOn, setVoiceOn] = useState(true);

  useFeedbackVoice(
    shownStatus,
    shownFeedback,
    voiceOn &&
      phase === 'running' &&
      pose.ready &&
      shownFeedback !== LOADING_FEEDBACK,
  );

  // ==========================================
  // 운동 시간 측정
  // ==========================================

  // 모델 로딩이 끝난 뒤부터 시간 측정
  const { elapsed, correct } = useWorkoutTimer(
    running && pose.ready,
    pose.status
  );

  // 목표 시간을 처음 채운 순간 한 번 안내
  const goalSpokenRef = useRef(false);
  const targetSeconds = state.stretch?.target_seconds ?? Infinity;

  useEffect(() => {
    if (goalSpokenRef.current || correct < targetSeconds) return;

    goalSpokenRef.current = true;

    if (voiceOn) {
      speak('목표 시간을 달성했어요! 종료 버튼을 눌러 주세요.');
    }
  }, [correct, targetSeconds, voiceOn]);

  // ==========================================
  // 카메라 실행
  // ==========================================

  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // ==========================================
  // 페이지 이탈 경고
  // ==========================================

  useEffect(() => {
    if (phase !== 'running') return undefined;

    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [phase]);

  // ==========================================
  // 세션 정보 확인
  // ==========================================

  if (!state.stretch || state.sessionId !== sessionId) {
    const back = state.stretch
      ? `/stretches/${state.stretch.id}/guide`
      : '/stretches';

    return <Navigate to={back} replace />;
  }

  const target = state.stretch.target_seconds;
  const goalReached = correct >= target;

  const info = STRETCH_INFO[state.stretch.id] ?? {};

  const guidePath = `/stretches/${state.stretch.id}/guide`;

  // ==========================================
  // 운동 종료 및 결과 저장
  // ==========================================

  const handleFinish = async () => {
    const duration = Math.round(elapsed * 10) / 10;

    if (duration <= 0) return;

    const correctSec = Math.min(
      Math.round(correct * 10) / 10,
      duration
    );

    setPhase('saving');
    setSaveError(null);

    try {
      await completeSession(sessionId, duration, correctSec);

      navigate(`/sessions/${sessionId}`, {
        replace: true,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        navigate(`/sessions/${sessionId}`, {
          replace: true,
        });
        return;
      }

      setSaveError(err);
      setPhase('error');
    }
  };

  // ==========================================
  // 운동 취소
  // ==========================================

  const handleCancel = async () => {
    setPhase('saving');

    try {
      await cancelSession(sessionId);
    } catch (err) {
      console.error('Session cancellation failed:', err);
    }

    dispatch({ type: 'RESET' });

    navigate('/stretches', {
      replace: true,
    });
  };

  // ==========================================
  // 화면 렌더링
  // ==========================================

  return (
    <div className={styles.page}>
      <LogoHeader />

      <main>
        <StepBar current={3} />

        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            {state.stretch.name}
          </h1>

          {running && pose.ready && (
            <span className={styles.live}>
              분석 중
            </span>
          )}
        </div>

        <div className={styles.layout}>
          {/* ===== 왼쪽: 카메라 + 관절선 + 자막 ===== */}

          <section
            className={styles.stage}
            aria-label="실시간 자세 분석"
          >
            <video
              ref={videoRef}
              className={styles.video}
              autoPlay
              muted
              playsInline
            />

            <PoseOverlay
              videoElementRef={videoElementRef}
              landmarksRef={landmarksRef}
              status={shownStatus}
            />

            {cameraStatus === 'ready' && (
              <div className={styles.badge}>
                <StatusBadge status={shownStatus} />
              </div>
            )}

            {cameraStatus === 'requesting' && (
              <p className={styles.stageMessage}>
                카메라를 켜는 중이에요...
              </p>
            )}

            {['notfound', 'busy', 'error'].includes(cameraStatus) && (
              <p className={styles.stageMessage}>
                카메라를 사용할 수 없어요. [취소]를 누르고
                운동 안내 화면에서 다시 시도해 주세요.
              </p>
            )}

            {/* 자세 판정 자막 */}
            {cameraStatus === 'ready' && (
              <p
                className={`${styles.caption} ${
                  styles[shownStatus] ?? ''
                }`}
                aria-live="polite"
              >
                {shownFeedback}
              </p>
            )}
          </section>

          {/* ===== 오른쪽: 유지 시간 · 기준 자세 · 정보 · 버튼 ===== */}

          <aside className={styles.panel}>
            {/* 올바른 자세 유지 시간 */}
            <section className={styles.card}>
              <HoldRing
                value={correct}
                target={target}
              />

              <p
                className={`${styles.ringLabel} ${
                  goalReached ? styles.goal : ''
                }`}
              >
                {goalReached
                  ? '🎉 목표 달성! [종료]를 눌러 주세요'
                  : '올바른 자세 유지 시간'}
              </p>
            </section>

            {/* 기준 자세 */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                기준 자세
              </h2>

              <div className={styles.reference}>
                <StretchScene pose={info.pose} />
              </div>
            </section>

            {/* 운동 정보 */}
            <section
              className={`${styles.card} ${styles.infoCard}`}
            >
              <div>
                <p className={styles.infoLabel}>
                  경과 시간
                </p>

                <p className={styles.infoValue}>
                  {toClock(elapsed)}
                </p>
              </div>

              <div>
                <p className={styles.infoLabel}>
                  음성 안내
                </p>

                <button
                  type="button"
                  className={styles.voiceBtn}
                  onClick={() => setVoiceOn((on) => !on)}
                  aria-pressed={voiceOn}
                >
                  {voiceOn ? '🔊 켜짐' : '🔇 꺼짐'}
                </button>
              </div>

              {/* 측정 각도 */}
              {pose.angle !== null && (
                <p className={styles.extra}>
                  측정 각도 {pose.angle.toFixed(1)}°
                </p>
              )}

              {/* 개발 모드 정보 */}
              {import.meta.env.DEV && (
                <p className={styles.extra}>
                  [개발] {usePythonMode ? 'Python' : 'Browser'}
                  {' · '}FPS {fps}
                  {' · '}판정 지연 {pose.latencyMs ?? '-'}ms
                </p>
              )}
            </section>

            {/* 자세 분석 오류 */}
            {pose.error && (
              <ErrorBanner
                message="자세 분석 서버에 연결할 수 없어요. 백엔드가 켜져 있는지 확인해 주세요."
              />
            )}

            {/* 결과 저장 오류 */}
            {saveError && (
              <ErrorBanner
                message={`결과 저장에 실패했어요: ${saveError.message}`}
                onRetry={handleFinish}
                retryLabel="다시 저장"
              />
            )}

            {/* 운동 버튼 */}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleCancel}
                disabled={phase === 'saving'}
              >
                취소
              </button>

              <button
                type="button"
                className={styles.finishBtn}
                onClick={handleFinish}
                disabled={
                  phase !== 'running' || elapsed <= 0
                }
              >
                {phase === 'saving' ? '저장 중...' : '종료'}
              </button>
            </div>
          </aside>
        </div>
      </main>

      {/* 카메라 권한 안내 */}
      <Modal
        open={cameraStatus === 'denied'}
        title="카메라 권한이 필요해요"
        onClose={() =>
          navigate(guidePath, { replace: true })
        }
        actions={
          <Button
            onClick={() =>
              navigate(guidePath, { replace: true })
            }
          >
            운동 안내로 돌아가기
          </Button>
        }
      >
        <p>
          카메라 권한이 꺼져 있어 분석을 진행할 수 없어요.
        </p>
      </Modal>
    </div>
  );
}
