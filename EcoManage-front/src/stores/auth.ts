import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'
import api from '@/services/api'

/** Utilizador autenticado, tal como devolvido pela API (GET /me, POST /login). */
export interface Utilizador {
  id: number
  nome: string
  username: string
  email: string | null
  perfil: string
  perfil_rotulo: string
  activo: boolean
}

/** Corpo de erro devolvido pela API em falhas de validação/autenticação. */
interface ErroApi {
  sucesso: false
  mensagem: string
  erros: Record<string, string[]> | null
}

const CHAVE_TOKEN = 'ecomanage.token'

/** Extrai a mensagem mais específica de um erro da API (campo > geral). */
function extrairMensagemErro(e: unknown, fallback: string): string {
  if (axios.isAxiosError<ErroApi>(e)) {
    const dados = e.response?.data
    const primeiroErroDeCampo = dados?.erros && Object.values(dados.erros).flat()[0]
    return primeiroErroDeCampo || dados?.mensagem || fallback
  }
  return e instanceof Error ? e.message : fallback
}

export const useAuthStore = defineStore('auth', () => {
  // --- estado ---------------------------------------------------------
  const token = ref<string | null>(localStorage.getItem(CHAVE_TOKEN))
  const utilizador = ref<Utilizador | null>(null)
  const aCarregar = ref(false)
  const erro = ref<string | null>(null)

  // --- derivados -------------------------------------------------------
  const autenticado = computed(() => !!token.value)

  // --- ações -------------------------------------------------------------
  /** Autentica contra a API (POST /login -> { token, utilizador }). */
  async function entrar(username: string, palavraPasse: string) {
    aCarregar.value = true
    erro.value = null

    try {
      const resposta = await api.post('/login', { username, password: palavraPasse })

      token.value = resposta.data.token
      utilizador.value = resposta.data.utilizador

      if (!token.value) throw new Error('Resposta de login sem token.')

      localStorage.setItem(CHAVE_TOKEN, token.value)
      return true
    } catch (e) {
      erro.value = extrairMensagemErro(e, 'Não foi possível iniciar sessão. Tenta novamente.')
      return false
    } finally {
      aCarregar.value = false
    }
  }

  /**
   * Recupera o utilizador autenticado a partir do token guardado
   * (chamado no arranque da app, para repor o nome/perfil após um refresh).
   */
  async function carregarUtilizador() {
    if (!token.value || utilizador.value) return
    try {
      const resposta = await api.get('/me')
      utilizador.value = resposta.data.utilizador
    } catch {
      // O interceptor da API já trata o 401 (limpa sessão e manda para o login).
    }
  }

  async function sair() {
    try {
      if (token.value) await api.post('/logout')
    } catch {
      // Mesmo que a API falhe a invalidar o token, a sessão local é sempre limpa.
    } finally {
      token.value = null
      utilizador.value = null
      localStorage.removeItem(CHAVE_TOKEN)
    }
  }

  function limparErro() {
    erro.value = null
  }

  /**
   * Atualiza os dados de perfil (nome/email) exibidos na app.
   *
   * TODO(backend): o backend ainda não tem nenhuma rota para gravar isto
   * (confirmado por `php artisan route:list` — só existem `POST /login`,
   * `GET /me` e `POST /logout`; não há `PUT/PATCH /me` nem `/users/{id}`).
   * Por isso esta função só atualiza o estado local (e por consequência o
   * que aparece no topo da app) — nada é persistido no servidor, e um
   * refresh de página repõe os dados originais vindos de `GET /me`.
   * Assim que o endpoint existir, troca o bloco abaixo por uma chamada real:
   *
   *   const resposta = await api.put('/me', dados)
   *   utilizador.value = resposta.data.utilizador
   */
  async function atualizarPerfil(dados: { nome: string; email: string | null }) {
    if (!utilizador.value) return false
    utilizador.value = { ...utilizador.value, nome: dados.nome, email: dados.email }
    return true
  }

  return {
    token,
    utilizador,
    aCarregar,
    erro,
    autenticado,
    entrar,
    carregarUtilizador,
    sair,
    limparErro,
    atualizarPerfil,
  }
})
