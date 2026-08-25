<script setup lang="ts">
import { ref, onMounted, computed, reactive, watch } from 'vue'
import axios from 'axios'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/services/api'
import { ICONES } from '@/utils/icones'
import { mt } from '@/utils/formato'
import type { Paginacao } from '@/types/api'

interface Pessoa {
  id: number
  nome: string
  tipo: 'cliente' | 'fornecedor' | 'devedor' | 'misto' | string
  tipo_rotulo: string
  telefone: string | null
  observacoes: string | null
  activo: boolean
  saldo_devedor?: number
}

const contactos = ref<Pessoa[]>([])
const paginacao = ref<Paginacao>({ pagina: 1, ultima_pagina: 1, total: 0 })
const aCarregar = ref(true)
const erro = ref('')

const pesquisa = ref('')
const filtroTipo = ref<'' | 'cliente' | 'fornecedor' | 'devedor'>('')
const paginaActual = ref(1)
const seleccionado = ref<Pessoa | null>(null)

async function carregar() {
  aCarregar.value = true
  erro.value = ''
  try {
    const { data } = await api.get('/pessoas', {
      params: {
        tipo: filtroTipo.value || undefined,
        pesquisa: pesquisa.value.trim() || undefined,
        com_saldo: 1,
        page: paginaActual.value,
      },
    })
    contactos.value = data.dados.itens || []
    paginacao.value = data.dados.paginacao || paginacao.value

    // Mantém a selecção se o contacto ainda estiver na lista (ex.: só mudou
    // de página de saldo); caso contrário selecciona o primeiro, ou nenhum.
    const primeiro = contactos.value[0]
    if (!primeiro) {
      seleccionado.value = null
    } else if (!contactos.value.some((c) => c.id === seleccionado.value?.id)) {
      seleccionar(primeiro)
    }
  } catch (e) {
    erro.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível carregar os contactos.'
  } finally {
    aCarregar.value = false
  }
}

onMounted(carregar)

// Pesquisa é no servidor (para funcionar bem com a paginação) — com um
// pequeno atraso, para não disparar um pedido a cada tecla.
let temporizadorPesquisa: ReturnType<typeof setTimeout> | undefined
watch(pesquisa, () => {
  clearTimeout(temporizadorPesquisa)
  temporizadorPesquisa = setTimeout(() => {
    paginaActual.value = 1
    carregar()
  }, 350)
})

function aplicarFiltro(tipo: '' | 'cliente' | 'fornecedor' | 'devedor') {
  filtroTipo.value = tipo
  paginaActual.value = 1
  carregar()
}

function irPara(p: number) {
  if (p >= 1 && p <= paginacao.value.ultima_pagina) {
    paginaActual.value = p
    carregar()
  }
}

// --- Cartões de resumo (contagens reais, independentes do filtro activo) --
const resumoContactos = ref({ total: 0, clientes: 0, fornecedores: 0, devedores: 0 })

async function carregarResumoContactos() {
  try {
    const [t, c, f, d] = await Promise.all([
      api.get('/pessoas', { params: { page: 1 } }),
      api.get('/pessoas', { params: { tipo: 'cliente', page: 1 } }),
      api.get('/pessoas', { params: { tipo: 'fornecedor', page: 1 } }),
      api.get('/pessoas', { params: { tipo: 'devedor', page: 1 } }),
    ])
    resumoContactos.value = {
      total: t.data.dados.paginacao?.total ?? 0,
      clientes: c.data.dados.paginacao?.total ?? 0,
      fornecedores: f.data.dados.paginacao?.total ?? 0,
      devedores: d.data.dados.paginacao?.total ?? 0,
    }
  } catch {
    // Cartões de resumo são só um extra informativo — não impedem o resto da tela.
  }
}

onMounted(carregarResumoContactos)

