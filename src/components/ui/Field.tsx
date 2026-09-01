import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, type, className = '', ...props },
  ref,
) {
  const id = useId();

  return (
    <div className="mb-3.5 text-left">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-text-muted">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type={type}
        className={`w-full rounded-xl border border-border bg-bg-elevated px-3.5 py-3 text-base text-text transition-colors focus:border-accent focus:outline-none ${className}`}
        {...props}
      />
    </div>
  );
});
