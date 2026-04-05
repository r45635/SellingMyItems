import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const role = cookieStore.get("demo_role")?.value;

  if (role !== "guest" && role !== "seller") {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      email: `${role}@local.test`,
      role,
      isDemo: true,
    },
  });
}
