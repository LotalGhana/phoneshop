import { db } from "@/db";
import { users, shops, categories, phones, spareParts } from "@/db/schema";
import { sql } from "drizzle-orm";
import { hashPassword, jsonResponse } from "@/lib/auth";
import crypto from "crypto";

// GET /api/seed - creates a demo admin account + shop if none exist
// Idempotent; safe to call multiple times.
export async function GET(request: Request) {
  try {
    const [existingAdmin] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`${users.role} = 'admin'`)
      .limit(1);

    if (existingAdmin) {
      return jsonResponse({
        seeded: false,
        message: "Admin user already exists",
        credentials: null,
      });
    }

    // Create demo shop
    const joinCode = crypto.randomBytes(3).toString("hex").toUpperCase();
    const [shop] = await db
      .insert(shops)
      .values({
        name: "Accra Mobile Hub",
        location: "Accra, Ghana",
        phone: "+233 20 000 0000",
        joinCode,
      })
      .returning();

    // Create admin user
    const password = "admin123";
    const passwordHash = await hashPassword(password);
    const [admin] = await db
      .insert(users)
      .values({
        username: "admin",
        email: "admin@phoneshop.gh",
        passwordHash,
        fullName: "System Administrator",
        role: "admin",
        shopId: shop.id,
        securityQuestion: "Your demo shop name",
        securityAnswerHash: await hashPassword("accra mobile hub"),
      })
      .returning();

    // Seed categories
    const cats = ["Smartphones", "Feature Phones", "Tablets", "Accessories"];
    const catIds: string[] = [];
    for (const name of cats) {
      const [c] = await db
        .insert(categories)
        .values({ name, shopId: shop.id })
        .returning();
      catIds.push(c.id);
    }

    // Seed sample phones
    const samplePhones = [
      { brand: "Samsung", model: "Galaxy S24 Ultra", type: "Smartphone", color: "Titanium Black", storage: "256GB", ram: "12GB", costPrice: "8500", sellingPrice: "11500", stock: 6, categoryId: catIds[0] },
      { brand: "Apple", model: "iPhone 15 Pro", type: "Smartphone", color: "Natural Titanium", storage: "128GB", ram: "8GB", costPrice: "9000", sellingPrice: "12500", stock: 4, categoryId: catIds[0] },
      { brand: "Tecno", model: "Camon 20 Premier", type: "Smartphone", color: "Dark Welkin", storage: "256GB", ram: "8GB", costPrice: "2000", sellingPrice: "2800", stock: 10, categoryId: catIds[0] },
      { brand: "Infinix", model: "Note 30 Pro", type: "Smartphone", color: "Magic Black", storage: "256GB", ram: "8GB", costPrice: "1400", sellingPrice: "2000", stock: 12, categoryId: catIds[0] },
      { brand: "Xiaomi", model: "Redmi Note 13", type: "Smartphone", color: "Midnight Black", storage: "128GB", ram: "6GB", costPrice: "1300", sellingPrice: "1800", stock: 8, categoryId: catIds[0] },
      { brand: "Nokia", model: "105", type: "Feature Phone", color: "Black", storage: "4MB", ram: "4MB", costPrice: "80", sellingPrice: "150", stock: 25, categoryId: catIds[1] },
      { brand: "Itel", model: "A70", type: "Smartphone", color: "Azure Blue", storage: "128GB", ram: "4GB", costPrice: "700", sellingPrice: "1100", stock: 15, categoryId: catIds[0] },
      { brand: "Samsung", model: "Galaxy Tab A9", type: "Tablet", color: "Silver", storage: "64GB", ram: "4GB", costPrice: "1500", sellingPrice: "2200", stock: 5, categoryId: catIds[2] },
    ];
    for (const p of samplePhones) {
      await db.insert(phones).values({ ...p, shopId: shop.id });
    }

    // Seed spare parts
    const sampleParts = [
      { partName: "LCD Screen - Samsung S24", compatibleModels: "Samsung Galaxy S24", sku: "SCR-S24", quantity: 8, costPrice: "800", sellingPrice: "1200" },
      { partName: "Battery - iPhone 15", compatibleModels: "iPhone 15, 15 Pro", sku: "BAT-IP15", quantity: 12, costPrice: "350", sellingPrice: "550" },
      { partName: "Charging Port - Tecno", compatibleModels: "Tecno Camon 20, Spark 10", sku: "CHG-TEC", quantity: 20, costPrice: "50", sellingPrice: "120" },
      { partName: "Back Cover - Infinix", compatibleModels: "Infinix Note 30", sku: "COV-INF", quantity: 15, costPrice: "60", sellingPrice: "150" },
      { partName: "Ear Speaker - Universal", compatibleModels: "Universal", sku: "SPK-UNI", quantity: 30, costPrice: "20", sellingPrice: "60" },
    ];
    for (const p of sampleParts) {
      await db.insert(spareParts).values({ ...p, shopId: shop.id });
    }

    return jsonResponse({
      seeded: true,
      shop: { name: shop.name, joinCode: shop.joinCode },
      credentials: {
        username: "admin",
        password,
        role: "admin",
      },
      message:
        "Demo admin account created. Use the credentials above to login.",
    });
  } catch (e: any) {
    return jsonResponse({ error: e?.message || "Seed failed" }, 500);
  }
}
