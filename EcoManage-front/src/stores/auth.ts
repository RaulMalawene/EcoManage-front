import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

/**
 * Utilizador autenticado, tal como devolvido pela API Laravel
 * (ex.: rota /api/me ou incluído na resposta de /api/login).
 */
export interface Utilizador {
  id: number
  nome: string
  email: string
}

const CHAVE_TOKEN = 'ecomanage.token'

export const useAuthStore = defineStore('auth', () => {
  // --- estado ---------------------------------------------------------
  const token = ref<string | null>(localStorage.getItem(CHAVE_TOKEN))
  const utilizador = ref<Utilizador | null>(null)
  const aCarregar = ref(false)
  const erro = ref<string | null>(null)

  // --- derivados -------------------------------------------------------
  const autenticado = computed(() => !!token.value)

  // --- ações -------------------------------------------------------------
  /**
   * Autentica contra a API Laravel (Sanctum - token de API).
   * TODO: ajustar o endpoint/URL base quando a API estiver ligada
   * (ex.: import.meta.env.VITE_API_URL + '/api/login').
   */
  async function entrar(email: string, palavraPasse: string) {
    aCarregar.value = true
    erro.value = null

    try {
      const resposta = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email, password: palavraPasse }),
      })

      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null)
        throw new Error(dados?.message ?? 'Credenciais inválidas. Verifica o email e a palavra-passe.')
      }

      const dados = await resposta.json()

      token.value = dados.token
      utilizador.value = dados.user ?? null
      localStorage.setItem(CHAVE_TOKEN, dados.token)

      return true
    } catch (e) {
      erro.value = e instanceof Error ? e.message : 'Não foi possível iniciar sessão. Tenta novamente.'
      return false
    } finally {
      aCarregar.value = false
    }
  }

  function sair() {
    token.value = null
    utilizador.value = null
    localStorage.removeItem(CHAVE_TOKEN)
  }

  function limparErro() {
    erro.value = null
  }

  return { token, utilizador, aCarregar, erro, autenticado, entrar, sair, limparErro }
})
