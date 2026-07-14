import { db } from "@/db";
import { users, sessions, shops } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  verifyPassword,
  createSession,
  jsonResponse,
  extractToken,
  resolveSession,
} from "@/lib/auth";

// POST /api/auth  -> login
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body || {};
    if (!username || !password) {
      return jsonResponse({ error: "username and password required" }, 400);
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (!user) {
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return jsonResponse({ error: "Invalid credentials" }, 401);
    }
    if (!user.active) {
      return jsonResponse({ error: "Account is disabled" }, 403);
    }
    const token = await createSession(user.id);
    let shopName: string | null = null;
    if (user.shopId) {
      const [shop] = await db
        .select({ name: shops.name })
        .from(shops)
        .where(eq(shops.id, user.shopId))
        .limit(1);
      shopName = shop?.name ?? null;
    }
    return jsonResponse({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        shopId: user.shopId,
        shopName,
      },
    });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || "Server error" }, 500);
  }
}

// GET /api/auth  -> current user
export async function GET(request: Request) {
  const user = await resolveSession(extractToken(request));
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
  return jsonResponse({ user });
}

// DELETE /api/auth -> logout
export async function DELETE(request: Request) {
  const token = extractToken(request);
  if (token) {
    try {
      await db.delete(sessions).where(eq(sessions.token, token));
    } catch {}
  }
  return jsonResponse({ ok: true });
}
