import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUserRole } from "@/lib/auth";

function getUsers(): Map<string, string> {
  const raw = process.env.AUTH_USERS || "";
  const users = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const [user, pass] = pair.split(":");
    if (user && pass) users.set(user.trim().toLowerCase(), pass.trim());
  }
  return users;
}

function makeToken(username: string): string {
  const secret = process.env.AUTH_SECRET || "fallback-secret";
  const payload = `${username}:${Date.now()}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64");
}

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const users = getUsers();
  const storedPass = users.get(username.trim().toLowerCase());

  if (!storedPass || storedPass !== password) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const token = makeToken(username.trim().toLowerCase());

  const normalizedUser = username.trim().toLowerCase();
  const role = getUserRole(normalizedUser);
  const res = NextResponse.json({ ok: true, username: normalizedUser, redirect: role?.default || "/" });
  res.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  res.cookies.set("auth_user", username.trim().toLowerCase(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
