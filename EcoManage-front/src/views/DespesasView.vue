<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import axios from 'axios'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/services/api'
import { ICONES } from '@/utils/icones'
import { mt, dataCurta, dataIsoLocal } from '@/utils/formato'
import { baixarFicheiro } from '@/utils/exportar'
import type { Paginacao } from '@/types/api'

interface Despesa {
  id: number
  data: string
  data_competencia: string | null
  categoria: string
  grupo_dre: 'operacional' | 'impostos_outros' | 'nao_operacional' | string
  grupo_dre_rotulo: string
  descricao: string
  valor: number
  pessoa: string | null
}

interface ResumoDespesas {
  total: number
}

const despesas = ref<Despesa[]>([])
const resumo = ref<ResumoDespesas>({ total: 0 })
const paginacao = ref<Paginacao>({ pagina: 1, ultima_pagina: 1, total: 0 })
const aCarregar = ref(true)
const erro = ref('')
const pesquisa = ref('')
const paginaActual = ref(1)

async function carregar() {
  aCarregar.value = true
  erro.value = ''
  try {
    const { data } = await api.get('/despesas', { params: { page: paginaActual.value } })
    despesas.value = data.dados.itens || []
    resumo.value = data.dados.resumo || resumo.value
    paginacao.value = data.dados.paginacao || paginacao.value
  } catch (e) {
    erro.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível carregar as despesas.'
  } finally {
    aCarregar.value = false
  }
}

onMounted(carregar)

const despesasFiltradas = computed(() => {
  if (!pesquisa.value.trim()) return despesas.value
  const termo = pesquisa.value.toLowerCase()
  return despesas.value.filter(
    (d) => d.descricao?.toLowerCase().includes(termo) || d.categoria?.toLowerCase().includes(termo),
  )
})

// Distribuição por grupo de DRE (dados já carregados): para onde vai o
// dinheiro do ponto de vista contabilístico.
const porGrupo = computed(() => {
  const grupos = new Map<string, number>()
  for (const d of despesas.value) {
    const rotulo = d.grupo_dre_rotulo || d.grupo_dre
    grupos.set(rotulo, (grupos.get(rotulo) || 0) + Number(d.valor || 0))
  }
  return [...grupos.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
})

// Top categorias livres (o texto que o dono escreveu, ex.: "Renda", "Salários").
const porCategoria = computed(() => {
  const categorias = new Map<string, number>()
  for (const d of despesas.value) {
    categorias.set(d.categoria, (categorias.get(d.categoria) || 0) + Number(d.valor || 0))
  }
  return [...categorias.entries()]
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5)
})

const maiorCategoria = computed(() => porCategoria.value[0] ?? null)

// Total desta página (não o total geral do servidor), é a base correcta
// para as percentagens da distribuição por grupo, já que `porGrupo` só
// soma o que está carregado.
const totalPagina = computed(() => porGrupo.value.reduce((s, g) => s + g.valor, 0))

// Classe de cor da etiqueta por grupo DRE (reaproveita os tons já usados
// noutras telas: verde = rotina/bom, âmbar = atenção, cinza = neutro).
function classeGrupo(grupo: string) {
  if (grupo === 'operacional') return 'pronto'
  if (grupo === 'impostos_outros') return 'medio'
  return 'neutro'
}

function refDespesa(id: number) {
  return 'DSP-' + String(id).padStart(4, '0')
}

function irPara(p: number) {
  if (p >= 1 && p <= paginacao.value.ultima_pagina) {
    paginaActual.value = p
    carregar()
  }
}

// --- Exportar PDF ---------------------------------------------------------
// GET /despesas/exportar — endpoint NOVO, ainda por criar no backend (ver
// prompt fornecido ao dono).
const aExportar = ref(false)

async function exportar() {
  aExportar.value = true
  try {
    await baixarFicheiro('/despesas/exportar')
  } catch {
    erro.value = 'Não foi possível exportar. Confirma que o endpoint /despesas/exportar já existe no backend.'
  } finally {
    aExportar.value = false
  }
}

// --- Modal "Registar Despesa" ---------------------------------------------
// POST /despesas: { categoria, descricao, valor, data?, data_competencia?,
// grupo_dre? ('operacional'|'impostos_outros'|'nao_operacional', por omissão
// 'operacional'), pessoa_id? }. `data` = quando o dinheiro saiu (caixa);
// `data_competencia` = a que mês o gasto pertence (DRE), só difere em casos
// como salário de Junho pago em Julho, por isso fica nas opções avançadas.
const categoriasSugeridas = ['Renda', 'Salários', 'Transporte', 'Energia', 'Água', 'Combustível', 'Manutenção', 'Material de escritório', 'Outros']

