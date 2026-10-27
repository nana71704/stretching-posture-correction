import { useContext } from 'react';
import { SessionContext } from '../context/session';

export default function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession은 SessionProvider 안에서만 쓸 수 있어요');
  return ctx;
}
