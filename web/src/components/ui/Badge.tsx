import { cn } from '../../utils/cn';

interface BadgeProps {
  variant?: 'default' | 'gold' | 'ok' | 'err' | 'blue' | 'purple';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', size = 'sm', children, className }: BadgeProps) {
  const variants = {
    default: 'bg-bg-4 text-text-2 border-border',
    gold: 'bg-gold-dim text-gold border-gold/20',
    ok: 'bg-ok-dim text-ok border-ok/20',
    err: 'bg-err-dim text-err border-err/20',
    blue: 'bg-blue-dim text-blue border-blue/20',
    purple: 'bg-purple-dim text-purple border-purple/20',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border font-medium',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}
