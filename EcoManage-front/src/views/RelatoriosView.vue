<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/services/api'
import { mt, dataIsoLocal } from '@/utils/formato'

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

// As linhas do DRE, em camadas, para a tabela principal — a MESMA conta
// que o DreService devolve, sem nenhum cálculo feito aqui: só formatação.
const linhasDre = computed(() => {
  if (!dre.value) return []
  const d = dre.value
  return [
    { rotulo: 'Receita de vendas', valor: d.receita_vendas, tipo: 'entrada', nivel: 0 },
    { rotulo: '(−) Custo dos materiais vendidos', valor: -d.custo_materiais_vendidos, tipo: 'saida', nivel: 1 },
    { rotulo: '= Lucro bruto', valor: d.lucro_bruto, tipo: 'subtotal', nivel: 0, margem: d.margem_bruta_pct },
    { rotulo: '(+) Juros de empréstimos', valor: d.outras_receitas?.juros_emprestimos || 0, tipo: 'entrada', nivel: 1 },
    { rotulo: '(−) Despesas operacionais', valor: -d.despesas_operacionais, tipo: 'saida', nivel: 1 },
    { rotulo: '= Resultado operacional', valor: d.resultado_operacional, tipo: 'subtotal', nivel: 0 },
    { rotulo: '(−) Impostos e outros', valor: -d.impostos_outros, tipo: 'saida', nivel: 1 },
    { rotulo: '= Lucro líquido', valor: d.lucro_liquido, tipo: 'total', nivel: 0, margem: d.margem_liquida_pct },
  ]
})

// Despesas operacionais detalhadas por categoria (a mesma informação que
// alimenta o painel "Categorias em Destaque" das Despesas, aqui filtrada
// só ao que efectivamente entrou no DRE deste período).
const despesasPorCategoria = computed(() => {
  if (!dre.value) return []
  return Object.entries(dre.value.despesas_por_categoria)
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
})
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

          <table class="dre-tabela">
            <tbody>
              <tr v-for="(l, i) in linhasDre" :key="i" :class="`linha--${l.tipo}`">
                <td class="dre-rotulo" :class="{ 'dre-rotulo--indent': l.nivel === 1 }">
                  {{ l.rotulo }}
                  <span v-if="l.margem !== undefined" class="dre-margem">{{ l.margem }}% margem</span>
                </td>
                <td class="dre-valor" :class="l.valor < 0 ? 'negativo' : 'positivo'">
                  {{ l.valor < 0 ? '−' : '' }}{{ mt(Math.abs(l.valor)) }}
                </td>
              </tr>
            </tbody>
          </table>

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
            <div class="composicao">
              <div class="comp-linha">
                <span>Receita</span>
                <div class="comp-barra"><div class="comp-fill comp-fill--verde" style="width: 100%"></div></div>
                <strong>{{ mt(dre.receita_vendas) }}</strong>
              </div>
              <div class="comp-linha">
                <span>Custo materiais</span>
                <div class="comp-barra">
                  <div
                    class="comp-fill comp-fill--teal"
                    :style="{ width: dre.receita_vendas > 0 ? (dre.custo_materiais_vendidos / dre.receita_vendas) * 100 + '%' : '0%' }"
                  ></div>
                </div>
                <strong>{{ mt(dre.custo_materiais_vendidos) }}</strong>
              </div>
              <div class="comp-linha">
                <span>Despesas</span>
                <div class="comp-barra">
                  <div
                    class="comp-fill comp-fill--vermelho"
                    :style="{ width: dre.receita_vendas > 0 ? (dre.despesas_operacionais / dre.receita_vendas) * 100 + '%' : '0%' }"
                  ></div>
                </div>
                <strong>{{ mt(dre.despesas_operacionais) }}</strong>
              </div>
              <div class="comp-linha comp-linha--total">
                <span>{{ temLucro ? 'Sobra (lucro)' : 'Falta (prejuízo)' }}</span>
                <div class="comp-barra">
                  <div
                    class="comp-fill"
                    :class="temLucro ? 'comp-fill--escuro' : 'comp-fill--vermelho-escuro'"
                    :style="{ width: dre.receita_vendas > 0 ? Math.min(100, Math.max(0, (Math.abs(dre.lucro_liquido) / dre.receita_vendas) * 100)) + '%' : '0%' }"
                  ></div>
                </div>
                <strong>{{ mt(Math.abs(dre.lucro_liquido)) }}</strong>
              </div>
            </div>
          </div>

          <div v-if="despesasPorCategoria.length > 0" class="painel-bloco">
            <h3>Despesas Operacionais por Categoria</h3>
            <div class="categorias-lista">
              <div v-for="c in despesasPorCategoria" :key="c.nome" class="categorias-item">
                <span class="categorias-item__nome">{{ c.nome }}</span>
                <span class="categorias-item__valor">{{ mt(c.valor) }}</span>
              </div>
            </div>
          </div>

          <div class="painel-bloco">
            <h3>Mais Análises</h3>
            <div class="em-breve-lista">
              <div class="em-breve-item">Evolução mensal (vários meses)</div>
              <div class="em-breve-item">Composição de materiais por categoria</div>
              <div class="em-breve-item">Comparação com período anterior</div>
              <div class="em-breve-item">Exportar PDF / Excel</div>
            </div>
            <p class="em-breve-legenda">Em breve — requerem novos endpoints.</p>
          </div>
        </aside>
      </div>
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

