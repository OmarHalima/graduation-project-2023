/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_SERVICE_KEY: string
  readonly VITE_APP_URL: string
  readonly VITE_FLOWISE_CHATFLOW_ID: string
  readonly VITE_FLOWISE_API_HOST: string
  readonly VITE_GEMINI_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
