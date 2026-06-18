import { cn } from '@/lib/utils';

type Status = 'active' | 'past_due' | 'paused' | 'cancelled';

const styles: Record<Status, string> = {
  active: 'bg-success/10 text-success border-success/20',
  past_due: 'bg-danger/10 text-danger border-danger/20',
  paused: 'bg-warning/10 text-warning border-warning/20',
  cancelled: 'bg-surface text-text-muted border-border',
};

const labels: Record<Status, string> = {
  active: 'Active',
  past_due: 'Past Due',
  paused: 'Paused',
  cancelled: 'Cancelled',
};

export function SubscriberStatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', styles[status])}>
      {labels[status]}
    </span>
  );
}
