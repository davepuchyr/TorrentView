import type { Torrent, TorrentStatus, SortConfig } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TorrentStatusIcon } from '@/components/torrent-status-icon';
import { formatBytes, formatEta, formatSpeed, getTrailerSearchUrl } from '@/lib/utils';
import { ArrowUp, ArrowDown, ArrowUpDown, Tv, Film, Monitor, HelpCircle, Download, Youtube } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useToast } from '@/hooks/use-toast';

type Props = {
  torrents: Torrent[];
  sortConfig: SortConfig[];
  onSort: (key: keyof Torrent | 'type', isShiftClick: boolean) => void;
  selectedTorrent: string | null;
  onRowClick: (hash: string) => void;
};

type HeaderConfig = {
    key: keyof Torrent | 'type';
    label: string;
    className?: string;
    headerClassName?: string;
}

const SortableHeader = ({
  columnKey,
  title,
  sortConfig,
  onSort,
  className
}: {
  columnKey: keyof Torrent | 'type';
  title: string;
  sortConfig: SortConfig[];
  onSort: (key: keyof Torrent | 'type', isShiftClick: boolean) => void;
  className?: string;
}) => {
  const sortInfo = sortConfig.find(c => c.key === columnKey);
  const sortIndex = sortConfig.findIndex(c => c.key === columnKey);
  const isSorted = !!sortInfo;
  const direction = sortInfo?.direction;
  const SortIcon = isSorted ? (direction === 'ascending' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={cn('whitespace-nowrap', className)}>
      <Button variant="ghost" onClick={(e) => onSort(columnKey, e.shiftKey)} className="-ml-4 h-8 px-2 sm:px-4">
        {title}
        <div className="flex items-center ml-2">
            <SortIcon 
                className={cn(
                    'h-4 w-4',
                    isSorted ? 'text-accent' : 'text-muted-foreground/50'
                )} 
            />
            {isSorted && sortConfig.length > 1 && (
                <span className="text-xs font-normal bg-muted text-muted-foreground rounded-full h-4 w-4 flex items-center justify-center ml-1">
                    {sortIndex + 1}
                </span>
            )}
        </div>
      </Button>
    </TableHead>
  );
};

export function TorrentTable({ torrents, sortConfig, onSort, selectedTorrent, onRowClick }: Props) {
  const { toast } = useToast();
  const headers: HeaderConfig[] = [
    { key: 'name', label: 'Name', className: 'w-[40%]' },
    { key: 'type', label: 'Type' },
    { key: 'resolution', label: 'Resolution' },
    { key: 'status', label: 'Status' },
    { key: 'size', label: 'Size', headerClassName: 'text-right', className: 'text-right' },
    { key: 'progress', label: 'Progress', headerClassName: 'text-right', className: 'text-right' },
    { key: 'dlspeed', label: 'Down Speed', headerClassName: 'text-right', className: 'text-right' },
    { key: 'upspeed', label: 'Up Speed', headerClassName: 'text-right', className: 'text-right' },
    { key: 'eta', label: 'ETA', headerClassName: 'text-right', className: 'text-right' },
    { key: 'ratio', label: 'Ratio', headerClassName: 'text-right', className: 'text-right' },
  ];

  const handleDownload = (torrent: Torrent) => {
    // In a real app, this would trigger a backend API call.
    toast({
      title: 'Download Started',
      description: `Downloading "${torrent.name}".`,
    });
  };

  const handlePreview = (torrent: Torrent) => {
    window.open(getTrailerSearchUrl(torrent.name), '_blank');
  };

  const formatDisplayName = (torrent: Torrent) => {
    if (torrent.resolution && torrent.resolution < 1080) {
      return torrent.name.replace(`${torrent.resolution}p`, `0${torrent.resolution}p`);
    }
    return torrent.name;
  };

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
                className={header.headerClassName}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {torrents.length > 0 ? (
            torrents.map((torrent) => (
              <ContextMenu key={torrent.hash}>
                <ContextMenuTrigger asChild>
                  <TableRow 
                    onClick={() => onRowClick(torrent.hash)}
                    data-state={selectedTorrent === torrent.hash ? 'selected' : 'unselected'}
                    className={cn('cursor-pointer', torrent.is_read && 'text-muted-foreground', selectedTorrent === torrent.hash && 'text-foreground')}
                  >
                    <TableCell className="font-medium truncate max-w-xs md:max-w-md" title={torrent.name}>
                      {formatDisplayName(torrent)}
                    </TableCell>
                    <TableCell>
                      {!torrent.resolution ? (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <HelpCircle className="h-3 w-3" />
                          <span>Other</span>
                        </Badge>
                      ) : torrent.is_series ? (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Tv className="h-3 w-3" />
                          <span>Series</span>
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <Film className="h-3 w-3" />
                            <span>Movie</span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {torrent.resolution ? (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Monitor className="h-3 w-3" />
                          <span>{torrent.resolution}p</span>
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell><TorrentStatusIcon status={torrent.status as TorrentStatus} /></TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatBytes(torrent.size)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress value={torrent.progress * 100} className="w-20 sm:w-24" aria-label={`Progress ${torrent.progress * 100}%`} />
                        <span className="text-sm text-muted-foreground tabular-nums w-12">
                          {(torrent.progress * 100).toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatSpeed(torrent.dlspeed)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatSpeed(torrent.upspeed)}</TableCell>
                    <TableCell className="text-right">{formatEta(torrent.eta)}</TableCell>
                    <TableCell className="text-right">{torrent.ratio.toFixed(2)}</TableCell>
                  </TableRow>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => handleDownload(torrent)}>
                    <Download className="mr-2 h-4 w-4" />
                    <span>Download</span>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handlePreview(torrent)}>
                    <Youtube className="mr-2 h-4 w-4" />
                    <span>Preview Trailer</span>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
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
