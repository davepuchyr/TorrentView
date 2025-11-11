export type Article = {
   category: string;
   contentLength: string;
   date: string;
   fileName: string;
   id: string;
   infoHash: string;
   isRead: boolean;
   link: string;
   magnetURI: string;
   peers: string;
   seeds: string;
   title: string;
   torrentURL: string;
   verified: string;
};

export type Feed = {
   articles: Article[];
   hasError: boolean;
   isLoading: boolean;
   lastBuildDate: string;
   title: string;
   uid: string;
   url: string;
};

export type Torrent = {
   added_on: number; // timestamp
   bytes: number | null;
   category: string;
   dlspeed: number; // bytes/s
   eta: number; // seconds
   feed: string;
   files?: TorrentFile[];
   hash: string;
   id: string;
   is_read: boolean;
   is_series: boolean;
   metadata: TorrentMetadata | null;
   name: string;
   progress: number; // 0-1
   ratio: number;
   resolution: number | null;
   series: string | null;
   size: string; // in kibibyte, mebibyte, etc
   status: TorrentStatus;
   upspeed: number; // bytes/s
};

export type TorrentFile = {
   name: string;
   size: number;
   progress: number;
};

export type TorrentStatus = "available" | "completed" | "downloading" | "error" | "paused" | "seeding";

export type SortConfig = {
   key: keyof Torrent | "type";
   direction: "ascending" | "descending";
};

export type TorrentFileInfo = {
   path: string[];
   length: number;
};

export type TorrentMetadata = {
   announce: string[] | null;
   comment: string | null;
   createdBy: string | null;
   creationDate: string | null;
   files: TorrentFileInfo[];
   fileTree: Record<string, any>;
   hash: string | null;
   length: number | null;
   name: string | null;
   pieceLength?: number;
   pieces?: number;
   private: boolean | null;
   source: "magnet" | "torrent";
   v1Hash: string | null;
   v2Hash: string | null;
};
