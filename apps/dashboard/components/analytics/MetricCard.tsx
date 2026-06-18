import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  warning?: boolean;
  className?: string;
}

export function MetricCard({ label, value, delta, deltaPositive, warning, className }: MetricCardProps) {
  return (
    <div className={cn('bg-surface border border-border rounded-xl p-5', warning && 'border-warning/50', className)}>
      <p className="text-text-muted text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
      {delta && (
        <p className={cn('text-sm mt-1', deltaPositive ? 'text-success' : 'text-danger')}>
          {deltaPositive ? '↑' : '↓'} {delta}
        </p>
      )}
      {warning && (
        <p className="text-xs text-warning mt-1">⚠ Low balance</p>
      )}
    </div>
  );
}
