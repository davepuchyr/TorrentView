import { NextRequest, NextResponse } from "next/server";
import type { Torrent } from "@/lib/types";

export async function POST(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const backendUrl = searchParams.get("backendUrl");

   if (!backendUrl) return NextResponse.json({ error: "Missing backendUrl parameter" }, { status: 400 });

   const body = await request.json();
   const torrent = body.torrent as Torrent;
   const data = body.data;
   const formData = new FormData();

   formData.append("urls", torrent.hash);
   formData.append("savepath", data.savePath);
   formData.append("stopped", String(true)); // NOTE: Always start stopped so that files can be cherry-picked.
   formData.append("sequentialDownload", String(data.sequential));
   formData.append("firstLastPiecePrio", String(data.firstLastPiecePrio));
   formData.append("contentLayout", data.contentLayout);

   let url = `${backendUrl}/api/v2/torrents/add`;
   try {
      const fetched = await fetch(url, {
         body: formData,
         method: "POST",
      });

      if (!fetched.ok) {
         const errorBody = await fetched.text();
         console.error(`Failed to add torrent ${torrent.name}:`, errorBody);
         return NextResponse.json({ error: `Failed to POST to ${url}: ${errorBody}` }, { status: fetched.status });
      }

      return new NextResponse(fetched.body, { status: 200 });
   } catch (e) {
      console.error(`Failed to add torrent ${torrent.name}:`, e);
      return NextResponse.json({ error: `Failed to POST to ${url}` }, { status: 502 });
   }
}
