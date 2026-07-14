import { db } from "@/db";
import { users, shops } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  requireAuth,
  jsonResponse,
  requireRoles,
  hashPassword,
} from "@/lib/auth";

// Admin: list all users
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin"]);

    let q = db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        shopId: users.shopId,
        active: users.active,
        createdAt: users.createdAt,
        shopName: shops.name,
      })
      .from(users)
      .leftJoin(shops, eq(users.shopId, shops.id));

    if (user.role === "shop_admin") {
      q = q.where(eq(users.shopId, user.shopId!)) as any;
    }
    q = q.orderBy(desc(users.createdAt)) as any;
    const rows = await (q as any);
    return jsonResponse({ users: rows });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

// Admin: create a user
export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin"]);
    const body = await request.json();
    const {
      username,
      email,
      password,
      fullName,
      role = "worker",
      shopId,
    } = body || {};
    if (!username || !email || !password || !fullName) {
      return jsonResponse({ error: "missing fields" }, 400);
    }
    const targetShopId =
      user.role === "admin" ? shopId : user.shopId;
    if (!targetShopId) {
      return jsonResponse({ error: "shopId required" }, 400);
    }
    // shop_admin cannot create other admins
    if (user.role === "shop_admin" && (role === "admin" || role === "shop_admin")) {
      return jsonResponse({ error: "Cannot create admin users" }, 403);
    }
    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        username,
        email,
        passwordHash,
        fullName,
        role,
        shopId: targetShopId,
      })
      .returning();
    return jsonResponse({ user: newUser }, 201);
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

// Admin: update role / active status
export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin"]);
    const body = await request.json();
    const { id, role, active } = body || {};
    if (!id) return jsonResponse({ error: "id required" }, 400);
    const updates: any = {};
    if (role !== undefined) {
      if (
        user.role === "shop_admin" &&
        (role === "admin" || role === "shop_admin")
      ) {
        return jsonResponse({ error: "Cannot promote to admin" }, 403);
      }
      updates.role = role;
    }
    if (active !== undefined) updates.active = active;
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    if (!updated) return jsonResponse({ error: "Not found" }, 404);
    return jsonResponse({ user: updated });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}

// Admin: delete user
export async function DELETE(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin"]);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ error: "id required" }, 400);
    if (id === user.id) {
      return jsonResponse({ error: "Cannot delete yourself" }, 400);
    }
    await db.delete(users).where(eq(users.id, id));
    return jsonResponse({ ok: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}
