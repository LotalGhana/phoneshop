import { db } from "@/db";
import { phones, spareParts, restocks } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
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
    const conds: any[] = [];
    const sid = shopEquals(user);
    if (sid) conds.push(eq(restocks.shopId, sid));
    let q = db.select().from(restocks);
    if (conds.length) q = q.where(conds[0]) as any;
    q = q.orderBy(desc(restocks.createdAt)) as any;
    const rows = await (q as any);
    return jsonResponse({ restocks: rows });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

// POST /api/restock -> increase stock of phone or part
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin", "worker", "repairer"]);
    const body = await request.json();
    const { itemType, itemId, quantity, unitCost = "0", note } = body || {};
    if (!itemType || !itemId || !quantity) {
      return jsonResponse(
        { error: "itemType, itemId and quantity required" },
        400
      );
    }
    const qty = Number(quantity) || 0;
    if (qty <= 0) return jsonResponse({ error: "quantity must be > 0" }, 400);

    let shopId: string | null = null;
    let label = "";
    if (itemType === "phone") {
      const conds: any[] = [eq(phones.id, itemId)];
      const sid = shopEquals(user);
      if (sid) conds.push(eq(phones.shopId, sid));
      const [phone] = await db
        .select()
        .from(phones)
        .where(and(...conds))
        .limit(1);
      if (!phone) return jsonResponse({ error: "Phone not found" }, 404);
      shopId = phone.shopId;
      label = `${phone.brand} ${phone.model}`;
      await db
        .update(phones)
        .set({ stock: phone.stock + qty, updatedAt: new Date() })
        .where(eq(phones.id, itemId));
    } else if (itemType === "part") {
      const conds: any[] = [eq(spareParts.id, itemId)];
      const sid = shopEquals(user);
      if (sid) conds.push(eq(spareParts.shopId, sid));
      const [part] = await db
        .select()
        .from(spareParts)
        .where(and(...conds))
        .limit(1);
      if (!part) return jsonResponse({ error: "Part not found" }, 404);
      shopId = part.shopId;
      label = part.partName;
      await db
        .update(spareParts)
        .set({ quantity: part.quantity + qty, updatedAt: new Date() })
        .where(eq(spareParts.id, itemId));
    } else {
      return jsonResponse({ error: "itemType must be 'phone' or 'part'" }, 400);
    }

    const [r] = await db
      .insert(restocks)
      .values({
        shopId: shopId!,
        itemId,
        itemType,
        quantity: qty,
        unitCost: String(unitCost),
        note: note || null,
        userId: user.id,
      })
      .returning();
    await logActivity({
      shopId,
      userId: user.id,
      action: "restock",
      details: `${label} +${qty}`,
    });
    return jsonResponse({ restock: r }, 201);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}
