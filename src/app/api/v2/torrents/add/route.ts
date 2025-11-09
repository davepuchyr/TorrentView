import { NextRequest, NextResponse } from "next/server";
import type { Torrent, TorrentFile } from "@/lib/types";

export async function POST(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const backendUrl = searchParams.get("backendUrl");

   if (!backendUrl) {
      return NextResponse.json({ error: "Missing backendUrl parameter" }, { status: 400 });
   }

   const body = await request.json();
   const torrent = body.torrent as Torrent;
   const data = body.data;

   const allFileIndices = torrent.files?.map((_, i) => i) || [];
   const selectedFileIndices = new Set<number>();
   const unselectedFileIndices = new Set<number>();

   if (torrent.files) {
      torrent.files.forEach((file: TorrentFile, index: number) => {
         if (data.selectedFiles.includes(file.name)) {
            selectedFileIndices.add(index);
         } else {
            unselectedFileIndices.add(index);
         }
      });
   }

   const formData = new FormData();
   formData.append("urls", torrent.hash);
   formData.append("savepath", data.savePath);
   formData.append("paused", String(data.paused));
   formData.append("sequential", String(data.sequential));
   formData.append("firstLastPiecePrio", String(data.firstLastPiecePrio));
   formData.append("root_folder", data.contentLayout === "Original" ? "unset" : String(data.contentLayout === "Subfolder"));

   if (torrent.files && selectedFileIndices.size > 0) {
      const filePriorities = allFileIndices.map(i => (selectedFileIndices.has(i) ? "1" : "0"));
      formData.append("file_priority", filePriorities.join("|"));
   } else if (!torrent.files && data.selectedFiles.length === 0) {
      // If it's a single file torrent and it's not selected, we can't download anything.
      // Or we can treat it as "download all" if selection is empty.
      // For now, let's assume if it's single file, it's always intended to be downloaded.
   }

   const url = `${backendUrl}/api/v2/torrents/add`;
   let fetched: Response;

   try {
      fetched = await fetch(url, {
         method: "POST",
         body: formData,
      });

      if (fetched.ok) {
         console.log(`Added torrent: ${torrent.name}`);
         // Mark as read after successful addition
         const markAsReadUrl = `${backendUrl}/api/v2/rss/markAsRead`;
         await fetch(markAsReadUrl, {
            headers: {
               "accept": "*/*",
               "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body: `itemPath=${encodeURIComponent(torrent.feed)}&articleId=${encodeURIComponent(torrent.id)}`,
            method: "POST",
         });
         return new NextResponse("OK", { status: 200 });
      } else {
         const errorBody = await fetched.text();
         console.error(`Failed to add torrent ${torrent.name}:`, errorBody);
         return NextResponse.json({ error: `Failed to POST to ${url}: ${errorBody}` }, { status: fetched.status });
      }
   } catch (e) {
      console.error(`Failed to add torrent ${torrent.name}:`, e);
      return NextResponse.json({ error: `Failed to POST to ${url}` }, { status: 502 });
   }
}
