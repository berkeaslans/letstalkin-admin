import { cn } from '@/lib/cn';
import type { IconName } from './icon-names';

/** Material Symbols Rounded — pasif outline w300, `filled` → FILL w400 (web ile aynı). */
export function Icon({
  name,
  size = 24,
  filled,
  bold,
  className,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
  bold?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn('ms', filled && 'fill', bold && 'bold', className)}
      style={{ fontSize: size, width: size, height: size }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
