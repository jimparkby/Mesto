import type { SportId } from '../domain/types';
import { SPORT_PATHS } from './sportPaths';

interface Props {
  sport: SportId;
  size?: number;
  color?: string;
  className?: string;
}

export function SportIcon({ sport, size = 20, color = 'currentColor', className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill={color}
      className={className}
      aria-hidden
    >
      <path d={SPORT_PATHS[sport] ?? SPORT_PATHS.other} />
    </svg>
  );
}
