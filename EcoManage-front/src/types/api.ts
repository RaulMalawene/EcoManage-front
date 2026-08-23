/** Formas de dados partilhadas por várias telas, confirmadas contra a API real. */

export interface ResumoDashboard {
  saldo_caixa: number
  total_em_divida: number
  valor_stock: number
  mes_corrente?: { lucro_liquido: number }
}

export interface MaterialStock {
  id: number
  nome: string
  preco_compra_kg: number
  preco_venda_kg: number
  stock_kg: number
  custo_medio_kg: number
  limite_alerta_kg: number | null
  valor_stock: number
  em_alerta: boolean
  activo: boolean
}

export interface Paginacao {
  pagina: number
  ultima_pagina: number
  total: number
  por_pagina?: number
}
