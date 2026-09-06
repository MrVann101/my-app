import { z } from "zod";
import { apiErrorResponse, parseJson } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  token: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  try {
    const { email, token } = await parseJson(request, verifyOtpSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

    if (error) {
      return Response.json(
        { error: { code: "otp_verification_failed", message: "That code is invalid or expired." } },
        { status: 400 },
      );
    }

    return Response.json({ userId: data.user?.id ?? null, verified: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
