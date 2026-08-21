<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

function sair() {
  auth.sair()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="painel">
    <header class="topo">
      <div class="marca">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 21c-4.5-3-8-6.5-8-11a6 6 0 0 1 11-3.3A6 6 0 0 1 20 10c0 4.5-3.5 8-8 11Z" />
        </svg>
        <span>EcoManage</span>
      </div>
      <button type="button" class="botao-sair" @click="sair">Sair</button>
    </header>

    <main class="conteudo">
      <h1>Bem-vindo{{ auth.utilizador?.nome ? `, ${auth.utilizador.nome}` : '' }} 👋</h1>
      <p>
        Esta é a tela inicial (placeholder). As próximas telas — pessoas, materiais, compras — vão
        aparecer aqui à medida que forem ligadas à API.
      </p>
    </main>
  </div>
</template>

<style scoped>
.painel {
  min-height: 100vh;
  background: var(--cor-fundo);
}

.topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: var(--cor-superficie);
  border-bottom: 1px solid var(--cor-borda);
}

.marca {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  color: var(--cor-primaria-700);
}

.botao-sair {
  padding: 0.5rem 0.9rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--cor-primaria-700);
  background: var(--cor-primaria-50);
  border: 1px solid var(--cor-primaria-200);
  border-radius: var(--raio-sm);
  cursor: pointer;
}

.botao-sair:hover {
  background: var(--cor-primaria-100);
}

.conteudo {
  max-width: 40rem;
  margin: 0 auto;
  padding: 3rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.conteudo h1 {
  font-size: 1.5rem;
}

.conteudo p {
  color: var(--cor-texto-suave);
  line-height: 1.5;
}
</style>
