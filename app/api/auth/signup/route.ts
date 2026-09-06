import { z } from "zod";
import { apiErrorResponse, parseJson } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const signupSchema = z.object({
  username: z.string().trim().min(2).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  try {
    const { username, email, password } = await parseJson(request, signupSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (error) {
      return Response.json(
        { error: { code: "signup_failed", message: error.message } },
        { status: 400 },
      );
    }

    return Response.json({
      userId: data.user?.id ?? null,
      verificationRequired: !data.user?.email_confirmed_at,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
