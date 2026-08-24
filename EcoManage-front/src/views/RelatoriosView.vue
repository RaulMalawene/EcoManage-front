<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { Bar, Line } from 'vue-chartjs'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/services/api'
import { mt, dataIsoLocal } from '@/utils/formato'
import { mtCompacto } from '@/utils/graficos'
import { PALETA } from '@/utils/paleta'
import '@/utils/graficos' // regista os componentes do Chart.js usados nesta app

interface Dre {
  periodo: { inicio: string; fim: string }
  receita_vendas: number
  custo_materiais_vendidos: number
  lucro_bruto: number
  margem_bruta_pct: number
  outras_receitas: { juros_emprestimos: number }
  despesas_operacionais: number
  despesas_por_categoria: Record<string, number>
  resultado_operacional: number
  impostos_outros: number
  lucro_liquido: number
  margem_liquida_pct: number
}

const dre = ref<Dre | null>(null)
const aCarregar = ref(true)
const erro = ref('')

// Período: por defeito, o mês corrente. `dataIsoLocal` evita o deslize de
// um dia perto da meia-noite que `toISOString()` tem (converte para UTC).
const hoje = new Date()
const dataInicio = ref(dataIsoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)))
const dataFim = ref(dataIsoLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)))

async function carregar() {
  aCarregar.value = true
  erro.value = ''
  try {
    const { data } = await api.get('/relatorios/dre', {
      params: { data_inicio: dataInicio.value, data_fim: dataFim.value },
    })
    dre.value = data.dados
  } catch (e) {
    erro.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível gerar o relatório.'
  } finally {
    aCarregar.value = false
  }
}

onMounted(carregar)

// O lucro é positivo? Muda a cor e a mensagem do resumo em toda a tela.
const temLucro = computed(() => (dre.value?.lucro_liquido || 0) >= 0)

// --- Gráfico em cascata (waterfall) do DRE ---------------------------------
// Cada barra parte de onde a anterior chegou — a visualização correcta para
// uma demonstração de resultados, em vez de uma tabela. Os pontos de
// partida/chegada usam sempre um valor que o backend já devolveu
// directamente (receita_vendas, lucro_bruto, resultado_operacional,
// lucro_liquido) ou uma soma simples entre dois desses valores — nunca um
// cálculo novo, para não haver risco de desalinhar do que o DreService diz.
const linhasDre = computed(() => {
  if (!dre.value) return []
  const d = dre.value
  const juros = d.outras_receitas?.juros_emprestimos || 0
  const posJuros = d.lucro_bruto + juros
  return [
    { rotulo: 'Receita de vendas', valor: d.receita_vendas, tipo: 'entrada' as const, inicio: 0, fim: d.receita_vendas },
    {
      rotulo: 'Custo dos materiais vendidos',
      valor: -d.custo_materiais_vendidos,
      tipo: 'saida' as const,
      inicio: d.receita_vendas,
      fim: d.lucro_bruto,
    },
    { rotulo: 'Lucro bruto', valor: d.lucro_bruto, tipo: 'subtotal' as const, inicio: 0, fim: d.lucro_bruto },
    { rotulo: 'Juros de empréstimos', valor: juros, tipo: 'entrada' as const, inicio: d.lucro_bruto, fim: posJuros },
    {
      rotulo: 'Despesas operacionais',
      valor: -d.despesas_operacionais,
      tipo: 'saida' as const,
      inicio: posJuros,
      fim: d.resultado_operacional,
    },
    {
      rotulo: 'Resultado operacional',
      valor: d.resultado_operacional,
      tipo: 'subtotal' as const,
      inicio: 0,
      fim: d.resultado_operacional,
    },
    {
      rotulo: 'Impostos e outros',
      valor: -d.impostos_outros,
      tipo: 'saida' as const,
      inicio: d.resultado_operacional,
      fim: d.lucro_liquido,
    },
    { rotulo: 'Lucro líquido', valor: d.lucro_liquido, tipo: 'total' as const, inicio: 0, fim: d.lucro_liquido },
  ]
})

