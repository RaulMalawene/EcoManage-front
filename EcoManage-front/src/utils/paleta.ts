/**
 * As mesmas cores do design system (ver `src/assets/main.css` :root),
 * mas como valores hex/rgb, o Chart.js desenha em <canvas>, que não lê
 * variáveis CSS directamente, por isso mantemos aqui uma cópia fiel.
 * Qualquer alteração de cor de marca tem de ser feita nos dois sítios.
 */
export const PALETA = {
  primaria50: '#ecfdf3',
  primaria100: '#d1fae0',
  primaria400: '#34b46a',
  primaria500: '#1f9d57',
  primaria600: '#167d45',
  primaria700: '#146339',

  teal500: '#0f9488',
  teal600: '#0c766d',
  teal700: '#0a5c54',

  ambar500: '#d99a1f',
  ambar600: '#b17f16',
  ambar700: '#8a6310',

  indigo500: '#5468d4',
  indigo600: '#4353b0',
  indigo700: '#37458c',

  erro: '#d9432e',
  erroFundo: '#fdecea',

  texto: '#16211c',
  textoSuave: '#5c6b64',
  borda: '#dfe7e2',
  superficie: '#ffffff',
} as const

/** Ordem categórica fixa (a mesma usada nos cartões KPI em toda a app);
 * nunca gerar cores novas, sempre seguir esta ordem. */
export const CORES_CATEGORICAS = [
  PALETA.primaria500,
  PALETA.teal500,
  PALETA.ambar500,
  PALETA.indigo500,
  PALETA.erro,
] as const
