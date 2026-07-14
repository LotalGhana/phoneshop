import { db } from "@/db";
import { phones, categories } from "@/db/schema";
import { eq, desc, ilike, sql } from "drizzle-orm";
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
    const categoryId = url.searchParams.get("categoryId");

    let query = db
      .select({
        id: phones.id,
        brand: phones.brand,
        model: phones.model,
        type: phones.type,
        color: phones.color,
        storage: phones.storage,
        ram: phones.ram,
        imei: phones.imei,
        serial: phones.serial,
        costPrice: phones.costPrice,
        sellingPrice: phones.sellingPrice,
        stock: phones.stock,
        imageUrl: phones.imageUrl,
        description: phones.description,
        categoryId: phones.categoryId,
        createdAt: phones.createdAt,
        shopId: phones.shopId,
        categoryName: categories.name,
      })
      .from(phones)
      .leftJoin(categories, eq(phones.categoryId, categories.id));

    const conditions: any[] = [];
    const sid = shopEquals(user);
    if (sid) conditions.push(eq(phones.shopId, sid));
    if (categoryId) conditions.push(eq(phones.categoryId, categoryId));
    if (q) {
      conditions.push(
        sql`(
          ${phones.brand} ILIKE ${"%" + q + "%"} OR
          ${phones.model} ILIKE ${"%" + q + "%"} OR
          ${phones.type} ILIKE ${"%" + q + "%"} OR
          ${phones.imei} ILIKE ${"%" + q + "%"}
        )`
      );
    }
    if (conditions.length) {
      query = query.where(sql.join(conditions, sql` AND `)) as any;
    }
    query = query.orderBy(desc(phones.createdAt)) as any;

    const rows = await (query as any);
    return jsonResponse({ phones: rows });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin", "worker"]);
    if (!user.shopId && user.role !== "admin") {
      return jsonResponse({ error: "No shop assigned" }, 400);
    }
    const body = await request.json();
    const {
      brand,
      model,
      type = "Smartphone",
      color,
      storage,
      ram,
      imei,
      serial,
      costPrice = "0",
      sellingPrice = "0",
      stock = 0,
      imageUrl,
      description,
      categoryId,
    } = body || {};
    if (!brand || !model) {
      return jsonResponse({ error: "brand and model required" }, 400);
    }
    // Admin needs to specify shopId; non-admin auto uses their shop
    const shopId =
      user.role === "admin"
        ? body.shopId || user.shopId
        : user.shopId!;
    if (!shopId) {
      return jsonResponse({ error: "shopId required for admin" }, 400);
    }
    const [phone] = await db
      .insert(phones)
      .values({
        shopId,
        categoryId: categoryId || null,
        brand,
        model,
        type,
        color: color || null,
        storage: storage || null,
        ram: ram || null,
        imei: imei || null,
        serial: serial || null,
        costPrice: String(costPrice),
        sellingPrice: String(sellingPrice),
        stock: Number(stock) || 0,
        imageUrl: imageUrl || null,
        description: description || null,
      })
      .returning();
    await logActivity({
      shopId,
      userId: user.id,
      action: "phone.added",
      details: `${phone.brand} ${phone.model}`,
    });
    return jsonResponse({ phone }, 201);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

function sqlJoin(conditions: any[]) {
  return sql.join(conditions, sql` AND `);
}
