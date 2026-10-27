import { useReducer } from 'react';
import { SessionContext, initialState, sessionReducer } from './session';

export function SessionProvider({ children }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  return <SessionContext.Provider value={{ state, dispatch }}>{children}</SessionContext.Provider>;
}
