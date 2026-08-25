<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import axios from 'axios'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/services/api'
import { ICONES } from '@/utils/icones'
import { mt, dataCurta } from '@/utils/formato'
import type { MaterialStock } from '@/types/api'

interface ResumoMateriais {
  total_materiais: number
  valor_stock_total: number
}

const materiais = ref<MaterialStock[]>([])
const resumo = ref<ResumoMateriais>({ total_materiais: 0, valor_stock_total: 0 })
const aCarregar = ref(true)
const erro = ref('')
const pesquisa = ref('')

async function carregar() {
  aCarregar.value = true
  erro.value = ''
  try {
    const { data } = await api.get('/materiais')
    materiais.value = data.dados.itens || []
    resumo.value = data.dados.resumo || resumo.value
  } catch (e) {
    erro.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível carregar os materiais.'
  } finally {
    aCarregar.value = false
  }
}

onMounted(carregar)

const materiaisFiltrados = computed(() => {
  if (!pesquisa.value.trim()) return materiais.value
  const termo = pesquisa.value.toLowerCase()
  return materiais.value.filter((m) => m.nome?.toLowerCase().includes(termo))
})

// Peso total em armazém (soma de todos os stocks).
const pesoTotal = computed(() => materiais.value.reduce((s, m) => s + Number(m.stock_kg || 0), 0))

// Quantos materiais estão "em alerta" (atingiram o limite de venda).
const prontosParaVender = computed(() => materiais.value.filter((m) => m.em_alerta).length)

// Total de quebras acumuladas (soma de todos os materiais).
const quebrasTotais = computed(() => materiais.value.reduce((s, m) => s + Number(m.total_quebras_kg || 0), 0))

function kg(valor: number | null | undefined) {
  return new Intl.NumberFormat('pt-MZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(valor || 0)
}

function refMaterial(id: number) {
  return 'MAT-' + String(id).padStart(3, '0')
}

// Estado do material face ao limite. O limite_alerta_kg marca o ponto a
// partir do qual VALE A PENA VENDER (há material acumulado). Traduzimos
// isso em quatro estados legíveis.
function estado(m: MaterialStock) {
  if (!m.limite_alerta_kg) return { texto: 'Sem limite', classe: 'neutro' }
  if (m.em_alerta) return { texto: 'Pronto p/ vender', classe: 'pronto' }
  const racio = m.stock_kg / m.limite_alerta_kg
  if (racio >= 0.5) return { texto: 'A acumular', classe: 'medio' }
  return { texto: 'Baixo', classe: 'baixo' }
}

// Percentagem da barra de progresso até ao limite.
function progresso(m: MaterialStock) {
  if (!m.limite_alerta_kg) return 100
  return Math.min(100, (m.stock_kg / m.limite_alerta_kg) * 100)
}

// Materiais mais longe de atingir o limite: os que precisam de mais
// compra para valer a pena vender (equivalente aos "alertas de repor").
const paraRepor = computed(() =>
  materiais.value
    .filter((m) => m.limite_alerta_kg && !m.em_alerta)
    .sort((a, b) => progresso(a) - progresso(b))
    .slice(0, 3),
)

// --- Modal "Novo Material" / "Adicionar Stock" --------------------------
// Não existe endpoint para só "somar kg" a um material, usa-se sempre
// POST /materiais/{id}/stock-inicial (que acumula a cada chamada). Um
// material novo cria-se primeiro em POST /materiais; a entrada de stock
// inicial é opcional nesse fluxo (o normal, no dia-a-dia, é o stock subir
// através de uma Compra, ver módulo Compras).
interface FormMaterial {
  modo: 'novo' | 'stock'
  material_id: number | null
  nome: string
  preco_compra_kg: string
  preco_venda_kg: string
  limite_alerta_kg: string
  quantidade_kg: string
  custo_kg: string
}

function formVazio(modo: 'novo' | 'stock', materialAlvo?: MaterialStock): FormMaterial {
  return {
    modo,
    material_id: materialAlvo?.id ?? null,
    nome: '',
    preco_compra_kg: '',
    preco_venda_kg: '',
    limite_alerta_kg: '',
    quantidade_kg: '',
    custo_kg: materialAlvo ? String(materialAlvo.preco_compra_kg) : '',
  }
}

const modalAberto = ref(false)
const formMaterial = reactive<FormMaterial>(formVazio('novo'))
const aGuardar = ref(false)
const erroModal = ref('')
const errosCampo = ref<Record<string, string[]>>({})

const materialSeleccionado = computed(() => materiais.value.find((m) => m.id === formMaterial.material_id))

function abrirModalNovo() {
  Object.assign(formMaterial, formVazio('novo'))
  erroModal.value = ''
  errosCampo.value = {}
  modalAberto.value = true
}

function abrirModalStock(material: MaterialStock) {
  Object.assign(formMaterial, formVazio('stock', material))
  erroModal.value = ''
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
  aGuardar.value = true
  erroModal.value = ''
  errosCampo.value = {}

  try {
    if (formMaterial.modo === 'novo') {
      const resMaterial = await api.post('/materiais', {
        nome: formMaterial.nome,
        preco_compra_kg: Number(formMaterial.preco_compra_kg),
        preco_venda_kg: Number(formMaterial.preco_venda_kg),
        limite_alerta_kg: formMaterial.limite_alerta_kg ? Number(formMaterial.limite_alerta_kg) : null,
      })
      const materialId = resMaterial.data.dados.id

      if (Number(formMaterial.quantidade_kg) > 0) {
        await api.post(`/materiais/${materialId}/stock-inicial`, {
          quantidade_kg: Number(formMaterial.quantidade_kg),
          custo_kg: Number(formMaterial.custo_kg || formMaterial.preco_compra_kg),
        })
      }
    } else {
      await api.post(`/materiais/${formMaterial.material_id}/stock-inicial`, {
        quantidade_kg: Number(formMaterial.quantidade_kg),
        custo_kg: Number(formMaterial.custo_kg),
      })
    }

    fecharModal()
    await carregar()
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data?.erros) {
      errosCampo.value = e.response.data.erros
    }
    erroModal.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível guardar. Tenta novamente.'
  } finally {
    aGuardar.value = false
  }
}

