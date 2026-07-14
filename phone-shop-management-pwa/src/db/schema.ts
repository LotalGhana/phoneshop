import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  uuid,
  boolean,
  index,
} from "drizzle-orm/pg-core";

export const shops = pgTable("shops", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull().default("Ghana"),
  phone: text("phone"),
  joinCode: text("join_code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    // admin = super admin (all shops), shop_admin = owner of a shop,
    // worker = sales clerk, repairer = handles spare parts
    role: text("role").notNull().default("worker"),
    shopId: uuid("shop_id").references(() => shops.id, { onDelete: "cascade" }),
    securityQuestion: text("security_question"),
    securityAnswerHash: text("security_answer_hash"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    shopIdx: index("users_shop_idx").on(t.shopId),
    roleIdx: index("users_role_idx").on(t.role),
  })
);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  shopId: uuid("shop_id").references(() => shops.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const phones = pgTable(
  "phones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    shopId: uuid("shop_id")
      .references(() => shops.id, { onDelete: "cascade" })
      .notNull(),
    brand: text("brand").notNull(),
    model: text("model").notNull(),
    type: text("type").notNull().default("Smartphone"), // Smartphone, Feature, Tablet, etc
    color: text("color"),
    storage: text("storage"), // e.g. 128GB
    ram: text("ram"), // e.g. 8GB
    imei: text("imei"),
    serial: text("serial"),
    costPrice: numeric("cost_price").notNull().default("0"),
    sellingPrice: numeric("selling_price").notNull().default("0"),
    stock: integer("stock").notNull().default(0),
    imageUrl: text("image_url"),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    shopIdx: index("phones_shop_idx").on(t.shopId),
    catIdx: index("phones_cat_idx").on(t.categoryId),
  })
);

export const spareParts = pgTable(
  "spare_parts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .references(() => shops.id, { onDelete: "cascade" })
      .notNull(),
    partName: text("part_name").notNull(), // e.g. Screen, Battery
    compatibleModels: text("compatible_models"), // comma separated models
    sku: text("sku"),
    quantity: integer("quantity").notNull().default(0),
    costPrice: numeric("cost_price").notNull().default("0"),
    sellingPrice: numeric("selling_price").notNull().default("0"),
    imageUrl: text("image_url"),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    shopIdx: index("spare_parts_shop_idx").on(t.shopId),
  })
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id")
      .references(() => shops.id, { onDelete: "cascade" })
      .notNull(),
    phoneId: uuid("phone_id").references(() => phones.id, {
      onDelete: "set null",
    }),
    partId: uuid("part_id").references(() => spareParts.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: numeric("unit_price").notNull().default("0"),
    total: numeric("total").notNull().default("0"),
    paymentMethod: text("payment_method").default("Cash"), // Cash, MoMo, Card
    note: text("note"),
    soldAt: timestamp("sold_at").defaultNow().notNull(),
  },
  (t) => ({
    shopIdx: index("sales_shop_idx").on(t.shopId),
    soldAtIdx: index("sales_sold_at_idx").on(t.soldAt),
  })
);

export const restocks = pgTable("restocks", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id")
    .references(() => shops.id, { onDelete: "cascade" })
    .notNull(),
  itemId: uuid("item_id").notNull(), // phone_id or part_id
  itemType: text("item_type").notNull(), // 'phone' or 'part'
  quantity: integer("quantity").notNull(),
  unitCost: numeric("unit_cost").notNull().default("0"),
  note: text("note"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopId: uuid("shop_id").references(() => shops.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
