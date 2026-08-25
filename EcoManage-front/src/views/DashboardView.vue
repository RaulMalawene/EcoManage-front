<script setup lang="ts">
import { ref, onMounted, computed, reactive, watch } from 'vue'
import axios from 'axios'
import { Bar, Doughnut } from 'vue-chartjs'
import type { ChartOptions, TooltipItem } from 'chart.js'
import AppLayout from '@/components/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'
import { ICONES } from '@/utils/icones'
import { mt } from '@/utils/formato'
import { mtCompacto } from '@/utils/graficos'
import { PALETA, CORES_CATEGORICAS } from '@/utils/paleta'
import type { ResumoDashboard, MaterialStock } from '@/types/api'
import '@/utils/graficos' // regista os componentes do Chart.js usados nesta app

interface Devedor {
  id: number
  pessoa: string
  saldo_devedor: number
  data_vencimento: string | null
  estado: 'vencido' | 'em_dia' | 'liquidado' | string
}

const auth = useAuthStore()

const dashboard = ref<ResumoDashboard | null>(null)
const devedores = ref<Devedor[]>([])
const materiais = ref<MaterialStock[]>([])
const aCarregar = ref(true)
const erro = ref('')

async function carregar() {
  aCarregar.value = true
  erro.value = ''
  try {
    const [resDash, resDev, resMat] = await Promise.all([
      api.get('/relatorios/dashboard'),
      api.get('/emprestimos', { params: { por_liquidar: 1 } }),
      api.get('/materiais'),
    ])
    dashboard.value = resDash.data.dados
    devedores.value = resDev.data.dados.itens || []
    materiais.value = resMat.data.dados.itens || []
  } catch (e) {
    erro.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível carregar o painel.'
  } finally {
    aCarregar.value = false
  }
}

onMounted(carregar)

const hoje = computed(() =>
  new Date().toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' }),
)

const primeiroNome = computed(() => auth.utilizador?.nome?.split(' ')[0] || '')

const cartoes = computed(() => {
  if (!dashboard.value) return []
  const d = dashboard.value
  return [
    { rotulo: 'Saldo disponível', valor: d.saldo_caixa, cor: 'verde', icone: 'caixa' },
    { rotulo: 'Total emprestado', valor: d.total_em_divida, cor: 'ambar', icone: 'emprestimos' },
    { rotulo: 'Valor em stock', valor: d.valor_stock, cor: 'teal', icone: 'materiais' },
    { rotulo: 'Lucro do mês', valor: d.mes_corrente?.lucro_liquido, cor: 'destaque', icone: 'relatorios' },
  ]
})

// Composição de stock por material (valor imobilizado): dados que já
// vinham em GET /materiais, sem precisar de nenhum endpoint novo. Mostra os
// 4 materiais de maior valor e agrupa o resto em "Outros" (nunca mais de 5
// fatias, para as cores categóricas não precisarem de repetir).
const composicaoStock = computed(() => {
  const ordenados = [...materiais.value].filter((m) => m.valor_stock > 0).sort((a, b) => b.valor_stock - a.valor_stock)
  const principais = ordenados.slice(0, 4).map((m, i) => ({ nome: m.nome, valor: m.valor_stock, cor: CORES_CATEGORICAS[i] }))
  const resto = ordenados.slice(4).reduce((s, m) => s + m.valor_stock, 0)
  if (resto > 0) principais.push({ nome: 'Outros materiais', valor: resto, cor: CORES_CATEGORICAS[4] })
  return principais
})

const dadosComposicaoStock = computed(() => ({
  labels: composicaoStock.value.map((c) => c.nome),
  datasets: [
    {
      data: composicaoStock.value.map((c) => c.valor),
      backgroundColor: composicaoStock.value.map((c) => c.cor),
      borderColor: PALETA.superficie,
      borderWidth: 2,
      hoverOffset: 6,
    },
  ],
}))

const opcoesComposicaoStock = computed<ChartOptions<'doughnut'>>(() => {
  const total = composicaoStock.value.reduce((s, c) => s + c.valor, 0)
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 8, padding: 12 } },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'doughnut'>) => {
            const valor = Number(ctx.raw)
            const pct = total > 0 ? Math.round((valor / total) * 100) : 0
            return ` ${mt(valor)} (${pct}%)`
          },
        },
      },
      datalabels: { display: false },
    },
  }
})