// entrada=verde, saída=vermelho, subtotal=índigo (checkpoint intermédio),
// total=verde/vermelho conforme o sinal real (lucro ou prejuízo).
function corBarraDre(l: { tipo: string; fim: number }) {
  if (l.tipo === 'entrada') return PALETA.primaria500
  if (l.tipo === 'saida') return PALETA.erro
  if (l.tipo === 'subtotal') return PALETA.indigo500
  return l.fim >= 0 ? PALETA.primaria600 : PALETA.erro
}

const dadosWaterfall = computed(() => ({
  labels: linhasDre.value.map((l) => l.rotulo),
  datasets: [
    {
      data: linhasDre.value.map((l): [number, number] => [l.inicio, l.fim]),
      backgroundColor: linhasDre.value.map((l) => corBarraDre(l)),
      borderRadius: 4,
      borderSkipped: false,
      barPercentage: 0.6,
    },
  ],
}))

const opcoesWaterfall = computed<any>(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      grid: { color: PALETA.borda },
      border: { display: false },
      ticks: { callback: (v: number) => mtCompacto(Number(v)) },
    },
    y: { grid: { display: false }, border: { display: false } },
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items: any[]) => items[0].label,
        label: (ctx: any) => {
          const l = linhasDre.value[ctx.dataIndex]
          if (!l) return ''
          return (l.valor < 0 ? '− ' : '') + mt(Math.abs(l.valor))
        },
      },
    },
  },
}))

// --- Composição do lucro (Receita → Custo → Despesas → Resultado) ---------
const dadosComposicao = computed(() => {
  if (!dre.value) return { labels: [], datasets: [] }
  const d = dre.value
  return {
    labels: ['Receita', 'Custo dos materiais', 'Despesas operacionais', temLucro.value ? 'Lucro líquido' : 'Prejuízo líquido'],
    datasets: [
      {
        data: [d.receita_vendas, d.custo_materiais_vendidos, d.despesas_operacionais, Math.abs(d.lucro_liquido)],
        backgroundColor: [PALETA.primaria500, PALETA.teal500, PALETA.erro, temLucro.value ? PALETA.primaria700 : '#8a3420'],
        borderRadius: 4,
        barPercentage: 0.6,
      },
    ],
  }
})

const opcoesComposicao = computed<any>(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { right: 56 } },
  scales: {
    x: { grid: { color: PALETA.borda }, border: { display: false }, ticks: { callback: (v: number) => mtCompacto(Number(v)) } },
    y: { grid: { display: false }, border: { display: false } },
  },
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx: any) => mt(ctx.raw) } },
    datalabels: {
      display: true,
      anchor: 'end',
      align: 'end',
      clamp: true,
      color: PALETA.texto,
      font: { weight: 600, size: 11 },
      formatter: (v: number) => mtCompacto(v),
    },
  },
}))

// Despesas operacionais detalhadas por categoria (a mesma informação que
// alimenta o painel "Categorias em Destaque" das Despesas, aqui filtrada
// só ao que efectivamente entrou no DRE deste período).
const despesasPorCategoria = computed(() => {
  if (!dre.value) return []
  return Object.entries(dre.value.despesas_por_categoria)
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
})

const dadosDespesasCategoria = computed(() => ({
  labels: despesasPorCategoria.value.map((c) => c.nome),
  datasets: [
    {
      data: despesasPorCategoria.value.map((c) => c.valor),
      backgroundColor: PALETA.ambar500,
      borderRadius: 4,
      barPercentage: 0.6,
    },
  ],
}))

const opcoesDespesasCategoria = computed<any>(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { right: 56 } },
  scales: {
    x: { grid: { color: PALETA.borda }, border: { display: false }, ticks: { callback: (v: number) => mtCompacto(Number(v)) } },
    y: { grid: { display: false }, border: { display: false } },
  },
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (ctx: any) => mt(ctx.raw) } },
    datalabels: {
      display: true,
      anchor: 'end',
      align: 'end',
      clamp: true,
      color: PALETA.texto,
      font: { weight: 600, size: 11 },
      formatter: (v: number) => mtCompacto(v),
    },
  },
}))

