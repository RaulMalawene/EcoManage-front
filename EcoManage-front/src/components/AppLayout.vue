<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ICONES } from '@/utils/icones'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const menuAberto = ref(false)
const aSair = ref(false)

// Itens do menu. 'pronto: false' marca telas ainda por construir —
// aparecem esbatidas e não navegam, para o dono ver o mapa completo
// do sistema sem clicar em algo que ainda não existe.
const itens = [
  { nome: 'Painel', rota: 'dashboard', pronto: true, icone: 'painel' },
  { nome: 'Livro-caixa', rota: 'caixa', pronto: true, icone: 'caixa' },
  { nome: 'Compras', rota: 'compras', pronto: false, icone: 'compras' },
  { nome: 'Vendas', rota: 'vendas', pronto: false, icone: 'vendas' },
  { nome: 'Empréstimos & Dívidas', rota: 'emprestimos', pronto: false, icone: 'emprestimos' },
  { nome: 'Materiais & Stock', rota: 'materiais', pronto: false, icone: 'materiais' },
  { nome: 'Despesas', rota: 'despesas', pronto: false, icone: 'despesas' },
  { nome: 'Contactos', rota: 'pessoas', pronto: false, icone: 'contactos' },
  { nome: 'Relatórios', rota: 'relatorios', pronto: false, icone: 'relatorios' },
  { nome: 'Configurações', rota: 'config', pronto: false, icone: 'config' },
]

// Fecha o menu (mobile) sempre que a rota muda.
watch(
  () => route.fullPath,
  () => {
    menuAberto.value = false
  },
)

async function sair() {
  aSair.value = true
  await auth.sair()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="layout">
    <!-- Véu de fundo (mobile) para fechar o menu ao tocar fora -->
    <div v-if="menuAberto" class="veu" @click="menuAberto = false"></div>

    <!-- Barra lateral -->
    <aside class="lateral" :class="{ 'lateral--aberta': menuAberto }">
      <div class="lateral__marca">
        <div class="logo-mini">
          <svg viewBox="0 0 24 24" fill="currentColor" width="19" height="19">
            <path
              d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"
            />
          </svg>
        </div>
        <span>Jay Recicly</span>
      </div>

      <nav class="lateral__nav" aria-label="Navegação principal">
        <template v-for="item in itens" :key="item.rota">
          <RouterLink
            v-if="item.pronto"
            :to="{ name: item.rota }"
            class="nav-item"
            active-class="nav-item--activo"
          >
            <span class="nav-item__icone" v-html="ICONES[item.icone]"></span>
            <span class="nav-item__texto">{{ item.nome }}</span>
          </RouterLink>
          <span v-else class="nav-item nav-item--indisponivel" title="Em breve">
            <span class="nav-item__icone" v-html="ICONES[item.icone]"></span>
            <span class="nav-item__texto">{{ item.nome }}</span>
            <small>em breve</small>
          </span>
        </template>
      </nav>

      <div class="lateral__rodape">© {{ new Date().getFullYear() }} Jay Recicly</div>
    </aside>

    <!-- Conteúdo -->
    <div class="principal">
      <header class="topo">
        <button class="menu-btn" type="button" @click="menuAberto = !menuAberto" aria-label="Abrir menu">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12h18M3 6h18M3 18h18" stroke-linecap="round" />
          </svg>
        </button>

        <div class="topo__caminho">
          <slot name="caminho">Painel</slot>
        </div>

        <div class="topo__utilizador">
          <div class="avatar">{{ (auth.utilizador?.nome || 'U').charAt(0).toUpperCase() }}</div>
          <div class="topo__info">
            <strong>{{ auth.utilizador?.nome || 'A carregar…' }}</strong>
            <small>{{ auth.utilizador?.perfil_rotulo || 'Jay Recicly' }}</small>
          </div>
          <button
            class="sair-btn"
            type="button"
            :disabled="aSair"
            @click="sair"
            title="Terminar sessão"
            aria-label="Terminar sessão"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <main class="conteudo">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
  background: var(--cor-fundo);
}

/* --- Véu (mobile) --- */
.veu {
  position: fixed;
  inset: 0;
  background: rgb(22 33 28 / 0.45);
  z-index: 19;
}

/* --- Barra lateral --- */
.lateral {
  width: 240px;
  background: var(--cor-superficie);
  border-right: 1px solid var(--cor-borda);
  display: flex;
  flex-direction: column;
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 20;
  transform: translateX(0);
}

.lateral__marca {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 22px 20px;
  font-weight: 700;
  font-size: 17px;
  color: var(--cor-texto);
}

.logo-mini {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--cor-primaria-600);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.lateral__nav {
  flex: 1;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 14px;
  border-radius: var(--raio-sm);
  font-size: 14px;
  color: var(--cor-texto-suave);
  text-decoration: none;
  transition: background 0.12s, color 0.12s;
}

.nav-item__icone {
  display: inline-flex;
  flex-shrink: 0;
  color: inherit;
  opacity: 0.85;
}

.nav-item__texto {
  flex: 1;
  min-width: 0;
}

.nav-item:hover {
  background: var(--cor-fundo);
  color: var(--cor-texto);
}

.nav-item--activo {
  background: var(--cor-primaria-50);
  color: var(--cor-primaria-700);
  font-weight: 600;
}
.nav-item--activo .nav-item__icone {
  opacity: 1;
}

.nav-item--indisponivel {
  color: #b3bdb7;
  cursor: default;
}
.nav-item--indisponivel small {
  font-size: 10px;
  background: var(--cor-neutra-fundo);
  padding: 2px 6px;
  border-radius: 5px;
  color: #9aa8a1;
  flex-shrink: 0;
}

.lateral__rodape {
  padding: 16px 20px;
  font-size: 12px;
  color: #a8b3ad;
  border-top: 1px solid var(--cor-borda);
}

/* --- Principal --- */
.principal {
  flex: 1;
  margin-left: 240px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topo {
  background: var(--cor-superficie);
  border-bottom: 1px solid var(--cor-borda);
  padding: 14px 28px;
  display: flex;
  align-items: center;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.menu-btn {
  display: none;
  background: none;
  border: none;
  color: var(--cor-texto-suave);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--raio-sm);
}
.menu-btn:hover {
  background: var(--cor-fundo);
}

.topo__caminho {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: var(--cor-texto-suave);
}

.topo__utilizador {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--cor-primaria-600);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.topo__info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.topo__info strong {
  font-size: 14px;
  color: var(--cor-texto);
}
.topo__info small {
  font-size: 12px;
  color: var(--cor-texto-suave);
}

.sair-btn {
  background: none;
  border: none;
  color: #9aa8a1;
  cursor: pointer;
  padding: 8px;
  border-radius: var(--raio-sm);
  margin-left: 6px;
}
.sair-btn:hover:not(:disabled) {
  background: var(--cor-erro-fundo);
  color: var(--cor-erro);
}
.sair-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.conteudo {
  padding: 28px;
  flex: 1;
  min-width: 0;
}

/* --- Responsivo --- */
@media (max-width: 900px) {
  .lateral {
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: var(--sombra);
  }
  .lateral--aberta {
    transform: translateX(0);
  }
  .principal {
    margin-left: 0;
  }
  .menu-btn {
    display: block;
  }
  .topo__info {
    display: none;
  }
  .conteudo {
    padding: 20px;
  }
}
</style>
