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

function requireUrl(name: string): string {
  const value = requireValue(name);

  try {
    new URL(value);
  } catch {
    throw new Error(`Environment variable ${name} must be a valid URL`);
  }

  return value;
}

export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl: requireUrl("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: requireValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
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