function iniciais(nome: string) {
  if (!nome) return '?'
  return nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

// Cor de identidade de cada tipo — a mesma ordem categórica usada em toda a app.
function classeTipo(tipo: string) {
  if (tipo === 'cliente') return 'teal'
  if (tipo === 'fornecedor') return 'ambar'
  if (tipo === 'devedor') return 'indigo'
  return 'neutro'
}

// --- Estatísticas do contacto seleccionado ---------------------------------
// Nada disto vem de um único endpoint "resumo de pessoa" (não existe) — é
// composto a partir do que já existe: GET /vendas e /compras já aceitam
// ?pessoa_id=, e o saldo em dívida vem de GET /pessoas?com_saldo=1.
interface StatsContacto {
  totalVendas: number | null
  totalCompras: number | null
  aCarregar: boolean
}
const statsSeleccionado = ref<StatsContacto>({ totalVendas: null, totalCompras: null, aCarregar: false })

async function carregarStatsContacto(c: Pessoa) {
  statsSeleccionado.value = { totalVendas: null, totalCompras: null, aCarregar: true }
  try {
    const pedidos: Promise<void>[] = []
    if (c.tipo === 'cliente' || c.tipo === 'misto') {
      pedidos.push(
        api.get('/vendas', { params: { pessoa_id: c.id } }).then((r) => {
          statsSeleccionado.value.totalVendas = r.data.dados.resumo?.receita_total ?? 0
        }),
      )
    }
    if (c.tipo === 'fornecedor' || c.tipo === 'misto') {
      pedidos.push(
        api.get('/compras', { params: { pessoa_id: c.id } }).then((r) => {
          const itens: { total: number }[] = r.data.dados.itens || []
          statsSeleccionado.value.totalCompras = itens.reduce((s, i) => s + Number(i.total || 0), 0)
        }),
      )
    }
    await Promise.all(pedidos)
  } catch {
    // Estatísticas são só um extra informativo — uma falha aqui não deve incomodar o utilizador.
  } finally {
    statsSeleccionado.value.aCarregar = false
  }
}

function seleccionar(c: Pessoa) {
  seleccionado.value = c
  carregarStatsContacto(c)
}

// --- Modal: novo / editar contacto -----------------------------------------
interface FormPessoa {
  nome: string
  tipo: 'cliente' | 'fornecedor' | 'devedor' | 'misto'
  telefone: string
  observacoes: string
  activo: boolean
}

function formVazio(pessoa?: Pessoa): FormPessoa {
  return {
    nome: pessoa?.nome ?? '',
    tipo: (pessoa?.tipo as FormPessoa['tipo']) ?? 'cliente',
    telefone: pessoa?.telefone ?? '',
    observacoes: pessoa?.observacoes ?? '',
    activo: pessoa?.activo ?? true,
  }
}

const modalAberto = ref(false)
const modoModal = ref<'novo' | 'editar'>('novo')
const form = reactive<FormPessoa>(formVazio())
const aGuardar = ref(false)
const erroForm = ref('')
const errosCampo = ref<Record<string, string[]>>({})

function abrirModalNovo() {
  modoModal.value = 'novo'
  Object.assign(form, formVazio())
  erroForm.value = ''
  errosCampo.value = {}
  modalAberto.value = true
}

function abrirModalEditar(c: Pessoa) {
  modoModal.value = 'editar'
  Object.assign(form, formVazio(c))
  erroForm.value = ''
  errosCampo.value = {}
  modalAberto.value = true
}

function fecharModal() {
  modalAberto.value = false
}

function erroCampo(campo: string) {
  return errosCampo.value[campo]?.[0] || ''
}

async function guardar() {
  erroForm.value = ''
  errosCampo.value = {}

  if (!form.nome.trim()) {
    erroForm.value = 'O nome é obrigatório.'
    return
  }

  aGuardar.value = true
  try {
    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      telefone: form.telefone.trim() || null,
      observacoes: form.observacoes.trim() || null,
      ...(modoModal.value === 'editar' ? { activo: form.activo } : {}),
    }

    if (modoModal.value === 'novo') {
      const { data } = await api.post('/pessoas', payload)
      fecharModal()
      paginaActual.value = 1
      await Promise.all([carregar(), carregarResumoContactos()])
      const novo = contactos.value.find((c) => c.id === data.dados?.id)
      if (novo) seleccionar(novo)
    } else if (seleccionado.value) {
      await api.put(`/pessoas/${seleccionado.value.id}`, payload)
      fecharModal()
      await carregar()
    }
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data?.erros) {
      errosCampo.value = e.response.data.erros
    }
    erroForm.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível guardar o contacto. Tenta novamente.'
  } finally {
    aGuardar.value = false
  }
}

// --- Desactivar contacto -----------------------------------------------
// DELETE /pessoas/{id} só desactiva (nunca apaga) — confirmação simples
// em duas etapas, sem diálogo nativo do browser.
const aConfirmarDesactivar = ref(false)
const aDesactivar = ref(false)