// --- Modal "Registar Quebra" ---------------------------------------------
// POST /materiais/{id}/quebra: kg perdidos (humidade, danos, manuseamento…)
// que saem do stock sem terem sido vendidos. Reduz stock_kg e soma a
// total_quebras_kg, não mexe no custo médio nem entra como receita.
// GET /materiais/{id}/quebras devolve o histórico (cada linha é um
// movimento de stock com origem "Quebra"), mostrado aqui como contexto.
interface MovimentoQuebra {
  id: number
  data: string
  quantidade_kg: number
  valor: number
  observacoes: string | null
  utilizador: string | null
}

function formQuebraVazio() {
  return { quantidade_kg: '', motivo: '', data: '' }
}

const modalQuebraAberto = ref(false)
const materialQuebra = ref<MaterialStock | null>(null)
const formQuebra = reactive(formQuebraVazio())
const aGuardarQuebra = ref(false)
const erroQuebra = ref('')
const errosCampoQuebra = ref<Record<string, string[]>>({})
const historicoQuebras = ref<MovimentoQuebra[]>([])
const aCarregarHistorico = ref(false)

async function carregarHistoricoQuebras() {
  if (!materialQuebra.value) return
  aCarregarHistorico.value = true
  try {
    const { data } = await api.get(`/materiais/${materialQuebra.value.id}/quebras`)
    historicoQuebras.value = data.dados.itens || []
  } catch {
    // Histórico é só informativo, se falhar, o formulário continua utilizável.
  } finally {
    aCarregarHistorico.value = false
  }
}

async function abrirModalQuebra(material: MaterialStock) {
  materialQuebra.value = material
  Object.assign(formQuebra, formQuebraVazio())
  erroQuebra.value = ''
  errosCampoQuebra.value = {}
  modalQuebraAberto.value = true
  await carregarHistoricoQuebras()
}

function fecharModalQuebra() {
  modalQuebraAberto.value = false
  materialQuebra.value = null
}

function erroCampoQuebra(campo: string) {
  return errosCampoQuebra.value[campo]?.[0] || ''
}

