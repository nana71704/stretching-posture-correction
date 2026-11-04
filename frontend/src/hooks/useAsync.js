import { useCallback, useEffect, useState } from 'react';

// asyncFn: Promise를 돌려주는 함수 (예: getStretches)
// 컴포넌트 밖에 정의된 함수이거나, useCallback으로 감싼 함수를 넘겨야 함
export default function useAsync(asyncFn) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    asyncFn()
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: null, data });
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, error, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [asyncFn, reloadKey]);

  const reload = useCallback(() => {
    setState({ loading: true, error: null, data: null });
    setReloadKey((k) => k + 1);
  }, []);

  return { ...state, reload };
}
