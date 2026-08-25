<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import axios from 'axios'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/services/api'
import { mt, dataCurta } from '@/utils/formato'
import { baixarFicheiro } from '@/utils/exportar'
import type { Paginacao, MaterialStock } from '@/types/api'

interface Emprestimo {
  id: number
  pessoa: string
  pessoa_id?: number
  valor_total: number
  saldo_devedor: number
  data_vencimento: string | null
  estado: 'em_dia' | 'vencido' | 'liquidado' | string
  tipo: 'dinheiro' | 'adiantamento_material' | 'material_emprestado' | string
  tipo_rotulo?: string
  // Só preenchidos quando tipo = material_emprestado.
  material?: string | null
  quantidade_kg?: number | null
}

interface ResumoEmprestimos {
  total_em_divida: number
}

interface Pessoa {
  id: number
  nome: string
  tipo: string
  tipo_rotulo: string
}

const emprestimos = ref<Emprestimo[]>([])
const resumo = ref<ResumoEmprestimos>({ total_em_divida: 0 })
const paginacao = ref<Paginacao>({ pagina: 1, ultima_pagina: 1, total: 0 })
const aCarregar = ref(true)
const erro = ref('')

const pesquisa = ref('')
const filtroEstado = ref<'' | 'em_dia' | 'vencido' | 'liquidado'>('')
const paginaActual = ref(1)

async function carregar() {
  aCarregar.value = true
  erro.value = ''
  try {
    const { data } = await api.get('/emprestimos', {
      params: {
        estado: filtroEstado.value || undefined,
        page: paginaActual.value,
      },
    })
    emprestimos.value = data.dados.itens || []
    resumo.value = data.dados.resumo || resumo.value
    paginacao.value = data.dados.paginacao || paginacao.value
  } catch (e) {
    erro.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível carregar os empréstimos.'
  } finally {
    aCarregar.value = false
  }
}

onMounted(carregar)

function aplicarFiltro(estado: '' | 'em_dia' | 'vencido' | 'liquidado') {
  filtroEstado.value = estado
  paginaActual.value = 1
  carregar()
}

const emprestimosFiltrados = computed(() => {
  if (!pesquisa.value.trim()) return emprestimos.value
  const termo = pesquisa.value.toLowerCase()
  return emprestimos.value.filter((e) => e.pessoa?.toLowerCase().includes(termo))
})

// Totais para os cartões (com base na página carregada).
const totalEmprestado = computed(() => emprestimos.value.reduce((s, e) => s + Number(e.valor_total || 0), 0))
const pagamentosEmAtraso = computed(() => emprestimos.value.filter((e) => e.estado === 'vencido').length)

function refEmprestimo(id: number) {
  return 'DB-' + String(id).padStart(3, '0')
}

