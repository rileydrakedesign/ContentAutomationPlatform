import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/api/openapi-spec";

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "https://app.agentsforx.com",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
