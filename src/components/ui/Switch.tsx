import { cn } from '@/lib/cn';

/** Web Switch: açık = sarı zemin + siyah düğme. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[28px] w-[46px] flex-none rounded-full transition-colors duration-200 disabled:opacity-40',
        checked ? 'bg-yellow' : 'bg-elev3 shadow-[inset_0_0_0_0.5px_var(--color-line2)]',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] left-[3px] h-[22px] w-[22px] rounded-full shadow-[0_2px_6px_rgb(0_0_0/0.35)] transition-transform duration-200 ease-[var(--ease-spring)]',
          checked ? 'translate-x-[18px] bg-black' : 'bg-text',
        )}
      />
    </button>
  );
}
