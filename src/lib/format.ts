export function compact(n: number): string {
  if (n === null || n === undefined || isNaN(n)) return "0";
  const abs = Math.abs(n);
  if (abs < 1000) return `${n}`;
  if (abs < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

export function timeAgo(epochSeconds: number): string {
  if (!epochSeconds) return "";
  const seconds = Math.floor(Date.now() / 1000 - epochSeconds);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
