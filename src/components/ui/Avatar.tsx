import { useState } from 'react';
import { mediaUrl, type Tick as TickKind } from '@/lib/api/admin';
import { cn } from '@/lib/cn';

// Web'deki seedColors/initials ile aynı: görsel yoksa isimden deterministik renk.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function seedColors(seed: string): [string, string] {
  const h = hash(seed || '?');
  const hue = h % 360;
  const hue2 = (hue + 28 + ((h >> 9) % 50)) % 360;
  return [`oklch(0.42 0.11 ${hue})`, `oklch(0.24 0.07 ${hue2})`];
}
function initials(name: string): string {
  const p = name.replace(/[@_.]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[1][0]).toUpperCase();
}

export function Avatar({ src, name, size = 36, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const url = mediaUrl(src);
  const [broken, setBroken] = useState(false);
  const [c1, c2] = seedColors(name);
  return (
    <span
      className={cn(
        'relative inline-block flex-none overflow-hidden rounded-full bg-elev2 after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.12)]',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {url && !broken ? (
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-semibold text-white/90"
          style={{ background: `linear-gradient(140deg, ${c1}, ${c2})`, fontSize: Math.max(9, size * 0.36), letterSpacing: '-0.02em' }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}

/** Web'deki Tick ile aynı rozet: sarı zemin + siyah tik, mavi zemin + beyaz tik. */
export function Tick({ tick, size = 14 }: { tick: TickKind | null | undefined; size?: number }) {
  if (!tick || tick === 'none') return null;
  const yellow = tick === 'yellow';
  return (
    <span
      className={cn('inline-flex flex-none items-center justify-center rounded-full', yellow ? 'bg-yellow' : 'bg-blue')}
      style={{ width: size, height: size }}
      title={yellow ? 'Sarı tik' : 'Mavi tik'}
    >
      <svg viewBox="0 0 24 24" width={size * 0.68} height={size * 0.68} aria-hidden="true">
        <path
          d="M5 12.5l4.2 4.2L19 7"
          fill="none"
          stroke={yellow ? '#000' : '#fff'}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
