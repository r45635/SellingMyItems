import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const role = username === "guest" || username === "seller" ? username : null;
  if (!role || password !== username) {
    return NextResponse.json(
      { error: "Invalid demo credentials" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set("demo_role", role, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
