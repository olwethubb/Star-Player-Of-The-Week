import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'gate' | 'small' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base = 'font-medium transition-transform duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-default disabled:active:scale-100 cursor-pointer';

const variants: Record<Variant, string> = {
  primary:
    'w-full font-display font-bold text-[15px] bg-accent text-accent-contrast rounded-full py-3.5 px-6 min-h-12 hover:brightness-110',
  // The gate CTA used to be a clip-path polygon with a notched corner — the only
  // element in the app using that shape language, and it read as a rendering glitch
  // rather than a decision. Now it's simply the primary button, sized for a form.
  gate:
    'w-full rounded-xl font-display font-bold text-[15px] bg-accent text-accent-contrast py-3.5 px-5 min-h-12 shadow-[0_6px_18px_rgba(255,90,31,0.26)] hover:brightness-105',
  ghost:
    'border border-border text-text rounded-full py-3 px-5 min-h-[46px] text-sm font-semibold hover:border-accent hover:text-accent bg-transparent',
  small:
    'border border-border rounded-full py-2 px-3 min-h-9 text-xs whitespace-nowrap hover:border-accent hover:text-accent bg-transparent',
  danger:
    'border border-border rounded-full py-2 px-3 min-h-9 text-xs whitespace-nowrap hover:border-red-500 hover:text-red-500 bg-transparent',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className = '', ...props },
  ref,
) {
  return <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />;
});
