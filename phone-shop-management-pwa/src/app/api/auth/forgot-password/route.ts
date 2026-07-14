import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { jsonResponse, randomToken } from "@/lib/auth";

// POST /api/auth/forgot-password
// Body: { email, securityAnswer }
// If email matches a user and (optionally) securityAnswer matches, returns a reset token.
// In a production app this would be emailed; here we return it for demo/testing.
export async function POST(request: Request) {
  try {
    const { email, securityAnswer } = (await request.json()) || {};
    if (!email) {
      return jsonResponse({ error: "email required" }, 400);
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) {
      // Don't reveal whether email exists
      return jsonResponse({
        ok: true,
        message:
          "If the account exists, a reset token has been prepared. Provide the security answer if you set one.",
      });
    }
    // Verify security answer if the user set one
    if (user.securityAnswerHash) {
      if (!securityAnswer) {
        return jsonResponse(
          {
            error: "security_answer_required",
            securityQuestion: user.securityQuestion,
          },
          400
        );
      }
      const bcrypt = await import("bcryptjs");
      const ok = await bcrypt.compare(
        String(securityAnswer).trim().toLowerCase(),
        user.securityAnswerHash
      );
      if (!ok) {
        return jsonResponse({ error: "Incorrect security answer" }, 400);
      }
    }
    const token = randomToken(24);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });
    return jsonResponse({
      ok: true,
      // In a real deployment, this would be emailed. For demo, return it.
      resetToken: token,
      securityQuestion: user.securityQuestion || null,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || "Server error" }, 500);
  }
}
