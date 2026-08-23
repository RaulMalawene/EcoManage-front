<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/services/api'
import { ICONES } from '@/utils/icones'
import { mt, dataCurta, dataIsoLocal } from '@/utils/formato'
import type { Paginacao } from '@/types/api'

interface Movimento {
  id: number
  data: string
  descricao: string
  categoria_rotulo: string
  origem_tipo: string | null
  tipo: 'entrada' | 'saida' | string
  valor: number
}

interface Fluxo {
  entradas: number
  saidas: number
}

// --- Estado ---
const movimentos = ref<Movimento[]>([])
const saldoActual = ref(0)
const fluxo = ref<Fluxo>({ entradas: 0, saidas: 0 })
const paginacao = ref<Paginacao>({ pagina: 1, ultima_pagina: 1, total: 0 })
const aCarregar = ref(true)
const erro = ref('')

// --- Filtros ---
const pesquisa = ref('')
const tipoFiltro = ref<'' | 'entrada' | 'saida'>('')
const periodo = ref('30') // dias
const paginaActual = ref(1)

// Traduz o período (em dias) para datas de início/fim (em hora local —
// toISOString() desliza um dia perto da meia-noite por causa do UTC).
function intervaloDatas() {
  const fim = new Date()
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - Number(periodo.value))
  return { data_inicio: dataIsoLocal(inicio), data_fim: dataIsoLocal(fim) }
}

async function carregar() {
  aCarregar.value = true
  erro.value = ''
  try {
    const { data_inicio, data_fim } = intervaloDatas()

    // Extracto (movimentos) + fluxo do período, em paralelo.
    const [resCaixa, resFluxo] = await Promise.all([
      api.get('/caixa', {
        params: {
          data_inicio,
          data_fim,
          tipo: tipoFiltro.value || undefined,
          page: paginaActual.value,
        },
      }),
      api.get('/caixa/fluxo', { params: { data_inicio, data_fim } }),
    ])

    movimentos.value = resCaixa.data.dados.itens || []
    saldoActual.value = resCaixa.data.dados.saldo_actual || 0
    paginacao.value = resCaixa.data.dados.paginacao || paginacao.value
    fluxo.value = resFluxo.data.dados || fluxo.value
  } catch (e) {
    erro.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível carregar o livro-caixa.'
  } finally {
    aCarregar.value = false
  }
}

onMounted(carregar)

// Recarrega quando muda o filtro de tipo ou o período (volta à página 1).
watch([tipoFiltro, periodo], () => {
  paginaActual.value = 1
  carregar()
})

watch(paginaActual, carregar)

// Pesquisa por descrição é feita no cliente (sobre a página carregada).
const movimentosFiltrados = computed(() => {
  if (!pesquisa.value.trim()) return movimentos.value
  const termo = pesquisa.value.toLowerCase()
  return movimentos.value.filter((m) => m.descricao?.toLowerCase().includes(termo))
})

function irPara(p: number) {
  if (p >= 1 && p <= paginacao.value.ultima_pagina) paginaActual.value = p
}

const paginas = computed(() => {
  const total = paginacao.value.ultima_pagina
  return Array.from({ length: total }, (_, i) => i + 1).slice(0, 5)
})
</script>

