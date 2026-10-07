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
    <!-- Palco da marca: verde-floresta com grão, brasa laranja e um anel
         fino que ecoa o círculo do logo e "sangra" para fora do ecrã. -->
    <section class="palco" aria-hidden="true">
      <span class="palco__anel"></span>
      <span class="palco__brasa"></span>
      <span class="palco__grao"></span>

      <header class="palco__topo">
        <span class="palco__marca">EcoFênix</span>
        <span class="palco__rotulo">Reciclagem &amp; Coleta</span>
      </header>

      <div class="palco__declaracao">
        <p class="palco__sobretitulo">EcoManage · Sistema de gestão</p>
        <h1 class="palco__titulo">Do lixo<br />ao <em>luxo</em>.</h1>
        <ol class="palco__etapas">
          <li><span>01</span>Coleta</li>
          <li><span>02</span>Triagem</li>
          <li><span>03</span>Valorização</li>
        </ol>
      </div>
    </section>

    <!-- Painel do formulário -->
    <main class="painel">
      <div class="painel__conteudo">
        <img :src="logoIcone" alt="EcoFênix" class="painel__logo" />

        <h2 class="painel__titulo">Bem-vindo de volta</h2>
        <p class="painel__subtitulo">Introduz as tuas credenciais para aceder ao sistema.</p>

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
              />
              <button
                type="button"
                class="alternar-visibilidade"
                :aria-label="mostrarPalavraPasse ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'"
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
          </div>

          <button type="submit" class="botao-entrar" :disabled="auth.aCarregar">
            <span v-if="auth.aCarregar" class="spinner" aria-hidden="true" />
            <span>{{ auth.aCarregar ? 'A entrar…' : 'Entrar' }}</span>
            <svg v-if="!auth.aCarregar" class="botao-entrar__seta" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </form>
      </div>

      <footer class="painel__rodape">
        <span>© {{ anoActual }} EcoFênix</span>
        <span class="painel__rodape-ponto" aria-hidden="true"></span>
        <span>Acesso restrito a colaboradores</span>
      </footer>
    </main>
  </div>
</template>

<style scoped>
/* Paleta local do palco: derivada do verde da marca, escurecida para
   dar contraste ao formulário. A brasa usa o laranja do logo. */
.tela-login {
  --palco-fundo: #0b2418;
  --palco-fundo-2: #0f3322;
  --palco-texto: #eef5f0;
  --palco-texto-suave: rgb(238 245 240 / 0.62);
  --palco-linha: rgb(238 245 240 / 0.14);
  --brasa: #ff7a2f;

  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(26rem, 1fr);
  background: var(--cor-superficie);
}

/* =================== palco =================== */
.palco {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 3rem clamp(2rem, 5vw, 4.5rem);
  color: var(--palco-texto);
  background:
    radial-gradient(120% 90% at 0% 0%, var(--palco-fundo-2) 0%, transparent 60%),
    linear-gradient(160deg, var(--palco-fundo-2) 0%, var(--palco-fundo) 55%, #071a11 100%);
}

/* anel fino: ecoa o círculo do logo, sangra pela direita */
.palco__anel {
  position: absolute;
  width: min(62rem, 95vh);
  aspect-ratio: 1;
  top: 50%;
  right: -38%;
  transform: translateY(-50%);
  border-radius: 50%;
  border: 1px solid var(--palco-linha);
  box-shadow:
    inset 0 0 0 4.5rem transparent,
    0 0 0 4.5rem rgb(238 245 240 / 0.025);
  pointer-events: none;
}

.palco__anel::after {
  content: '';
  position: absolute;
  inset: 14%;
  border-radius: 50%;
  border: 1px dashed rgb(238 245 240 / 0.09);
}

/* brasa: brilho quente baixo, puxa o olhar para a declaração */
.palco__brasa {
  position: absolute;
  width: 40rem;
  height: 40rem;
  right: -12rem;
  bottom: -18rem;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgb(255 122 47 / 0.32), rgb(255 122 47 / 0.08) 55%, transparent);
  pointer-events: none;
}

/* grão subtil para dar textura táctil */
.palco__grao {
  position: absolute;
  inset: 0;
  opacity: 0.14;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  pointer-events: none;
}

.palco__topo,
.palco__declaracao {
  position: relative;
  z-index: 1;
}

