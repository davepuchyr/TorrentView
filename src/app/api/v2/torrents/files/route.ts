import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
   const { searchParams } = new URL(request.url);
   const backendUrl = searchParams.get("backendUrl");
   const hash = searchParams.get("hash");

   if (!backendUrl) {
      return NextResponse.json({ error: "Missing backendUrl parameter" }, { status: 400 });
   }
   if (!hash) {
      return NextResponse.json({ error: "Missing hash parameter" }, { status: 400 });
   }

   const url = `${backendUrl}/api/v2/torrents/files?hash=${hash}`;
   let fetched: Response;

   try {
      fetched = await fetch(url, {
         headers: {
            "accept": "*/*",
         },
      });
      const data = await fetched.json();
      return NextResponse.json(data, { status: fetched.status, headers: fetched.headers });
   } catch (e) {
      console.error(`Failed to get files for torrent ${hash}:`, e);
      return NextResponse.json({ error: `Failed to GET from ${url}` }, { status: 502 });
   }
}
