<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import axios from 'axios'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/services/api'
import { ICONES } from '@/utils/icones'
import { mt, dataCurta } from '@/utils/formato'
import { baixarFicheiro } from '@/utils/exportar'
import type { ResumoDashboard, MaterialStock, Paginacao } from '@/types/api'

interface ItemCompra {
  material_id: number
  material_nome: string
  quantidade_kg: number
}

interface Compra {
  id: number
  data: string
  fornecedor: string
  total: number
  itens: ItemCompra[]
}

interface Pessoa {
  id: number
  nome: string
  tipo: string
  tipo_rotulo: string
}

const compras = ref<Compra[]>([])
const dashboard = ref<ResumoDashboard | null>(null)
const materiais = ref<MaterialStock[]>([])
const paginacao = ref<Paginacao>({ pagina: 1, ultima_pagina: 1, total: 0 })
const aCarregar = ref(true)
const erro = ref('')

const pesquisaFornecedor = ref('')
const paginaActual = ref(1)

async function carregar() {
  aCarregar.value = true
  erro.value = ''
  try {
    const [resCompras, resDash, resMat] = await Promise.all([
      api.get('/compras', { params: { page: paginaActual.value } }),
      api.get('/relatorios/dashboard'),
      api.get('/materiais'),
    ])

    // CompraController@index só devolve {itens, paginacao}, sem "resumo"
    // (confirmado no código do backend). O total/peso desta página são
    // calculados no cliente a partir dos itens carregados (ver `resumo`).
    compras.value = resCompras.data.dados.itens || []
    paginacao.value = resCompras.data.dados.paginacao || paginacao.value
    dashboard.value = resDash.data.dados
    materiais.value = resMat.data.dados.itens || []
  } catch (e) {
    erro.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível carregar as compras.'
  } finally {
    aCarregar.value = false
  }
}

onMounted(carregar)

// Total e peso desta página (o backend não devolve um resumo agregado
// para /compras, só para /vendas e /emprestimos).
const resumo = computed(() => ({
  total_comprado: compras.value.reduce((s, c) => s + Number(c.total || 0), 0),
  peso_total_kg: compras.value.reduce(
    (s, c) => s + (c.itens || []).reduce((si, i) => si + Number(i.quantidade_kg || 0), 0),
    0,
  ),
}))

const comprasFiltradas = computed(() => {
  if (!pesquisaFornecedor.value.trim()) return compras.value
  const termo = pesquisaFornecedor.value.toLowerCase()
  return compras.value.filter((c) => c.fornecedor?.toLowerCase().includes(termo))
})

function formatoKg(valor: number | null | undefined) {
  return new Intl.NumberFormat('pt-MZ', { maximumFractionDigits: 0 }).format(valor || 0)
}