<template>
  <AppLayout>
    <template #caminho>Painel / Livro-caixa</template>

    <div class="cabecalho">
      <div>
        <h1>Livro-caixa</h1>
        <p>Consulta todas as entradas e saídas financeiras da Jay Recicly.</p>
      </div>
      <div class="cabecalho__accoes">
        <button type="button" class="botao-fantasma" disabled title="Em breve">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Exportar PDF
          <small>em breve</small>
        </button>
      </div>
    </div>

    <div class="nota">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" stroke-linecap="round" />
      </svg>
      O livro-caixa preenche-se automaticamente a partir das compras, vendas, empréstimos e despesas. Para
      registar dinheiro, usa o módulo respetivo.
    </div>

    <p v-if="erro" class="estado estado--erro" role="alert">{{ erro }}</p>

    <!-- Cartões -->
    <section class="cartoes">
      <div class="card-kpi card-kpi--destaque">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Saldo atual</span>
          <span class="card-kpi__icone" v-html="ICONES.caixa"></span>
        </div>
        <strong class="card-kpi__valor">{{ mt(saldoActual) }}</strong>
      </div>
      <div class="card-kpi">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Total entradas (período)</span>
          <span class="card-kpi__icone card-kpi__icone--verde" v-html="ICONES.vendas"></span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--verde">{{ mt(fluxo.entradas, { abs: true }) }}</strong>
      </div>
      <div class="card-kpi">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Total saídas (período)</span>
          <span class="card-kpi__icone card-kpi__icone--vermelho" v-html="ICONES.compras"></span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--vermelho">{{ mt(fluxo.saidas, { abs: true }) }}</strong>
      </div>
    </section>

    <!-- Tabela -->
    <section class="painel-bloco">
      <div class="painel-bloco__topo">
        <h2>Histórico de Transações</h2>
        <div class="filtros">
          <input v-model="pesquisa" type="text" placeholder="Pesquisar descrição…" class="filtro-pesquisa" />
          <select v-model="tipoFiltro" class="filtro-select">
            <option value="">Todos os tipos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>
          <select v-model="periodo" class="filtro-select">
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
          </select>
        </div>
      </div>

      <div v-if="aCarregar" class="estado">
        <span class="spinner" aria-hidden="true"></span>
        <p>A carregar transações…</p>
      </div>
      <p v-else-if="movimentosFiltrados.length === 0" class="vazio">Sem movimentos neste período.</p>

      <table v-else class="tabela">
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th class="ao-centro">Origem</th>
            <th class="ao-fim">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in movimentosFiltrados" :key="m.id">
            <td class="nowrap">{{ dataCurta(m.data) }}</td>
            <td class="descricao">{{ m.descricao }}</td>
            <td>{{ m.categoria_rotulo }}</td>
            <td class="ao-centro">
              <span class="etiqueta etiqueta--concluido">{{ m.origem_tipo || 'Manual' }}</span>
            </td>
            <td class="ao-fim">
              <span :class="m.tipo === 'entrada' ? 'valor--positivo' : 'valor--negativo'">
                {{ m.tipo === 'entrada' ? '+' : '−' }} {{ mt(m.valor, { abs: true }) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Paginação -->
      <div v-if="!aCarregar && paginacao.total > 0" class="paginacao">
        <span class="paginacao__info">
          A mostrar {{ movimentosFiltrados.length }} de {{ paginacao.total }} movimentos
        </span>
        <div class="paginacao__botoes">
          <button class="pg-btn" :disabled="paginaActual === 1" @click="irPara(paginaActual - 1)">Anterior</button>
          <button
            v-for="p in paginas"
            :key="p"
            class="pg-btn"
            :class="{ 'pg-btn--activo': p === paginaActual }"
            @click="irPara(p)"
          >
            {{ p }}
          </button>
          <button
            class="pg-btn"
            :disabled="paginaActual === paginacao.ultima_pagina"
            @click="irPara(paginaActual + 1)"
          >
            Próximo
          </button>
        </div>
      </div>
    </section>
  </AppLayout>
</template>

<style scoped>
.nota {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--cor-primaria-50);
  color: var(--cor-primaria-700);
  border-radius: var(--raio-sm);
  padding: 12px 16px;
  font-size: 13px;
  margin-bottom: 22px;
}
.nota svg {
  flex-shrink: 0;
}

.filtros {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.descricao {
  font-weight: 500;
  color: var(--cor-texto);
}
.valor--positivo {
  color: var(--cor-primaria-600);
  font-weight: 600;
  white-space: nowrap;
}
.valor--negativo {
  color: var(--cor-erro);
  font-weight: 600;
  white-space: nowrap;
}

</style>
