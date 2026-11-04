import { createContext } from 'react';

export const initialState = {
  stretch: null, // { id, name, target_seconds } (UI-02에서 선택)
  sessionId: null, // UI-03에서 POST /api/sessions 응답으로 저장 (3주차)
};

export function sessionReducer(state, action) {
  switch (action.type) {
    case 'SELECT_STRETCH':
      // 다른 스트레칭을 고르면 이전 세션 번호는 의미가 없으므로 비운다
      return { stretch: action.stretch, sessionId: null };
    case 'START_SESSION':
      return { ...state, sessionId: action.sessionId };
    case 'RESET':
      return initialState;
    default:
      throw new Error(`알 수 없는 action: ${action.type}`);
  }
}

export const SessionContext = createContext(null);
