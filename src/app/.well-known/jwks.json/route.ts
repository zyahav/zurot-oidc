import { NextResponse } from "next/server";
import { getJWKS } from "@/lib/jwt";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function GET() {
  const jwks = await getJWKS();

  return NextResponse.json(jwks, {
    headers: {
      ...corsHeaders,
      "Cache-Control": "public, max-age=86400",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
