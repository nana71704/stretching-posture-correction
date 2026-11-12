import { useEffect, useState } from 'react';

// value가 holdMs 동안 그대로일 때만 바뀐 값을 돌려줌 (문구 깜빡임 방지)
// 그 사이에 원래 값으로 돌아오면 아무 일도 없었던 것처럼 유지
export default function useStableValue(value, holdMs = 500) {
  const [stable, setStable] = useState(value);

  useEffect(() => {
    if (value === stable) return undefined;
    const timer = setTimeout(() => setStable(value), holdMs);
    return () => clearTimeout(timer);
  }, [value, stable, holdMs]);

  return stable;
}