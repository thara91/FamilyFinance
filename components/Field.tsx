'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';
import { formatNumber, parseRupiah } from '@/lib/money';

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (aria: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
}

/** Visible label, hint and error wired to the control through aria-describedby. */
export function Field({ id, label, error, hint, children }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ');
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-label">
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy || undefined })}
      {hint ? (
        <span id={`${id}-hint`} className="text-xs leading-snug text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="text-[13px] text-down">
          {error}
        </span>
      ) : null}
    </div>
  );
}

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onValueChange: (value: number) => void;
};

/** Rupiah input that keeps the number whole and shows thousand separators as the person types. */
export function MoneyInput({ value, onValueChange, ...rest }: MoneyInputProps) {
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
        Rp
      </span>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="input num pl-10"
        value={value === 0 ? '' : formatNumber(value)}
        placeholder="0"
        onChange={(e) => onValueChange(parseRupiah(e.target.value))}
      />
    </div>
  );
}
