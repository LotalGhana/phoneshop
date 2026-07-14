import { db } from "@/db";
import {
  phones,
  spareParts,
  sales,
  categories,
  activityLogs,
} from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { requireAuth, jsonResponse, shopEquals } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const sid = shopEquals(user);

    const shopFilter = sid ? eq(phones.shopId, sid) : undefined;
    const shopFilterParts = sid ? eq(spareParts.shopId, sid) : undefined;
    const shopFilterSales = sid ? eq(sales.shopId, sid) : undefined;
    const shopFilterCats = sid ? eq(categories.shopId, sid) : undefined;
    const shopFilterLogs = sid ? eq(activityLogs.shopId, sid) : undefined;

    // Total phones (units in stock)
    const [phoneStock] = await db
      .select({
        totalUnits: sql<number>`COALESCE(SUM(${phones.stock}),0)`,
        totalModels: sql<number>`COUNT(*)`,
        totalValue: sql<number>`COALESCE(SUM(${phones.stock} * CAST(${phones.sellingPrice} AS NUMERIC)),0)`,
      })
      .from(phones)
      .where(shopFilter as any);

    // Low stock phones (stock < 3)
    const lowStockPhones = await db
      .select({
        id: phones.id,
        brand: phones.brand,
        model: phones.model,
        stock: phones.stock,
      })
      .from(phones)
      .where(
        sid
          ? and(shopFilter, sql`${phones.stock} < 3`)
          : sql`${phones.stock} < 3`
      )
      .limit(10);

    // Total spare parts
    const [partStock] = await db
      .select({
        totalUnits: sql<number>`COALESCE(SUM(${spareParts.quantity}),0)`,
        totalTypes: sql<number>`COUNT(*)`,
      })
      .from(spareParts)
      .where(shopFilterParts as any);

    // Sales stats
    const [salesAgg] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(CAST(${sales.total} AS NUMERIC)),0)`,
        totalTransactions: sql<number>`COUNT(*)`,
      })
      .from(sales)
      .where(shopFilterSales as any);

    // Sales per day for last 30 days
    const salesByDay = await db
      .select({
        day: sql<string>`DATE(${sales.soldAt})::text`,
        total: sql<number>`COALESCE(SUM(CAST(${sales.total} AS NUMERIC)),0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(sales)
      .where(
        sid
          ? and(
              shopFilterSales,
              sql`${sales.soldAt} >= NOW() - INTERVAL '30 days'`
            )
          : sql`${sales.soldAt} >= NOW() - INTERVAL '30 days'`
      )
      .groupBy(sql`DATE(${sales.soldAt})`)
      .orderBy(sql`DATE(${sales.soldAt}) ASC`);

    // Phones by category (for pie chart)
    const phonesByCategory = await db
      .select({
        categoryName: sql<string>`COALESCE(${categories.name}, 'Uncategorized')`,
        count: sql<number>`COUNT(*)`,
        units: sql<number>`COALESCE(SUM(${phones.stock}),0)`,
      })
      .from(phones)
      .leftJoin(categories, eq(phones.categoryId, categories.id))
      .where(shopFilter as any)
      .groupBy(sql`COALESCE(${categories.name}, 'Uncategorized')`);

    // Top selling phones (by sales count)
    const topPhones = await db
      .select({
        label: sql<string>`COALESCE(${phones.brand} || ' ' || ${phones.model}, 'Unknown')`,
        totalQty: sql<number>`COALESCE(SUM(${sales.quantity}),0)`,
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${sales.total} AS NUMERIC)),0)`,
      })
      .from(sales)
      .leftJoin(phones, eq(sales.phoneId, phones.id))
      .where(
        sid
          ? and(shopFilterSales, sql`${sales.phoneId} IS NOT NULL`)
          : sql`${sales.phoneId} IS NOT NULL`
      )
      .groupBy(sql`${phones.brand}`, sql`${phones.model}`)
      .orderBy(sql`COALESCE(SUM(${sales.quantity}),0) DESC`)
      .limit(8);

    // Payment methods distribution
    const paymentMethods = await db
      .select({
        method: sql<string>`COALESCE(${sales.paymentMethod}, 'Other')`,
        total: sql<number>`COALESCE(SUM(CAST(${sales.total} AS NUMERIC)),0)`,
      })
      .from(sales)
      .where(shopFilterSales as any)
      .groupBy(sql`COALESCE(${sales.paymentMethod}, 'Other')`);

    // Recent activity
    const recentActivity = await db
      .select()
      .from(activityLogs)
      .where(shopFilterLogs as any)
      .orderBy(sql`${activityLogs.createdAt} DESC`)
      .limit(20);

    return jsonResponse({
      phones: {
        totalUnits: Number(phoneStock?.totalUnits || 0),
        totalModels: Number(phoneStock?.totalModels || 0),
        totalValue: Number(phoneStock?.totalValue || 0),
      },
      parts: {
        totalUnits: Number(partStock?.totalUnits || 0),
        totalTypes: Number(partStock?.totalTypes || 0),
      },
      sales: {
        totalRevenue: Number(salesAgg?.totalSales || 0),
        totalTransactions: Number(salesAgg?.totalTransactions || 0),
      },
      lowStockPhones,
      salesByDay,
      phonesByCategory,
      topPhones,
      paymentMethods,
      recentActivity,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return jsonResponse({ error: e?.message || "Server error" }, 500);
  }
}
