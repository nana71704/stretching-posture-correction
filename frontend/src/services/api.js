
import { MOCK_STRETCHES } from './mock/stretches';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// API 오류 처리
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// 공통 API 요청 함수
async function request(path, { method = 'GET', body } = {}) {
  let res;

  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body !== undefined
        ? { 'Content-Type': 'application/json' }
        : undefined,
      body: body !== undefined
        ? JSON.stringify(body)
        : undefined,
    });
  } catch {
    throw new ApiError(
      '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.',
      0
    );
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : data?.error ??
          `요청에 실패했어요 (${res.status})`;

    throw new ApiError(message, res.status);
  }

  return data;
}

// Mock 데이터 응답
function mock(data, ms = 500) {
  return new Promise((resolve) =>
    setTimeout(() => resolve(structuredClone(data)), ms)
  );
}

// ==========================================
// 1. 스트레칭 목록 조회
// GET /api/stretches
// ==========================================

export function getStretches() {
  if (USE_MOCK) {
    return mock(MOCK_STRETCHES);
  }

  return request('/api/stretches');
}

// ==========================================
// 2. 스트레칭 상세 조회
// GET /api/stretches/{stretch_id}
// ==========================================

export function getStretch(id) {
  if (USE_MOCK) {
    const found = MOCK_STRETCHES.find(
      (s) => s.id === Number(id)
    );

    return found
      ? mock(found)
      : Promise.reject(
          new ApiError('스트레칭을 찾을 수 없어요.', 404)
        );
  }

  return request(`/api/stretches/${id}`);
}

// ==========================================
// 3. 운동 세션 생성
// POST /api/sessions
// ==========================================

export function createSession(stretchId) {
  if (USE_MOCK) {
    return mock({
      session_id: Date.now() % 100000,
      stretch_id: stretchId,
      status: 'started',
    });
  }

  return request('/api/sessions', {
    method: 'POST',
    body: {
      stretch_id: stretchId,
    },
  });
}

// ==========================================
// 4. 운동 세션 종료 및 결과 저장
// POST /api/sessions/{session_id}/complete
// ==========================================

export function completeSession(
  sessionId,
  durationSeconds,
  correctSeconds
) {
  return request(`/api/sessions/${sessionId}/complete`, {
    method: 'POST',
    body: {
      duration_seconds: durationSeconds,
      correct_seconds: correctSeconds,
    },
  });
}

// ==========================================
// 5. 개별 운동 기록 조회
// GET /api/sessions/{session_id}
// ==========================================

export function getSession(sessionId) {
  return request(`/api/sessions/${sessionId}`);
}

// ==========================================
// 6. 전체 운동 기록 조회
// GET /api/sessions
// ==========================================

export function getSessions() {
  return request('/api/sessions');
}


 // ==========================================
 // 7. 스트레칭 종류별 통계 조회
 // GET /api/stats/stretches
 // ==========================================

export function getStretchStats() {
  return request('/api/stats/stretches');
}
