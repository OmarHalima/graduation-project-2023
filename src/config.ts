export const config = {
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
  gemini: {
    apiKey: import.meta.env.VITE_GEMINI_API_KEY,
  },
  app: {
    url: import.meta.env.VITE_APP_URL,
    env: import.meta.env.MODE,
  },
  email: {
    from: import.meta.env.VITE_EMAIL_FROM,
    host: import.meta.env.VITE_SMTP_HOST,
    port: Number(import.meta.env.VITE_SMTP_PORT),
    user: import.meta.env.VITE_SMTP_USER,
    pass: import.meta.env.VITE_SMTP_PASS,
  },
}; 