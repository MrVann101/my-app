import { z } from "zod";
import { apiErrorResponse, parseJson } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(72),
});

export async function POST(request: Request) {
  try {
    const credentials = await parseJson(request, loginSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error) {
      return Response.json(
        { error: { code: "login_failed", message: "Email or password is incorrect." } },
        { status: 401 },
      );
    }

    return Response.json({ userId: data.user.id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
