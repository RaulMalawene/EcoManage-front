/**
 * Configuração partilhada do Chart.js — registo dos componentes usados e os
 * valores por omissão (fonte, cores de eixo/grelha, tooltip) para que todos
 * os gráficos da app pareçam desenhados pela mesma mão, sem repetir isto em
 * cada tela.
 */
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { PALETA } from './paleta'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels,
)

// Datalabels é opt-in por gráfico (só liga onde faz sentido rótulo directo);
// isto desliga-o por omissão para não aparecer em todos os charts.
ChartJS.defaults.set('plugins.datalabels', { display: false })

ChartJS.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif"
ChartJS.defaults.font.size = 12
ChartJS.defaults.color = PALETA.textoSuave

ChartJS.defaults.plugins.tooltip.backgroundColor = PALETA.texto
ChartJS.defaults.plugins.tooltip.titleFont = { family: "'Poppins', 'Inter', sans-serif", weight: 600, size: 12 }
ChartJS.defaults.plugins.tooltip.bodyFont = { family: "'Inter', sans-serif", size: 12 }
ChartJS.defaults.plugins.tooltip.padding = 10
ChartJS.defaults.plugins.tooltip.cornerRadius = 8
ChartJS.defaults.plugins.tooltip.displayColors = true
ChartJS.defaults.plugins.tooltip.boxPadding = 4

ChartJS.defaults.plugins.legend.labels.usePointStyle = true
ChartJS.defaults.plugins.legend.labels.pointStyle = 'circle'
ChartJS.defaults.plugins.legend.labels.boxWidth = 8
ChartJS.defaults.plugins.legend.labels.padding = 16
ChartJS.defaults.plugins.legend.labels.font = { family: "'Inter', sans-serif", size: 12, weight: 500 }

export { ChartJS }

/** Formata em Metical compacto para eixos/rótulos onde o espaço é curto. */
export function mtCompacto(valor: number) {
  const abs = Math.abs(valor)
  if (abs >= 1_000_000) return (valor / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (abs >= 1_000) return (valor / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(Math.round(valor))
}
