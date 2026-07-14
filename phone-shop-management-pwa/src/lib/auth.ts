import { db } from "@/db";
import { users, sessions, shops } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const SESSION_TTL_HOURS = 24 * 7; // 7 days

export type Role = "admin" | "shop_admin" | "worker" | "repairer";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  shopId: string | null;
  shopName?: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken(48);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
  await db.insert(sessions).values({ userId, token, expiresAt });
  return token;
}

export async function resolveSession(
  token: string | null | undefined
): Promise<AuthUser | null> {
  if (!token) return null;
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user || !user.active) return null;

  let shopName: string | null = null;
  if (user.shopId) {
    const [shop] = await db
      .select({ name: shops.name })
      .from(shops)
      .where(eq(shops.id, user.shopId))
      .limit(1);
    shopName = shop?.name ?? null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role as Role,
    shopId: user.shopId,
    shopName,
  };
}

export function extractToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  // also allow x-token header for convenience
  const x = request.headers.get("x-token");
  if (x) return x;
  return null;
}

export async function requireAuth(
  request: Request
): Promise<AuthUser> {
  const user = await resolveSession(extractToken(request));
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export function requireRoles(user: AuthUser, roles: Role[]): void {
  if (!roles.includes(user.role)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function shopScope(user: AuthUser): { shopId: string } | {} {
  // Admin sees all shops. Everyone else only sees their shop.
  if (user.role === "admin") return {};
  if (!user.shopId) {
    throw new Response(JSON.stringify({ error: "No shop assigned" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return { shopId: user.shopId };
}

export function shopEquals(
  user: AuthUser
) {
  // returns a drizzle condition (only if not admin)
  if (user.role === "admin") return undefined;
  return user.shopId;
}

export async function logActivity(params: {
  shopId?: string | null;
  userId?: string | null;
  action: string;
  details?: string;
}) {
  try {
    await db.insert(activityLogs).values({
      shopId: params.shopId ?? null,
      userId: params.userId ?? null,
      action: params.action,
      details: params.details ?? null,
    });
  } catch (e) {
    console.error("logActivity failed", e);
  }
}

// re-export
import { activityLogs } from "@/db/schema";
