<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import logoIcone from '@/assets/logo-icon.png'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({
  username: '',
  palavraPasse: '',
})

const mostrarPalavraPasse = ref(false)
const capsLockActivo = ref(false)
const tentouSubmeter = ref(false)
const anoActual = new Date().getFullYear()

// --- validação simples no cliente ------------------------------------
const erroUsername = computed(() => {
  if (!tentouSubmeter.value) return ''
  if (!form.username.trim()) return 'Indica o teu nome de utilizador.'
  return ''
})

const erroPalavraPasse = computed(() => {
  if (!tentouSubmeter.value) return ''
  if (!form.palavraPasse) return 'Indica a tua palavra-passe.'
  return ''
})

const formularioValido = computed(() => !erroUsername.value && !erroPalavraPasse.value)

/** Avisa quando o Caps Lock está ligado — causa comum de "credenciais inválidas". */
function verificarCapsLock(e: KeyboardEvent) {
  capsLockActivo.value = e.getModifierState?.('CapsLock') ?? false
}

async function submeter() {
  tentouSubmeter.value = true
  auth.limparErro()

  if (!formularioValido.value) return

  const sucesso = await auth.entrar(form.username.trim(), form.palavraPasse)
  if (sucesso) {
    const destino = typeof route.query.redirect === 'string' ? route.query.redirect : { name: 'dashboard' }
    router.push(destino)
  }
}
</script>

<template>
  <div class="tela-login">
    <main class="cartao">
      <header class="cartao__cabecalho">
        <img :src="logoIcone" alt="" class="cartao__logo" />
        <p class="cartao__marca">EcoFênix <span>· EcoManage</span></p>
        <h1 class="cartao__titulo">Bem-vindo de volta</h1>
        <p class="cartao__subtitulo">Introduz as tuas credenciais para aceder ao sistema.</p>
      </header>

      <p v-if="auth.erro" class="alerta" role="alert">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5M12 16h.01" stroke-linecap="round" />
        </svg>
        <span>{{ auth.erro }}</span>
      </p>

      <form novalidate @submit.prevent="submeter">
        <div class="campo">
          <label for="username">Utilizador</label>
          <div class="campo__caixa">
            <svg class="campo__icone" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke-linecap="round" />
            </svg>
            <input
              id="username"
              v-model="form.username"
              type="text"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              placeholder="o teu nome de utilizador"
              :aria-invalid="!!erroUsername"
              :aria-describedby="erroUsername ? 'username-erro' : undefined"
              :disabled="auth.aCarregar"
              autofocus
            />
          </div>
          <span v-if="erroUsername" id="username-erro" class="campo__erro">{{ erroUsername }}</span>
        </div>

        <div class="campo">
          <label for="palavra-passe">Palavra-passe</label>
          <div class="campo__caixa">
            <svg class="campo__icone" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
              <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              id="palavra-passe"
              v-model="form.palavraPasse"
              class="campo__input--com-acao"
              :type="mostrarPalavraPasse ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
              :aria-invalid="!!erroPalavraPasse"
              :aria-describedby="erroPalavraPasse ? 'palavra-passe-erro' : undefined"
              :disabled="auth.aCarregar"
              @keydown="verificarCapsLock"
              @keyup="verificarCapsLock"
              @blur="capsLockActivo = false"
            />
            <button
              type="button"
              class="alternar-visibilidade"
              :aria-label="mostrarPalavraPasse ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'"
              :aria-pressed="mostrarPalavraPasse"
              @click="mostrarPalavraPasse = !mostrarPalavraPasse"
            >
              <svg v-if="mostrarPalavraPasse" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M3 3l18 18M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5M9.4 5.5A10.9 10.9 0 0 1 12 5c5 0 9 3.6 10.5 7-.6 1.3-1.4 2.5-2.5 3.6M6.2 6.8C4 8.3 2.4 10.4 1.5 12c1.5 3.4 5.5 7 10.5 7 1.4 0 2.7-.3 3.9-.8" />
              </svg>
              <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
          <span v-if="erroPalavraPasse" id="palavra-passe-erro" class="campo__erro">{{ erroPalavraPasse }}</span>
          <span v-else-if="capsLockActivo" class="campo__aviso" role="status">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 4l7 8h-4v4H9v-4H5l7-8ZM9 20h6" stroke-linejoin="round" stroke-linecap="round" />
            </svg>
            Caps Lock está ligado
          </span>
        </div>

        <button type="submit" class="botao-entrar" :disabled="auth.aCarregar">
          <span v-if="auth.aCarregar" class="spinner" aria-hidden="true" />
          <span>{{ auth.aCarregar ? 'A entrar…' : 'Entrar' }}</span>
          <svg v-if="!auth.aCarregar" class="botao-entrar__seta" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </form>

      <p class="cartao__ajuda">Esqueceste a palavra-passe? Contacta o administrador do sistema.</p>
    </main>

    <footer class="rodape">
      <span>© {{ anoActual }} EcoFênix</span>
      <span class="rodape__ponto" aria-hidden="true"></span>
      <span>Acesso restrito a colaboradores</span>
    </footer>
  </div>
</template>

<style scoped>
/* Fundo branco e um único cartão centrado: sem distrações, o foco
   está todo no formulário. */
.tela-login {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.75rem;
  padding: 2rem 1rem;
  background: #ffffff;
}

