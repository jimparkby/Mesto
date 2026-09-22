const COLORS = ['#16a34a', '#0ea5e9', '#f97316', '#a855f7', '#ef4444', '#eab308', '#06b6d4', '#3b82f6'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, photoUrl, size = 36 }: { name: string; photoUrl?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (photoUrl) return <img className="avatar" src={photoUrl} alt={name} style={style} referrerPolicy="no-referrer" />;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <span className="avatar" style={{ ...style, background: COLORS[hash(name) % COLORS.length] }} aria-label={name}>
      {initials || '?'}
    </span>
  );
}