function iniciais(nome: string) {
  if (!nome) return '?'
  return nome
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function estadoInfo(estado: string) {
  const mapa: Record<string, { texto: string; classe: string }> = {
    em_dia: { texto: 'Pendente', classe: 'pendente' },
    vencido: { texto: 'Atrasado', classe: 'atrasado' },
    liquidado: { texto: 'Pago', classe: 'liquidado' },
  }
  return mapa[estado] || { texto: estado, classe: 'pendente' }
}

function irPara(p: number) {
  if (p >= 1 && p <= paginacao.value.ultima_pagina) {
    paginaActual.value = p
    carregar()
  }
}

// --- Exportar PDF ---------------------------------------------------------
// GET /emprestimos/exportar — endpoint NOVO, ainda por criar no backend
// (ver prompt fornecido ao dono). Reaproveita o mesmo filtro de estado.
const aExportar = ref(false)

async function exportar() {
  aExportar.value = true
  try {
    await baixarFicheiro('/emprestimos/exportar', { estado: filtroEstado.value || undefined })
  } catch {
    erro.value = 'Não foi possível exportar. Confirma que o endpoint /emprestimos/exportar já existe no backend.'
  } finally {
    aExportar.value = false
  }
}

// --- Modal "Novo Registo" -------------------------------------------------
// POST /emprestimos (confirmado no código de EmprestimoRequest/EmprestimoService):
// { pessoa_id, valor_principal (obrigatório), juro_valor?, data?, data_vencimento?,
// motivo?, tipo? ('dinheiro' | 'adiantamento_material' | 'material_emprestado',
// por omissão 'dinheiro'), material_id?/quantidade_kg? (obrigatórios só quando
// tipo = 'material_emprestado', nesse caso o empréstimo sai directamente do
// stock do material escolhido, em vez de dinheiro do caixa; valor_principal
// continua obrigatório mesmo assim: é o valor em MT que fica registado como dívida).
// valor_total (mostrado na tabela/cartões) é calculado no backend = principal + juro.
// O devedor pode ser escolhido de entre os já cadastrados (GET /pessoas?tipo=devedor)
// ou criado ali mesmo (POST /pessoas).
interface FormEmprestimo {
  modoDevedor: 'existente' | 'novo'
  pessoa_id: number | null
  nomeDevedorNovo: string
  valor_principal: string
  juro_valor: string
  tipo: 'dinheiro' | 'adiantamento_material' | 'material_emprestado'
  material_id: number | null
  quantidade_kg: string
  data_vencimento: string
  motivo: string
}

function formEmprestimoVazio(): FormEmprestimo {
  return {
    modoDevedor: devedores.value.length > 0 ? 'existente' : 'novo',
    pessoa_id: devedores.value[0]?.id ?? null,
    nomeDevedorNovo: '',
    valor_principal: '',
    juro_valor: '',
    tipo: 'dinheiro',
    material_id: materiais.value[0]?.id ?? null,
    quantidade_kg: '',
    data_vencimento: '',
    motivo: '',
  }
}

const modalRegistoAberto = ref(false)
const devedores = ref<Pessoa[]>([])
const aCarregarDevedores = ref(false)
const materiais = ref<MaterialStock[]>([])
const aCarregarMateriais = ref(false)
const formEmprestimo = reactive<FormEmprestimo>(formEmprestimoVazio())
const aGuardarRegisto = ref(false)
const erroRegisto = ref('')
const errosCampoRegisto = ref<Record<string, string[]>>({})

const materialEmprestimoSeleccionado = computed(() => materiais.value.find((m) => m.id === formEmprestimo.material_id))

async function abrirModalRegisto() {
  erroRegisto.value = ''
  errosCampoRegisto.value = {}
  modalRegistoAberto.value = true

  if (devedores.value.length === 0) {
    aCarregarDevedores.value = true
    try {
      const resposta = await api.get('/pessoas', { params: { tipo: 'devedor' } })
      devedores.value = resposta.data.dados.itens || []
    } catch {
      // Sem devedores disponíveis, o formulário assume "devedor novo".
    } finally {
      aCarregarDevedores.value = false
    }
  }

  // Ao contrário dos devedores, o stock muda com frequência (vendas, compras,
  // quebras…), recarrega sempre que o modal abre para os kg mostrados não
  // ficarem desactualizados.
  aCarregarMateriais.value = true
  try {
    const resposta = await api.get('/materiais')
    materiais.value = resposta.data.dados.itens || []
  } catch {
    // Sem materiais disponíveis, "Empréstimo em material" fica sem opções.
  } finally {
    aCarregarMateriais.value = false
  }

  Object.assign(formEmprestimo, formEmprestimoVazio())
}

function fecharModalRegisto() {
  modalRegistoAberto.value = false
}

function erroCampoRegisto(campo: string) {
  return errosCampoRegisto.value[campo]?.[0] || ''
}

async function guardarRegisto() {
  aGuardarRegisto.value = true
  erroRegisto.value = ''
  errosCampoRegisto.value = {}

  try {
    let pessoaId = formEmprestimo.pessoa_id

    if (formEmprestimo.modoDevedor === 'novo') {
      const resPessoa = await api.post('/pessoas', { nome: formEmprestimo.nomeDevedorNovo, tipo: 'devedor' })
      pessoaId = resPessoa.data.dados.id
    }

    const emMaterial = formEmprestimo.tipo === 'material_emprestado'

    await api.post('/emprestimos', {
      pessoa_id: pessoaId,
      valor_principal: Number(formEmprestimo.valor_principal),
      juro_valor: formEmprestimo.juro_valor ? Number(formEmprestimo.juro_valor) : undefined,
      tipo: formEmprestimo.tipo,
      material_id: emMaterial ? formEmprestimo.material_id : undefined,
      quantidade_kg: emMaterial ? Number(formEmprestimo.quantidade_kg) : undefined,
      data_vencimento: formEmprestimo.data_vencimento || undefined,
      motivo: formEmprestimo.motivo || undefined,
    })

    fecharModalRegisto()
    paginaActual.value = 1
    await carregar()
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data?.erros) {
      errosCampoRegisto.value = e.response.data.erros
    }
    erroRegisto.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível registar o empréstimo. Tenta novamente.'
  } finally {
    aGuardarRegisto.value = false
  }
}

