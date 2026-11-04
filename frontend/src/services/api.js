import { MOCK_STRETCHES } from './mock/stretches';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// 화면에서 오류 종류를 구분할 수 있도록 상태 코드를 담는 에러
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 = 네트워크 오류(서버 꺼짐, CORS 등)
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.', 0);
  }

  const data = await res.json().catch(() => null); // 본문이 없거나 JSON이 아닐 때 대비

  if (!res.ok) {
    // 에러 응답 형식 { "error": "메시지" } 기준. 백엔드와 다르게 합의하면 여기만 고치면 됨
    throw new ApiError(data?.error ?? `요청에 실패했어요 (${res.status})`, res.status);
  }
  return data;
}

// 목 모드: 실제 네트워크처럼 약간 늦게 응답 (로딩 화면 확인용)
function mock(data, ms = 500) {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), ms));
}

// ---- 엔드포인트 6개 (명세서 7장) ----
export function getStretches() {
  if (USE_MOCK) return mock(MOCK_STRETCHES);
  return request('/api/stretches');
}

export function getStretch(id) {
  if (USE_MOCK) {
    const found = MOCK_STRETCHES.find((s) => s.id === Number(id));
    return found ? mock(found) : Promise.reject(new ApiError('스트레칭을 찾을 수 없어요', 404));
  }
  return request(`/api/stretches/${id}`);
}

export function createSession(stretchId) {
  if (USE_MOCK) return mock({ session_id: Date.now() % 100000 });
  return request('/api/sessions', { method: 'POST', body: { stretch_id: stretchId } });
}

export function completeSession(sessionId) {
  return request(`/api/sessions/${sessionId}/complete`, { method: 'POST' });
}

export function getSession(sessionId) {
  return request(`/api/sessions/${sessionId}`);
}

export function getSessions() {
  return request('/api/sessions');
}