// Fornecedores mais activos entre as compras carregadas: soma o total
// pago a cada um e ordena do maior para o menor.
const fornecedoresDestaque = computed(() => {
  const somas = new Map<string, number>()
  for (const c of compras.value) {
    somas.set(c.fornecedor, (somas.get(c.fornecedor) || 0) + Number(c.total))
  }
  return [...somas.entries()]
    .map(([fornecedor, total]) => ({ fornecedor, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)
})

// Materiais com stock baixo: útil aqui para decidir o que vale a pena
// comprar a seguir (mesma lógica usada nas Vendas).
const materiaisAlerta = computed(() =>
  [...materiais.value].filter((m) => m.limite_alerta_kg).sort((a, b) => a.stock_kg - b.stock_kg).slice(0, 3),
)

// Resume os materiais de uma compra numa linha ("Ferro (50kg), Cobre (10kg)").
function materiaisResumo(compra: Compra) {
  if (!compra.itens?.length) return '-'
  return compra.itens.map((i) => `${i.material_nome} (${Number(i.quantidade_kg).toFixed(0)}kg)`).join(', ')
}

function refCompra(id: number) {
  return 'COMP-' + String(id).padStart(5, '0')
}

function irPara(p: number) {
  if (p >= 1 && p <= paginacao.value.ultima_pagina) {
    paginaActual.value = p
    carregar()
  }
}

// --- Exportar PDF ---------------------------------------------------------
// GET /compras/exportar — endpoint NOVO, ainda por criar no backend (ver
// prompt fornecido ao dono).
const aExportar = ref(false)

async function exportar() {
  aExportar.value = true
  try {
    await baixarFicheiro('/compras/exportar')
  } catch {
    erro.value = 'Não foi possível exportar. Confirma que o endpoint /compras/exportar já existe no backend.'
  } finally {
    aExportar.value = false
  }
}

// --- Modal "Registar Nova Compra" ---------------------------------------
// POST /compras exige { pessoa_id, itens: [{ material_id, quantidade_kg, preco_kg }] }.
// O fornecedor pode ser escolhido de entre os já cadastrados (GET /pessoas?tipo=fornecedor)
// ou criado ali mesmo (POST /pessoas), tal como o cliente no modal de Vendas.
interface ItemFormCompra {
  material_id: number | null
  quantidade_kg: string
  preco_kg: string
}

function novoItemVazio(): ItemFormCompra {
  const primeiro = materiais.value[0]
  return {
    material_id: primeiro?.id ?? null,
    quantidade_kg: '',
    preco_kg: primeiro ? String(primeiro.preco_compra_kg) : '',
  }
}

interface FormCompra {
  modoFornecedor: 'existente' | 'novo'
  pessoa_id: number | null
  nomeFornecedorNovo: string
  itens: ItemFormCompra[]
}

function formCompraVazio(): FormCompra {
  return {
    modoFornecedor: fornecedores.value.length > 0 ? 'existente' : 'novo',
    pessoa_id: fornecedores.value[0]?.id ?? null,
    nomeFornecedorNovo: '',
    itens: [novoItemVazio()],
  }
}

const modalCompraAberto = ref(false)
const fornecedores = ref<Pessoa[]>([])
const aCarregarFornecedores = ref(false)
const formCompra = reactive<FormCompra>(formCompraVazio())
const aGuardarCompra = ref(false)
const erroCompra = ref('')
const errosCampoCompra = ref<Record<string, string[]>>({})

async function abrirModalCompra() {
  erroCompra.value = ''
  errosCampoCompra.value = {}
  modalCompraAberto.value = true

  if (fornecedores.value.length === 0) {
    aCarregarFornecedores.value = true
    try {
      const resposta = await api.get('/pessoas', { params: { tipo: 'fornecedor' } })
      fornecedores.value = resposta.data.dados.itens || []
    } catch {
      // Sem fornecedores disponíveis, o formulário assume "fornecedor novo".
    } finally {
      aCarregarFornecedores.value = false
    }
  }

  Object.assign(formCompra, formCompraVazio())
}

function fecharModalCompra() {
  modalCompraAberto.value = false
}

function adicionarItem() {
  formCompra.itens.push(novoItemVazio())
}

function removerItem(indice: number) {
  if (formCompra.itens.length > 1) formCompra.itens.splice(indice, 1)
}

// Ao escolher o material, sugere o preço de compra de tabela (editável a seguir).
function aoEscolherMaterial(item: ItemFormCompra) {
  const material = materiais.value.find((m) => m.id === item.material_id)
  if (material) item.preco_kg = String(material.preco_compra_kg)
}

const totalEstimado = computed(() =>
  formCompra.itens.reduce((soma, item) => soma + (Number(item.quantidade_kg) || 0) * (Number(item.preco_kg) || 0), 0),
)

function erroCampoCompra(campo: string) {
  return errosCampoCompra.value[campo]?.[0] || ''
}

function erroItemCompra(indice: number, campo: string) {
  return errosCampoCompra.value[`itens.${indice}.${campo}`]?.[0] || ''
}

async function guardarCompra() {
  aGuardarCompra.value = true
  erroCompra.value = ''
  errosCampoCompra.value = {}

  try {
    let pessoaId = formCompra.pessoa_id

    if (formCompra.modoFornecedor === 'novo') {
      const resPessoa = await api.post('/pessoas', { nome: formCompra.nomeFornecedorNovo, tipo: 'fornecedor' })
      pessoaId = resPessoa.data.dados.id
    }

    await api.post('/compras', {
      pessoa_id: pessoaId,
      itens: formCompra.itens.map((item) => ({
        material_id: item.material_id,
        quantidade_kg: Number(item.quantidade_kg),
        preco_kg: Number(item.preco_kg),
      })),
    })

    fecharModalCompra()
    paginaActual.value = 1
    await carregar() // stock e valor em caixa mudam com a compra, recarrega tudo
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data?.erros) {
      errosCampoCompra.value = e.response.data.erros
    }
    erroCompra.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível registar a compra. Tenta novamente.'
  } finally {
    aGuardarCompra.value = false
  }
}
</script>

<template>
  <AppLayout>
    <template #caminho>Painel / Compras</template>

    <!-- Cabeçalho -->
    <div class="cabecalho">
      <div>
        <h1>Compras de Material</h1>
        <p>Gira as aquisições de materiais recicláveis dos seus fornecedores.</p>
      </div>
      <div class="cabecalho__accoes">
        <button type="button" class="botao-fantasma" :disabled="aExportar" @click="exportar">
          <span v-if="aExportar" class="spinner" aria-hidden="true"></span>
          {{ aExportar ? 'A exportar…' : 'Exportar Relatório' }}
        </button>
        <button type="button" class="botao-primario" @click="abrirModalCompra">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          Registar Nova Compra
        </button>
      </div>
    </div>

    <p v-if="erro" class="estado estado--erro" role="alert">{{ erro }}</p>

    <!-- Cartões -->
    <section class="cartoes">
      <div class="card-kpi card-kpi--verde">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Total Comprado (listado)</span>
          <span class="card-kpi__icone card-kpi__icone--verde" v-html="ICONES.compras"></span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--verde">{{ mt(resumo.total_comprado) }}</strong>
      </div>
      <div class="card-kpi card-kpi--ambar">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Peso Total Comprado</span>
          <span class="card-kpi__icone card-kpi__icone--ambar" v-html="ICONES.relatorios"></span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--ambar">{{ formatoKg(resumo.peso_total_kg) }} kg</strong>
      </div>
      <div class="card-kpi card-kpi--indigo">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Saldo em Caixa</span>
          <span class="card-kpi__icone card-kpi__icone--indigo" v-html="ICONES.caixa"></span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--indigo">{{ mt(dashboard?.saldo_caixa) }}</strong>
      </div>
      <div class="card-kpi card-kpi--teal">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">Valor em Stock</span>
          <span class="card-kpi__icone card-kpi__icone--teal" v-html="ICONES.materiais"></span>
        </div>
        <strong class="card-kpi__valor card-kpi__valor--teal">{{ mt(dashboard?.valor_stock) }}</strong>
      </div>
    </section>

    <div class="grelha">
      <!-- Histórico de compras -->
      <section class="painel-bloco">
        <div class="painel-bloco__topo">
          <div>
            <h2>Histórico de Compras</h2>
            <p class="subtitulo">Lista detalhada das aquisições de material recicláveis.</p>
          </div>
          <input v-model="pesquisaFornecedor" type="text" placeholder="Filtrar por fornecedor…" class="filtro-pesquisa" />
        </div>

        <div v-if="aCarregar" class="estado">
          <span class="spinner" aria-hidden="true"></span>
          <p>A carregar compras…</p>
        </div>
        <p v-else-if="comprasFiltradas.length === 0" class="vazio">Ainda não há compras registadas.</p>

        <table v-else class="tabela">
          <thead>
            <tr>
              <th>Ref.</th>
              <th>Data</th>
              <th>Fornecedor</th>
              <th>Materiais</th>
              <th class="ao-fim">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in comprasFiltradas" :key="c.id">
              <td class="ref nowrap">{{ refCompra(c.id) }}</td>
              <td class="nowrap">{{ dataCurta(c.data) }}</td>
              <td class="forte">{{ c.fornecedor }}</td>
              <td class="materiais">{{ materiaisResumo(c) }}</td>
              <td class="ao-fim nowrap">{{ mt(c.total) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="!aCarregar && paginacao.total > 0" class="paginacao">
          <span class="paginacao__info">
            A mostrar {{ comprasFiltradas.length }} de {{ paginacao.total }} compras registadas
          </span>
          <div class="paginacao__botoes">
            <button class="pg-btn" :disabled="paginaActual === 1" @click="irPara(paginaActual - 1)">Anterior</button>
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

      <!-- Coluna lateral -->
      <aside class="lateral-dir">
        <!-- Fornecedores em destaque (dados reais) -->
        <div class="painel-bloco">
          <h3 class="com-icone">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
              <path
                d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><circle cx="12" cy="7" r="4" />
            </svg>
            Fornecedores em Destaque
          </h3>

          <p v-if="fornecedoresDestaque.length === 0" class="vazio-mini">Sem compras registadas ainda.</p>

          <div v-else class="ranking">
            <div v-for="f in fornecedoresDestaque" :key="f.fornecedor" class="ranking__item">
              <span class="ranking__nome">{{ f.fornecedor }}</span>
              <span class="ranking__valor">{{ mt(f.total) }}</span>
            </div>
          </div>
        </div>

        <!-- Alertas de stock (dados reais) -->
        <div class="painel-bloco">
          <h3 class="com-icone">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
              <path
                d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                stroke-linejoin="round"
              />
              <path d="M12 9v4M12 17h.01" stroke-linecap="round" />
            </svg>
            Níveis de Stock
          </h3>

          <p v-if="materiaisAlerta.length === 0" class="vazio-mini">Sem materiais com limite definido.</p>

          <div v-else class="alertas">
            <div v-for="m in materiaisAlerta" :key="m.id" class="alerta">
              <div>
                <strong>{{ m.nome }}</strong>
                <small>Disponível: {{ Number(m.stock_kg).toFixed(0) }} kg</small>
              </div>
              <span class="badge" :class="m.em_alerta ? 'badge--baixo' : 'badge--ok'">
                {{ m.em_alerta ? 'BAIXO' : 'NORMAL' }}
              </span>
            </div>
          </div>

          <RouterLink :to="{ name: 'dashboard' }" class="ver-mais">Ver painel de stock →</RouterLink>
        </div>
      </aside>
    </div>

    <!-- Modal: registar nova compra -->
    <Teleport to="body">
      <div v-if="modalCompraAberto" class="modal-veu" @click.self="fecharModalCompra">
        <div class="modal-cartao modal-cartao--largo" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-compra">
          <div class="modal-cabecalho">
            <h3 id="titulo-modal-compra">Registar Nova Compra</h3>
            <button type="button" class="modal-fechar" aria-label="Fechar" @click="fecharModalCompra">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <form class="modal-form" @submit.prevent="guardarCompra">
            <!-- Fornecedor -->
            <div v-if="fornecedores.length > 0" class="alternador">
              <button
                type="button"
                class="alternador__opcao"
                :class="{ 'alternador__opcao--activa': formCompra.modoFornecedor === 'existente' }"
                @click="formCompra.modoFornecedor = 'existente'"
              >
                Fornecedor existente
              </button>
              <button
                type="button"
                class="alternador__opcao"
                :class="{ 'alternador__opcao--activa': formCompra.modoFornecedor === 'novo' }"
                @click="formCompra.modoFornecedor = 'novo'"
              >
                Fornecedor novo
              </button>
            </div>

            <div v-if="formCompra.modoFornecedor === 'existente'" class="campo-modal">
              <label for="fornecedor-existente">Fornecedor</label>
              <select id="fornecedor-existente" v-model.number="formCompra.pessoa_id" :disabled="aCarregarFornecedores">
                <option v-if="aCarregarFornecedores" value="">A carregar fornecedores…</option>
                <option v-for="f in fornecedores" :key="f.id" :value="f.id">{{ f.nome }}</option>
              </select>
              <span v-if="erroCampoCompra('pessoa_id')" class="campo-modal__erro">{{ erroCampoCompra('pessoa_id') }}</span>
            </div>
            <div v-else class="campo-modal">
              <label for="fornecedor-novo">Nome do fornecedor</label>
              <input id="fornecedor-novo" v-model="formCompra.nomeFornecedorNovo" type="text" placeholder="ex.: António Mucavele" />
              <span v-if="erroCampoCompra('pessoa_id')" class="campo-modal__erro">{{ erroCampoCompra('pessoa_id') }}</span>
            </div>

            <!-- Materiais comprados -->
            <div class="itens-venda">
              <div v-for="(item, i) in formCompra.itens" :key="i" class="item-venda">
                <div class="item-venda__cabecalho">
                  <span>Material {{ i + 1 }}</span>
                  <button
                    v-if="formCompra.itens.length > 1"
                    type="button"
                    class="item-venda__remover"
                    @click="removerItem(i)"
                  >
                    Remover
                  </button>
                </div>

                <div class="campo-modal">
                  <label :for="`material-${i}`">Material</label>
                  <select :id="`material-${i}`" v-model.number="item.material_id" @change="aoEscolherMaterial(item)">
                    <option v-for="m in materiais" :key="m.id" :value="m.id">
                      {{ m.nome }}, {{ Number(m.stock_kg).toFixed(0) }}kg em stock
                    </option>
                  </select>
                  <span v-if="erroItemCompra(i, 'material_id')" class="campo-modal__erro">
                    {{ erroItemCompra(i, 'material_id') }}
                  </span>
                </div>

                <div class="campo-modal-grupo">
                  <div class="campo-modal">
                    <label :for="`quantidade-${i}`">Peso (kg)</label>
                    <input :id="`quantidade-${i}`" v-model="item.quantidade_kg" type="number" min="0" step="0.01" placeholder="0.00" />
                    <span v-if="erroItemCompra(i, 'quantidade_kg')" class="campo-modal__erro">
                      {{ erroItemCompra(i, 'quantidade_kg') }}
                    </span>
                  </div>
                  <div class="campo-modal">
                    <label :for="`preco-${i}`">Preço de compra /kg</label>
                    <input :id="`preco-${i}`" v-model="item.preco_kg" type="number" min="0" step="0.01" placeholder="0.00" />
                    <span v-if="erroItemCompra(i, 'preco_kg')" class="campo-modal__erro">
                      {{ erroItemCompra(i, 'preco_kg') }}
                    </span>
                  </div>
                </div>
              </div>

              <button type="button" class="botao-secundario botao-secundario--bloco" @click="adicionarItem">
                + Adicionar outro material
              </button>
            </div>

            <div class="total-estimado">
              <span>Total a Pagar</span>
              <strong>{{ mt(totalEstimado) }}</strong>
            </div>

            <p v-if="erroCompra" class="modal-alerta" role="alert">{{ erroCompra }}</p>

            <div class="modal-rodape">
              <button type="button" class="botao-secundario" :disabled="aGuardarCompra" @click="fecharModalCompra">
                Cancelar
              </button>
              <button type="submit" class="botao-primario" :disabled="aGuardarCompra">
                <span v-if="aGuardarCompra" class="spinner spinner--claro" aria-hidden="true"></span>
                {{ aGuardarCompra ? 'A guardar…' : 'Confirmar e Pagar Fornecedor' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>

<style scoped>
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
.materiais {
  color: var(--cor-texto-suave);
  font-size: 12px;
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

.ranking {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ranking__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--cor-fundo);
  border-radius: var(--raio-sm);
  font-size: 13px;
}
.ranking__nome {
  color: var(--cor-texto);
  font-weight: 500;
}
.ranking__valor {
  color: var(--cor-primaria-600);
  font-weight: 600;
  white-space: nowrap;
}

.alertas {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.alerta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--cor-fundo);
  border-radius: var(--raio-sm);
}
.alerta strong {
  display: block;
  font-size: 14px;
  color: var(--cor-texto);
}
.alerta small {
  font-size: 12px;
  color: var(--cor-texto-suave);
}
.ver-mais {
  display: inline-block;
  margin-top: 14px;
  font-size: 13px;
  color: var(--cor-primaria-600);
  text-decoration: none;
  font-weight: 600;
}
.ver-mais:hover {
  color: var(--cor-primaria-700);
}
.vazio-mini {
  font-size: 13px;
  color: var(--cor-texto-suave);
}

/* --- Modal: registar nova compra --- */
.itens-venda {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.item-venda {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background: var(--cor-fundo);
  border-radius: var(--raio-sm);
}
.item-venda__cabecalho {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--cor-texto-suave);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.item-venda__remover {
  background: none;
  border: none;
  color: var(--cor-erro);
  font-size: 12px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: normal;
  cursor: pointer;
  padding: 0;
}
.item-venda__remover:hover {
  text-decoration: underline;
}
.total-estimado {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: var(--cor-primaria-50);
  border-radius: var(--raio-sm);
  font-size: 14px;
  color: var(--cor-primaria-700);
  font-weight: 600;
}
.total-estimado strong {
  font-family: var(--fonte-titulo);
  font-size: 16px;
}

@media (max-width: 1000px) {
  .grelha {
    grid-template-columns: 1fr;
  }
}
</style>
