/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base da API Laravel, sem barra final (ex.: http://localhost:8000). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
