import { db } from "@/db";
import { spareParts } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import {
  requireAuth,
  jsonResponse,
  shopEquals,
  requireRoles,
  logActivity,
} from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const q = url.searchParams.get("q");

    let query = db.select().from(spareParts);
    const conds: any[] = [];
    const sid = shopEquals(user);
    if (sid) conds.push(eq(spareParts.shopId, sid));
    if (q) {
      conds.push(
        sql`(
          ${spareParts.partName} ILIKE ${"%" + q + "%"} OR
          ${spareParts.compatibleModels} ILIKE ${"%" + q + "%"} OR
          ${spareParts.sku} ILIKE ${"%" + q + "%"}
        )`
      );
    }
    if (conds.length) query = query.where(sql.join(conds, sql` AND `)) as any;
    query = query.orderBy(desc(spareParts.createdAt)) as any;
    const rows = await (query as any);
    return jsonResponse({ parts: rows });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin", "repairer"]);
    if (!user.shopId && user.role !== "admin") {
      return jsonResponse({ error: "No shop assigned" }, 400);
    }
    const body = await request.json();
    const {
      partName,
      compatibleModels,
      sku,
      quantity = 0,
      costPrice = "0",
      sellingPrice = "0",
      imageUrl,
      description,
    } = body || {};
    if (!partName) return jsonResponse({ error: "partName required" }, 400);
    const shopId =
      user.role === "admin" ? body.shopId || user.shopId : user.shopId!;
    if (!shopId) return jsonResponse({ error: "shopId required" }, 400);
    const [part] = await db
      .insert(spareParts)
      .values({
        shopId,
        partName,
        compatibleModels: compatibleModels || null,
        sku: sku || null,
        quantity: Number(quantity) || 0,
        costPrice: String(costPrice),
        sellingPrice: String(sellingPrice),
        imageUrl: imageUrl || null,
        description: description || null,
      })
      .returning();
    await logActivity({
      shopId,
      userId: user.id,
      action: "part.added",
      details: partName,
    });
    return jsonResponse({ part }, 201);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin", "repairer"]);
    const body = await request.json();
    const { id } = body || {};
    if (!id) return jsonResponse({ error: "id required" }, 400);
    // find with shop scope
    const conds: any[] = [eq(spareParts.id, id)];
    const sid = shopEquals(user);
    if (sid) conds.push(eq(spareParts.shopId, sid));
    const [existing] = await db
      .select()
      .from(spareParts)
      .where(sql.join(conds, sql` AND `))
      .limit(1);
    if (!existing) return jsonResponse({ error: "Not found" }, 404);
    const updates: any = { updatedAt: new Date() };
    for (const f of [
      "partName",
      "compatibleModels",
      "sku",
      "imageUrl",
      "description",
    ]) {
      if (f in body) updates[f] = body[f];
    }
    if ("quantity" in body) updates.quantity = Number(body.quantity) || 0;
    if ("costPrice" in body) updates.costPrice = String(body.costPrice);
    if ("sellingPrice" in body) updates.sellingPrice = String(body.sellingPrice);
    const [updated] = await db
      .update(spareParts)
      .set(updates)
      .where(eq(spareParts.id, id))
      .returning();
    await logActivity({
      shopId: existing.shopId,
      userId: user.id,
      action: "part.updated",
      details: updated.partName,
    });
    return jsonResponse({ part: updated });
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
    const conds: any[] = [eq(spareParts.id, id)];
    const sid = shopEquals(user);
    if (sid) conds.push(eq(spareParts.shopId, sid));
    const [existing] = await db
      .select()
      .from(spareParts)
      .where(sql.join(conds, sql` AND `))
      .limit(1);
    if (!existing) return jsonResponse({ error: "Not found" }, 404);
    await db.delete(spareParts).where(eq(spareParts.id, id));
    await logActivity({
      shopId: existing.shopId,
      userId: user.id,
      action: "part.deleted",
      details: existing.partName,
    });
    return jsonResponse({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}
