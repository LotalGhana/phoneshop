import { db } from "@/db";
import { phones } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireAuth,
  jsonResponse,
  shopEquals,
  requireRoles,
  logActivity,
} from "@/lib/auth";

async function findPhone(id: string, user: any) {
  const conds: any[] = [eq(phones.id, id)];
  const sid = shopEquals(user);
  if (sid) conds.push(eq(phones.shopId, sid));
  const [phone] = await db
    .select()
    .from(phones)
    .where(and(...conds))
    .limit(1);
  return phone;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const phone = await findPhone(id, user);
    if (!phone) return jsonResponse({ error: "Not found" }, 404);
    return jsonResponse({ phone });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin", "worker"]);
    const { id } = await params;
    const phone = await findPhone(id, user);
    if (!phone) return jsonResponse({ error: "Not found" }, 404);

    const body = await request.json();
    const updates: any = { updatedAt: new Date() };
    const fields = [
      "brand",
      "model",
      "type",
      "color",
      "storage",
      "ram",
      "imei",
      "serial",
      "imageUrl",
      "description",
      "categoryId",
    ];
    for (const f of fields) {
      if (f in body) updates[f] = body[f];
    }
    if ("costPrice" in body) updates.costPrice = String(body.costPrice);
    if ("sellingPrice" in body) updates.sellingPrice = String(body.sellingPrice);
    if ("stock" in body) updates.stock = Number(body.stock) || 0;

    const [updated] = await db
      .update(phones)
      .set(updates)
      .where(eq(phones.id, id))
      .returning();
    await logActivity({
      shopId: phone.shopId,
      userId: user.id,
      action: "phone.updated",
      details: `${updated.brand} ${updated.model}`,
    });
    return jsonResponse({ phone: updated });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin"]);
    const { id } = await params;
    const phone = await findPhone(id, user);
    if (!phone) return jsonResponse({ error: "Not found" }, 404);
    await db.delete(phones).where(eq(phones.id, id));
    await logActivity({
      shopId: phone.shopId,
      userId: user.id,
      action: "phone.deleted",
      details: `${phone.brand} ${phone.model}`,
    });
    return jsonResponse({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}
