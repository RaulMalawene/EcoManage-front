<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import logoEcofenix from '@/assets/logo-ecofenix.png'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({
  username: '',
  palavraPasse: '',
})

const mostrarPalavraPasse = ref(false)
const tentouSubmeter = ref(false)

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
    <!-- Fundo decorativo: manchas de gradiente suaves, nunca atrás do logo
         (é por isso que o logo fica sempre sobre o cartão branco). -->
    <div class="fundo-decorativo" aria-hidden="true">
      <span class="mancha mancha--verde"></span>
      <span class="mancha mancha--laranja"></span>
      <span class="mancha mancha--teal"></span>
    </div>

    <div class="cartao-login">
      <img :src="logoEcofenix" alt="EcoFênix — Reciclagem &amp; Coleta" class="cartao-login__logo" />
      <p class="cartao-login__tagline">Gestão simples para operações mais sustentáveis.</p>

      <div class="cartao-login__divisor"></div>

      <h2>Iniciar sessão</h2>
      <p class="subtitulo">Introduz as tuas credenciais para aceder ao sistema.</p>

      <p v-if="auth.erro" class="alerta" role="alert">
        {{ auth.erro }}
      </p>

      <form novalidate @submit.prevent="submeter">
        <div class="campo">
          <label for="username">Utilizador</label>
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
          <span v-if="erroUsername" id="username-erro" class="campo__erro">{{ erroUsername }}</span>
        </div>

        <div class="campo">
          <label for="palavra-passe">Palavra-passe</label>
          <div class="campo-palavra-passe">
            <input
              id="palavra-passe"
              v-model="form.palavraPasse"
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
          {{ auth.aCarregar ? 'A entrar…' : 'Entrar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.tela-login {
  min-height: 100vh;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: var(--cor-fundo);
  overflow: hidden;
}

/* ---------- fundo decorativo ---------- */
.fundo-decorativo {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.mancha {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
}

.mancha--verde {
  width: 34rem;
  height: 34rem;
  top: -12rem;
  left: -10rem;
  background: var(--cor-primaria-400);
  opacity: 0.45;
}

.mancha--laranja {
  width: 28rem;
  height: 28rem;
  bottom: -10rem;
  right: -8rem;
  background: #ff8a3d;
  opacity: 0.35;
}

.mancha--teal {
  width: 22rem;
  height: 22rem;
  bottom: 6rem;
  left: 10%;
  background: var(--cor-teal-500);
  opacity: 0.25;
}

/* ---------- cartão ---------- */
.cartao-login {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: rgb(255 255 255 / 0.92);
  backdrop-filter: blur(18px);
  border: 1px solid rgb(255 255 255 / 0.7);
  border-radius: 1.75rem;
  box-shadow: 0 32px 64px -20px rgb(16 40 30 / 0.28);
  padding: 2.5rem 2.25rem;
  animation: entrada 0.45s ease-out;
}

@keyframes entrada {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cartao-login__logo {
  display: block;
  width: 9.5rem;
  max-width: 100%;
  height: auto;
  margin-bottom: 0.6rem;
}

.cartao-login__tagline {
  font-size: 0.85rem;
  color: var(--cor-texto-suave);
  line-height: 1.4;
  max-width: 18rem;
}

.cartao-login__divisor {
  width: 2.75rem;
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--cor-primaria-500), var(--cor-teal-500));
  margin: 1.5rem 0;
}

.cartao-login h2 {
  font-family: var(--fonte-titulo);
  font-size: 1.45rem;
  font-weight: 600;
  color: var(--cor-texto);
}

.subtitulo {
  margin-top: 0.35rem;
  color: var(--cor-texto-suave);
  font-size: 0.9rem;
  line-height: 1.4;
}

form {
  width: 100%;
  margin-top: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  text-align: left;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.campo label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--cor-texto);
}

.campo input {
  width: 100%;
  padding: 0.65rem 0.8rem;
  font-size: 0.95rem;
  border: 1px solid var(--cor-borda);
  border-radius: var(--raio-sm);
  background: var(--cor-superficie);
  color: var(--cor-texto);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.campo input:hover {
  border-color: var(--cor-primaria-400);
}

.campo input:focus-visible {
  outline: none;
  border-color: var(--cor-primaria-500);
  box-shadow: var(--sombra-foco);
}

.campo input[aria-invalid='true'] {
  border-color: var(--cor-erro);
}

.campo input:disabled {
  background: var(--cor-fundo);
  color: var(--cor-texto-suave);
}

.campo__erro {
  font-size: 0.8rem;
  color: var(--cor-erro);
}

.campo-palavra-passe {
  position: relative;
  display: flex;
}

.campo-palavra-passe input {
  padding-right: 2.5rem;
}

.alternar-visibilidade {
  position: absolute;
  right: 0.4rem;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: transparent;
  color: var(--cor-texto-suave);
  border-radius: var(--raio-sm);
  cursor: pointer;
}

.alternar-visibilidade:hover {
  color: var(--cor-primaria-600);
  background: var(--cor-primaria-50);
}

.alternar-visibilidade:focus-visible {
  outline: none;
  box-shadow: var(--sombra-foco);
}

.alerta {
  width: 100%;
  margin-top: 1.25rem;
  padding: 0.7rem 0.85rem;
  border-radius: var(--raio-sm);
  background: var(--cor-erro-fundo);
  color: var(--cor-erro);
  font-size: 0.875rem;
  line-height: 1.4;
  text-align: left;
}

.botao-entrar {
  width: 100%;
  margin-top: 0.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: white;
  background: var(--cor-primaria-500);
  border: none;
  border-radius: var(--raio-sm);
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.05s ease;
}

.botao-entrar:hover:not(:disabled) {
  background: var(--cor-primaria-600);
}

.botao-entrar:active:not(:disabled) {
  transform: translateY(1px);
}

.botao-entrar:focus-visible {
  outline: none;
  box-shadow: var(--sombra-foco);
}

.botao-entrar:disabled {
  background: var(--cor-primaria-200);
  cursor: not-allowed;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgb(255 255 255 / 0.5);
  border-top-color: white;
  border-radius: 50%;
  animation: girar 0.6s linear infinite;
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- responsivo ---------- */
@media (max-width: 480px) {
  .cartao-login {
    padding: 2rem 1.5rem;
    border-radius: 1.25rem;
  }

  .cartao-login__logo {
    width: 8rem;
  }
}
</style>
