import type { Torrent, TorrentStatus } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TorrentStatusIcon } from '@/components/torrent-status-icon';
import { formatBytes, formatEta, formatSpeed } from '@/lib/utils';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortConfig = {
  key: keyof Torrent;
  direction: 'ascending' | 'descending';
} | null;

type Props = {
  torrents: Torrent[];
  sortConfig: SortConfig;
  onSort: (key: keyof Torrent) => void;
};

type HeaderConfig = {
    key: keyof Torrent;
    label: string;
    className?: string;
}

const SortableHeader = ({
  columnKey,
  title,
  sortConfig,
  onSort,
  className
}: {
  columnKey: keyof Torrent;
  title: string;
  sortConfig: SortConfig;
  onSort: (key: keyof Torrent) => void;
  className?: string;
}) => {
  const isSorted = sortConfig?.key === columnKey;
  const direction = sortConfig?.direction;
  const SortIcon = isSorted ? (direction === 'ascending' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={cn('whitespace-nowrap', className)}>
      <Button variant="ghost" onClick={() => onSort(columnKey)} className="-ml-4 h-8 px-2 sm:px-4">
        {title}
        <SortIcon 
            className={cn(
                'ml-2 h-4 w-4',
                isSorted ? 'text-accent' : 'text-muted-foreground/50'
            )} 
        />
      </Button>
    </TableHead>
  );
};

export function TorrentTable({ torrents, sortConfig, onSort }: Props) {
  const headers: HeaderConfig[] = [
    { key: 'name', label: 'Name', className: 'w-[40%]' },
    { key: 'status', label: 'Status' },
    { key: 'size', label: 'Size' },
    { key: 'progress', label: 'Progress' },
    { key: 'dlspeed', label: 'Down Speed' },
    { key: 'upspeed', label: 'Up Speed' },
    { key: 'eta', label: 'ETA' },
    { key: 'ratio', label: 'Ratio' },
  ];

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-card">
            {headers.map((header) => (
              <SortableHeader
                key={header.key}
                columnKey={header.key}
                title={header.label}
                sortConfig={sortConfig}
                onSort={onSort}
                className={header.className}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {torrents.length > 0 ? (
            torrents.map((torrent) => (
              <TableRow key={torrent.hash}>
                <TableCell className="font-medium truncate max-w-xs md:max-w-md" title={torrent.name}>{torrent.name}</TableCell>
                <TableCell><TorrentStatusIcon status={torrent.status as TorrentStatus} /></TableCell>
                <TableCell className="whitespace-nowrap">{formatBytes(torrent.size)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={torrent.progress * 100} className="w-20 sm:w-24" aria-label={`Progress ${torrent.progress * 100}%`} />
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {(torrent.progress * 100).toFixed(1)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatSpeed(torrent.dlspeed)}</TableCell>
                <TableCell className="whitespace-nowrap">{formatSpeed(torrent.upspeed)}</TableCell>
                <TableCell>{formatEta(torrent.eta)}</TableCell>
                <TableCell>{torrent.ratio.toFixed(2)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={headers.length} className="h-24 text-center">
                No results found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
