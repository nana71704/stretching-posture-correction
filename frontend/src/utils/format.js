// 초 → 읽기 쉬운 글자
// 12.34 → "12.3초", 75 → "1분 15초", null → "-"
export function formatSeconds(sec) {
  if (sec == null) return '-';
  const s = Math.round(sec * 10) / 10;
  if (s < 60) return `${s}초`;
  return `${Math.floor(s / 60)}분 ${Math.floor(s % 60)}초`;
}

// 서버 시간(UTC 문자열) → 한국 시간 글자
// "2026-11-05T12:00:00+00:00" → "11월 5일 오후 09:00"
export function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
