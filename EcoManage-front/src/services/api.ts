import axios from 'axios'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

/**
 * Cliente HTTP único para toda a aplicação.
 * Base URL: VITE_API_URL (ex.: http://localhost:8000) + "/api".
 * Configura-se em .env / .env.local (ver .env.example).
 */
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api`,
  headers: {
    Accept: 'application/json',
  },
})

// Anexa sempre o token guardado (Sanctum) a cada pedido.
api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`
  }
  return config
})

// Sessão expirada/token inválido -> limpa e manda para o login.
api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    if (erro.response?.status === 401) {
      const auth = useAuthStore()
      auth.sair()
      if (router.currentRoute.value.name !== 'login') {
        router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
      }
    }
    return Promise.reject(erro)
  },
)

export default api
