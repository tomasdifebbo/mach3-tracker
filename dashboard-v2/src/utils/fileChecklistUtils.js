// Função universal para detectar arquivos que já foram testados, usinados ou dados OK pelo operador
export function isFileMarkedOk(filename = '') {
  if (!filename) return false;
  const lower = filename.toLowerCase().trim();

  // 1. Tag explícita no nome do arquivo (OK, chapaok, chapa ok, _ok, -ok, cortado, feito)
  if (
    lower.includes('chapaok') ||
    lower.includes('chapa ok') ||
    lower.includes(' ok.txt') ||
    lower.includes('_ok.txt') ||
    lower.includes('-ok.txt') ||
    lower.includes(' ok ') ||
    lower.includes('ja foi') ||
    lower.includes('cortado') ||
    lower.includes('feito') ||
    lower.endsWith('ok.txt')
  ) {
    return true;
  }

  // 2. Arquivos confirmados como concluídos por padrão legado de lote
  if (
    lower === 'compensado 6mm e6mm_11.txt' ||
    lower === 'compensado 6mm e6mm_12.txt' ||
    lower === 'compensado 6mm e6mm_10.txt' ||
    lower === 'compensado 6mm e6mm_9.txt' ||
    lower === 'compensado 6mm e6mm_8.txt' ||
    lower === 'compensado 6mm e6mm_7.txt' ||
    lower === 'compensado 6mm e6mm_5.txt' ||
    lower === 'compensado 6mm e6mm_4.txt' ||
    lower === 'compensado 6mm e6mm_3.txt' ||
    lower === 'compensado 6mm e6mm_2.txt' ||
    lower === 'compensado 6mm e6mm_1.txt' ||
    lower.includes('textura tijolos especiais e4mm') ||
    lower === 'compensado 10mm e6mm_1.txt' ||
    lower.includes('aplique mdf 9mm_1-corte 1') ||
    lower.includes('aplique mdf 9mm_2-corte 2') ||
    lower.includes('aplique mdf 9mm_3-corte 3') ||
    lower.includes('aplique mdf 9mm_4-corte 4') ||
    lower.includes('aplique mdf 9mm_1-corte 5') ||
    lower.includes('aplique mdf 9mm_2-corte 6') ||
    lower.includes('aplique mdf 9mm_4-corte 7') ||
    lower === '4x compensado 6mm e6mm.txt' ||
    lower === '2x compensado 6mm e6mm_1-corte 2.txt'
  ) {
    return true;
  }

  return false;
}