// --- Evolução mensal ------------------------------------------------------
// GET /relatorios/dre-mensal?meses=6 — endpoint NOVO, ainda por criar no
// backend (ver prompt fornecido ao dono). Devolve, do mês mais antigo para
// o mais recente, um DRE completo por mês (o mesmo formato de /relatorios/dre,
// com "mes"/"mes_rotulo" a mais). Enquanto o endpoint não existir, esta
// secção mostra silenciosamente "sem dados" em vez de rebentar a tela.
interface DreMensal extends Dre {
  mes: string
  mes_rotulo: string
}

const evolucaoMensal = ref<DreMensal[]>([])
const aCarregarEvolucao = ref(true)

async function carregarEvolucaoMensal() {
  aCarregarEvolucao.value = true
  try {
    const { data } = await api.get('/relatorios/dre-mensal', { params: { meses: 6 } })
    evolucaoMensal.value = data.dados || []
  } catch {
    // Endpoint ainda não existe ou falhou — o painel fica vazio, sem partir a tela.
    evolucaoMensal.value = []
  } finally {
    aCarregarEvolucao.value = false
  }
}

onMounted(carregarEvolucaoMensal)

const dadosEvolucao = computed(() => ({
  labels: evolucaoMensal.value.map((m) => m.mes_rotulo),
  datasets: [
    {
      label: 'Receita',
      data: evolucaoMensal.value.map((m) => m.receita_vendas),
      borderColor: PALETA.primaria500,
      backgroundColor: PALETA.primaria500,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    },
    {
      label: 'Despesas',
      data: evolucaoMensal.value.map((m) => m.despesas_operacionais),
      borderColor: PALETA.erro,
      backgroundColor: PALETA.erro,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    },
    {
      label: 'Lucro líquido',
      data: evolucaoMensal.value.map((m) => m.lucro_liquido),
      borderColor: PALETA.indigo600,
      backgroundColor: PALETA.indigo600,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    },
  ],
}))

