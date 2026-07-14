import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword, jsonResponse } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { token, newPassword } = (await request.json()) || {};
    if (!token || !newPassword) {
      return jsonResponse({ error: "token and newPassword required" }, 400);
    }
    if (newPassword.length < 6) {
      return jsonResponse(
        { error: "Password must be at least 6 characters" },
        400
      );
    }
    const [reset] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(eq(passwordResetTokens.token, token), eq(passwordResetTokens.used, false))
      )
      .limit(1);
    if (!reset) {
      return jsonResponse({ error: "Invalid or used reset token" }, 400);
    }
    if (reset.expiresAt.getTime() < Date.now()) {
      return jsonResponse({ error: "Reset token expired" }, 400);
    }
    const passwordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, reset.userId));
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, reset.id));
    return jsonResponse({ ok: true });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || "Server error" }, 500);
  }
}
