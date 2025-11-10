import { NextRequest, NextResponse } from "next/server";
import type { Torrent } from "@/lib/types";

export async function POST(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const backendUrl = searchParams.get("backendUrl");

   if (!backendUrl) {
      return NextResponse.json({ error: "Missing backendUrl parameter" }, { status: 400 });
   }

   const body = await request.json();
   const torrent = body.torrent as Torrent;
   const data = body.data;
   const formData = new FormData();

   formData.append("urls", torrent.hash);
   formData.append("savepath", data.savePath);
   formData.append("paused", String(true)); // HARD-CODED: always start paused since we need the torrent files that can only be obtained with the calculated hash
   formData.append("sequential", String(data.sequential));
   formData.append("firstLastPiecePrio", String(data.firstLastPiecePrio));
   formData.append("root_folder", data.contentLayout === "Original" ? "unset" : String(data.contentLayout === "Subfolder"));

   let url = `${backendUrl}/api/v2/torrents/add`;
   let fetched: Response;
   const failed = async (response: Response) => {
      const errorBody = await response.text();
      console.error(`Failed to add torrent ${torrent.name}:`, errorBody);
      return NextResponse.json({ error: `Failed to POST to ${url}: ${errorBody}` }, { status: response.status });
   };

   try {
      // Add the torrent...
      fetched = await fetch(url, {
         body: formData,
         method: "POST",
      });

      if (!fetched.ok) return await failed(fetched);

      // ...and get its hash.
      url = `${backendUrl}/api/v2/torrents/info?limit=1&sort=added_on&reverse=true`;
      fetched = await fetch(url);

      if (!fetched.ok) return await failed(fetched);

      return new NextResponse(fetched.body, { status: 200 });
   } catch (e) {
      console.error(`Failed to add torrent ${torrent.name}:`, e);
      return NextResponse.json({ error: `Failed to POST to ${url}` }, { status: 502 });
   }
}
