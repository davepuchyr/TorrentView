import { NextRequest, NextResponse } from "next/server";

import bencode from "bencode";
import { createHash } from "crypto";
import WebTorrent, { Torrent as WebTorrentTorrent } from "webtorrent";
import { TorrentFileInfo, TorrentMetadata } from "@/lib/types";

// ——— Helper: Convert Uint8Array to UTF-8 string ———
function uint8ArrayToUtf8(uint8Array: Uint8Array): string {
   return new TextDecoder("utf-8").decode(uint8Array);
}

// ——— Helper: Build v2 file tree (nested object) ———
function buildV2FileTree(tree, path = []) {
   const result = {};
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
}

// ——— Helper: Flatten v2 tree to file list ———
function flattenV2FileTree(tree, basePath = []) {
   let files = [];
   for (const [name, node] of Object.entries(tree)) {
      const currentPath = [...basePath, name];
      if (node.length !== undefined) {
         files.push({ path: currentPath, length: node.length });
      } else {
         files = files.concat(flattenV2FileTree(node, currentPath));
      }
   }
   return files;
}

// ——— Helper: Build v1-style file tree ———
function buildV1FileTree(files: TorrentFileInfo[]): Record<string, any> {
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
}

// ——— Helper: Resolve magnet link using WebTorrent ———
function resolveMagnet(magnet: string): Promise<WebTorrentTorrent> {
   return new Promise((resolve, reject) => {
      const client = new WebTorrent();
      const timeout = setTimeout(() => {
         client.destroy();
         reject(new Error("Magnet resolution timeout"));
      }, 30000);

      client.add(magnet, (torrent: WebTorrentTorrent) => {
         clearTimeout(timeout);
         resolve(torrent);
         client.destroy();
      });

      client.on("error", err => {
         clearTimeout(timeout);
         client.destroy();
         reject(err);
      });
   });
}

/**
 * Parses .torrent file or magnet link and returns full metadata with v1/v2 support.
 * @param {string} url - URL to .torrent file or magnet link
 * @returns {Promise<Object>} Metadata with v1/v2 hashes, files, size, etc.
 */
