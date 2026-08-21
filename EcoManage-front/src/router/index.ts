import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/**
 * Rotas da aplicação. Cada rota pode marcar:
 *   meta.requerAuth  -> só entra quem tem sessão
 *   meta.soVisitante -> só para quem NÃO tem sessão (ex.: o login)
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { soVisitante: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { requerAuth: true },
    },
    // (Próximas telas — pessoas, materiais, compras... — entram aqui
    //  com meta.requerAuth.)
  ],
})

/**
 * Guarda global: corre antes de cada navegação.
 *  - Sem sessão a tentar entrar numa rota protegida -> vai para o login.
 *  - Com sessão a tentar abrir o login -> vai para o dashboard.
 */
router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requerAuth && !auth.autenticado) {
    return { name: 'login' }
  }

  if (to.meta.soVisitante && auth.autenticado) {
    return { name: 'dashboard' }
  }
})

export default router
