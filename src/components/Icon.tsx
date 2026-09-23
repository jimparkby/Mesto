import {
  CalendarBlank,
  CaretRight,
  ChartBar,
  CheckCircle,
  Clock,
  Crosshair,
  Export,
  MagnifyingGlass,
  MapPin,
  MapTrifold,
  Megaphone,
  NavigationArrow,
  PencilSimple,
  Plus,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  UserCircle,
  UsersThree,
  Wallet,
  X,
  type IconProps,
  type IconWeight,
} from '@phosphor-icons/react';

/**
 * Иконки в стиле Apple: закрашенные глифы Phosphor (MIT) — ближе всего к SF Symbols,
 * которые Apple разрешает только в приложениях для своих платформ.
 */
const ICONS = {
  events: CalendarBlank,
  map: MapTrifold,
  plus: Plus,
  user: UserCircle,
  search: MagnifyingGlass,
  filter: SlidersHorizontal,
  share: Export,
  clock: Clock,
  pin: MapPin,
  near: NavigationArrow,
  wallet: Wallet,
  level: ChartBar,
  users: UsersThree,
  organizer: Megaphone,
  route: NavigationArrow,
  locate: Crosshair,
  chevron: CaretRight,
  shield: ShieldCheck,
  logout: SignOut,
  check: CheckCircle,
  close: X,
  edit: PencilSimple,
} as const;

export type IconName = keyof typeof ICONS;

interface Props extends Omit<IconProps, 'weight'> {
  name: IconName;
  size?: number;
  weight?: IconWeight;
}

export function Icon({ name, size = 24, weight = 'fill', ...rest }: Props) {
  const Glyph = ICONS[name];
  return <Glyph size={size} weight={weight} aria-hidden {...rest} />;
}

/** Системная палитра iOS для плашек-иконок, как в «Настройках». */
export const TILE = {
  gray: '#8e8e93',
  red: '#ff3b30',
  orange: '#ff9500',
  green: '#34c759',
  blue: '#007aff',
  indigo: '#5856d6',
} as const;

/** Белый глиф на цветной скруглённой плашке. */
export function IconTile({ name, color, size = 30 }: { name: IconName; color: string; size?: number }) {
  return (
    <span className="icon-tile" style={{ background: color, width: size, height: size }}>
      <Icon name={name} size={Math.round(size * 0.62)} />
    </span>
  );
}
