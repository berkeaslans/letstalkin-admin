import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { Icon } from './Icon';
import type { IconName } from './icon-names';

export function Card({
  title,
  sub,
  right,
  children,
  className,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0 rounded-card bg-elev shadow-[inset_0_0_0_0.5px_var(--color-line)]', className)}>
      {(title || right) && (
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[18px] py-3.5">
          {title && <h2 className="text-[15px] font-bold tracking-[-0.2px]">{title}</h2>}
          {sub && <span className="text-[12px] text-sub">{sub}</span>}
          {right && <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  icon,
  value,
  sub,
  tone,
  onClick,
}: {
  label: string;
  icon: IconName;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'live' | 'up';
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-card bg-elev px-[18px] py-4 text-left shadow-[inset_0_0_0_0.5px_var(--color-line)]',
        onClick && 'press transition-shadow hover:shadow-[inset_0_0_0_0.5px_var(--color-line2)]',
      )}
    >
      <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-sub">
        <Icon name={icon} size={18} />
        {label}
      </span>
      <span className={cn('text-[28px] leading-tight font-bold tracking-[-0.8px] tabular', tone === 'live' && 'text-live')}>{value}</span>
      {sub && <span className={cn('text-[12px] font-semibold', tone === 'up' ? 'text-up' : 'text-sub')}>{sub}</span>}
    </Tag>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-[12px]', className)} />;
}

export function Rows({ n = 5 }: { n?: number }) {
  return (
    <div className="flex flex-col gap-2 px-[18px] pb-4">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon = 'check_circle',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <Icon name={icon} size={40} className="text-faint" />
      <p className="text-[15px] font-semibold">{title}</p>
      {body && <p className="max-w-[46ch] text-[13px] text-sub">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <EmptyState
      icon="error"
      title="Yüklenemedi"
      body={errorMessage(error)}
      action={
        retry && (
          <Button size="sm" icon="refresh" onClick={retry}>
            Tekrar dene
          </Button>
        )
      }
    />
  );
}

export function Tag({ children, tone }: { children: ReactNode; tone?: 'yellow' | 'blue' | 'live' | 'up' | 'epic' | 'match' }) {
  const tones = {
    yellow: 'bg-yellow/13 text-yellow',
    blue: 'bg-blue/18 text-[#6aa0ff]',
    live: 'bg-live/14 text-live',
    up: 'bg-up/13 text-up',
    epic: 'bg-epic/16 text-[#b38bff]',
    match: 'bg-match/15 text-match',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1 rounded-tag px-2 text-[11px] font-bold whitespace-nowrap',
        tone ? tones[tone] : 'bg-elev3 text-sub',
      )}
    >
      {children}
    </span>
  );
}

export function LiveTag() {
  return (
    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-tag bg-live px-2 text-[11px] font-bold text-white">
      <span className="h-1.5 w-1.5 rounded-full bg-white" />
      CANLI
    </span>
  );
}
