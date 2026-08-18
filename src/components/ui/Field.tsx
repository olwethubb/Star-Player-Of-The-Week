import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { IconEye, IconEyeOff } from './Icons';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  isPassword?: boolean;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, isPassword, type, className = '', ...props },
  ref,
) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-3.5 text-left">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-text-muted">
        {label}
      </label>
      <div className={isPassword ? 'relative' : undefined}>
        <input
          ref={ref}
          id={id}
          type={isPassword ? (visible ? 'text' : 'password') : type}
          className={`w-full rounded-xl border border-border bg-bg-elevated px-3.5 py-3 text-base text-text transition-colors focus:border-accent focus:outline-none ${
            isPassword ? 'pr-12' : ''
          } ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            aria-label={visible ? 'Hide password' : 'Show password'}
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-muted"
          >
            {visible ? <IconEyeOff /> : <IconEye />}
          </button>
        )}
      </div>
    </div>
  );
});