.palco__topo {
  display: flex;
  align-items: baseline;
  gap: 0.85rem;
}

.palco__marca {
  font-family: var(--fonte-titulo);
  font-weight: 600;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
}

.palco__rotulo {
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--palco-texto-suave);
  padding-left: 0.85rem;
  border-left: 1px solid var(--palco-linha);
}

.palco__declaracao {
  max-width: 40rem;
  animation: subir 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

.palco__sobretitulo {
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--palco-texto-suave);
  margin-bottom: 1.25rem;
}

.palco__titulo {
  font-family: var(--fonte-titulo);
  font-weight: 500;
  font-size: clamp(3.25rem, 7.2vw, 6.5rem);
  line-height: 0.96;
  letter-spacing: -0.04em;
  color: var(--palco-texto);
}

.palco__titulo em {
  font-style: normal;
  color: var(--brasa);
}

.palco__etapas {
  list-style: none;
  margin: 2.75rem 0 0;
  padding: 1.25rem 0 0;
  display: flex;
  gap: 2.5rem;
  border-top: 1px solid var(--palco-linha);
  font-size: 0.9rem;
  color: var(--palco-texto);
}

.palco__etapas span {
  display: block;
  font-size: 0.72rem;
  color: var(--palco-texto-suave);
  font-variant-numeric: tabular-nums;
  margin-bottom: 0.3rem;
}

/* =================== painel =================== */
.painel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 3rem clamp(1.5rem, 4vw, 4rem) 2rem;
  background: var(--cor-superficie);
}

.painel__conteudo {
  width: 100%;
  max-width: 23rem;
  margin: auto;
  animation: subir 0.6s 0.1s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

.painel__logo {
  display: block;
  width: 4rem;
  height: 4rem;
  object-fit: contain;
  margin-bottom: 2rem;
}

.painel__titulo {
  font-family: var(--fonte-titulo);
  font-size: 1.9rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.15;
  color: var(--cor-texto);
}

.painel__subtitulo {
  margin-top: 0.5rem;
  color: var(--cor-texto-suave);
  font-size: 0.95rem;
  line-height: 1.5;
}

form {
  margin-top: 2.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ---------- campos ---------- */
.campo {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
  height: 3.1rem;
  padding: 0 0.95rem 0 2.75rem;
  font-size: 0.95rem;
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

.alternar-visibilidade {
  position: absolute;
  right: 0.45rem;
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
}

.alerta svg {
  flex-shrink: 0;
  margin-top: 0.05rem;
}

/* ---------- botão ---------- */
.botao-entrar {
  margin-top: 0.5rem;
  height: 3.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  font-size: 0.97rem;
  font-weight: 600;
  color: white;
  background: var(--palco-fundo-2);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 10px 24px -12px rgb(11 36 24 / 0.6);
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.05s ease;
}

.botao-entrar:hover:not(:disabled) {
  background: var(--cor-primaria-600);
  box-shadow: 0 14px 28px -12px rgb(22 125 69 / 0.55);
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
  background: #5d7a6b;
  box-shadow: none;
  cursor: not-allowed;
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
.painel__rodape {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 2.5rem;
  font-size: 0.78rem;
  color: var(--cor-texto-suave);
}

.painel__rodape-ponto {
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
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .palco__declaracao,
  .painel__conteudo {
    animation: none;
  }
}

/* =================== responsivo =================== */
@media (max-width: 960px) {
  .tela-login {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .palco {
    min-height: 17rem;
    padding: 1.75rem 1.5rem 2rem;
    gap: 3rem;
  }

  .palco__anel {
    width: 34rem;
    right: -16rem;
  }

  .palco__brasa {
    width: 26rem;
    height: 26rem;
    right: -8rem;
    bottom: -14rem;
  }

  .palco__sobretitulo {
    display: none;
  }

  .palco__titulo {
    font-size: clamp(2.6rem, 11vw, 4rem);
  }

  .palco__etapas {
    margin-top: 1.5rem;
    padding-top: 1rem;
    gap: 1.75rem;
    font-size: 0.82rem;
  }

  .painel {
    padding: 2.5rem 1.5rem 1.5rem;
  }

  .painel__logo {
    display: none;
  }

  .painel__titulo {
    font-size: 1.6rem;
  }
}
</style>