/* ---- Tabela do DRE ---- */
.dre-tabela {
  width: 100%;
  border-collapse: collapse;
}
.dre-tabela td {
  padding: 12px 8px;
  font-size: 14px;
  border-bottom: 1px solid var(--cor-neutra-fundo);
}
.dre-rotulo {
  color: var(--cor-texto);
}
.dre-rotulo--indent {
  padding-left: 24px;
  color: var(--cor-texto-suave);
  font-size: 13px;
}
.dre-margem {
  display: inline-block;
  margin-left: 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--cor-primaria-600);
  background: var(--cor-primaria-50);
  padding: 2px 8px;
  border-radius: 10px;
}
.dre-valor {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.dre-valor.positivo {
  color: var(--cor-primaria-600);
}
.dre-valor.negativo {
  color: var(--cor-erro);
}
.linha--subtotal td {
  font-weight: 600;
  background: var(--cor-fundo);
}
.linha--subtotal .dre-rotulo {
  color: var(--cor-texto);
}
.linha--total td {
  font-weight: 700;
  font-size: 16px;
  border-top: 2px solid var(--cor-primaria-600);
  border-bottom: none;
  padding-top: 16px;
}
.linha--total .dre-rotulo {
  color: var(--cor-primaria-700);
}
.linha--total .dre-valor {
  color: var(--cor-primaria-700);
}
.linha--total .dre-valor.negativo {
  color: var(--cor-erro);
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

/* ---- Composição do lucro ---- */
.composicao {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.comp-linha {
  display: grid;
  grid-template-columns: 90px 1fr auto;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--cor-texto);
}
.comp-barra {
  height: 8px;
  background: var(--cor-neutra-fundo);
  border-radius: 5px;
  overflow: hidden;
}
.comp-fill {
  height: 100%;
  border-radius: 5px;
}
.comp-fill--verde {
  background: var(--cor-primaria-500);
}
.comp-fill--teal {
  background: var(--cor-teal-500);
}
.comp-fill--vermelho {
  background: var(--cor-erro);
}
.comp-fill--escuro {
  background: var(--cor-primaria-700);
}
.comp-fill--vermelho-escuro {
  background: #8a3420;
}
.comp-linha strong {
  font-size: 12px;
  color: var(--cor-texto);
  font-variant-numeric: tabular-nums;
}
.comp-linha--total {
  border-top: 1px solid var(--cor-neutra-fundo);
  padding-top: 12px;
  margin-top: 4px;
}

/* ---- Despesas por categoria ---- */
.categorias-lista {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.categorias-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--cor-fundo);
  border-radius: var(--raio-sm);
  font-size: 13px;
}
.categorias-item__nome {
  color: var(--cor-texto);
  font-weight: 500;
}
.categorias-item__valor {
  color: var(--cor-erro);
  font-weight: 600;
  white-space: nowrap;
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

@media (max-width: 1000px) {
  .grelha {
    grid-template-columns: 1fr;
  }
}
</style>