interface FormDespesa {
  categoria: string
  descricao: string
  valor: string
  data: string
  data_competencia: string
  grupo_dre: 'operacional' | 'impostos_outros' | 'nao_operacional'
}

function formVazio(): FormDespesa {
  return {
    categoria: '',
    descricao: '',
    valor: '',
    data: dataIsoLocal(new Date()),
    data_competencia: '',
    grupo_dre: 'operacional',
  }
}

const modalAberto = ref(false)
const form = reactive<FormDespesa>(formVazio())
const aGuardar = ref(false)
const erroForm = ref('')
const errosCampo = ref<Record<string, string[]>>({})

function abrirModal() {
  Object.assign(form, formVazio())
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

  // Validação leve no cliente, feedback imediato antes de gastar um pedido.
  if (!form.categoria.trim()) {
    erroForm.value = 'Escolha ou escreva a categoria.'
    return
  }
  if (!form.descricao.trim()) {
    erroForm.value = 'Escreva uma descrição.'
    return
  }
  if (!(parseFloat(form.valor) > 0)) {
    erroForm.value = 'O valor tem de ser maior que zero.'
    return
  }

  aGuardar.value = true
  try {
    await api.post('/despesas', {
      categoria: form.categoria.trim(),
      descricao: form.descricao.trim(),
      valor: parseFloat(form.valor),
      data: form.data,
      grupo_dre: form.grupo_dre,
      // Competência só vai se for diferente da data de pagamento.
      data_competencia: form.data_competencia || undefined,
    })

    fecharModal()
    paginaActual.value = 1
    await carregar()
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data?.erros) {
      errosCampo.value = e.response.data.erros
    }
    erroForm.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível guardar a despesa. Tenta novamente.'
  } finally {
    aGuardar.value = false
  }
}
</script>

