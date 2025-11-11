import { NextRequest, NextResponse } from "next/server";

import bencode from "bencode";
import { createHash } from "crypto";
import WebTorrent, { Torrent as WebTorrentTorrent } from "webtorrent";
import { TorrentFileInfo, TorrentMetadata } from "@/lib/types";

interface WebTorrentTorrentExtended extends WebTorrentTorrent {
   info: Record<string, any>;
}

// ——— Helper: Convert Uint8Array to UTF-8 string ———
const uint8ArrayToUtf8 = (uint8Array: Uint8Array): string => new TextDecoder("utf-8").decode(uint8Array);

// ——— Helper: Build v2 file tree (nested object) ———
const buildV2FileTree = (tree: Record<string, any>, path: string[] = []): Record<string, any> => {
   const result: Record<string, any> = {};
   for (const [key, value] of Object.entries(tree)) {
      const currentPath = [...path, key];
      if (value[""] !== undefined) {
         // Leaf: file
         result[key] = {
            length: value[""].length,
            pieces: value[""].pieces ? value[""].pieces.length / 32 : 0,
            path: currentPath,
         };
      } else {
         // Directory
         result[key] = buildV2FileTree(value, currentPath);
      }
   }
   return result;
};

// ——— Helper: Flatten v2 tree to file list ———
const flattenV2FileTree = (tree: Record<string, any>, basePath: string[] = []): Array<{ path: string[]; length: number }> => {
   let files: Array<{ path: string[]; length: number }> = [];
   for (const [name, node] of Object.entries(tree)) {
      const currentPath = [...basePath, name];
      if (node.length !== undefined) {
         files.push({ path: currentPath, length: node.length });
      } else {
         files = files.concat(flattenV2FileTree(node, currentPath));
      }
   }
   return files;
};

// ——— Helper: Build v1-style file tree ———
const buildV1FileTree = (files: TorrentFileInfo[]): Record<string, any> => {
   const tree: Record<string, any> = {};
   for (const file of files) {
      let current: Record<string, any> = tree;
      for (let i = 0; i < file.path.length - 1; i++) {
         const dir = file.path[i];
         current[dir] = current[dir] || {};
         current = current[dir];
      }
      current[file.path[file.path.length - 1]] = { length: file.length };
   }
   return tree;
};

/**
 * Parses .torrent file or magnet link and returns full metadata with v1/v2 support using WebTorrent.
 * @param {string} url - URL to .torrent file or magnet link
 * @returns {Promise<TorrentMetadata>} Metadata with v1/v2 hashes, files, size, etc.
 */
const getTorrentMetadata = async (url: string): Promise<TorrentMetadata> => {
   const client = new WebTorrent();
   const source = url.startsWith("magnet:") ? "magnet" : "torrent";
   let torrent: WebTorrentTorrentExtended;

   try {
      if (source === "magnet") {
         torrent = await new Promise<WebTorrentTorrentExtended>((resolve, reject) => {
            const timeout = setTimeout(() => {
               client.destroy();
               reject(new Error("Magnet resolution timeout"));
            }, 30000);

            client.add(url, (t: WebTorrentTorrent) => {
               clearTimeout(timeout);
               resolve(t as WebTorrentTorrentExtended);
            });

            client.on("error", err => {
               clearTimeout(timeout);
               client.destroy();
               reject(err);
            });
         });
      } else { // torrent
         const response = await fetch(url, {
            signal: AbortSignal.timeout(15000), // 15s timeout
         });

         if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch .torrent file`);

         const buffer = Buffer.from(await response.arrayBuffer());

         torrent = await new Promise<WebTorrentTorrentExtended>((resolve, reject) => {
            client.add(buffer, (t: WebTorrentTorrent) => {
               resolve(t as WebTorrentTorrentExtended);
            });

            client.on("error", err => {
               client.destroy();
               reject(err);
            });
         });
      }

      // Extract metadata from torrent
      const info = torrent.info;

      if (!info) throw new Error('Missing "info" dictionary in torrent');

      // Compute hashes
      const v1Hash = createHash("sha1").update(bencode.encode(info)).digest("hex").toLowerCase();
      const v2Hash =
         info["meta version"] !== 2
            ? null
            : createHash("sha256")
                 .update(bencode.encode({ ...info, pieces: Buffer.alloc(0) }))
                 .digest("hex")
                 .toLowerCase();

      // Parse files
      let files: TorrentFileInfo[] = [];
      let fileTree: Record<string, any> = {};
      let totalLength = 0;

      if (info["file tree"]) { // v2 file tree
         fileTree = buildV2FileTree(info["file tree"]);
         const flatFiles = flattenV2FileTree(fileTree);
         files = flatFiles.map(f => ({ path: f.path, length: f.length }));
         totalLength = flatFiles.reduce((sum: number, f: TorrentFileInfo) => sum + f.length, 0);
      } else if (info.files) { // Multi-file v1
         files = info.files.map((f: any) => ({
            path: f.path.map((p: any) => (p instanceof Uint8Array ? uint8ArrayToUtf8(p) : p.toString())),
            length: f.length,
         }));
         totalLength = files.reduce((sum, f) => sum + f.length, 0);
         fileTree = buildV1FileTree(files);
      } else { // Single-file v1
         const name = info.name instanceof Uint8Array ? uint8ArrayToUtf8(info.name) : info.name ? info.name.toString() : "Unknown";
         files = [{ path: [name], length: info.length }];
         totalLength = info.length;
         fileTree = buildV1FileTree(files);
      }

      const metadata: TorrentMetadata = {
         source,
         hash: v1Hash, // Default to v1 for compatibility.
         v1Hash,
         v2Hash,
         name: torrent.name,
         pieceLength: info["piece length"],
         pieces: info.pieces ? info.pieces.length / 20 : 0,
         length: totalLength,
         files,
         fileTree,
         private: !!info.private,
         createdBy: torrent.createdBy,
         creationDate: torrent.created ? torrent.created.toISOString() : null,
         comment: torrent.comment,
         announce: torrent.announce,
      };

      client.destroy();
      return metadata;
   } catch (error) {
      client.destroy();
      throw error;
   }
};


/**
 * This is a custom endpoint, not a qbittorrent proxy endpoint, that is necessary since qbittorrent doesn't provide an endpoint for querying a torrent's metadata.
 * @param request
 * @returns torrent metadata
 */
export async function GET(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const backendUrl = searchParams.get("backendUrl");
   const url = searchParams.get("url");

   if (!backendUrl) return NextResponse.json({ error: "Missing parameter backendUrl" }, { status: 400 });
   if (!url)        return NextResponse.json({ error: "Missing parameter hash" },       { status: 400 });

   try {
      const metadata = await getTorrentMetadata(url);
      return NextResponse.json(metadata, { status: 200 });
   } catch (e) {
      const message = `Failed to get metadata for ${url}`;
      console.error(`${message}:`, e);
      return NextResponse.json({ error: message }, { status: 502 });
   }
}
