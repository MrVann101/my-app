import { z } from "zod";
import { apiErrorResponse, parseJson } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const resendOtpSchema = z.object({ email: z.string().trim().email() });

export async function POST(request: Request) {
  try {
    const { email } = await parseJson(request, resendOtpSchema);
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });

    if (error) {
      return Response.json(
        { error: { code: "otp_resend_failed", message: "Unable to resend the code right now." } },
        { status: 429 },
      );
    }

    return Response.json({ sent: true, cooldownSeconds: 60 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
