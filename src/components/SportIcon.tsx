import { sportMeta } from '../domain/sports';
import type { SportId } from '../domain/types';
import { SPORT_PATHS } from './sportPaths';

interface Props {
  sport: SportId;
  size?: number;
  color?: string;
  className?: string;
}

/** Пиктограмма вида спорта: своя (Material Symbols) для основных, глиф Phosphor — для остальных из каталога. */
export function SportIcon({ sport, size = 20, color = 'currentColor', className }: Props) {
  const path = SPORT_PATHS[sport];
  const Glyph = path ? null : sportMeta(sport).glyph;
  if (Glyph) return <Glyph size={size} color={color} weight="fill" className={className} aria-hidden />;
  return (
    <svg width={size} height={size} viewBox="0 -960 960 960" fill={color} className={className} aria-hidden>
      <path d={path ?? SPORT_PATHS.other} />
    </svg>
  );
}