// --- Fluxo de caixa mensal --------------------------------------------
// GET /caixa/fluxo-mensal?meses=6: endpoint NOVO, ainda por criar no
// backend (ver prompt fornecido ao dono). Devolve, do mês mais antigo para
// o mais recente, {mes, mes_rotulo, entradas, saidas, saldo_periodo}. Sem
// ele, o painel mostra "sem dados" em vez de rebentar a tela.
interface FluxoMensal {
  mes: string
  mes_rotulo: string
  entradas: number
  saidas: number
  saldo_periodo: number
}

const fluxoMensal = ref<FluxoMensal[]>([])
const aCarregarFluxo = ref(true)

async function carregarFluxoMensal() {
  aCarregarFluxo.value = true
  try {
    const { data } = await api.get('/caixa/fluxo-mensal', { params: { meses: 6 } })
    fluxoMensal.value = data.dados || []
  } catch {
    fluxoMensal.value = []
  } finally {
    aCarregarFluxo.value = false
  }
}

onMounted(carregarFluxoMensal)

const dadosFluxoMensal = computed(() => ({
  labels: fluxoMensal.value.map((m) => m.mes_rotulo),
  datasets: [
    {
      label: 'Entradas',
      data: fluxoMensal.value.map((m) => m.entradas),
      backgroundColor: PALETA.primaria500,
      borderRadius: 4,
      barPercentage: 0.7,
      categoryPercentage: 0.6,
    },
    {
      label: 'Saídas',
      data: fluxoMensal.value.map((m) => m.saidas),
      backgroundColor: PALETA.erro,
      borderRadius: 4,
      barPercentage: 0.7,
      categoryPercentage: 0.6,
    },
  ],
}))

const opcoesFluxoMensal = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { grid: { display: false }, border: { display: false } },
    y: { grid: { color: PALETA.borda }, border: { display: false }, ticks: { callback: (v) => mtCompacto(Number(v)) } },
  },
  plugins: {
    legend: { position: 'top', align: 'start' },
    tooltip: { callbacks: { label: (ctx: TooltipItem<'bar'>) => `${ctx.dataset.label}: ${mt(ctx.parsed.y)}` } },
  },
}))

function estadoDevedor(estado: string) {
  const mapa: Record<string, { texto: string; classe: string }> = {
    vencido: { texto: 'Atrasado', classe: 'atrasado' },
    em_dia: { texto: 'Pendente', classe: 'pendente' },
    liquidado: { texto: 'Liquidado', classe: 'liquidado' },
  }
  return mapa[estado] || { texto: estado, classe: 'pendente' }
}

// --- modal "Adicionar stock" -------------------------------------------
// Não existe endpoint para só "somar kg" a um material: usa-se sempre
// POST /materiais/{id}/stock-inicial (que acumula a cada chamada); para
// um material novo cria-se primeiro em POST /materiais.
interface FormStock {
  modo: 'existente' | 'novo'
  material_id: number | null
  nome: string
  preco_compra_kg: string
  preco_venda_kg: string
  limite_alerta_kg: string
  quantidade_kg: string
  custo_kg: string
}

function formStockVazio(): FormStock {
  return {
    modo: materiais.value.length > 0 ? 'existente' : 'novo',
    material_id: materiais.value[0]?.id ?? null,
    nome: '',
    preco_compra_kg: '',
    preco_venda_kg: '',
    limite_alerta_kg: '',
    quantidade_kg: '',
    custo_kg: materiais.value[0] ? String(materiais.value[0].preco_compra_kg) : '',
  }
}

const modalStockAberto = ref(false)
const formStock = reactive<FormStock>(formStockVazio())
const aGuardarStock = ref(false)
const erroStock = ref('')
const errosCampoStock = ref<Record<string, string[]>>({})

function abrirModalStock() {
  Object.assign(formStock, formStockVazio())
  erroStock.value = ''
  errosCampoStock.value = {}
  modalStockAberto.value = true
}

function fecharModalStock() {
  modalStockAberto.value = false
}

function erroCampo(campo: string) {
  return errosCampoStock.value[campo]?.[0] || ''
}

