import { db } from "@/db";
import { sales, phones, spareParts } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
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
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const conds: any[] = [];
    const sid = shopEquals(user);
    if (sid) conds.push(eq(sales.shopId, sid));
    if (from) conds.push(sql`${sales.soldAt} >= ${new Date(from).toISOString()}`);
    if (to) conds.push(sql`${sales.soldAt} <= ${new Date(to).toISOString()}`);

    let q = db.select().from(sales);
    if (conds.length) q = q.where(sql.join(conds, sql` AND `)) as any;
    q = q.orderBy(desc(sales.soldAt)) as any;
    const rows = await (q as any);
    return jsonResponse({ sales: rows });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

// POST /api/sales -> record a sale (and decrement stock)
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin", "worker", "repairer"]);
    const body = await request.json();
    const {
      phoneId,
      partId,
      quantity = 1,
      customerName,
      customerPhone,
      paymentMethod = "Cash",
      note,
      unitPrice,
    } = body || {};

    if (!phoneId && !partId) {
      return jsonResponse({ error: "phoneId or partId required" }, 400);
    }
    const qty = Number(quantity) || 1;

    let shopId: string | null = null;
    let price = unitPrice != null ? String(unitPrice) : "0";
    let itemLabel = "";

    if (phoneId) {
      const conds: any[] = [eq(phones.id, phoneId)];
      const sid = shopEquals(user);
      if (sid) conds.push(eq(phones.shopId, sid));
      const [phone] = await db
        .select()
        .from(phones)
        .where(and(...conds))
        .limit(1);
      if (!phone) return jsonResponse({ error: "Phone not found" }, 404);
      if (phone.stock < qty) {
        return jsonResponse({ error: "Not enough stock" }, 400);
      }
      price = unitPrice != null ? String(unitPrice) : phone.sellingPrice;
      shopId = phone.shopId;
      itemLabel = `${phone.brand} ${phone.model}`;
      // decrement stock
      await db
        .update(phones)
        .set({ stock: phone.stock - qty, updatedAt: new Date() })
        .where(eq(phones.id, phoneId));
    } else if (partId) {
      const conds: any[] = [eq(spareParts.id, partId)];
      const sid = shopEquals(user);
      if (sid) conds.push(eq(spareParts.shopId, sid));
      const [part] = await db
        .select()
        .from(spareParts)
        .where(and(...conds))
        .limit(1);
      if (!part) return jsonResponse({ error: "Part not found" }, 404);
      if (part.quantity < qty) {
        return jsonResponse({ error: "Not enough stock" }, 400);
      }
      price = unitPrice != null ? String(unitPrice) : part.sellingPrice;
      shopId = part.shopId;
      itemLabel = part.partName;
      await db
        .update(spareParts)
        .set({ quantity: part.quantity - qty, updatedAt: new Date() })
        .where(eq(spareParts.id, partId));
    }

    const unitNum = Number(price) || 0;
    const total = (unitNum * qty).toFixed(2);

    const [sale] = await db
      .insert(sales)
      .values({
        shopId: shopId!,
        phoneId: phoneId || null,
        partId: partId || null,
        userId: user.id,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        quantity: qty,
        unitPrice: price,
        total,
        paymentMethod,
        note: note || null,
      })
      .returning();
    await logActivity({
      shopId,
      userId: user.id,
      action: "sale.recorded",
      details: `${itemLabel} x${qty} = GHS ${total}`,
    });
    return jsonResponse({ sale }, 201);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}
