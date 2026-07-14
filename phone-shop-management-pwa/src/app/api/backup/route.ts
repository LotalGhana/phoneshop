import { db } from "@/db";
import {
  shops,
  users,
  categories,
  phones,
  spareParts,
  sales,
  restocks,
  activityLogs,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth, jsonResponse, requireRoles } from "@/lib/auth";

// GET /api/backup - download full backup JSON
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin"]);
    const scope = user.role === "admin" ? null : user.shopId!;

    const backup: any = {
      version: 1,
      generatedAt: new Date().toISOString(),
      scope: scope ? { shopId: scope } : "all",
    };

    // Shops
    if (scope) {
      backup.shops = await db.select().from(shops).where(eq(shops.id, scope));
    } else {
      backup.shops = await db.select().from(shops);
    }
    // Users (without password hashes for safety; they're still hashed but we include them)
    const allUsers = scope
      ? await db.select().from(users).where(eq(users.shopId, scope))
      : await db.select().from(users);
    backup.users = allUsers;

    if (scope) {
      backup.categories = await db
        .select()
        .from(categories)
        .where(eq(categories.shopId, scope));
      backup.phones = await db
        .select()
        .from(phones)
        .where(eq(phones.shopId, scope));
      backup.spareParts = await db
        .select()
        .from(spareParts)
        .where(eq(spareParts.shopId, scope));
      backup.sales = await db
        .select()
        .from(sales)
        .where(eq(sales.shopId, scope));
      backup.restocks = await db
        .select()
        .from(restocks)
        .where(eq(restocks.shopId, scope));
      backup.activityLogs = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.shopId, scope));
    } else {
      backup.categories = await db.select().from(categories);
      backup.phones = await db.select().from(phones);
      backup.spareParts = await db.select().from(spareParts);
      backup.sales = await db.select().from(sales);
      backup.restocks = await db.select().from(restocks);
      backup.activityLogs = await db.select().from(activityLogs);
    }

    const body = JSON.stringify(backup, null, 2);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="phone-shop-backup-${Date.now()}.json"`,
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

// POST /api/restore - restore from JSON backup
// Body: { data: <backup object>, mode: 'merge' | 'replace' }
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin"]);
    const body = await request.json();
    const { data, mode = "merge" } = body || {};
    if (!data || typeof data !== "object") {
      return jsonResponse({ error: "data required" }, 400);
    }

    const scope = user.role === "admin" ? null : user.shopId!;

    // If mode = replace, delete current data in scope
    if (mode === "replace") {
      if (scope) {
        await db.delete(activityLogs).where(eq(activityLogs.shopId, scope));
        await db.delete(restocks).where(eq(restocks.shopId, scope));
        await db.delete(sales).where(eq(sales.shopId, scope));
        await db.delete(spareParts).where(eq(spareParts.shopId, scope));
        await db.delete(phones).where(eq(phones.shopId, scope));
        await db.delete(categories).where(eq(categories.shopId, scope));
        await db.delete(users).where(eq(users.shopId, scope));
      } else {
        await db.delete(activityLogs);
        await db.delete(restocks);
        await db.delete(sales);
        await db.delete(spareParts);
        await db.delete(phones);
        await db.delete(categories);
        await db.delete(users);
        await db.delete(shops);
      }
    }

    const stats: any = {};

    // Insert shops (admin only)
    if (Array.isArray(data.shops) && !scope) {
      for (const s of data.shops) {
        try {
          await db.insert(shops).values({
            id: s.id,
            name: s.name,
            location: s.location,
            phone: s.phone,
            joinCode: s.joinCode,
            createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          });
        } catch (e: any) {
          // duplicate key in merge mode - skip
        }
      }
      stats.shops = data.shops.length;
    }

    // Users
    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        try {
          await db.insert(users).values({
            id: u.id,
            username: u.username,
            email: u.email,
            passwordHash: u.passwordHash,
            fullName: u.fullName,
            role: u.role,
            shopId: u.shopId,
            securityQuestion: u.securityQuestion,
            securityAnswerHash: u.securityAnswerHash,
            active: u.active ?? true,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          });
        } catch {}
      }
      stats.users = data.users.length;
    }

    const insertMany = async (table: any, rows: any[], transform: (r: any) => any) => {
      if (!Array.isArray(rows)) return 0;
      let n = 0;
      for (const r of rows) {
        try {
          await db.insert(table).values(transform(r));
          n++;
        } catch {}
      }
      return n;
    };

    stats.categories = await insertMany(categories, data.categories || [], (c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      imageUrl: c.imageUrl,
      shopId: c.shopId,
      createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
    }));

    stats.phones = await insertMany(phones, data.phones || [], (p: any) => ({
      id: p.id,
      categoryId: p.categoryId,
      shopId: p.shopId,
      brand: p.brand,
      model: p.model,
      type: p.type,
      color: p.color,
      storage: p.storage,
      ram: p.ram,
      imei: p.imei,
      serial: p.serial,
      costPrice: String(p.costPrice ?? 0),
      sellingPrice: String(p.sellingPrice ?? 0),
      stock: p.stock ?? 0,
      imageUrl: p.imageUrl,
      description: p.description,
      createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    }));

    stats.spareParts = await insertMany(spareParts, data.spareParts || [], (p: any) => ({
      id: p.id,
      shopId: p.shopId,
      partName: p.partName,
      compatibleModels: p.compatibleModels,
      sku: p.sku,
      quantity: p.quantity ?? 0,
      costPrice: String(p.costPrice ?? 0),
      sellingPrice: String(p.sellingPrice ?? 0),
      imageUrl: p.imageUrl,
      description: p.description,
      createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    }));

    stats.sales = await insertMany(sales, data.sales || [], (s: any) => ({
      id: s.id,
      shopId: s.shopId,
      phoneId: s.phoneId,
      partId: s.partId,
      userId: s.userId,
      customerName: s.customerName,
      customerPhone: s.customerPhone,
      quantity: s.quantity ?? 1,
      unitPrice: String(s.unitPrice ?? 0),
      total: String(s.total ?? 0),
      paymentMethod: s.paymentMethod,
      note: s.note,
      soldAt: s.soldAt ? new Date(s.soldAt) : new Date(),
    }));

    stats.restocks = await insertMany(restocks, data.restocks || [], (r: any) => ({
      id: r.id,
      shopId: r.shopId,
      itemId: r.itemId,
      itemType: r.itemType,
      quantity: r.quantity,
      unitCost: String(r.unitCost ?? 0),
      note: r.note,
      userId: r.userId,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
    }));

    stats.activityLogs = await insertMany(
      activityLogs,
      data.activityLogs || [],
      (a: any) => ({
        id: a.id,
        shopId: a.shopId,
        userId: a.userId,
        action: a.action,
        details: a.details,
        createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
      })
    );

    return jsonResponse({ ok: true, mode, restored: stats });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}
