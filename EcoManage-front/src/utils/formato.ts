/** Formatação partilhada por todas as telas (valores em Metical, datas). */

export function mt(valor: number | null | undefined, opcoes: { abs?: boolean } = {}) {
  const v = opcoes.abs ? Math.abs(valor || 0) : valor || 0
  return (
    new Intl.NumberFormat('pt-MZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v) + ' MT'
  )
}

export function dataCurta(data: string | null | undefined) {
  if (!data) return '-'
  return new Date(data).toLocaleDateString('pt-MZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** Formata uma data local como AAAA-MM-DD sem passar por UTC (evita o
 * deslize de um dia que `toISOString()` causa perto da meia-noite). */
export function dataIsoLocal(d: Date) {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}