<template>
  <AppLayout>
    <template #caminho>Painel / Despesas</template>

    <!-- Cabeçalho -->
    <div class="cabecalho">
      <div>
        <h1>Gestão de Despesas</h1>
        <p>Registo e categorização das saídas de caixa da Jay Recicly.</p>
      </div>
      <div class="cabecalho__accoes">
        <button type="button" class="botao-fantasma" :disabled="aExportar" @click="exportar">
          <span v-if="aExportar" class="spinner" aria-hidden="true"></span>
          {{ aExportar ? 'A exportar…' : 'Exportar Relatório' }}
        </button>
        <button type="button" class="botao-primario" @click="abrirModal">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          Registar Despesa
        </button>
      </div>
    </div>

    <div class="nota">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" stroke-linecap="round" />
      </svg>
      As despesas entram automaticamente no livro-caixa e no DRE (excepto as "não operacionais", que ficam de fora do
      cálculo do lucro). Consulta o resultado em Relatórios.
    </div>

    <p v-if="erro" class="estado estado--erro" role="alert">{{ erro }}</p>

    <!-- Cartões -->
    <section class="cartoes">
      <div class="card-kpi card-kpi--verde">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Total de Despesas</span>
          <span class="card-kpi__icone card-kpi__icone--verde" v-html="ICONES.despesas"></span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--verde">{{ mt(resumo.total) }}</strong>
        <small class="card-kpi__nota">listadas</small>
      </div>

      <div class="card-kpi card-kpi--indigo">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Nº de Despesas</span>
          <span class="card-kpi__icone card-kpi__icone--indigo">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--indigo">{{ paginacao.total }}</strong>
        <small class="card-kpi__nota">registadas</small>
      </div>

      <div class="card-kpi card-kpi--ambar">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Maior Categoria</span>
          <span class="card-kpi__icone card-kpi__icone--ambar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 6l-9.5 9.5-5-5L1 18" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M17 6h6v6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--ambar">{{ maiorCategoria?.nome || '-' }}</strong>
        <small class="card-kpi__nota">{{ maiorCategoria ? mt(maiorCategoria.valor) + ' no total' : 'sem despesas ainda' }}</small>
      </div>
    </section>

    <div class="grelha">
      <!-- Histórico -->
      <section class="painel-bloco">
        <div class="painel-bloco__topo">
          <div>
            <h2>Histórico de Transações</h2>
            <p class="subtitulo">Lista detalhada das despesas recentes.</p>
          </div>
          <input v-model="pesquisa" type="text" placeholder="Filtrar despesas…" class="filtro-pesquisa" />
        </div>

        <div v-if="aCarregar" class="estado">
          <span class="spinner" aria-hidden="true"></span>
          <p>A carregar despesas…</p>
        </div>
        <p v-else-if="despesasFiltradas.length === 0" class="vazio">Ainda não há despesas registadas.</p>

        <table v-else class="tabela">
          <thead>
            <tr>
              <th>Ref.</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Data</th>
              <th class="ao-fim">Valor</th>
              <th class="ao-centro">Grupo DRE</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in despesasFiltradas" :key="d.id">
              <td class="ref nowrap">{{ refDespesa(d.id) }}</td>
              <td class="forte">{{ d.descricao }}</td>
              <td><span class="etiqueta-cat">{{ d.categoria }}</span></td>
              <td class="nowrap">{{ dataCurta(d.data) }}</td>
              <td class="ao-fim nowrap">{{ mt(d.valor) }}</td>
              <td class="ao-centro">
                <span class="etiqueta" :class="`etiqueta--${classeGrupo(d.grupo_dre)}`">{{ d.grupo_dre_rotulo }}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="!aCarregar && paginacao.total > 0" class="paginacao">
          <span class="paginacao__info">A mostrar {{ despesasFiltradas.length }} de {{ paginacao.total }} despesas</span>
          <div class="paginacao__botoes">
            <button class="pg-btn" :disabled="paginaActual === 1" @click="irPara(paginaActual - 1)">Anterior</button>
            <button class="pg-btn" :disabled="paginaActual === paginacao.ultima_pagina" @click="irPara(paginaActual + 1)">Próximo</button>
          </div>
        </div>
      </section>

      <!-- Coluna lateral -->
      <aside class="lateral-dir">
        <div class="painel-bloco">
          <h3 class="com-icone">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 21H4a1 1 0 0 1-1-1V3" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M7 15l4-4 3 3 5-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Distribuição por Grupo
          </h3>
          <p class="subtitulo-mini">Para onde vai o dinheiro (grupo de DRE).</p>

          <p v-if="porGrupo.length === 0" class="vazio-mini">Ainda não há despesas.</p>

          <div v-else class="grupos">
            <div v-for="g in porGrupo" :key="g.nome" class="grupo">
              <div class="grupo__topo">
                <span>{{ g.nome }}</span>
                <strong>{{ mt(g.valor) }}</strong>
              </div>
              <div class="barra">
                <div
                  class="barra__preenchimento"
                  :style="{ width: totalPagina > 0 ? (g.valor / totalPagina) * 100 + '%' : '0%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div class="painel-bloco">
          <h3 class="com-icone">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
              <path
                d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                stroke-linejoin="round"
              />
              <path d="M12 9v4M12 17h.01" stroke-linecap="round" />
            </svg>
            Categorias em Destaque
          </h3>
          <p class="subtitulo-mini">As categorias com mais gasto acumulado.</p>

          <p v-if="porCategoria.length === 0" class="vazio-mini">Ainda não há despesas.</p>

          <div v-else class="categorias-lista">
            <div v-for="c in porCategoria" :key="c.nome" class="categorias-item">
              <span class="categorias-item__nome">{{ c.nome }}</span>
              <span class="categorias-item__valor">{{ mt(c.valor) }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Modal: registar despesa -->
    <Teleport to="body">
      <div v-if="modalAberto" class="modal-veu" @click.self="fecharModal">
        <div class="modal-cartao" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-despesa">
          <div class="modal-cabecalho">
            <h3 id="titulo-modal-despesa">Registar Despesa</h3>
            <button type="button" class="modal-fechar" aria-label="Fechar" @click="fecharModal">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <form class="modal-form" @submit.prevent="guardar">
            <div class="campo-modal">
              <label for="categoria-despesa">Categoria</label>
              <input id="categoria-despesa" v-model="form.categoria" list="categorias-despesa" placeholder="ex.: Renda, Salários…" />
              <datalist id="categorias-despesa">
                <option v-for="c in categoriasSugeridas" :key="c" :value="c" />
              </datalist>
              <span v-if="erroCampo('categoria')" class="campo-modal__erro">{{ erroCampo('categoria') }}</span>
            </div>

            <div class="campo-modal">
              <label for="descricao-despesa">Descrição</label>
              <input id="descricao-despesa" v-model="form.descricao" type="text" placeholder="ex.: Renda do armazém, Agosto" />
              <span v-if="erroCampo('descricao')" class="campo-modal__erro">{{ erroCampo('descricao') }}</span>
            </div>

            <div class="campo-modal-grupo">
              <div class="campo-modal">
                <label for="valor-despesa">Valor</label>
                <input id="valor-despesa" v-model="form.valor" type="number" min="0" step="0.01" placeholder="0.00" />
                <span v-if="erroCampo('valor')" class="campo-modal__erro">{{ erroCampo('valor') }}</span>
              </div>
              <div class="campo-modal">
                <label for="data-despesa">Data de pagamento</label>
                <input id="data-despesa" v-model="form.data" type="date" />
                <span v-if="erroCampo('data')" class="campo-modal__erro">{{ erroCampo('data') }}</span>
              </div>
            </div>

            <div class="campo-modal">
              <label for="grupo-dre">Grupo de DRE</label>
              <select id="grupo-dre" v-model="form.grupo_dre">
                <option value="operacional">Operacional (renda, salários, transporte…)</option>
                <option value="impostos_outros">Impostos e outros</option>
                <option value="nao_operacional">Não operacional (investimento, não conta para o lucro)</option>
              </select>
              <span class="campo-modal__ajuda">Decide se e onde a despesa entra no cálculo do lucro.</span>
            </div>

            <details class="avancado">
              <summary>Opções avançadas</summary>
              <div class="campo-modal">
                <label for="competencia-despesa">Mês de competência <small>(opcional)</small></label>
                <input id="competencia-despesa" v-model="form.data_competencia" type="date" />
                <span class="campo-modal__ajuda">
                  Só se o gasto pertencer a um mês diferente do pagamento (ex.: salário de Junho pago em Julho).
                </span>
                <span v-if="erroCampo('data_competencia')" class="campo-modal__erro">{{ erroCampo('data_competencia') }}</span>
              </div>
            </details>

            <p v-if="erroForm" class="modal-alerta" role="alert">{{ erroForm }}</p>

            <div class="modal-rodape">
              <button type="button" class="botao-secundario" :disabled="aGuardar" @click="fecharModal">Cancelar</button>
              <button type="submit" class="botao-primario" :disabled="aGuardar">
                <span v-if="aGuardar" class="spinner spinner--claro" aria-hidden="true"></span>
                {{ aGuardar ? 'A guardar…' : 'Guardar Despesa' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
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

.grelha {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 18px;
}

.ref {
  font-size: 12px;
  color: var(--cor-texto-suave);
  font-weight: 600;
}
.forte {
  font-weight: 500;
  color: var(--cor-texto);
}
.etiqueta-cat {
  font-size: 12px;
  background: var(--cor-neutra-fundo);
  color: var(--cor-neutra-texto);
  padding: 3px 10px;
  border-radius: 6px;
}

.lateral-dir {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.lateral-dir h3 {
  font-size: 16px;
  margin: 0 0 4px;
  color: var(--cor-texto);
}
.com-icone {
  display: flex;
  align-items: center;
  gap: 8px;
}
.subtitulo-mini {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--cor-texto-suave);
}
.vazio-mini {
  font-size: 13px;
  color: var(--cor-texto-suave);
}

.grupos {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.grupo__topo {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 6px;
  color: var(--cor-texto);
}
.grupo__topo strong {
  font-weight: 600;
}
.barra {
  height: 7px;
  background: var(--cor-neutra-fundo);
  border-radius: 5px;
  overflow: hidden;
}
.barra__preenchimento {
  height: 100%;
  background: linear-gradient(90deg, var(--cor-primaria-400), var(--cor-primaria-600));
  border-radius: 5px;
}

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
  color: var(--cor-ambar-700);
  font-weight: 600;
  white-space: nowrap;
}

/* --- Modal --- */
.campo-modal__ajuda {
  font-size: 12px;
  color: var(--cor-texto-suave);
  margin-top: 5px;
}
.avancado {
  margin-top: -4px;
}
.avancado summary {
  font-size: 13px;
  color: var(--cor-primaria-600);
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 14px;
}
.avancado summary:hover {
  color: var(--cor-primaria-700);
}

@media (max-width: 1000px) {
  .grelha {
    grid-template-columns: 1fr;
  }
}
</style>
