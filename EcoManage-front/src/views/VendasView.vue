<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import axios from 'axios'
import AppLayout from '@/components/AppLayout.vue'
import api from '@/services/api'
import { ICONES } from '@/utils/icones'
import { mt, dataCurta } from '@/utils/formato'
import { baixarFicheiro } from '@/utils/exportar'
import type { ResumoDashboard, MaterialStock, Paginacao } from '@/types/api'

interface ItemVenda {
  material_id: number
  material_nome: string
  quantidade_kg: number
}

interface Venda {
  id: number
  data: string
  cliente: string
  total: number
  lucro: number
  itens: ItemVenda[]
}

interface ResumoVendas {
  receita_total: number
  lucro_total: number
}

interface Pessoa {
  id: number
  nome: string
  tipo: string
  tipo_rotulo: string
}

const vendas = ref<Venda[]>([])
const resumo = ref<ResumoVendas>({ receita_total: 0, lucro_total: 0 })
const dashboard = ref<ResumoDashboard | null>(null)
const materiais = ref<MaterialStock[]>([])
const paginacao = ref<Paginacao>({ pagina: 1, ultima_pagina: 1, total: 0 })
const aCarregar = ref(true)
const erro = ref('')

const pesquisaCliente = ref('')
const paginaActual = ref(1)

async function carregar() {
  aCarregar.value = true
  erro.value = ''
  try {
    const [resVendas, resDash, resMat] = await Promise.all([
      api.get('/vendas', { params: { page: paginaActual.value } }),
      api.get('/relatorios/dashboard'),
      api.get('/materiais'),
    ])

    vendas.value = resVendas.data.dados.itens || []
    resumo.value = resVendas.data.dados.resumo || resumo.value
    paginacao.value = resVendas.data.dados.paginacao || paginacao.value
    dashboard.value = resDash.data.dados
    materiais.value = resMat.data.dados.itens || []
  } catch (e) {
    erro.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível carregar as vendas.'
  } finally {
    aCarregar.value = false
  }
}

onMounted(carregar)

const vendasFiltradas = computed(() => {
  if (!pesquisaCliente.value.trim()) return vendas.value
  const termo = pesquisaCliente.value.toLowerCase()
  return vendas.value.filter((v) => v.cliente?.toLowerCase().includes(termo))
})

const cartoes = computed(() => [
  { rotulo: 'Receita de Vendas (listadas)', valor: resumo.value.receita_total, cor: 'verde', icone: 'vendas' },
  { rotulo: 'Lucro Estimado', valor: resumo.value.lucro_total, cor: 'ambar', icone: 'relatorios' },
  { rotulo: 'Valor em Stock', valor: dashboard.value?.valor_stock, cor: 'teal', icone: 'materiais' },
  { rotulo: 'Total em Dívida', valor: dashboard.value?.total_em_divida, cor: 'vermelho', icone: 'emprestimos' },
])

// Materiais com stock baixo, proxy para "alertas de stock": os que têm
// limite definido, ordenados pelos que têm menos stock disponível.
const materiaisAlerta = computed(() =>
  [...materiais.value].filter((m) => m.limite_alerta_kg).sort((a, b) => a.stock_kg - b.stock_kg).slice(0, 3),
)

// Resume os materiais de uma venda numa linha ("Ferro (50kg), Cobre (10kg)").
function materiaisResumo(venda: Venda) {
  if (!venda.itens?.length) return '-'
  return venda.itens.map((i) => `${i.material_nome} (${Number(i.quantidade_kg).toFixed(0)}kg)`).join(', ')
}

function refVenda(id: number) {
  return 'VND-' + String(id).padStart(5, '0')
}

function irPara(p: number) {
  if (p >= 1 && p <= paginacao.value.ultima_pagina) {
    paginaActual.value = p
    carregar()
  }
}

// --- Exportar PDF ---------------------------------------------------------
// GET /vendas/exportar — endpoint NOVO, ainda por criar no backend (ver
// prompt fornecido ao dono). Reaproveita os mesmos filtros da listagem.
const aExportar = ref(false)

async function exportar() {
  aExportar.value = true
  try {
    await baixarFicheiro('/vendas/exportar')
  } catch {
    erro.value = 'Não foi possível exportar. Confirma que o endpoint /vendas/exportar já existe no backend.'
  } finally {
    aExportar.value = false
  }
}

