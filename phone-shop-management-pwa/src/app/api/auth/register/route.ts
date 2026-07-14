import { db } from "@/db";
import { users, shops, sessions } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  createSession,
  jsonResponse,
  randomToken,
} from "@/lib/auth";
import crypto from "crypto";

function genJoinCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      username,
      email,
      password,
      fullName,
      role = "shop_admin",
      shopName,
      shopLocation,
      joinCode,
      securityQuestion,
      securityAnswer,
    } = body || {};

    if (!username || !email || !password || !fullName) {
      return jsonResponse(
        { error: "username, email, password and fullName are required" },
        400
      );
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)))
      .limit(1);
    if (existing.length) {
      return jsonResponse(
        { error: "Username or email already exists" },
        400
      );
    }

    const passwordHash = await hashPassword(password);
    const securityAnswerHash = securityAnswer
      ? await hashPassword(securityAnswer.trim().toLowerCase())
      : null;

    let shopId: string | null = null;

    // If joining an existing shop via joinCode
    if (joinCode) {
      const [shop] = await db
        .select()
        .from(shops)
        .where(eq(shops.joinCode, joinCode.toUpperCase()))
        .limit(1);
      if (!shop) {
        return jsonResponse({ error: "Invalid join code" }, 400);
      }
      shopId = shop.id;
    } else if (role === "shop_admin" || role === "admin") {
      // Create a new shop
      const name = shopName || `${fullName}'s Shop`;
      const location = shopLocation || "Ghana";
      const code = genJoinCode();
      const [shop] = await db
        .insert(shops)
        .values({
          name,
          location,
          joinCode: code,
        })
        .returning();
      shopId = shop.id;
    }

    const [user] = await db
      .insert(users)
      .values({
        username,
        email,
        passwordHash,
        fullName,
        role,
        shopId,
        securityQuestion: securityQuestion || null,
        securityAnswerHash,
      })
      .returning();

    const token = await createSession(user.id);

    return jsonResponse({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        shopId: user.shopId,
      },
    });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || "Server error" }, 500);
  }
}