async function getTorrentMetadata(url: string): Promise<TorrentMetadata> {
   // Step 1: Detect and handle magnet link
   if (url.startsWith("magnet:")) {
      const params = new URLSearchParams(url.split("?")[1] || "");
      const xt = params.get("xt");
      const dn = params.get("dn");

      if (!xt || !xt.startsWith("urn:btih:")) {
         throw new Error("Invalid magnet link: missing or unsupported xt parameter");
      }

      const btih = xt.slice(9); // Remove 'urn:btih:'
      let v1Hash = null,
         v2Hash = null;

      if (btih.length === 40) {
         v1Hash = btih.toLowerCase(); // Hex-encoded v1
      } else if (btih.length === 32) {
         v1Hash = Buffer.from(btih, "base32").toString("hex").toLowerCase(); // Base32 v1
      } else if (btih.length === 64) {
         v2Hash = btih.toLowerCase(); // Hex-encoded v2
      } else {
         throw new Error("Unsupported btih length in magnet link");
      }

      try {
         const torrent = await resolveMagnet(url);
         // dmjp: NOTE: WTF?: torrent resolves to a "clean" WebTorrentTorrent in resolveMagnet() but somehow loses its file property contents and adds an info property with a file property that contains uint8 array(s)!
         const files: TorrentFileInfo[] = (torrent as any).info.files.map((f: { path: Uint8Array[]; length: number }) => {
            return{ path: uint8ArrayToUtf8(f.path[0]).split("/"), length: f.length }
         });
         const length = files.reduce((sum, f) => sum + f.length, 0);
         const fileTree = buildV1FileTree(files);

         return {
            source: "magnet",
            hash: v1Hash || v2Hash,
            v1Hash,
            v2Hash,
            name: torrent.name || (dn ? decodeURIComponent(dn) : null),
            length,
            files,
            fileTree,
            private: null,
            createdBy: null,
            creationDate: null,
            comment: null,
            announce: params.get("tr") || null,
            announceList: params.getAll("tr").length > 0 ? [params.getAll("tr")] : [],
         };
      } catch (e) {
         console.error("Failed to resolve magnet:", e);
         // Fallback to original empty response
         return {
            source: "magnet",
            hash: v1Hash || v2Hash,
            v1Hash,
            v2Hash,
            name: dn ? decodeURIComponent(dn) : null,
            length: null,
            files: [],
            fileTree: {},
            private: null,
            createdBy: null,
            creationDate: null,
            comment: null,
            announce: params.get("tr") || null,
            announceList: params.getAll("tr").length > 0 ? [params.getAll("tr")] : [],
         };
      }
   }

   // Step 2: Fetch .torrent file
   const response = await fetch(url, {
      signal: AbortSignal.timeout(15000), // 15s timeout
   });

   if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch .torrent file`);
   }

   const buffer = Buffer.from(await response.arrayBuffer());

   // Step 3: Decode bencode
   let decoded;
   try {
      decoded = bencode.decode(buffer);
   } catch (err) {
      throw new Error("Invalid .torrent file: bencode parsing failed");
   }

   if (!decoded.info) {
      throw new Error('Missing "info" dictionary in torrent');
   }

   const info = decoded.info;
   const v1Hash = createHash("sha1").update(bencode.encode(info)).digest("hex").toLowerCase();
   let v2Hash = null;
   let fileTree = {};
   let totalLength = 0;
   let files: TorrentFileInfo[] = [];

   // Step 4: Handle v2 or hybrid
   if (info["meta version"]) {
      const metaVersion = info["meta version"];
      if (metaVersion === 2) {
         // Pure v2 or hybrid
         v2Hash = createHash("sha256")
            .update(bencode.encode({ ...info, pieces: Buffer.alloc(0) })) // v2 hash excludes pieces
            .digest("hex")
            .toLowerCase();

         // Build v2 file tree
         if (info["file tree"]) {
            fileTree = buildV2FileTree(info["file tree"]);
            const flatFiles = flattenV2FileTree(fileTree);
            files = flatFiles.map(f => ({ path: f.path, length: f.length }));
            totalLength = flatFiles.reduce((sum: number, f: TorrentFileInfo) => sum + f.length, 0);
         }
      }
   }

   // Step 5: Fallback to v1 file list if no v2 tree
   if (!files.length) {
      if (info.files) {
         // Multi-file v1
         files = info.files.map(f => ({
            path: f.path.map(p => p.toString()),
            length: f.length,
         }));
         totalLength = files.reduce((sum, f) => sum + f.length, 0);
      } else {
         // Single-file v1
         const name = info.name ? uint8ArrayToUtf8(info.name) : "Unknown";
         files = [{ path: [name], length: info.length }];
         totalLength = info.length;
      }
      fileTree = buildV1FileTree(files);
   }

   // Step 6: Extract common metadata
   return {
      source: "torrent",
      hash: v1Hash, // Default to v1 for compatibility
      v1Hash,
      v2Hash,
      name: info.name ? uint8ArrayToUtf8(info.name) : null,
      pieceLength: info["piece length"],
      pieces: info.pieces ? info.pieces.length / 20 : 0,
      length: totalLength,
      files,
      fileTree,
      private: !!info.private,
      createdBy: decoded["created by"] ? uint8ArrayToUtf8(decoded["created by"]) : null,
      creationDate: decoded["creation date"] ? new Date(decoded["creation date"] * 1000).toISOString() : null,
      comment: decoded.comment ? uint8ArrayToUtf8(decoded.comment) : null,
      announce: decoded.announce ? uint8ArrayToUtf8(decoded.announce) : null,
      announceList:
         decoded["announce-list"]?.map((tier: Uint8Array<ArrayBufferLike>[]) =>
            tier.map((t: Uint8Array<ArrayBufferLike>) => uint8ArrayToUtf8(t)),
         ) || [],
   };
}

export async function GET(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const backendUrl = searchParams.get("backendUrl");
   const url = searchParams.get("url");

   if (!backendUrl) {
      return NextResponse.json({ error: "Missing backendUrl parameter" }, { status: 400 });
   }
   if (!url) {
      return NextResponse.json({ error: "Missing hash parameter" }, { status: 400 });
   }

   try {
      const metadata = await getTorrentMetadata(url);
      return NextResponse.json(metadata.files, { status: 200 });
   } catch (e) {
      const message = `Failed to get metadata for ${url}`;
      console.error(`${message}:`, e);
      return NextResponse.json({ error: message }, { status: 502 });
   }
}