// Fica no modal depois de guardar (em vez de fechar), assim dá para
// registar várias quebras seguidas e ver logo cada uma no histórico.
async function guardarQuebra() {
  if (!materialQuebra.value) return
  aGuardarQuebra.value = true
  erroQuebra.value = ''
  errosCampoQuebra.value = {}

  try {
    await api.post(`/materiais/${materialQuebra.value.id}/quebra`, {
      quantidade_kg: Number(formQuebra.quantidade_kg),
      motivo: formQuebra.motivo || undefined,
      data: formQuebra.data || undefined,
    })

    Object.assign(formQuebra, formQuebraVazio())
    await Promise.all([carregarHistoricoQuebras(), carregar()])
    // `carregar()` troca as referências em `materiais`, realinha o material
    // do modal para o stock/quebras acumuladas ficarem actualizados no ecrã.
    materialQuebra.value = materiais.value.find((m) => m.id === materialQuebra.value?.id) ?? materialQuebra.value
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data?.erros) {
      errosCampoQuebra.value = e.response.data.erros
    }
    erroQuebra.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível registar a quebra. Tenta novamente.'
  } finally {
    aGuardarQuebra.value = false
  }
}
</script>

<template>
  <AppLayout>
    <template #caminho>Painel / Materiais & Stock</template>

    <!-- Cabeçalho -->
    <div class="cabecalho">
      <div>
        <h1>Materiais &amp; Stock</h1>
        <p>Gestão centralizada de inventário e níveis de stock para reciclagem.</p>
      </div>
      <div class="cabecalho__accoes">
        <button type="button" class="botao-fantasma" disabled title="Em breve">
          Exportar
          <small>em breve</small>
        </button>
        <button type="button" class="botao-primario" @click="abrirModalNovo">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          Novo Material
        </button>
      </div>
    </div>

    <p v-if="erro" class="estado estado--erro" role="alert">{{ erro }}</p>

    <!-- Cartões -->
    <section class="cartoes">
      <div class="card-kpi card-kpi--verde">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Valor Total em Stock</span>
          <span class="card-kpi__icone card-kpi__icone--verde" v-html="ICONES.materiais"></span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--verde">{{ mt(resumo.valor_stock_total) }}</strong>
      </div>

      <div class="card-kpi card-kpi--teal">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Peso Total</span>
          <span class="card-kpi__icone card-kpi__icone--teal" v-html="ICONES.relatorios"></span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--teal">{{ kg(pesoTotal) }} kg</strong>
      </div>

      <div class="card-kpi card-kpi--ambar">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Prontos para Vender</span>
          <span class="card-kpi__icone card-kpi__icone--ambar">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" />
              <path d="M22 4 12 14.01l-3-3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--ambar">{{ String(prontosParaVender).padStart(2, '0') }}</strong>
        <small class="card-kpi__nota">materiais acima do limite</small>
      </div>

      <div class="card-kpi card-kpi--indigo">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Total de Materiais</span>
          <span class="card-kpi__icone card-kpi__icone--indigo">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3h18v18H3zM3 9h18M9 21V9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--indigo">{{ resumo.total_materiais }}</strong>
        <small class="card-kpi__nota">registados</small>
      </div>

      <div class="card-kpi card-kpi--vermelho">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Quebras Registadas</span>
          <span class="card-kpi__icone card-kpi__icone--vermelho">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" /><path d="M9 9l6 6M15 9l-6 6" stroke-linecap="round" />
            </svg>
          </span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--vermelho">{{ kg(quebrasTotais) }} kg</strong>
        <small class="card-kpi__nota">perdidos no total</small>
      </div>
    </section>

    <div class="grelha">
      <!-- Inventário -->
      <section class="painel-bloco">
        <div class="painel-bloco__topo">
          <div>
            <h2>Inventário de Materiais</h2>
            <p class="subtitulo">Stock disponível e limites de venda por material.</p>
          </div>
          <input v-model="pesquisa" type="text" placeholder="Procurar material…" class="filtro-pesquisa" />
        </div>

        <div v-if="aCarregar" class="estado">
          <span class="spinner" aria-hidden="true"></span>
          <p>A carregar inventário…</p>
        </div>
        <p v-else-if="materiaisFiltrados.length === 0" class="vazio">Ainda não há materiais registados.</p>

        <table v-else class="tabela">
          <thead>
            <tr>
              <th>Ref.</th>
              <th>Material</th>
              <th class="ao-fim">Stock atual</th>
              <th class="ao-fim">Limite venda</th>
              <th class="ao-fim">Preço/kg</th>
              <th class="ao-centro">Estado</th>
              <th class="ao-centro">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in materiaisFiltrados" :key="m.id">
              <td class="ref nowrap">{{ refMaterial(m.id) }}</td>
              <td>
                <div class="material-nome">
                  <span class="material-ponto"></span>
                  {{ m.nome }}
                </div>
                <div class="barra-mini">
                  <div class="barra-mini__fill" :class="estado(m).classe" :style="{ width: progresso(m) + '%' }"></div>
                </div>
              </td>
              <td class="ao-fim forte nowrap">{{ kg(m.stock_kg) }} kg</td>
              <td class="ao-fim cinza nowrap">{{ m.limite_alerta_kg ? kg(m.limite_alerta_kg) + ' kg' : '-' }}</td>
              <td class="ao-fim nowrap">{{ mt(m.preco_venda_kg) }}</td>
              <td class="ao-centro">
                <span class="etiqueta" :class="`etiqueta--${estado(m).classe}`">{{ estado(m).texto }}</span>
              </td>
              <td class="ao-centro">
                <div class="acoes-linha">
                  <button type="button" class="btn-linha" @click="abrirModalStock(m)">+ Stock</button>
                  <button type="button" class="btn-linha btn-linha--vermelho" @click="abrirModalQuebra(m)">Quebra</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Coluna lateral -->
      <aside class="lateral-dir">
        <div class="painel-bloco">
          <h3 class="com-icone">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
              <path
                d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                stroke-linejoin="round"
              />
              <path d="M12 9v4M12 17h.01" stroke-linecap="round" />
            </svg>
            Ainda a Acumular
          </h3>

          <p v-if="paraRepor.length === 0" class="vazio-mini">Todos os materiais atingiram o limite. 🎉</p>

          <div v-else class="repor-lista">
            <div v-for="m in paraRepor" :key="m.id" class="repor-item">
              <div>
                <strong>{{ m.nome }}</strong>
                <small>Atual: {{ kg(m.stock_kg) }} kg de {{ kg(m.limite_alerta_kg) }} kg</small>
              </div>
              <RouterLink :to="{ name: 'compras' }" class="repor-btn">Comprar</RouterLink>
            </div>
          </div>
        </div>

        <div class="painel-bloco">
          <h3 class="com-icone">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v5h5M3 8l4-4a9 9 0 1 1-2 9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Movimentações Recentes
          </h3>
          <div class="em-breve-mini">Histórico de movimentos de stock em breve</div>
        </div>
      </aside>
    </div>

    <!-- Modal: novo material / adicionar stock -->
    <Teleport to="body">
      <div v-if="modalAberto" class="modal-veu" @click.self="fecharModal">
        <div class="modal-cartao" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-material">
          <div class="modal-cabecalho">
            <h3 id="titulo-modal-material">{{ formMaterial.modo === 'novo' ? 'Novo Material' : 'Adicionar Stock' }}</h3>
            <button type="button" class="modal-fechar" aria-label="Fechar" @click="fecharModal">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <form class="modal-form" @submit.prevent="guardar">
            <template v-if="formMaterial.modo === 'novo'">
              <div class="campo-modal">
                <label for="nome-material">Nome do material</label>
                <input id="nome-material" v-model="formMaterial.nome" type="text" placeholder="ex.: Alumínio" />
                <span v-if="erroCampo('nome')" class="campo-modal__erro">{{ erroCampo('nome') }}</span>
              </div>
              <div class="campo-modal-grupo">
                <div class="campo-modal">
                  <label for="preco-compra">Preço de compra /kg</label>
                  <input id="preco-compra" v-model="formMaterial.preco_compra_kg" type="number" min="0" step="0.01" placeholder="0.00" />
                  <span v-if="erroCampo('preco_compra_kg')" class="campo-modal__erro">{{ erroCampo('preco_compra_kg') }}</span>
                </div>
                <div class="campo-modal">
                  <label for="preco-venda">Preço de venda /kg</label>
                  <input id="preco-venda" v-model="formMaterial.preco_venda_kg" type="number" min="0" step="0.01" placeholder="0.00" />
                  <span v-if="erroCampo('preco_venda_kg')" class="campo-modal__erro">{{ erroCampo('preco_venda_kg') }}</span>
                </div>
              </div>
              <div class="campo-modal">
                <label for="limite-alerta">Limite p/ venda /kg <small>(opcional)</small></label>
                <input id="limite-alerta" v-model="formMaterial.limite_alerta_kg" type="number" min="0" step="0.01" placeholder="ex.: 100" />
              </div>
            </template>

            <div v-else class="campo-modal">
              <label>Material</label>
              <div class="material-alvo">{{ materialSeleccionado?.nome }}</div>
            </div>

            <div class="campo-modal-grupo">
              <div class="campo-modal">
                <label for="quantidade-kg">
                  {{ formMaterial.modo === 'novo' ? 'Stock inicial (kg)' : 'Quantidade a adicionar (kg)' }}
                  <small v-if="formMaterial.modo === 'novo'">(opcional)</small>
                </label>
                <input id="quantidade-kg" v-model="formMaterial.quantidade_kg" type="number" min="0" step="0.01" placeholder="0.00" />
                <span v-if="erroCampo('quantidade_kg')" class="campo-modal__erro">{{ erroCampo('quantidade_kg') }}</span>
              </div>
              <div class="campo-modal">
                <label for="custo-kg">Custo desta entrada /kg</label>
                <input id="custo-kg" v-model="formMaterial.custo_kg" type="number" min="0" step="0.01" placeholder="0.00" />
                <span v-if="erroCampo('custo_kg')" class="campo-modal__erro">{{ erroCampo('custo_kg') }}</span>
              </div>
            </div>

            <p v-if="erroModal" class="modal-alerta" role="alert">{{ erroModal }}</p>

            <div class="modal-rodape">
              <button type="button" class="botao-secundario" :disabled="aGuardar" @click="fecharModal">Cancelar</button>
              <button type="submit" class="botao-primario" :disabled="aGuardar">
                <span v-if="aGuardar" class="spinner spinner--claro" aria-hidden="true"></span>
                {{ aGuardar ? 'A guardar…' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Modal: registar quebra -->
    <Teleport to="body">
      <div v-if="modalQuebraAberto" class="modal-veu" @click.self="fecharModalQuebra">
        <div class="modal-cartao modal-cartao--largo" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-quebra">
          <div class="modal-cabecalho">
            <h3 id="titulo-modal-quebra">Registar Quebra: {{ materialQuebra?.nome }}</h3>
            <button type="button" class="modal-fechar" aria-label="Fechar" @click="fecharModalQuebra">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <form class="modal-form" @submit.prevent="guardarQuebra">
            <div class="quebra-resumo">
              <div>
                <span class="quebra-resumo__rotulo">Stock disponível</span>
                <strong>{{ kg(materialQuebra?.stock_kg) }} kg</strong>
              </div>
              <div>
                <span class="quebra-resumo__rotulo">Quebras já registadas</span>
                <strong>{{ kg(materialQuebra?.total_quebras_kg) }} kg</strong>
              </div>
            </div>

            <div class="campo-modal-grupo">
              <div class="campo-modal">
                <label for="quebra-quantidade">Quantidade perdida (kg)</label>
                <input
                  id="quebra-quantidade"
                  v-model="formQuebra.quantidade_kg"
                  type="number"
                  min="0"
                  :max="materialQuebra?.stock_kg"
                  step="0.01"
                  placeholder="0.00"
                />
                <span v-if="erroCampoQuebra('quantidade_kg')" class="campo-modal__erro">{{ erroCampoQuebra('quantidade_kg') }}</span>
              </div>
              <div class="campo-modal">
                <label for="quebra-data">Data <small>(opcional)</small></label>
                <input id="quebra-data" v-model="formQuebra.data" type="date" />
              </div>
            </div>

            <div class="campo-modal">
              <label for="quebra-motivo">Motivo <small>(opcional)</small></label>
              <input id="quebra-motivo" v-model="formQuebra.motivo" type="text" placeholder="ex.: Humidade, dano no transporte…" />
            </div>

            <p v-if="erroQuebra" class="modal-alerta" role="alert">{{ erroQuebra }}</p>

            <div class="modal-rodape">
              <button type="button" class="botao-secundario" @click="fecharModalQuebra">Fechar</button>
              <button type="submit" class="botao-primario" :disabled="aGuardarQuebra">
                <span v-if="aGuardarQuebra" class="spinner spinner--claro" aria-hidden="true"></span>
                {{ aGuardarQuebra ? 'A registar…' : 'Registar Quebra' }}
              </button>
            </div>
          </form>

          <div class="quebra-historico">
            <h4>Histórico recente</h4>
            <div v-if="aCarregarHistorico" class="estado">
              <span class="spinner" aria-hidden="true"></span>
            </div>
            <p v-else-if="historicoQuebras.length === 0" class="vazio-mini">Sem quebras registadas para este material.</p>
            <div v-else class="quebra-lista">
              <div v-for="mv in historicoQuebras" :key="mv.id" class="quebra-item">
                <div>
                  <strong>{{ kg(mv.quantidade_kg) }} kg</strong>
                  <small>{{ dataCurta(mv.data) }}{{ mv.observacoes ? ' · ' + mv.observacoes : '' }}</small>
                </div>
                <span class="quebra-item__valor">−{{ mt(mv.valor) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>

<style scoped>
.grelha {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 18px;
}

.ref {
  font-size: 12px;
  color: var(--cor-texto-suave);
  font-weight: 600;
}
.forte {
  font-weight: 700;
  color: var(--cor-texto);
}
.cinza {
  color: var(--cor-texto-suave);
}

.material-nome {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--cor-texto);
}
.material-ponto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cor-primaria-500);
  flex-shrink: 0;
}
.barra-mini {
  height: 4px;
  background: var(--cor-neutra-fundo);
  border-radius: 3px;
  margin-top: 6px;
  overflow: hidden;
}
.barra-mini__fill {
  height: 100%;
  border-radius: 3px;
}
.barra-mini__fill.pronto {
  background: var(--cor-primaria-500);
}
.barra-mini__fill.medio {
  background: var(--cor-ambar-500);
}
.barra-mini__fill.baixo {
  background: var(--cor-erro);
}
.barra-mini__fill.neutro {
  background: #b3bdb7;
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
.btn-linha--vermelho {
  color: var(--cor-erro);
  background: var(--cor-erro-fundo);
  border-color: #f6d4cf;
}
.btn-linha--vermelho:hover {
  background: #f9c9c2;
}

.acoes-linha {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.lateral-dir {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.lateral-dir h3 {
  font-size: 16px;
  margin: 0 0 12px;
  color: var(--cor-texto);
}
.com-icone {
  display: flex;
  align-items: center;
  gap: 8px;
}

.repor-lista {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.repor-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--cor-fundo);
  border-radius: var(--raio-sm);
}
.repor-item strong {
  display: block;
  font-size: 14px;
  color: var(--cor-texto);
}
.repor-item small {
  font-size: 12px;
  color: var(--cor-texto-suave);
}
.repor-btn {
  font-size: 12px;
  font-weight: 600;
  color: var(--cor-primaria-700);
  background: var(--cor-primaria-50);
  padding: 6px 12px;
  border-radius: 7px;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
}
.repor-btn:hover {
  background: var(--cor-primaria-100);
}
.em-breve-mini {
  border: 1.5px dashed var(--cor-borda);
  border-radius: var(--raio-sm);
  padding: 16px;
  font-size: 12px;
  text-align: center;
  color: #9aa8a1;
}
.vazio-mini {
  font-size: 13px;
  color: var(--cor-texto-suave);
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

/* --- Modal: registar quebra --- */
.quebra-resumo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px 14px;
  background: var(--cor-erro-fundo);
  border-radius: var(--raio-sm);
}
.quebra-resumo__rotulo {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--cor-texto-suave);
  margin-bottom: 3px;
}
.quebra-resumo strong {
  font-size: 16px;
  color: var(--cor-erro);
}

.quebra-historico {
  padding: 0 24px 22px;
}
.quebra-historico h4 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--cor-texto-suave);
  margin: 0 0 12px;
}
.quebra-lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}
.quebra-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--cor-fundo);
  border-radius: var(--raio-sm);
}
.quebra-item strong {
  display: block;
  font-size: 13px;
  color: var(--cor-texto);
}
.quebra-item small {
  font-size: 12px;
  color: var(--cor-texto-suave);
}
.quebra-item__valor {
  font-size: 13px;
  font-weight: 600;
  color: var(--cor-erro);
  white-space: nowrap;
  flex-shrink: 0;
}

@media (max-width: 1000px) {
  .grelha {
    grid-template-columns: 1fr;
  }
}
</style>
