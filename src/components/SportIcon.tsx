import {
  Barbell,
  Basketball,
  Hockey,
  PersonSimpleBike,
  PersonSimpleRun,
  PersonSimpleSwim,
  PersonSimpleTaiChi,
  SoccerBall,
  Target,
  TennisBall,
  Volleyball,
  type Icon as PhosphorIcon,
  type IconWeight,
} from '@phosphor-icons/react';
import type { SportId } from '../domain/types';

export const SPORT_ICONS: Record<SportId, PhosphorIcon> = {
  football: SoccerBall,
  running: PersonSimpleRun,
  basketball: Basketball,
  volleyball: Volleyball,
  tennis: TennisBall,
  yoga: PersonSimpleTaiChi,
  cycling: PersonSimpleBike,
  workout: Barbell,
  swimming: PersonSimpleSwim,
  hockey: Hockey,
  other: Target,
};

interface Props {
  sport: SportId;
  size?: number;
  weight?: IconWeight;
  color?: string;
  className?: string;
}

export function SportIcon({ sport, size = 20, weight = 'fill', color, className }: Props) {
  const Glyph = SPORT_ICONS[sport] ?? Target;
  return <Glyph size={size} weight={weight} color={color} className={className} aria-hidden />;
}
