<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
    <!-- Painel de marca (visível em ecrãs largos) -->
    <section class="painel-marca" aria-hidden="true">
      <div class="painel-marca__conteudo">
        <div class="painel-marca__logo">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8">
            <path
              d="M12 21c-4.5-3-8-6.5-8-11a6 6 0 0 1 11-3.3A6 6 0 0 1 20 10c0 4.5-3.5 8-8 11Z"
            />
          </svg>
          <span>Jay Recicly</span>
        </div>
        <h1>Gestão simples para operações mais sustentáveis.</h1>
        <p>Pessoas, materiais e compras: tudo num só lugar, pronto para a tua equipa.</p>
      </div>
    </section>

    <!-- Painel do formulário -->
    <section class="painel-formulario">
      <div class="cartao-formulario">
        <div class="cabecalho-mobile">
          <div class="painel-marca__logo painel-marca__logo--escuro">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8">
              <path
                d="M12 21c-4.5-3-8-6.5-8-11a6 6 0 0 1 11-3.3A6 6 0 0 1 20 10c0 4.5-3.5 8-8 11Z"
              />
            </svg>
            <span>Jay Recicly</span>
          </div>
        </div>

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
    </section>
  </div>
</template>

<style scoped>
.tela-login {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

/* ---------- painel de marca ---------- */
.painel-marca {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  background: linear-gradient(160deg, var(--cor-primaria-700), var(--cor-primaria-500));
  color: white;
}

.painel-marca__conteudo {
  max-width: 26rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.painel-marca__logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.02em;
}

.painel-marca h1 {
  font-size: 1.9rem;
  line-height: 1.25;
  font-weight: 600;
}

.painel-marca p {
  color: rgb(255 255 255 / 0.85);
  font-size: 1rem;
  line-height: 1.5;
}

.cabecalho-mobile {
  display: none;
  margin-bottom: 1.5rem;
}

.painel-marca__logo--escuro {
  color: var(--cor-primaria-700);
}

/* ---------- painel do formulário ---------- */
.painel-formulario {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: var(--cor-fundo);
}

.cartao-formulario {
  width: 100%;
  max-width: 24rem;
  background: var(--cor-superficie);
  border: 1px solid var(--cor-borda);
  border-radius: var(--raio);
  box-shadow: var(--sombra);
  padding: 2.25rem 2rem;
}

.cartao-formulario h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--cor-texto);
}

.subtitulo {
  margin-top: 0.35rem;
  color: var(--cor-texto-suave);
  font-size: 0.925rem;
  line-height: 1.4;
}

form {
  margin-top: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
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
  margin-top: 1.25rem;
  padding: 0.7rem 0.85rem;
  border-radius: var(--raio-sm);
  background: var(--cor-erro-fundo);
  color: var(--cor-erro);
  font-size: 0.875rem;
  line-height: 1.4;
}

.botao-entrar {
  margin-top: 0.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.7rem 1rem;
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
@media (max-width: 860px) {
  .tela-login {
    grid-template-columns: 1fr;
  }

  .painel-marca {
    display: none;
  }

  .cabecalho-mobile {
    display: block;
  }

  .painel-formulario {
    padding: 1.5rem;
  }

  .cartao-formulario {
    padding: 1.75rem 1.5rem;
  }
}
</style>
