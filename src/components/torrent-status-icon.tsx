import type { TorrentStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, PauseCircle, XCircle } from 'lucide-react';

const statusConfig = {
  downloading: { icon: ArrowDownToLine, color: 'text-primary', label: 'Downloading' },
  seeding: { icon: ArrowUpFromLine, color: 'text-[hsl(var(--chart-2))]', label: 'Seeding' },
  completed: { icon: CheckCircle2, color: 'text-muted-foreground', label: 'Completed' },
  paused: { icon: PauseCircle, color: 'text-[hsl(var(--chart-4))]', label: 'Paused' },
  error: { icon: XCircle, color: 'text-destructive', label: 'Error' },
};

export function TorrentStatusIcon({ status }: { status: TorrentStatus }) {
  const { icon: Icon, color, label } = statusConfig[status];

  return (
    <div className={cn('flex items-center gap-2 text-sm', color)}>
      <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span className="hidden md:inline">{label}</span>
    </div>
  );
}