// Ao trocar de material, sugere o custo desta entrada = preço de compra atual do material.
watch(
  () => formStock.material_id,
  (id) => {
    if (formStock.modo !== 'existente') return
    const material = materiais.value.find((m) => m.id === id)
    if (material) formStock.custo_kg = String(material.preco_compra_kg)
  },
)

async function guardarStock() {
  aGuardarStock.value = true
  erroStock.value = ''
  errosCampoStock.value = {}

  try {
    let materialId = formStock.material_id

    if (formStock.modo === 'novo') {
      const resMaterial = await api.post('/materiais', {
        nome: formStock.nome,
        preco_compra_kg: Number(formStock.preco_compra_kg),
        preco_venda_kg: Number(formStock.preco_venda_kg),
        limite_alerta_kg: formStock.limite_alerta_kg ? Number(formStock.limite_alerta_kg) : null,
      })
      materialId = resMaterial.data.dados.id
    }

    await api.post(`/materiais/${materialId}/stock-inicial`, {
      quantidade_kg: Number(formStock.quantidade_kg),
      custo_kg: Number(formStock.custo_kg),
    })

    fecharModalStock()
    await carregar()
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data?.erros) {
      errosCampoStock.value = e.response.data.erros
    }
    erroStock.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível guardar. Tenta novamente.'
  } finally {
    aGuardarStock.value = false
  }
}
</script>

