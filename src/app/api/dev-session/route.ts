import { NextResponse } from "next/server";
import { getUser, getUserCapabilities } from "@/lib/auth";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ user: null });
  }

  const capabilities = await getUserCapabilities(user);

  return NextResponse.json({
    user: {
      email: user.email,
    },
    capabilities: {
      buyer: capabilities.buyer,
      seller: capabilities.seller,
      admin: capabilities.admin,
    },
  });
}