// --- Modal "Registar Pagamento" -------------------------------------------
// POST /emprestimos/{id}/pagar (confirmado em PagamentoRequest/EmprestimoService):
// { valor (obrigatório), data?, forma? ('dinheiro'|'material', por omissão
// 'dinheiro'), material_id?/quantidade_kg? (só se forma='material') }. Este
// modal cobre o caso mais comum (pagamento em dinheiro), enviando só `valor`;
// o backend abate primeiro o juro em dívida e só depois o principal.
const modalPagamentoAberto = ref(false)
const emprestimoAPagar = ref<Emprestimo | null>(null)
const valorPagamento = ref('')
const aGuardarPagamento = ref(false)
const erroPagamento = ref('')
const errosCampoPagamento = ref<Record<string, string[]>>({})

function abrirModalPagamento(e: Emprestimo) {
  emprestimoAPagar.value = e
  valorPagamento.value = String(e.saldo_devedor)
  erroPagamento.value = ''
  errosCampoPagamento.value = {}
  modalPagamentoAberto.value = true
}

function fecharModalPagamento() {
  modalPagamentoAberto.value = false
  emprestimoAPagar.value = null
}

function erroCampoPagamento(campo: string) {
  return errosCampoPagamento.value[campo]?.[0] || ''
}

async function guardarPagamento() {
  if (!emprestimoAPagar.value) return
  aGuardarPagamento.value = true
  erroPagamento.value = ''
  errosCampoPagamento.value = {}

  try {
    await api.post(`/emprestimos/${emprestimoAPagar.value.id}/pagar`, {
      valor: Number(valorPagamento.value),
    })

    fecharModalPagamento()
    await carregar()
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data?.erros) {
      errosCampoPagamento.value = e.response.data.erros
    }
    erroPagamento.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível registar o pagamento. Tenta novamente.'
  } finally {
    aGuardarPagamento.value = false
  }
}
</script>

