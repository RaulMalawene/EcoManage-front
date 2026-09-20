<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ aberto: boolean }>()
const emit = defineEmits<{ fechar: [] }>()

const auth = useAuthStore()

const form = reactive({ nome: '', email: '' })
const erroNome = ref('')
const aGuardar = ref(false)
const guardadoComSucesso = ref(false)

// Repõe os campos com os dados atuais sempre que o modal abre.
watch(
  () => props.aberto,
  (aberto) => {
    if (!aberto) return
    form.nome = auth.utilizador?.nome || ''
    form.email = auth.utilizador?.email || ''
    erroNome.value = ''
    guardadoComSucesso.value = false
  },
)

function fechar() {
  if (aGuardar.value) return
  emit('fechar')
}

async function guardar() {
  erroNome.value = ''
  if (!form.nome.trim()) {
    erroNome.value = 'Indica o teu nome.'
    return
  }

  aGuardar.value = true
  try {
    await auth.atualizarPerfil({ nome: form.nome.trim(), email: form.email.trim() || null })
    guardadoComSucesso.value = true
    setTimeout(() => emit('fechar'), 900)
  } finally {
    aGuardar.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="aberto" class="modal-veu" @click.self="fechar">
      <div class="modal-cartao" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-perfil">
        <div class="modal-cabecalho">
          <h3 id="titulo-modal-perfil">Editar perfil</h3>
          <button type="button" class="modal-fechar" aria-label="Fechar" @click="fechar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <form class="modal-form" @submit.prevent="guardar">
          <div class="campo-modal">
            <label for="perfil-nome">Nome</label>
            <input id="perfil-nome" v-model="form.nome" type="text" placeholder="O teu nome" :disabled="aGuardar" />
            <span v-if="erroNome" class="campo-modal__erro">{{ erroNome }}</span>
          </div>

          <div class="campo-modal">
            <label for="perfil-email">Email <small>(opcional)</small></label>
            <input id="perfil-email" v-model="form.email" type="email" placeholder="ex.: nome@exemplo.com" :disabled="aGuardar" />
          </div>

          <div class="campo-modal">
            <label for="perfil-username">Utilizador</label>
            <input id="perfil-username" type="text" :value="auth.utilizador?.username" disabled />
          </div>

          <!-- Alteração de palavra-passe: por implementar. Segue a mesma
               convenção "em breve" usada no menu lateral, porque o backend
               ainda não tem nenhuma rota para gravar perfil (ver TODO em
               stores/auth.ts::atualizarPerfil). -->
          <div class="campo-modal campo-modal--indisponivel">
            <label>Palavra-passe <small>(em breve)</small></label>
            <input type="password" value="••••••••" disabled />
          </div>

          <p class="modal-nota">
            Por agora as alterações só ficam guardadas nesta sessão — um refresh da página repõe os dados originais.
            A gravação permanente do perfil ainda vai ser adicionada no backend.
          </p>

          <p v-if="guardadoComSucesso" class="modal-sucesso" role="status">Perfil atualizado.</p>

          <div class="modal-rodape">
            <button type="button" class="botao-secundario" :disabled="aGuardar" @click="fechar">Cancelar</button>
            <button type="submit" class="botao-primario" :disabled="aGuardar">
              <span v-if="aGuardar" class="spinner spinner--claro" aria-hidden="true"></span>
              {{ aGuardar ? 'A guardar…' : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.campo-modal--indisponivel {
  opacity: 0.55;
}
.campo-modal--indisponivel input {
  cursor: not-allowed;
}
.modal-nota {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cor-texto-suave);
  background: var(--cor-fundo);
  border-radius: var(--raio-sm);
  padding: 10px 12px;
  margin: 0;
}
.modal-sucesso {
  padding: 0.6rem 0.8rem;
  border-radius: var(--raio-sm);
  background: var(--cor-primaria-50);
  color: var(--cor-primaria-700);
  font-size: 0.85rem;
  margin: 0;
}
</style>
