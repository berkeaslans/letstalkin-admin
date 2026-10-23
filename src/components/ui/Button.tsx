import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './Icon';
import type { IconName } from './icon-names';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'md' | 'sm' | 'xs';

// Web'deki Button ile aynı varyantlar: birincil sarı + siyah Quicksand 700 (marka imzası).
const variants: Record<Variant, string> = {
  primary: 'bg-yellow text-black font-brand font-bold shadow-[0_10px_40px_rgb(255_216_0/0.18)] hover:brightness-105',
  secondary: 'bg-elev2 text-text shadow-[inset_0_0_0_0.5px_var(--color-line2)] hover:bg-elev3',
  outline: 'bg-transparent text-text shadow-[inset_0_0_0_0.5px_var(--color-line2)] hover:bg-elev2',
  ghost: 'bg-transparent text-text hover:bg-elev2',
  danger: 'bg-live/12 text-live shadow-[inset_0_0_0_0.5px_rgb(255_59_78/0.35)] hover:bg-live/20',
};
const sizes: Record<Size, string> = {
  md: 'h-10 px-4 text-[13.5px] gap-2',
  sm: 'h-8 px-3.5 text-[12.5px] gap-1.5',
  xs: 'h-7 px-3 text-[12px] gap-1',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  busy,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: IconName; busy?: boolean; children?: ReactNode }) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={cn(
        'press inline-flex select-none items-center justify-center rounded-full font-semibold whitespace-nowrap transition-[background,filter,color] duration-150 disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {busy ? (
        <Icon name="progress_activity" size={size === 'md' ? 18 : 16} className="animate-spin" />
      ) : (
        icon && <Icon name={icon} size={size === 'md' ? 18 : 16} filled={variant === 'primary'} />
      )}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  className,
  size = 22,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('press grid h-10 w-10 place-items-center rounded-full text-text hover:bg-elev2', className)}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