async function desactivarSeleccionado() {
  if (!seleccionado.value) return
  aDesactivar.value = true
  try {
    await api.delete(`/pessoas/${seleccionado.value.id}`)
    aConfirmarDesactivar.value = false
    seleccionado.value = null
    await Promise.all([carregar(), carregarResumoContactos()])
  } catch {
    erro.value = 'Não foi possível desactivar o contacto. Tenta novamente.'
  } finally {
    aDesactivar.value = false
  }
}
</script>

<template>
  <AppLayout>
    <template #caminho>Painel / Contactos</template>

    <!-- Cabeçalho -->
    <div class="cabecalho">
      <div>
        <h1>Lista de Contactos</h1>
        <p>Gira os seus clientes, fornecedores e parceiros de negócio.</p>
      </div>
      <div class="cabecalho__accoes">
        <button type="button" class="botao-fantasma" disabled title="Em breve">
          Exportar CSV
          <small>em breve</small>
        </button>
        <button type="button" class="botao-primario" @click="abrirModalNovo">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          Novo Contacto
        </button>
      </div>
    </div>

    <p v-if="erro" class="estado estado--erro" role="alert">{{ erro }}</p>

    <!-- Cartões -->
    <section class="cartoes">
      <div class="card-kpi card-kpi--verde">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Total de Contactos</span>
          <span class="card-kpi__icone card-kpi__icone--verde">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16.5 4.5a3.2 3.2 0 0 1 0 6.4M22 20c0-3-2-5.2-5-5.9" stroke-linecap="round" />
            </svg>
          </span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--verde">{{ resumoContactos.total }}</strong>
      </div>

      <div class="card-kpi card-kpi--teal">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Clientes</span>
          <span class="card-kpi__icone card-kpi__icone--teal" v-html="ICONES.vendas"></span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--teal">{{ resumoContactos.clientes }}</strong>
      </div>

      <div class="card-kpi card-kpi--ambar">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Fornecedores</span>
          <span class="card-kpi__icone card-kpi__icone--ambar" v-html="ICONES.compras"></span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--ambar">{{ resumoContactos.fornecedores }}</strong>
      </div>

      <div class="card-kpi card-kpi--indigo">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Devedores</span>
          <span class="card-kpi__icone card-kpi__icone--indigo" v-html="ICONES.emprestimos"></span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--indigo">{{ resumoContactos.devedores }}</strong>
      </div>
    </section>

    <div class="layout-contactos">
      <!-- Lista -->
      <section class="painel-bloco coluna-lista">
        <div class="barra-filtros">
          <div class="abas">
            <button type="button" class="aba" :class="{ 'aba--activa': filtroTipo === '' }" @click="aplicarFiltro('')">Todos</button>
            <button type="button" class="aba" :class="{ 'aba--activa': filtroTipo === 'cliente' }" @click="aplicarFiltro('cliente')">
              Clientes
            </button>
            <button type="button" class="aba" :class="{ 'aba--activa': filtroTipo === 'fornecedor' }" @click="aplicarFiltro('fornecedor')">
              Fornecedores
            </button>
            <button type="button" class="aba" :class="{ 'aba--activa': filtroTipo === 'devedor' }" @click="aplicarFiltro('devedor')">
              Devedores
            </button>
          </div>
          <input v-model="pesquisa" type="text" placeholder="Procurar nome…" class="filtro-pesquisa" />
        </div>

        <div v-if="aCarregar" class="estado">
          <span class="spinner" aria-hidden="true"></span>
          <p>A carregar contactos…</p>
        </div>
        <p v-else-if="contactos.length === 0" class="vazio">Nenhum contacto encontrado.</p>

        <template v-else>
          <div class="cartoes-grid">
            <button
              v-for="c in contactos"
              :key="c.id"
              type="button"
              class="contacto-card"
              :class="{ 'contacto-card--activo': seleccionado?.id === c.id }"
              @click="seleccionar(c)"
            >
              <div class="contacto-card__topo">
                <span class="avatar">{{ iniciais(c.nome) }}</span>
                <span class="tipo-badge" :class="`tipo-badge--${classeTipo(c.tipo)}`">{{ c.tipo_rotulo }}</span>
              </div>
              <div class="contacto-card__nome">{{ c.nome }}</div>
              <div class="contacto-card__info">
                <span v-if="c.telefone">{{ c.telefone }}</span>
                <span v-else class="sem-info">Sem telefone</span>
              </div>
              <div class="contacto-card__rodape">
                <span class="ponto" :class="{ 'ponto--activo': c.activo }"></span>
                {{ c.activo ? 'Ativo' : 'Inativo' }}
              </div>
            </button>

            <!-- Cartão de adicionar -->
            <button type="button" class="contacto-card contacto-card--adicionar" @click="abrirModalNovo">
              <div class="adicionar-icone">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                  <path
                    d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 .01M19 8v6M22 11h-6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <strong>Adicionar Contacto</strong>
              <small>Registe um novo parceiro</small>
            </button>
          </div>

          <div v-if="paginacao.total > 0" class="paginacao">
            <span class="paginacao__info">A mostrar {{ contactos.length }} de {{ paginacao.total }} contactos</span>
            <div class="paginacao__botoes">
              <button class="pg-btn" :disabled="paginaActual === 1" @click="irPara(paginaActual - 1)">Anterior</button>
              <button class="pg-btn" :disabled="paginaActual === paginacao.ultima_pagina" @click="irPara(paginaActual + 1)">
                Próximo
              </button>
            </div>
          </div>
        </template>
      </section>

      <!-- Painel de detalhe -->
      <aside v-if="seleccionado" class="coluna-detalhe">
        <div class="detalhe-card">
          <div class="detalhe-header"></div>
          <div class="detalhe-avatar">{{ iniciais(seleccionado.nome) }}</div>

          <div class="detalhe-corpo">
            <h2>{{ seleccionado.nome }}</h2>
            <span class="tipo-badge" :class="`tipo-badge--${classeTipo(seleccionado.tipo)}`">{{ seleccionado.tipo_rotulo }}</span>

            <!-- Estatísticas reais: saldo em dívida (sempre) + vendas/compras conforme o tipo -->
            <div class="valores-stats">
              <div class="valor-mini" :class="{ 'valor-mini--alerta': (seleccionado.saldo_devedor || 0) > 0 }">
                <span>Saldo em dívida</span>
                <strong>{{ mt(seleccionado.saldo_devedor) }}</strong>
              </div>
              <div v-if="seleccionado.tipo === 'cliente' || seleccionado.tipo === 'misto'" class="valor-mini">
                <span>Total em vendas</span>
                <strong v-if="statsSeleccionado.totalVendas !== null">{{ mt(statsSeleccionado.totalVendas) }}</strong>
                <span v-else class="valor-mini__carregar spinner" aria-hidden="true"></span>
              </div>
              <div v-if="seleccionado.tipo === 'fornecedor' || seleccionado.tipo === 'misto'" class="valor-mini">
                <span>Total em compras</span>
                <strong v-if="statsSeleccionado.totalCompras !== null">{{ mt(statsSeleccionado.totalCompras) }}</strong>
                <span v-else class="valor-mini__carregar spinner" aria-hidden="true"></span>
              </div>
            </div>

            <div class="detalhe-contactos">
              <div v-if="seleccionado.telefone" class="detalhe-linha">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path
                    d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"
                  />
                </svg>
                <div>
                  <small>Telemóvel</small>
                  <span>{{ seleccionado.telefone }}</span>
                </div>
              </div>

              <div v-if="seleccionado.observacoes" class="detalhe-linha">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
                </svg>
                <div>
                  <small>Observações</small>
                  <span>{{ seleccionado.observacoes }}</span>
                </div>
              </div>

              <p v-if="!seleccionado.telefone && !seleccionado.observacoes" class="vazio-mini">Sem mais informação registada.</p>
            </div>

            <div class="detalhe-accoes">
              <button type="button" class="botao-secundario" @click="abrirModalEditar(seleccionado)">Editar</button>
              <button
                v-if="!aConfirmarDesactivar"
                type="button"
                class="botao-secundario botao-secundario--perigo"
                @click="aConfirmarDesactivar = true"
              >
                Desativar
              </button>
            </div>

            <div v-if="aConfirmarDesactivar" class="confirmar-desactivar">
              <p>Desativar {{ seleccionado.nome }}? Deixa de aparecer na lista, mas o histórico mantém-se.</p>
              <div class="confirmar-desactivar__botoes">
                <button type="button" class="botao-secundario" :disabled="aDesactivar" @click="aConfirmarDesactivar = false">
                  Cancelar
                </button>
                <button type="button" class="botao-perigo" :disabled="aDesactivar" @click="desactivarSeleccionado">
                  <span v-if="aDesactivar" class="spinner spinner--claro" aria-hidden="true"></span>
                  {{ aDesactivar ? 'A desativar…' : 'Confirmar' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Modal: novo / editar contacto -->
    <Teleport to="body">
      <div v-if="modalAberto" class="modal-veu" @click.self="fecharModal">
        <div class="modal-cartao" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-contacto">
          <div class="modal-cabecalho">
            <h3 id="titulo-modal-contacto">{{ modoModal === 'novo' ? 'Novo Contacto' : 'Editar Contacto' }}</h3>
            <button type="button" class="modal-fechar" aria-label="Fechar" @click="fecharModal">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <form class="modal-form" @submit.prevent="guardar">
            <div class="campo-modal">
              <label for="nome-contacto">Nome</label>
              <input id="nome-contacto" v-model="form.nome" type="text" placeholder="ex.: António Mucavele" />
              <span v-if="erroCampo('nome')" class="campo-modal__erro">{{ erroCampo('nome') }}</span>
            </div>

            <div class="campo-modal">
              <label for="tipo-contacto">Tipo</label>
              <select id="tipo-contacto" v-model="form.tipo">
                <option value="cliente">Cliente (compra sucata a si)</option>
                <option value="fornecedor">Fornecedor (traz sucata)</option>
                <option value="devedor">Devedor</option>
                <option value="misto">Misto</option>
              </select>
              <span v-if="erroCampo('tipo')" class="campo-modal__erro">{{ erroCampo('tipo') }}</span>
            </div>

            <div class="campo-modal">
              <label for="telefone-contacto">Telefone <small>(opcional)</small></label>
              <input id="telefone-contacto" v-model="form.telefone" type="text" placeholder="+258 8x xxx xxxx" />
              <span v-if="erroCampo('telefone')" class="campo-modal__erro">{{ erroCampo('telefone') }}</span>
            </div>

            <div class="campo-modal">
              <label for="observacoes-contacto">Observações <small>(opcional)</small></label>
              <textarea id="observacoes-contacto" v-model="form.observacoes" rows="2" placeholder="Notas sobre este contacto…"></textarea>
            </div>

            <label v-if="modoModal === 'editar'" class="campo-checkbox">
              <input v-model="form.activo" type="checkbox" />
              Contacto activo
            </label>

            <p v-if="erroForm" class="modal-alerta" role="alert">{{ erroForm }}</p>

            <div class="modal-rodape">
              <button type="button" class="botao-secundario" :disabled="aGuardar" @click="fecharModal">Cancelar</button>
              <button type="submit" class="botao-primario" :disabled="aGuardar">
                <span v-if="aGuardar" class="spinner spinner--claro" aria-hidden="true"></span>
                {{ aGuardar ? 'A guardar…' : 'Guardar Contacto' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>

<style scoped>
.layout-contactos {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 18px;
}

.coluna-lista {
  align-self: start;
}
.barra-filtros {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}
.abas {
  display: flex;
  gap: 4px;
  background: var(--cor-fundo);
  padding: 4px;
  border-radius: 10px;
}
.aba {
  padding: 8px 14px;
  border: none;
  background: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--cor-texto-suave);
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.aba--activa {
  background: var(--cor-superficie);
  color: var(--cor-primaria-700);
  font-weight: 600;
  box-shadow: 0 1px 3px rgb(22 33 28 / 0.12);
}

.cartoes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}
.contacto-card {
  text-align: left;
  background: var(--cor-superficie);
  border: 1.5px solid var(--cor-neutra-fundo);
  border-radius: var(--raio);
  padding: 16px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.12s, box-shadow 0.12s, transform 0.12s;
}
.contacto-card:hover {
  border-color: var(--cor-primaria-200);
  transform: translateY(-1px);
}
.contacto-card--activo {
  border-color: var(--cor-primaria-500);
  box-shadow: var(--sombra-foco);
}
.contacto-card__topo {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--cor-primaria-100);
  color: var(--cor-primaria-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}
.tipo-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.tipo-badge--teal {
  background: var(--cor-teal-100);
  color: var(--cor-teal-700);
}
.tipo-badge--ambar {
  background: var(--cor-ambar-100);
  color: var(--cor-ambar-700);
}
.tipo-badge--indigo {
  background: var(--cor-indigo-100);
  color: var(--cor-indigo-700);
}
.tipo-badge--neutro {
  background: var(--cor-neutra-fundo);
  color: var(--cor-neutra-texto);
}
.contacto-card__nome {
  font-family: var(--fonte-titulo);
  font-weight: 600;
  color: var(--cor-texto);
  margin-bottom: 6px;
}
.contacto-card__info {
  font-size: 13px;
  color: var(--cor-texto-suave);
  margin-bottom: 12px;
}
.sem-info {
  color: #b3bdb7;
  font-style: italic;
}
.contacto-card__rodape {
  font-size: 12px;
  color: var(--cor-texto-suave);
  display: flex;
  align-items: center;
  gap: 6px;
}
.ponto {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #b3bdb7;
}
.ponto--activo {
  background: var(--cor-primaria-500);
}

.contacto-card--adicionar {
  border-style: dashed;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #9aa8a1;
  gap: 4px;
  min-height: 150px;
}
.contacto-card--adicionar:hover {
  border-color: var(--cor-primaria-500);
  color: var(--cor-primaria-600);
}
.adicionar-icone {
  margin-bottom: 6px;
}
.contacto-card--adicionar strong {
  font-family: var(--fonte-titulo);
  font-size: 14px;
  color: var(--cor-texto-suave);
}
.contacto-card--adicionar small {
  font-size: 12px;
}

/* ---- Painel de detalhe ---- */
.coluna-detalhe {
  align-self: start;
}
.detalhe-card {
  background: var(--cor-superficie);
  border-radius: var(--raio);
  box-shadow: var(--sombra);
  overflow: hidden;
}
.detalhe-header {
  height: 64px;
  background: linear-gradient(120deg, var(--cor-primaria-700), var(--cor-teal-500));
}
.detalhe-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--cor-primaria-100);
  color: var(--cor-primaria-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  margin: -36px auto 0;
  border: 4px solid var(--cor-superficie);
}
.detalhe-corpo {
  padding: 16px 24px 24px;
  text-align: center;
}
.detalhe-corpo h2 {
  font-family: var(--fonte-titulo);
  font-size: 20px;
  margin: 12px 0 8px;
  color: var(--cor-texto);
}

.valores-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 20px 0;
}
.valores-stats:has(> :last-child:nth-child(3)) {
  grid-template-columns: 1fr;
}
.valor-mini {
  background: var(--cor-fundo);
  border-radius: var(--raio-sm);
  padding: 12px;
}
.valor-mini--alerta {
  background: var(--cor-erro-fundo);
}
.valor-mini span {
  display: block;
  font-size: 11px;
  color: var(--cor-texto-suave);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 4px;
}
.valor-mini strong {
  font-family: var(--fonte-titulo);
  font-size: 14px;
  color: var(--cor-texto);
}
.valor-mini--alerta strong {
  color: var(--cor-erro);
}
.valor-mini__carregar {
  width: 13px;
  height: 13px;
  border-width: 2px;
  display: inline-block;
}

.detalhe-contactos {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}
.detalhe-linha {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.detalhe-linha svg {
  color: #9aa8a1;
  margin-top: 2px;
  flex-shrink: 0;
}
.detalhe-linha small {
  display: block;
  font-size: 11px;
  color: var(--cor-texto-suave);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.detalhe-linha span {
  font-size: 14px;
  color: var(--cor-texto);
}
.vazio-mini {
  font-size: 13px;
  color: var(--cor-texto-suave);
  text-align: left;
  margin: 0;
}

.detalhe-accoes {
  display: flex;
  gap: 10px;
}
.detalhe-accoes .botao-secundario {
  flex: 1;
  justify-content: center;
}
.botao-secundario--perigo {
  color: var(--cor-erro);
}
.botao-secundario--perigo:hover {
  background: var(--cor-erro-fundo);
  border-color: #f6d4cf;
}

.confirmar-desactivar {
  margin-top: 12px;
  padding: 12px;
  background: var(--cor-erro-fundo);
  border-radius: var(--raio-sm);
  text-align: left;
}
.confirmar-desactivar p {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--cor-texto);
  line-height: 1.4;
}
.confirmar-desactivar__botoes {
  display: flex;
  gap: 8px;
}
.confirmar-desactivar__botoes .botao-secundario {
  flex: 1;
  justify-content: center;
}
.botao-perigo {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0.6rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  background: var(--cor-erro);
  border: none;
  border-radius: var(--raio-sm);
  cursor: pointer;
  font-family: inherit;
}
.botao-perigo:hover:not(:disabled) {
  background: #b83525;
}
.botao-perigo:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* ---- Modal ---- */
.campo-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--cor-texto);
  cursor: pointer;
}
.campo-checkbox input {
  width: 16px;
  height: 16px;
  accent-color: var(--cor-primaria-500);
}

@media (max-width: 1000px) {
  .layout-contactos {
    grid-template-columns: 1fr;
  }
}
</style>