/* =================== cartão =================== */
.cartao {
  width: 100%;
  max-width: 26rem;
  padding: 2.5rem 2.25rem 2rem;
  background: var(--cor-superficie);
  border: 1px solid var(--cor-borda);
  border-radius: 18px;
  box-shadow:
    0 1px 2px rgb(22 33 28 / 0.04),
    0 24px 48px -24px rgb(22 33 28 / 0.18);
  animation: subir 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

.cartao__cabecalho {
  text-align: center;
}

.cartao__logo {
  display: block;
  width: 3.75rem;
  height: 3.75rem;
  margin: 0 auto 1rem;
  object-fit: contain;
}

.cartao__marca {
  font-family: var(--fonte-titulo);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--cor-primaria-600);
  margin-bottom: 1.25rem;
}

.cartao__marca span {
  color: var(--cor-texto-suave);
  font-weight: 500;
}

.cartao__titulo {
  font-family: var(--fonte-titulo);
  font-size: 1.6rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.2;
  color: var(--cor-texto);
}

.cartao__subtitulo {
  margin-top: 0.45rem;
  color: var(--cor-texto-suave);
  font-size: 0.92rem;
  line-height: 1.5;
}

.cartao__ajuda {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--cor-borda);
  text-align: center;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--cor-texto-suave);
}

form {
  margin-top: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

/* ---------- campos ---------- */
.campo {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.campo label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--cor-texto);
}

.campo__caixa {
  position: relative;
  display: flex;
  align-items: center;
}

.campo__icone {
  position: absolute;
  left: 0.95rem;
  color: var(--cor-texto-suave);
  pointer-events: none;
  transition: color 0.15s ease;
}

.campo input {
  width: 100%;
  height: 3rem;
  padding: 0 0.95rem 0 2.75rem;
  font-size: 1rem; /* 16px evita o zoom automático no iOS */
  font-family: inherit;
  border: 1px solid var(--cor-borda);
  border-radius: 10px;
  background: #f7faf8;
  color: var(--cor-texto);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
}

.campo input::placeholder {
  color: #9aa8a1;
}

.campo input:hover {
  border-color: #b9cbc0;
}

.campo input:focus-visible {
  outline: none;
  background: var(--cor-superficie);
  border-color: var(--cor-primaria-500);
  box-shadow: var(--sombra-foco);
}

.campo__caixa:focus-within .campo__icone {
  color: var(--cor-primaria-600);
}

.campo input[aria-invalid='true'] {
  border-color: var(--cor-erro);
  background: #fffafa;
}

.campo input:disabled {
  color: var(--cor-texto-suave);
  cursor: not-allowed;
}

.campo__input--com-acao {
  padding-right: 3rem !important;
}

.campo__erro {
  font-size: 0.8rem;
  color: var(--cor-erro);
}

.campo__aviso {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--cor-aviso);
}

.alternar-visibilidade {
  position: absolute;
  right: 0.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  background: transparent;
  color: var(--cor-texto-suave);
  border-radius: var(--raio-sm);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.alternar-visibilidade:hover {
  color: var(--cor-primaria-600);
  background: var(--cor-primaria-50);
}

.alternar-visibilidade:focus-visible {
  outline: none;
  box-shadow: var(--sombra-foco);
}

/* ---------- alerta ---------- */
.alerta {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  margin-top: 1.5rem;
  padding: 0.8rem 0.95rem;
  border-radius: 10px;
  border: 1px solid rgb(217 67 46 / 0.2);
  background: var(--cor-erro-fundo);
  color: var(--cor-erro);
  font-size: 0.875rem;
  line-height: 1.45;
  animation: tremer 0.35s ease;
}

.alerta svg {
  flex-shrink: 0;
  margin-top: 0.05rem;
}

/* ---------- botão ---------- */
.botao-entrar {
  margin-top: 0.4rem;
  height: 3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  font-size: 0.97rem;
  font-weight: 600;
  font-family: inherit;
  color: white;
  background: var(--cor-primaria-600);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 10px 24px -14px rgb(22 125 69 / 0.7);
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.05s ease;
}

.botao-entrar:hover:not(:disabled) {
  background: var(--cor-primaria-700);
  box-shadow: 0 14px 28px -14px rgb(22 125 69 / 0.75);
}

.botao-entrar__seta {
  transition: transform 0.2s ease;
}

.botao-entrar:hover:not(:disabled) .botao-entrar__seta {
  transform: translateX(3px);
}

.botao-entrar:active:not(:disabled) {
  transform: translateY(1px);
}

.botao-entrar:focus-visible {
  outline: none;
  box-shadow: var(--sombra-foco);
}

.botao-entrar:disabled {
  background: #6f9a82;
  box-shadow: none;
  cursor: progress;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgb(255 255 255 / 0.45);
  border-top-color: white;
  border-radius: 50%;
  animation: girar 0.6s linear infinite;
}

/* ---------- rodapé ---------- */
.rodape {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  font-size: 0.78rem;
  color: var(--cor-texto-suave);
}

.rodape__ponto {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.6;
}

/* ---------- animações ---------- */
@keyframes subir {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes tremer {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cartao,
  .alerta {
    animation: none;
  }
}

/* =================== telemóvel =================== */
@media (max-width: 480px) {
  .tela-login {
    justify-content: flex-start;
    padding: 2.5rem 1rem 1.5rem;
  }

  /* em ecrãs pequenos o cartão funde-se com o fundo branco */
  .cartao {
    padding: 0.5rem 0.25rem 0;
    border: none;
    box-shadow: none;
  }
}
</style>