<template>
  <AppLayout>
    <template #caminho>Painel / Visão Geral</template>

    <div v-if="aCarregar" class="estado">
      <span class="spinner" aria-hidden="true"></span>
      <p>A carregar o painel…</p>
    </div>

    <div v-else-if="erro" class="estado estado--erro" role="alert">
      <p>{{ erro }}</p>
      <button type="button" class="botao-tentar" @click="carregar">Tentar novamente</button>
    </div>

    <template v-else>
      <section class="hero">
        <div class="hero__texto">
          <h1>Bem-vindo{{ primeiroNome ? `, ${primeiroNome}` : '' }}</h1>
          <p>Aqui está o resumo financeiro e operacional da Jay Recicly para hoje, {{ hoje }}.</p>
        </div>
      </section>

      <section class="cartoes">
        <div v-for="c in cartoes" :key="c.rotulo" class="card-kpi" :class="`card-kpi--${c.cor}`">
          <div class="card-kpi__topo">
            <span class="card-kpi__rotulo">{{ c.rotulo }}</span>
            <span class="card-kpi__icone" :class="`card-kpi__icone--${c.cor}`" v-html="ICONES[c.icone]"></span>
          </div>
          <strong class="card-kpi__valor" :class="`card-kpi__valor--${c.cor}`">{{ mt(c.valor) }}</strong>
        </div>
      </section>

      <section class="graficos">
        <div class="painel-bloco">
          <div class="painel-bloco__cabecalho">
            <h2>Fluxo de Caixa Mensal</h2>
            <p>Comparativo entre entradas e saídas de capital</p>
          </div>
          <div v-if="aCarregarFluxo" class="estado">
            <span class="spinner" aria-hidden="true"></span>
          </div>
          <div v-else-if="fluxoMensal.length === 0" class="em-breve">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 3v18h18M7 14l3-3 3 3 5-5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <p>Sem dados de fluxo mensal ainda</p>
            <small>Liga-se automaticamente quando o endpoint <code>/caixa/fluxo-mensal</code> existir no backend</small>
          </div>
          <div v-else class="grafico-alto">
            <Bar :data="dadosFluxoMensal" :options="opcoesFluxoMensal" />
          </div>
        </div>

        <div class="painel-bloco">
          <div class="painel-bloco__cabecalho">
            <h2>Composição de Stock</h2>
            <p>Valor imobilizado por material</p>
          </div>
          <p v-if="composicaoStock.length === 0" class="vazio">Ainda não há stock com valor registado.</p>
          <div v-else class="grafico-alto">
            <Doughnut :data="dadosComposicaoStock" :options="opcoesComposicaoStock" />
          </div>
        </div>
      </section>

      <section class="tabelas">
        <div class="painel-bloco">
          <div class="painel-bloco__cabecalho">
            <h2>Principais Devedores</h2>
            <p>Clientes com dívidas pendentes ou em atraso</p>
          </div>
          <p v-if="devedores.length === 0" class="vazio">Sem dívidas por liquidar.</p>
          <table v-else class="tabela">
            <thead>
              <tr>
                <th>Devedor</th>
                <th>Montante</th>
                <th>Vencimento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in devedores.slice(0, 5)" :key="d.id">
                <td>{{ d.pessoa }}</td>
                <td>{{ mt(d.saldo_devedor) }}</td>
                <td>{{ d.data_vencimento || '-' }}</td>
                <td>
                  <span class="etiqueta" :class="`etiqueta--${estadoDevedor(d.estado).classe}`">
                    {{ estadoDevedor(d.estado).texto }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="painel-bloco">
          <div class="painel-bloco__cabecalho">
            <h2>Níveis de Stock (kg)</h2>
            <p>Quantidade de material em armazém</p>
          </div>
          <p v-if="materiais.length === 0" class="vazio">Ainda não há materiais registados.</p>
          <div v-else class="stock-lista">
            <div v-for="m in materiais.slice(0, 5)" :key="m.id" class="stock-item">
              <div class="stock-item__topo">
                <span>{{ m.nome }}</span>
                <span class="stock-item__valores">
                  {{ Number(m.stock_kg).toFixed(0) }}kg<template v-if="m.limite_alerta_kg">
                    / {{ Number(m.limite_alerta_kg).toFixed(0) }}kg</template
                  >
                </span>
              </div>
              <div class="barra">
                <div
                  class="barra__preenchimento"
                  :style="{
                    width: m.limite_alerta_kg ? Math.min(100, (m.stock_kg / m.limite_alerta_kg) * 100) + '%' : '100%',
                  }"
                ></div>
              </div>
            </div>
          </div>
          <button type="button" class="botao-adicionar-stock" @click="abrirModalStock">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
            Adicionar stock
          </button>
        </div>
      </section>

      <!-- Modal: adicionar stock -->
      <Teleport to="body">
        <div v-if="modalStockAberto" class="modal-veu" @click.self="fecharModalStock">
          <div class="modal-cartao" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-stock">
            <div class="modal-cabecalho">
              <h3 id="titulo-modal-stock">Adicionar stock</h3>
              <button type="button" class="modal-fechar" aria-label="Fechar" @click="fecharModalStock">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
                </svg>
              </button>
            </div>

            <form class="modal-form" @submit.prevent="guardarStock">
              <div v-if="materiais.length > 0" class="alternador">
                <button
                  type="button"
                  class="alternador__opcao"
                  :class="{ 'alternador__opcao--activa': formStock.modo === 'existente' }"
                  @click="formStock.modo = 'existente'"
                >
                  Material existente
                </button>
                <button
                  type="button"
                  class="alternador__opcao"
                  :class="{ 'alternador__opcao--activa': formStock.modo === 'novo' }"
                  @click="formStock.modo = 'novo'"
                >
                  Material novo
                </button>
              </div>

              <div v-if="formStock.modo === 'existente'" class="campo-modal">
                <label for="material-existente">Material</label>
                <select id="material-existente" v-model.number="formStock.material_id">
                  <option v-for="m in materiais" :key="m.id" :value="m.id">
                    {{ m.nome }}, {{ Number(m.stock_kg).toFixed(0) }}kg em stock
                  </option>
                </select>
              </div>

              <template v-else>
                <div class="campo-modal">
                  <label for="nome-material">Nome do material</label>
                  <input id="nome-material" v-model="formStock.nome" type="text" placeholder="ex.: Alumínio" />
                  <span v-if="erroCampo('nome')" class="campo-modal__erro">{{ erroCampo('nome') }}</span>
                </div>
                <div class="campo-modal-grupo">
                  <div class="campo-modal">
                    <label for="preco-compra">Preço de compra /kg</label>
                    <input id="preco-compra" v-model="formStock.preco_compra_kg" type="number" min="0" step="0.01" placeholder="0.00" />
                    <span v-if="erroCampo('preco_compra_kg')" class="campo-modal__erro">{{ erroCampo('preco_compra_kg') }}</span>
                  </div>
                  <div class="campo-modal">
                    <label for="preco-venda">Preço de venda /kg</label>
                    <input id="preco-venda" v-model="formStock.preco_venda_kg" type="number" min="0" step="0.01" placeholder="0.00" />
                    <span v-if="erroCampo('preco_venda_kg')" class="campo-modal__erro">{{ erroCampo('preco_venda_kg') }}</span>
                  </div>
                </div>
                <div class="campo-modal">
                  <label for="limite-alerta">Limite de alerta /kg <small>(opcional)</small></label>
                  <input id="limite-alerta" v-model="formStock.limite_alerta_kg" type="number" min="0" step="0.01" placeholder="ex.: 100" />
                </div>
              </template>

              <div class="campo-modal-grupo">
                <div class="campo-modal">
                  <label for="quantidade-kg">Quantidade a adicionar (kg)</label>
                  <input id="quantidade-kg" v-model="formStock.quantidade_kg" type="number" min="0" step="0.01" placeholder="0.00" />
                  <span v-if="erroCampo('quantidade_kg')" class="campo-modal__erro">{{ erroCampo('quantidade_kg') }}</span>
                </div>
                <div class="campo-modal">
                  <label for="custo-kg">Custo desta entrada /kg</label>
                  <input id="custo-kg" v-model="formStock.custo_kg" type="number" min="0" step="0.01" placeholder="0.00" />
                  <span v-if="erroCampo('custo_kg')" class="campo-modal__erro">{{ erroCampo('custo_kg') }}</span>
                </div>
              </div>

              <p v-if="erroStock" class="modal-alerta" role="alert">{{ erroStock }}</p>

              <div class="modal-rodape">
                <button type="button" class="botao-secundario" :disabled="aGuardarStock" @click="fecharModalStock">Cancelar</button>
                <button type="submit" class="botao-primario" :disabled="aGuardarStock">
                  <span v-if="aGuardarStock" class="spinner spinner--claro" aria-hidden="true"></span>
                  {{ aGuardarStock ? 'A guardar…' : 'Guardar' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Teleport>
    </template>
  </AppLayout>
</template>

<style scoped>
.botao-tentar {
  margin-top: 4px;
  padding: 0.5rem 1.1rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--cor-erro);
  background: var(--cor-erro-fundo);
  border: 1px solid rgb(217 67 46 / 0.25);
  border-radius: var(--raio-sm);
  cursor: pointer;
}
.botao-tentar:hover {
  background: rgb(217 67 46 / 0.14);
}

.hero {
  background: linear-gradient(120deg, var(--cor-primaria-700), var(--cor-primaria-500));
  border-radius: var(--raio);
  padding: 32px;
  color: #fff;
  margin-bottom: 22px;
}
.hero h1 {
  font-size: 26px;
  margin: 0 0 8px;
}
.hero p {
  margin: 0;
  opacity: 0.9;
  font-size: 14px;
  max-width: 520px;
}

.graficos,
.tabelas {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 18px;
  margin-bottom: 22px;
}
.em-breve {
  border: 1.5px dashed var(--cor-borda);
  border-radius: var(--raio-sm);
  padding: 40px 20px;
  text-align: center;
  color: #9aa8a1;
}
.em-breve p {
  margin: 12px 0 4px;
  font-weight: 600;
  color: var(--cor-texto-suave);
}
.em-breve small {
  font-size: 12px;
}

/* ---- Contentor dos gráficos Chart.js (precisam de altura fixa no pai) ---- */
.grafico-alto {
  position: relative;
  height: 280px;
}

.stock-lista {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stock-item__topo {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--cor-texto);
}
.stock-item__valores {
  color: var(--cor-texto-suave);
  font-variant-numeric: tabular-nums;
}
.barra {
  height: 8px;
  background: var(--cor-neutra-fundo);
  border-radius: 5px;
  overflow: hidden;
}
.barra__preenchimento {
  height: 100%;
  background: linear-gradient(90deg, var(--cor-primaria-400), var(--cor-primaria-600));
  border-radius: 5px;
}

.botao-adicionar-stock {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 18px;
  padding: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--cor-primaria-700);
  background: var(--cor-primaria-50);
  border: 1.5px dashed var(--cor-primaria-200);
  border-radius: var(--raio-sm);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.botao-adicionar-stock:hover {
  background: var(--cor-primaria-100);
  border-color: var(--cor-primaria-400);
}

@media (max-width: 900px) {
  .graficos,
  .tabelas {
    grid-template-columns: 1fr;
  }
}
</style>
