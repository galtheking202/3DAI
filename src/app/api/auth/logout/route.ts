import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await destroySession();
  return NextResponse.redirect(new URL("/", env.APP_URL), 303);
}
