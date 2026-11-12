type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type ServerEnv = PublicEnv & {
  supabaseServiceRoleKey: string;
  geminiApiKey: string;
  groqApiKey: string;
  usdaApiKey: string;
  resendApiKey: string;
};

function requireValue(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function requirePublicValue(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getPublicEnv(): PublicEnv {
  const supabaseUrl = requirePublicValue("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = requirePublicValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error("Environment variable NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

export function getServerEnv(): ServerEnv {
  return {
    ...getPublicEnv(),
    supabaseServiceRoleKey: requireValue("SUPABASE_SERVICE_ROLE_KEY"),
    geminiApiKey: requireValue("GEMINI_API_KEY"),
    groqApiKey: requireValue("GROQ_API_KEY"),
    usdaApiKey: requireValue("USDA_API_KEY"),
    resendApiKey: requireValue("RESEND_API_KEY"),
  };
}

export function getUsdaApiKey(): string {
  return requireValue("USDA_API_KEY");
}

export function getGeminiApiKey(): string {
  return requireValue("GEMINI_API_KEY");
}

export function getGroqApiKey(): string {
  return requireValue("GROQ_API_KEY");
}

export function getResendApiKey(): string {
  return requireValue("RESEND_API_KEY");
}