import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  requireAuth,
  jsonResponse,
  shopEquals,
  requireRoles,
} from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const conds: any[] = [];
    const sid = shopEquals(user);
    if (sid) conds.push(eq(categories.shopId, sid));
    let q = db.select().from(categories);
    if (conds.length) q = q.where(eq(categories.shopId, sid!)) as any;
    q = q.orderBy(desc(categories.createdAt)) as any;
    const rows = await (q as any);
    return jsonResponse({ categories: rows });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin"]);
    const body = await request.json();
    const { name, description, imageUrl } = body || {};
    if (!name) return jsonResponse({ error: "name required" }, 400);
    const shopId =
      user.role === "admin" ? body.shopId || user.shopId : user.shopId;
    if (!shopId) return jsonResponse({ error: "shopId required" }, 400);
    const [cat] = await db
      .insert(categories)
      .values({
        shopId,
        name,
        description: description || null,
        imageUrl: imageUrl || null,
      })
      .returning();
    return jsonResponse({ category: cat }, 201);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin"]);
    const body = await request.json();
    const { id, name, description, imageUrl } = body || {};
    if (!id) return jsonResponse({ error: "id required" }, 400);
    const conds: any[] = [eq(categories.id, id)];
    const sid = shopEquals(user);
    if (sid) conds.push(eq(categories.shopId, sid));
    const [cat] = await db
      .update(categories)
      .set({
        name: name ?? undefined,
        description: description ?? null,
        imageUrl: imageUrl ?? null,
      } as any)
      // @ts-ignore
      .where(conds.length === 1 ? conds[0] : undefined)
      .returning();
    return jsonResponse({ category: cat });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin"]);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ error: "id required" }, 400);
    const conds: any[] = [eq(categories.id, id)];
    const sid = shopEquals(user);
    if (sid) conds.push(eq(categories.shopId, sid));
    await db.delete(categories).where(conds.length === 1 ? conds[0] : undefined);
    return jsonResponse({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}