<template>
  <AppLayout>
    <template #caminho>Painel / Empréstimos &amp; Dívidas</template>

    <!-- Cabeçalho -->
    <div class="cabecalho">
      <div>
        <h1>Empréstimos &amp; Dívidas</h1>
        <p>Gira os empréstimos concedidos a terceiros e os pagamentos a receber.</p>
      </div>
      <div class="cabecalho__accoes">
        <button type="button" class="botao-fantasma" :disabled="aExportar" @click="exportar">
          <span v-if="aExportar" class="spinner" aria-hidden="true"></span>
          {{ aExportar ? 'A exportar…' : 'Exportar PDF' }}
        </button>
        <button type="button" class="botao-primario" @click="abrirModalRegisto">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          Novo Registo
        </button>
      </div>
    </div>

    <p v-if="erro" class="estado estado--erro" role="alert">{{ erro }}</p>

    <!-- Cartões -->
    <section class="cartoes">
      <div class="card-kpi card-kpi--verde">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Total Emprestado</span>
          <span class="card-kpi__icone card-kpi__icone--verde">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M7 17 17 7M7 7h10v10" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--verde">{{ mt(totalEmprestado) }}</strong>
        <small class="card-kpi__nota">a receber (listados)</small>
      </div>

      <div class="card-kpi card-kpi--ambar">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Dívida Atual Total</span>
          <span class="card-kpi__icone card-kpi__icone--ambar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 7 7 17M17 17H7V7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--ambar">{{ mt(resumo.total_em_divida) }}</strong>
        <small class="card-kpi__nota">por liquidar</small>
      </div>

      <div class="card-kpi" :class="pagamentosEmAtraso > 0 ? 'card-kpi--vermelho' : 'card-kpi--verde'">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Pagamentos em Atraso</span>
          <span class="card-kpi__icone" :class="pagamentosEmAtraso > 0 ? 'card-kpi__icone--vermelho' : 'card-kpi__icone--verde'">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" stroke-linecap="round" />
            </svg>
          </span>
        </div>
        <strong class="card-kpi__valor" :class="pagamentosEmAtraso > 0 ? 'card-kpi__valor--vermelho' : 'card-kpi__valor--verde'">
          {{ pagamentosEmAtraso }} {{ pagamentosEmAtraso === 1 ? 'Pendente' : 'Pendentes' }}
        </strong>
        <small class="card-kpi__nota">{{ pagamentosEmAtraso > 0 ? 'atenção requerida' : 'tudo em dia' }}</small>
      </div>
    </section>

    <!-- Lista -->
    <section class="painel-bloco">
      <div class="painel-bloco__topo">
        <div class="abas">
          <button type="button" class="aba" :class="{ 'aba--activa': filtroEstado === '' }" @click="aplicarFiltro('')">Todos</button>
          <button type="button" class="aba" :class="{ 'aba--activa': filtroEstado === 'em_dia' }" @click="aplicarFiltro('em_dia')">Em dia</button>
          <button type="button" class="aba" :class="{ 'aba--activa': filtroEstado === 'vencido' }" @click="aplicarFiltro('vencido')">Atrasados</button>
          <button type="button" class="aba" :class="{ 'aba--activa': filtroEstado === 'liquidado' }" @click="aplicarFiltro('liquidado')">Pagos</button>
        </div>
        <input v-model="pesquisa" type="text" placeholder="Pesquisar devedor…" class="filtro-pesquisa" />
      </div>

      <div v-if="aCarregar" class="estado">
        <span class="spinner" aria-hidden="true"></span>
        <p>A carregar empréstimos…</p>
      </div>
      <p v-else-if="emprestimosFiltrados.length === 0" class="vazio">Nenhum empréstimo encontrado.</p>

      <table v-else class="tabela">
        <thead>
          <tr>
            <th>Beneficiário</th>
            <th>Tipo</th>
            <th class="ao-fim">Valor inicial</th>
            <th class="ao-fim">Dívida atual</th>
            <th>Vencimento</th>
            <th class="ao-centro">Estado</th>
            <th class="ao-centro">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in emprestimosFiltrados" :key="e.id">
            <td>
              <div class="beneficiario">
                <span class="avatar">{{ iniciais(e.pessoa) }}</span>
                <div>
                  <div class="beneficiario__nome">{{ e.pessoa }}</div>
                  <div class="beneficiario__ref">{{ refEmprestimo(e.id) }}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="tipo">
                <svg
                  v-if="e.tipo === 'material_emprestado'"
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M12 2 3 7l9 5 9-5-9-5Z" /><path d="M3 12l9 5 9-5M3 17l9 5 9-5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <svg v-else viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M7 17 17 7M7 7h10v10" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                {{ e.tipo_rotulo || 'Empréstimo' }}
              </span>
              <div v-if="e.tipo === 'material_emprestado' && e.material" class="tipo-material">
                {{ e.material }} · {{ Number(e.quantidade_kg).toFixed(1) }}kg
              </div>
            </td>
            <td class="ao-fim cinza nowrap">{{ mt(e.valor_total) }}</td>
            <td class="ao-fim forte nowrap">{{ mt(e.saldo_devedor) }}</td>
            <td class="nowrap">{{ dataCurta(e.data_vencimento) }}</td>
            <td class="ao-centro">
              <span class="etiqueta" :class="`etiqueta--${estadoInfo(e.estado).classe}`">
                {{ estadoInfo(e.estado).texto }}
              </span>
            </td>
            <td class="ao-centro">
              <button
                v-if="e.estado !== 'liquidado'"
                type="button"
                class="btn-linha"
                @click="abrirModalPagamento(e)"
              >
                Pagar
              </button>
              <span v-else class="cinza">-</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!aCarregar && paginacao.total > 0" class="paginacao">
        <span class="paginacao__info">A mostrar {{ emprestimosFiltrados.length }} de {{ paginacao.total }} registos</span>
        <div class="paginacao__botoes">
          <button class="pg-btn" :disabled="paginaActual === 1" @click="irPara(paginaActual - 1)">Anterior</button>
          <button class="pg-btn" :disabled="paginaActual === paginacao.ultima_pagina" @click="irPara(paginaActual + 1)">Próximo</button>
        </div>
      </div>
    </section>

    <!-- Modal: novo registo de empréstimo -->
    <Teleport to="body">
      <div v-if="modalRegistoAberto" class="modal-veu" @click.self="fecharModalRegisto">
        <div class="modal-cartao" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-registo">
          <div class="modal-cabecalho">
            <h3 id="titulo-modal-registo">Novo Registo</h3>
            <button type="button" class="modal-fechar" aria-label="Fechar" @click="fecharModalRegisto">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <form class="modal-form" @submit.prevent="guardarRegisto">
            <div v-if="devedores.length > 0" class="alternador">
              <button
                type="button"
                class="alternador__opcao"
                :class="{ 'alternador__opcao--activa': formEmprestimo.modoDevedor === 'existente' }"
                @click="formEmprestimo.modoDevedor = 'existente'"
              >
                Devedor existente
              </button>
              <button
                type="button"
                class="alternador__opcao"
                :class="{ 'alternador__opcao--activa': formEmprestimo.modoDevedor === 'novo' }"
                @click="formEmprestimo.modoDevedor = 'novo'"
              >
                Devedor novo
              </button>
            </div>

            <div v-if="formEmprestimo.modoDevedor === 'existente'" class="campo-modal">
              <label for="devedor-existente">Devedor</label>
              <select id="devedor-existente" v-model.number="formEmprestimo.pessoa_id" :disabled="aCarregarDevedores">
                <option v-if="aCarregarDevedores" value="">A carregar devedores…</option>
                <option v-for="d in devedores" :key="d.id" :value="d.id">{{ d.nome }}</option>
              </select>
              <span v-if="erroCampoRegisto('pessoa_id')" class="campo-modal__erro">{{ erroCampoRegisto('pessoa_id') }}</span>
            </div>
            <div v-else class="campo-modal">
              <label for="devedor-novo">Nome do devedor</label>
              <input id="devedor-novo" v-model="formEmprestimo.nomeDevedorNovo" type="text" placeholder="ex.: Cremildo Nhantumbo" />
              <span v-if="erroCampoRegisto('pessoa_id')" class="campo-modal__erro">{{ erroCampoRegisto('pessoa_id') }}</span>
            </div>

            <div class="campo-modal-grupo">
              <div class="campo-modal">
                <label for="valor-principal">Valor emprestado (principal)</label>
                <input id="valor-principal" v-model="formEmprestimo.valor_principal" type="number" min="0" step="0.01" placeholder="0.00" />
                <span v-if="erroCampoRegisto('valor_principal')" class="campo-modal__erro">{{ erroCampoRegisto('valor_principal') }}</span>
              </div>
              <div class="campo-modal">
                <label for="juro-valor">Juro <small>(opcional)</small></label>
                <input id="juro-valor" v-model="formEmprestimo.juro_valor" type="number" min="0" step="0.01" placeholder="0.00" />
                <span v-if="erroCampoRegisto('juro_valor')" class="campo-modal__erro">{{ erroCampoRegisto('juro_valor') }}</span>
              </div>
            </div>

            <div class="campo-modal-grupo">
              <div class="campo-modal">
                <label for="tipo-emprestimo">Tipo <small>(opcional)</small></label>
                <select id="tipo-emprestimo" v-model="formEmprestimo.tipo">
                  <option value="dinheiro">Empréstimo em dinheiro</option>
                  <option value="adiantamento_material">Adiantamento a abater em material</option>
                  <option value="material_emprestado">Empréstimo em material</option>
                </select>
              </div>
              <div class="campo-modal">
                <label for="data-vencimento">Data de vencimento <small>(opcional)</small></label>
                <input id="data-vencimento" v-model="formEmprestimo.data_vencimento" type="date" />
                <span v-if="erroCampoRegisto('data_vencimento')" class="campo-modal__erro">{{ erroCampoRegisto('data_vencimento') }}</span>
              </div>
            </div>

            <!-- Só quando "Empréstimo em material": sai directamente do stock, não do caixa. -->
            <div v-if="formEmprestimo.tipo === 'material_emprestado'" class="campo-modal-grupo campo-modal-grupo--material">
              <div class="campo-modal">
                <label for="material-emprestimo">Material emprestado</label>
                <select id="material-emprestimo" v-model.number="formEmprestimo.material_id" :disabled="aCarregarMateriais">
                  <option v-if="aCarregarMateriais" value="">A carregar materiais…</option>
                  <option v-for="m in materiais" :key="m.id" :value="m.id">
                    {{ m.nome }}, {{ Number(m.stock_kg).toFixed(0) }}kg em stock
                  </option>
                </select>
                <span v-if="erroCampoRegisto('material_id')" class="campo-modal__erro">{{ erroCampoRegisto('material_id') }}</span>
              </div>
              <div class="campo-modal">
                <label for="quantidade-material">Quantidade (kg)</label>
                <input
                  id="quantidade-material"
                  v-model="formEmprestimo.quantidade_kg"
                  type="number"
                  min="0"
                  :max="materialEmprestimoSeleccionado?.stock_kg"
                  step="0.01"
                  placeholder="0.00"
                />
                <span v-if="erroCampoRegisto('quantidade_kg')" class="campo-modal__erro">{{ erroCampoRegisto('quantidade_kg') }}</span>
              </div>
            </div>

            <div class="campo-modal">
              <label for="motivo">Motivo <small>(opcional)</small></label>
              <input id="motivo" v-model="formEmprestimo.motivo" type="text" placeholder="ex.: adiantamento para reparação de viatura" />
            </div>

            <p v-if="erroRegisto" class="modal-alerta" role="alert">{{ erroRegisto }}</p>

            <div class="modal-rodape">
              <button type="button" class="botao-secundario" :disabled="aGuardarRegisto" @click="fecharModalRegisto">Cancelar</button>
              <button type="submit" class="botao-primario" :disabled="aGuardarRegisto">
                <span v-if="aGuardarRegisto" class="spinner spinner--claro" aria-hidden="true"></span>
                {{ aGuardarRegisto ? 'A guardar…' : 'Guardar registo' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Modal: registar pagamento -->
    <Teleport to="body">
      <div v-if="modalPagamentoAberto" class="modal-veu" @click.self="fecharModalPagamento">
        <div class="modal-cartao" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-pagamento">
          <div class="modal-cabecalho">
            <h3 id="titulo-modal-pagamento">Registar Pagamento</h3>
            <button type="button" class="modal-fechar" aria-label="Fechar" @click="fecharModalPagamento">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <form class="modal-form" @submit.prevent="guardarPagamento">
            <div class="campo-modal">
              <label>Devedor</label>
              <div class="material-alvo">{{ emprestimoAPagar?.pessoa }}</div>
            </div>

            <div class="campo-modal">
              <label for="valor-pagamento">Valor a pagar <small>(dívida atual: {{ mt(emprestimoAPagar?.saldo_devedor) }})</small></label>
              <input
                id="valor-pagamento"
                v-model="valorPagamento"
                type="number"
                min="0"
                :max="emprestimoAPagar?.saldo_devedor"
                step="0.01"
                placeholder="0.00"
              />
              <span v-if="erroCampoPagamento('valor')" class="campo-modal__erro">{{ erroCampoPagamento('valor') }}</span>
            </div>

            <p v-if="erroPagamento" class="modal-alerta" role="alert">{{ erroPagamento }}</p>

            <div class="modal-rodape">
              <button type="button" class="botao-secundario" :disabled="aGuardarPagamento" @click="fecharModalPagamento">Cancelar</button>
              <button type="submit" class="botao-primario" :disabled="aGuardarPagamento">
                <span v-if="aGuardarPagamento" class="spinner spinner--claro" aria-hidden="true"></span>
                {{ aGuardarPagamento ? 'A guardar…' : 'Confirmar Pagamento' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>

<style scoped>
.ref {
  font-size: 12px;
  color: var(--cor-texto-suave);
  font-weight: 600;
}
.cinza {
  color: var(--cor-texto-suave);
}
.forte {
  font-weight: 700;
  color: var(--cor-texto);
}

/* ---- Abas de filtro por estado ---- */
.abas {
  display: flex;
  gap: 4px;
  background: var(--cor-fundo);
  padding: 4px;
  border-radius: 10px;
}
.aba {
  padding: 8px 16px;
  border: none;
  background: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--cor-texto-suave);
  cursor: pointer;
  font-family: inherit;
}
.aba--activa {
  background: var(--cor-superficie);
  color: var(--cor-primaria-700);
  font-weight: 600;
  box-shadow: 0 1px 3px rgb(22 33 28 / 0.12);
}

.beneficiario {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--cor-primaria-100);
  color: var(--cor-primaria-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.beneficiario__nome {
  font-weight: 500;
  color: var(--cor-texto);
}
.beneficiario__ref {
  font-size: 12px;
  color: var(--cor-texto-suave);
}
.tipo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--cor-primaria-600);
  white-space: nowrap;
}
.tipo-material {
  font-size: 11px;
  color: var(--cor-texto-suave);
  margin-top: 2px;
  padding-left: 19px;
}

.campo-modal-grupo--material {
  padding: 12px;
  background: var(--cor-teal-50);
  border-radius: var(--raio-sm);
}

.btn-linha {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 11px;
  font-size: 12px;
  font-weight: 600;
  color: var(--cor-primaria-700);
  background: var(--cor-primaria-50);
  border: 1px solid var(--cor-primaria-100);
  border-radius: 7px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.btn-linha:hover {
  background: var(--cor-primaria-100);
}

.material-alvo {
  padding: 0.6rem 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  border: 1px solid var(--cor-borda);
  border-radius: var(--raio-sm);
  background: var(--cor-fundo);
  color: var(--cor-texto);
}
</style>