// --- Modal "Registar Nova Venda" ---------------------------------------
// POST /vendas exige { pessoa_id, itens: [{ material_id, quantidade_kg, preco_kg }] }.
// O cliente pode ser escolhido de entre os já cadastrados (GET /pessoas?tipo=cliente)
// ou criado ali mesmo (POST /pessoas), tal como o material no modal do Painel.
interface ItemFormVenda {
  material_id: number | null
  quantidade_kg: string
  preco_kg: string
}

function novoItemVazio(): ItemFormVenda {
  const primeiro = materiais.value[0]
  return {
    material_id: primeiro?.id ?? null,
    quantidade_kg: '',
    preco_kg: primeiro ? String(primeiro.preco_venda_kg) : '',
  }
}

interface FormVenda {
  modoCliente: 'existente' | 'novo'
  pessoa_id: number | null
  nomeClienteNovo: string
  itens: ItemFormVenda[]
}

function formVendaVazio(): FormVenda {
  return {
    modoCliente: clientes.value.length > 0 ? 'existente' : 'novo',
    pessoa_id: clientes.value[0]?.id ?? null,
    nomeClienteNovo: '',
    itens: [novoItemVazio()],
  }
}

const modalVendaAberto = ref(false)
const clientes = ref<Pessoa[]>([])
const aCarregarClientes = ref(false)
const formVenda = reactive<FormVenda>(formVendaVazio())
const aGuardarVenda = ref(false)
const erroVenda = ref('')
const errosCampoVenda = ref<Record<string, string[]>>({})

async function abrirModalVenda() {
  erroVenda.value = ''
  errosCampoVenda.value = {}
  modalVendaAberto.value = true

  if (clientes.value.length === 0) {
    aCarregarClientes.value = true
    try {
      const resposta = await api.get('/pessoas', { params: { tipo: 'cliente' } })
      clientes.value = resposta.data.dados.itens || []
    } catch {
      // Sem clientes disponíveis, o formulário assume "cliente novo".
    } finally {
      aCarregarClientes.value = false
    }
  }

  Object.assign(formVenda, formVendaVazio())
}

function fecharModalVenda() {
  modalVendaAberto.value = false
}

function adicionarItem() {
  formVenda.itens.push(novoItemVazio())
}

function removerItem(indice: number) {
  if (formVenda.itens.length > 1) formVenda.itens.splice(indice, 1)
}

// Ao escolher o material, sugere o preço de venda de tabela (editável a seguir).
function aoEscolherMaterial(item: ItemFormVenda) {
  const material = materiais.value.find((m) => m.id === item.material_id)
  if (material) item.preco_kg = String(material.preco_venda_kg)
}

const totalEstimado = computed(() =>
  formVenda.itens.reduce((soma, item) => soma + (Number(item.quantidade_kg) || 0) * (Number(item.preco_kg) || 0), 0),
)

function erroCampoVenda(campo: string) {
  return errosCampoVenda.value[campo]?.[0] || ''
}

function erroItemVenda(indice: number, campo: string) {
  return errosCampoVenda.value[`itens.${indice}.${campo}`]?.[0] || ''
}

async function guardarVenda() {
  aGuardarVenda.value = true
  erroVenda.value = ''
  errosCampoVenda.value = {}

  try {
    let pessoaId = formVenda.pessoa_id

    if (formVenda.modoCliente === 'novo') {
      const resPessoa = await api.post('/pessoas', { nome: formVenda.nomeClienteNovo, tipo: 'cliente' })
      pessoaId = resPessoa.data.dados.id
    }

    await api.post('/vendas', {
      pessoa_id: pessoaId,
      itens: formVenda.itens.map((item) => ({
        material_id: item.material_id,
        quantidade_kg: Number(item.quantidade_kg),
        preco_kg: Number(item.preco_kg),
      })),
    })

    fecharModalVenda()
    paginaActual.value = 1
    await carregar()
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.data?.erros) {
      errosCampoVenda.value = e.response.data.erros
    }
    erroVenda.value = (axios.isAxiosError(e) && e.response?.data?.mensagem) || 'Não foi possível registar a venda. Tenta novamente.'
  } finally {
    aGuardarVenda.value = false
  }
}
</script>

