'use client';

import { cn } from '@/lib/cn';
import { forwardRef } from 'react';

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }>(
  function Button({ className, variant = 'primary', ...props }, ref) {
    const base = 'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
    const variants: Record<string, string> = {
      primary:   'bg-brand-500 text-white hover:bg-brand-600',
      secondary: 'bg-white text-gray-800 border hover:bg-gray-50',
      danger:    'bg-red-600 text-white hover:bg-red-700',
      ghost:     'text-gray-700 hover:bg-gray-100',
    };
    return <button ref={ref} className={cn(base, variants[variant], className)} {...props} />;
  }
);

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none',
          className
        )}
        {...props}
      />
    );
  }
);

export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className, ...props }) => (
  <label className={cn('text-sm font-medium text-gray-700', className)} {...props} />
);

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('rounded-lg border bg-white shadow-sm', className)} {...props} />
);

export const Badge: React.FC<{ children: React.ReactNode; tone?: 'green' | 'amber' | 'red' | 'gray' | 'blue' }> = ({ children, tone = 'gray' }) => {
  const tones: Record<string, string> = {
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
    red:   'bg-red-100 text-red-800',
    gray:  'bg-gray-100 text-gray-700',
    blue:  'bg-blue-100 text-blue-800',
  };
  return <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', tones[tone])}>{children}</span>;
};
