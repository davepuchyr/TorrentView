import { NextRequest, NextResponse } from "next/server";
import type { Torrent } from "@/lib/types";

export async function POST(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const backendUrl = searchParams.get("backendUrl");

   if (!backendUrl) return NextResponse.json({ error: "Missing backendUrl parameter" }, { status: 400 });

   const body = await request.json();
   const torrent = body.torrent as Torrent;
   const data = body.data;

   if (!torrent.metadata) return NextResponse.json({ error: "Missing torrent.metadata" }, { status: 400 });
   if (!data.selectedFiles) return NextResponse.json({ error: "Missing data.selectedFiles" }, { status: 400 });

   let url = "";
   try {
      // Add the torrent in a stopped state...
      const formData = new FormData();
      formData.append("urls", torrent.hash);
      formData.append("savepath", data.savePath);
      formData.append("stopped", String(true)); // NOTE: Always start stopped so that files can be cherry-picked.
      formData.append("sequentialDownload", String(data.sequential));
      formData.append("firstLastPiecePrio", String(data.firstLastPiecePrio));
      formData.append("contentLayout", data.contentLayout);

      url = `${backendUrl}/api/v2/torrents/add`;
      const added = await fetch(url, { body: formData, method: "POST" });

      if (!added.ok) throw new Error(`Failed to add torrent ${torrent.name}: ${await added.text()}`);

      // ...then wait for the backend to get updated...
      url = `${backendUrl}/api/v2/torrents/info?limit=1&sort=added_on&reverse=true`;
      let retrys = 10; // HARD-CODED
      do {
         await new Promise(resolve => { setTimeout(resolve, 100) }); // HARD-CODED
         const updated = await fetch(url);
         try {
            const entry = await updated.json();
            if (entry!.length && entry[0].hash === torrent.metadata.hash) break;
         } catch (e) {
            // no-op: just wait for the backend to get updated
         }
      } while (--retrys);

      if (!retrys) throw new Error(`Couldn't find ${torrent.name} in the backend after many retries!`);

      // ...then cherry-pick the files...
      if (data.selectedFiles.length < torrent.metadata.files.length) {
         const selecteds = new Set(data.selectedFiles);
         const joined = torrent.metadata.files.map(f => f.path.join("/"));
         const files = new Set(joined);
         const difference = files.difference(selecteds);
         const ids: number[] = [];
         for (let i = 0, n = joined.length; i < n; ++i) {
            const file = joined[i];
            if (difference.has(file)) ids.push(i);
         }
         if (!ids.length) throw new Error(`Failed to exclude any files from torrent ${torrent.name}!`);

         const formData = new FormData();
         formData.append("hash", torrent.metadata.hash!);
         formData.append("priority", String(0)); // HARD-CODED: Do not download.
         formData.append("id", ids.join("|")); // HARD-CODED delimiter
         url = `${backendUrl}/api/v2/torrents/filePrio`;
         const filtered = await fetch(url, { body: formData, method: "POST" });

         if (!filtered.ok) return NextResponse.json({ error: `Failed to GET to ${url}: ${await filtered.text()}` }, { status: filtered.status });
      }

      // ...and, finally, kick-off the download unless explicitly asked not to do so.
      if (!data.paused) {
         const formData = new FormData();
         formData.append("hashes", torrent.metadata.hash!);
         url = `${backendUrl}/api/v2/torrents/start`;
         const started = await fetch(url, { body: formData, method: "POST" });

         if (!started.ok) throw new Error(`Failed to start torrent ${torrent.name}: ${await started.text()}`);
      }

      return NextResponse.json({ hash: torrent.metadata.hash }, { status: 200 });
   } catch (e) {
      const failed = `Failed on ${url}`;
      console.error(`${failed}:`, e);
      return NextResponse.json({ error: e, message: failed }, { status: 500 });
   }
}