<template>
  <AppLayout>
    <template #caminho>Painel / Vendas</template>

    <!-- Cabeçalho -->
    <div class="cabecalho">
      <div>
        <h1>Gestão de Vendas</h1>
        <p>Monitoriza transações, lucros e movimentação de materiais.</p>
      </div>
      <div class="cabecalho__accoes">
        <button type="button" class="botao-fantasma" :disabled="aExportar" @click="exportar">
          <span v-if="aExportar" class="spinner" aria-hidden="true"></span>
          {{ aExportar ? 'A exportar…' : 'Exportar Relatório' }}
        </button>
        <button type="button" class="botao-primario" @click="abrirModalVenda">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          Registar Nova Venda
        </button>
      </div>
    </div>

    <p v-if="erro" class="estado estado--erro" role="alert">{{ erro }}</p>

    <!-- Cartões -->
    <section class="cartoes">
      <div v-for="c in cartoes" :key="c.rotulo" class="card-kpi" :class="`card-kpi--${c.cor}`">
        <div class="card-kpi__topo">
          <span class="card-kpi__rotulo">{{ c.rotulo }}</span>
          <span class="card-kpi__icone" :class="`card-kpi__icone--${c.cor}`" v-html="ICONES[c.icone]"></span>
        </div>
        <strong class="card-kpi__valor" :class="`card-kpi__valor--${c.cor}`">{{ mt(c.valor) }}</strong>
      </div>
    </section>

    <div class="grelha">
      <!-- Histórico de vendas -->
      <section class="painel-bloco">
        <div class="painel-bloco__topo">
          <div>
            <h2>Histórico de Vendas</h2>
            <p class="subtitulo">Lista detalhada das transações recentes.</p>
          </div>
          <input v-model="pesquisaCliente" type="text" placeholder="Filtrar por cliente…" class="filtro-pesquisa" />
        </div>

        <div v-if="aCarregar" class="estado">
          <span class="spinner" aria-hidden="true"></span>
          <p>A carregar vendas…</p>
        </div>
        <p v-else-if="vendasFiltradas.length === 0" class="vazio">Ainda não há vendas registadas.</p>

        <table v-else class="tabela">
          <thead>
            <tr>
              <th>Ref.</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Materiais</th>
              <th class="ao-fim">Total</th>
              <th class="ao-fim">Lucro</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in vendasFiltradas" :key="v.id">
              <td class="ref nowrap">{{ refVenda(v.id) }}</td>
              <td class="nowrap">{{ dataCurta(v.data) }}</td>
              <td>{{ v.cliente }}</td>
              <td class="materiais">{{ materiaisResumo(v) }}</td>
              <td class="ao-fim nowrap">{{ mt(v.total) }}</td>
              <td class="ao-fim nowrap valor--lucro">{{ mt(v.lucro) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="!aCarregar && paginacao.total > 0" class="paginacao">
          <span class="paginacao__info">
            A mostrar {{ vendasFiltradas.length }} de {{ paginacao.total }} vendas registadas
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
        <!-- Meta trimestral (em breve) -->
        <div class="painel-bloco painel-bloco--destaque">
          <h3>Meta Trimestral</h3>
          <p class="bloco-destaque__texto">Definição de metas de crescimento em breve.</p>
          <div class="em-breve-mini">Requer histórico de vários meses</div>
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

        <!-- Próximas entregas (em breve) -->
        <div class="painel-bloco">
          <h3 class="com-icone">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" stroke-linecap="round" />
            </svg>
            Próximas Entregas
          </h3>
          <div class="em-breve-mini">Agendamento de entregas em breve</div>
        </div>
      </aside>
    </div>

    <!-- Modal: registar nova venda -->
    <Teleport to="body">
      <div v-if="modalVendaAberto" class="modal-veu" @click.self="fecharModalVenda">
        <div class="modal-cartao modal-cartao--largo" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-venda">
          <div class="modal-cabecalho">
            <h3 id="titulo-modal-venda">Registar Nova Venda</h3>
            <button type="button" class="modal-fechar" aria-label="Fechar" @click="fecharModalVenda">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <form class="modal-form" @submit.prevent="guardarVenda">
            <!-- Cliente -->
            <div v-if="clientes.length > 0" class="alternador">
              <button
                type="button"
                class="alternador__opcao"
                :class="{ 'alternador__opcao--activa': formVenda.modoCliente === 'existente' }"
                @click="formVenda.modoCliente = 'existente'"
              >
                Cliente existente
              </button>
              <button
                type="button"
                class="alternador__opcao"
                :class="{ 'alternador__opcao--activa': formVenda.modoCliente === 'novo' }"
                @click="formVenda.modoCliente = 'novo'"
              >
                Cliente novo
              </button>
            </div>

            <div v-if="formVenda.modoCliente === 'existente'" class="campo-modal">
              <label for="cliente-existente">Cliente</label>
              <select id="cliente-existente" v-model.number="formVenda.pessoa_id" :disabled="aCarregarClientes">
                <option v-if="aCarregarClientes" value="">A carregar clientes…</option>
                <option v-for="c in clientes" :key="c.id" :value="c.id">{{ c.nome }}</option>
              </select>
              <span v-if="erroCampoVenda('pessoa_id')" class="campo-modal__erro">{{ erroCampoVenda('pessoa_id') }}</span>
            </div>
            <div v-else class="campo-modal">
              <label for="cliente-novo">Nome do cliente</label>
              <input id="cliente-novo" v-model="formVenda.nomeClienteNovo" type="text" placeholder="ex.: João Xavier" />
              <span v-if="erroCampoVenda('pessoa_id')" class="campo-modal__erro">{{ erroCampoVenda('pessoa_id') }}</span>
            </div>

            <!-- Materiais vendidos -->
            <div class="itens-venda">
              <div v-for="(item, i) in formVenda.itens" :key="i" class="item-venda">
                <div class="item-venda__cabecalho">
                  <span>Material {{ i + 1 }}</span>
                  <button
                    v-if="formVenda.itens.length > 1"
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
                      {{ m.nome }}, {{ Number(m.stock_kg).toFixed(0) }}kg disponível
                    </option>
                  </select>
                  <span v-if="erroItemVenda(i, 'material_id')" class="campo-modal__erro">
                    {{ erroItemVenda(i, 'material_id') }}
                  </span>
                </div>

                <div class="campo-modal-grupo">
                  <div class="campo-modal">
                    <label :for="`quantidade-${i}`">Quantidade (kg)</label>
                    <input :id="`quantidade-${i}`" v-model="item.quantidade_kg" type="number" min="0" step="0.01" placeholder="0.00" />
                    <span v-if="erroItemVenda(i, 'quantidade_kg')" class="campo-modal__erro">
                      {{ erroItemVenda(i, 'quantidade_kg') }}
                    </span>
                  </div>
                  <div class="campo-modal">
                    <label :for="`preco-${i}`">Preço de venda /kg</label>
                    <input :id="`preco-${i}`" v-model="item.preco_kg" type="number" min="0" step="0.01" placeholder="0.00" />
                    <span v-if="erroItemVenda(i, 'preco_kg')" class="campo-modal__erro">
                      {{ erroItemVenda(i, 'preco_kg') }}
                    </span>
                  </div>
                </div>
              </div>

              <button type="button" class="botao-secundario botao-secundario--bloco" @click="adicionarItem">
                + Adicionar outro material
              </button>
            </div>

            <div class="total-estimado">
              <span>Total estimado</span>
              <strong>{{ mt(totalEstimado) }}</strong>
            </div>

            <p v-if="erroVenda" class="modal-alerta" role="alert">{{ erroVenda }}</p>

            <div class="modal-rodape">
              <button type="button" class="botao-secundario" :disabled="aGuardarVenda" @click="fecharModalVenda">
                Cancelar
              </button>
              <button type="submit" class="botao-primario" :disabled="aGuardarVenda">
                <span v-if="aGuardarVenda" class="spinner spinner--claro" aria-hidden="true"></span>
                {{ aGuardarVenda ? 'A guardar…' : 'Guardar venda' }}
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
.materiais {
  color: var(--cor-texto-suave);
  font-size: 12px;
}
.valor--lucro {
  color: var(--cor-primaria-600);
  font-weight: 600;
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
.bloco-destaque__texto {
  font-size: 13px;
  opacity: 0.9;
  margin: 0 0 14px;
}
.em-breve-mini {
  border: 1.5px dashed var(--cor-borda);
  border-radius: var(--raio-sm);
  padding: 12px;
  font-size: 12px;
  text-align: center;
  color: var(--cor-texto-suave);
}
.painel-bloco--destaque .em-breve-mini {
  border-color: rgb(255 255 255 / 0.4);
  color: rgb(255 255 255 / 0.85);
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

/* --- Modal: registar nova venda --- */
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
