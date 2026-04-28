import { NextResponse } from "next/server";
import { getUser, getUserCapabilities } from "@/lib/auth";

export async function GET() {
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