const opcoesEvolucao = computed<any>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: { grid: { display: false }, border: { display: false } },
    y: { grid: { color: PALETA.borda }, border: { display: false }, ticks: { callback: (v: number) => mtCompacto(Number(v)) } },
  },
  plugins: {
    legend: { position: 'top', align: 'start' },
    tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${mt(ctx.parsed.y)}` } },
  },
}))
</script>

<template>
  <AppLayout>
    <template #caminho>Painel / Relatórios</template>

    <!-- Cabeçalho -->
    <div class="cabecalho">
      <div>
        <h1>Relatórios Executivos</h1>
        <p>Analise o desempenho financeiro e operacional da Jay Recicly.</p>
      </div>
      <div class="cabecalho__accoes">
        <div class="periodo">
          <input v-model="dataInicio" type="date" class="filtro-pesquisa" @change="carregar" />
          <span>até</span>
          <input v-model="dataFim" type="date" class="filtro-pesquisa" @change="carregar" />
        </div>
        <button type="button" class="botao-fantasma" disabled title="Em breve">
          Exportar PDF
          <small>em breve</small>
        </button>
      </div>
    </div>

    <div v-if="aCarregar" class="estado">
      <span class="spinner" aria-hidden="true"></span>
      <p>A gerar relatório…</p>
    </div>
    <p v-else-if="erro" class="estado estado--erro" role="alert">{{ erro }}</p>

    <template v-else-if="dre">
      <!-- Resumo consolidado -->
      <section class="hero" :class="temLucro ? 'hero--lucro' : 'hero--prejuizo'">
        <span class="hero__etiqueta">Resumo do período</span>
        <h2 v-if="temLucro">O negócio teve lucro neste período</h2>
        <h2 v-else>O negócio teve prejuízo neste período</h2>
        <p>
          De {{ mt(dre.receita_vendas) }} em vendas, {{ temLucro ? 'sobrou um lucro líquido de' : 'ficou um prejuízo líquido de' }}
          <strong>{{ mt(Math.abs(dre.lucro_liquido)) }}</strong>
          — uma margem de {{ dre.margem_liquida_pct }}%.
        </p>
      </section>

      <!-- Cartões -->
      <section class="cartoes">
        <div class="card-kpi card-kpi--verde">
          <div class="card-kpi__topo">
            <span class="card-kpi__rotulo">Receita Total</span>
          </div>
          <strong class="card-kpi__valor card-kpi__valor--verde">{{ mt(dre.receita_vendas) }}</strong>
          <small class="card-kpi__nota">Total de vendas do período</small>
        </div>

        <div class="card-kpi card-kpi--teal">
          <div class="card-kpi__topo">
            <span class="card-kpi__rotulo">Custo dos Materiais</span>
          </div>
          <strong class="card-kpi__valor card-kpi__valor--teal">{{ mt(dre.custo_materiais_vendidos) }}</strong>
          <small class="card-kpi__nota">O que a sucata vendida custou</small>
        </div>

        <div class="card-kpi card-kpi--vermelho">
          <div class="card-kpi__topo">
            <span class="card-kpi__rotulo">Despesas Operacionais</span>
          </div>
          <strong class="card-kpi__valor card-kpi__valor--vermelho">{{ mt(dre.despesas_operacionais) }}</strong>
          <small class="card-kpi__nota">Renda, salários, transporte…</small>
        </div>

        <div class="card-kpi" :class="temLucro ? 'card-kpi--destaque' : 'card-kpi--destaque-alerta'">
          <div class="card-kpi__topo">
            <span class="card-kpi__rotulo">{{ temLucro ? 'Lucro Líquido' : 'Prejuízo Líquido' }}</span>
          </div>
          <strong class="card-kpi__valor">{{ mt(Math.abs(dre.lucro_liquido)) }}</strong>
          <small class="card-kpi__nota">Margem de {{ dre.margem_liquida_pct }}%</small>
        </div>
      </section>

      <div class="grelha">
        <!-- O DRE em si — a peça principal -->
        <section class="painel-bloco">
          <h2>Demonstração de Resultados (DRE)</h2>
          <p class="subtitulo">Como se chega do total de vendas ao lucro real, passo a passo.</p>

          <div class="grafico-alto">
            <Bar :data="dadosWaterfall" :options="opcoesWaterfall" />
          </div>

          <div class="dre-nota">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" stroke-linecap="round" />
            </svg>
            Isto mede o <strong>lucro</strong>, não o dinheiro em caixa. Uma venda a crédito conta aqui, mesmo antes de o
            dinheiro entrar — para o saldo real, consulta o Livro-caixa.
          </div>
        </section>

        <!-- Coluna lateral -->
        <aside class="lateral-dir">
          <div class="painel-bloco">
            <h3>Composição do Lucro</h3>
            <div class="grafico-medio">
              <Bar :data="dadosComposicao" :options="opcoesComposicao" />
            </div>
          </div>

          <div v-if="despesasPorCategoria.length > 0" class="painel-bloco">
            <h3>Despesas Operacionais por Categoria</h3>
            <div class="grafico-medio" :style="{ height: Math.max(120, despesasPorCategoria.length * 34) + 'px' }">
              <Bar :data="dadosDespesasCategoria" :options="opcoesDespesasCategoria" />
            </div>
          </div>

          <div class="painel-bloco">
            <h3>Mais Análises</h3>
            <div class="em-breve-lista">
              <div class="em-breve-item">Composição de materiais por categoria</div>
              <div class="em-breve-item">Comparação com período anterior</div>
              <div class="em-breve-item">Exportar PDF / Excel</div>
            </div>
            <p class="em-breve-legenda">Em breve — requerem novos endpoints.</p>
          </div>
        </aside>
      </div>

      <!-- Evolução mensal — largura total, é a peça que mais beneficia de espaço -->
      <section class="painel-bloco painel-bloco--evolucao">
        <h2>Evolução Mensal</h2>
        <p class="subtitulo">Receita, despesas e lucro líquido dos últimos 6 meses.</p>

        <div v-if="aCarregarEvolucao" class="estado">
          <span class="spinner" aria-hidden="true"></span>
        </div>
        <p v-else-if="evolucaoMensal.length === 0" class="vazio">
          Ainda sem dados suficientes para uma evolução mensal — este painel liga-se automaticamente assim que o endpoint
          <code>/relatorios/dre-mensal</code> existir no backend.
        </p>
        <div v-else class="grafico-alto">
          <Line :data="dadosEvolucao" :options="opcoesEvolucao" />
        </div>
      </section>
    </template>
  </AppLayout>
</template>

<style scoped>
.cabecalho {
  flex-wrap: wrap;
}
.cabecalho__accoes {
  align-items: center;
}
.periodo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--cor-texto-suave);
}
.periodo .filtro-pesquisa {
  padding: 8px 10px;
}

/* ---- Resumo consolidado (hero) ---- */
.hero {
  border-radius: var(--raio);
  padding: 28px;
  margin-bottom: 22px;
  color: #fff;
}
.hero--lucro {
  background: linear-gradient(135deg, var(--cor-primaria-700), var(--cor-teal-500));
}
.hero--prejuizo {
  background: linear-gradient(135deg, #8a3420, var(--cor-erro));
}
.hero__etiqueta {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.85;
}
.hero h2 {
  font-family: var(--fonte-titulo);
  font-size: 23px;
  margin: 8px 0 10px;
}
.hero p {
  margin: 0;
  font-size: 15px;
  opacity: 0.95;
  max-width: 640px;
  line-height: 1.5;
}
.hero strong {
  font-weight: 700;
}

/* Cartão-destaque em alerta: o mesmo tratamento do card-kpi--destaque
   (gradiente cheio, texto branco), mas em tons de vermelho para o prejuízo. */
.card-kpi--destaque-alerta {
  background: linear-gradient(135deg, #8a3420, var(--cor-erro));
  border-color: transparent;
}
.card-kpi--destaque-alerta::before {
  display: none;
}
.card-kpi--destaque-alerta .card-kpi__rotulo {
  color: rgb(255 255 255 / 0.85);
}
.card-kpi--destaque-alerta .card-kpi__valor {
  color: #fff;
}
.card-kpi--destaque-alerta .card-kpi__nota {
  color: rgb(255 255 255 / 0.75);
}

.grelha {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 18px;
}
.lateral-dir {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.lateral-dir h3 {
  font-size: 15px;
  margin: 0 0 16px;
  color: var(--cor-texto);
}

/* ---- Contentores dos gráficos (o Chart.js precisa de altura fixa no pai) ---- */
.grafico-alto {
  position: relative;
  height: 340px;
}
.grafico-medio {
  position: relative;
  height: 200px;
}

.dre-nota {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: var(--cor-fundo);
  border-radius: var(--raio-sm);
  padding: 14px 16px;
  margin-top: 20px;
  font-size: 13px;
  color: var(--cor-texto-suave);
  line-height: 1.5;
}
.dre-nota svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.dre-nota strong {
  color: var(--cor-texto);
}

/* ---- Mais análises (em breve) ---- */
.em-breve-lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.em-breve-item {
  border: 1.5px dashed var(--cor-borda);
  border-radius: var(--raio-sm);
  padding: 12px;
  font-size: 13px;
  color: #9aa8a1;
}
.em-breve-legenda {
  font-size: 12px;
  color: #b3bdb7;
  margin: 12px 0 0;
  text-align: center;
  font-style: italic;
}

.painel-bloco--evolucao {
  margin-top: 18px;
}

@media (max-width: 1000px) {
  .grelha {
    grid-template-columns: 1fr;
  }
}
</style>
