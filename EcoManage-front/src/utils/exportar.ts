/**
 * Descarrega um ficheiro gerado pelo backend (PDF/CSV) e dispara o download
 * no browser.
 *
 * Usa blob + link temporário em vez de um simples <a href="..."> porque a
 * autenticação desta app é por token Bearer (Sanctum), não por cookie — um
 * link directo não enviaria o cabeçalho Authorization e a API responderia
 * 401. Passando pelo `api` (axios) o interceptor já estabelecido em
 * `services/api.ts` trata disso.
 */
import api from '@/services/api'

export async function baixarFicheiro(url: string, params: Record<string, unknown> = {}, nomeSugerido?: string) {
  const resposta = await api.get(url, { params, responseType: 'blob' })

  const nome = nomeSugerido || extrairNomeDoCabecalho(resposta.headers['content-disposition']) || 'ficheiro'
  const blobUrl = URL.createObjectURL(resposta.data)

  const link = document.createElement('a')
  link.href = blobUrl
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(blobUrl)
}

function extrairNomeDoCabecalho(cabecalho?: string): string | null {
  if (!cabecalho) return null
  const match = cabecalho.match(/filename="?([^"]+)"?/)
  return match?.[1] ?? null
}
