import { db } from "@/db";
import { shops } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, jsonResponse, requireRoles } from "@/lib/auth";
import crypto from "crypto";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin"]);
    const rows = await db.select().from(shops).orderBy(desc(shops.createdAt));
    return jsonResponse({ shops: rows });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin"]);
    const body = await request.json();
    const { name, location = "Ghana", phone } = body || {};
    if (!name) return jsonResponse({ error: "name required" }, 400);
    const joinCode = crypto.randomBytes(3).toString("hex").toUpperCase();
    const [shop] = await db
      .insert(shops)
      .values({ name, location, phone: phone || null, joinCode })
      .returning();
    return jsonResponse({ shop }, 201);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}
