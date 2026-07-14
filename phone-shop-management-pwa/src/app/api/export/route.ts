import { db } from "@/db";
import { phones, spareParts, sales, categories } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth, jsonResponse, requireRoles, shopEquals } from "@/lib/auth";

function toCSV(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(","));
  }
  return lines.join("\n");
}

// GET /api/export?type=phones|parts|sales
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    requireRoles(user, ["admin", "shop_admin", "worker", "repairer"]);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "phones";
    const sid = shopEquals(user);

    let rows: any[] = [];
    let filename = "";
    if (type === "phones") {
      const q = db.select({
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
        createdAt: phones.createdAt,
        categoryName: categories.name,
      })
        .from(phones)
        .leftJoin(categories, eq(phones.categoryId, categories.id));
      rows = sid ? await (q.where(eq(phones.shopId, sid)) as any) : await (q as any);
      filename = "phones.csv";
    } else if (type === "parts") {
      const q = db.select().from(spareParts);
      rows = sid ? await (q.where(eq(spareParts.shopId, sid)) as any) : await (q as any);
      filename = "spare-parts.csv";
    } else if (type === "sales") {
      const q = db.select().from(sales);
      rows = sid ? await (q.where(eq(sales.shopId, sid)) as any) : await (q as any);
      filename = "sales.csv";
    } else {
      return jsonResponse({ error: "Invalid type" }, 400);
    }

    const csv = toCSV(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}
