/**
 * Utilitário de injeção automática de Macros M101 / M102 e ajuste de Spindle
 * Padrão oficial do Mach3 Tracker / ACT para controle de usinagem e apontamento.
 */

export function patchGcodeContent(text, targetSpeed = '18000') {
  if (!text || typeof text !== 'string') {
    return {
      patchedContent: '',
      originalLinesCount: 0,
      patchedLinesCount: 0,
      m101Line: -1,
      m102Line: -1,
      spindleReplacedCount: 0,
      targetSpeed
    };
  }

  const lines = text.split(/\r?\n/);
  // 1. Remove M101 e M102 prévios para evitar duplicatas
  const cleanLines = lines.filter(l => !['M101', 'M102'].includes(l.trim().toUpperCase()));
  const newLines = [];
  let m101Inserted = false;
  let m101Line = -1;
  let spindleReplacedCount = 0;

  for (let i = 0; i < cleanLines.length; i++) {
    let line = cleanLines[i];
    if (targetSpeed && line.includes('S12000')) {
      line = line.replace(/S12000/g, `S${targetSpeed}`);
      spindleReplacedCount++;
    }
    newLines.push(line);

    // Injeta M101 imediatamente após o acionamento do spindle (M03 / M3)
    const codePart = line.split('(')[0].toUpperCase();
    if ((codePart.includes('M03') || codePart.includes('M3')) && !codePart.includes('M30') && !m101Inserted) {
      newLines.push('M101');
      m101Inserted = true;
      m101Line = newLines.length;
    }
  }

  // Fallback de M101 no início caso o arquivo não possua M03 explícito
  if (!m101Inserted && newLines.length > 0) {
    const insertIdx = Math.min(2, newLines.length);
    newLines.splice(insertIdx, 0, 'M101');
    m101Inserted = true;
    m101Line = insertIdx + 1;
  }

  const finalLines = [];
  let m102Inserted = false;
  let m102Line = -1;

  // Injeta M102 antes do encerramento de programa (M30)
  for (let i = 0; i < newLines.length; i++) {
    const line = newLines[i];
    const codePart = line.split('(')[0].toUpperCase();
    if (codePart.includes('M30') && !m102Inserted) {
      finalLines.push('M102');
      m102Inserted = true;
      m102Line = finalLines.length;
    }
    finalLines.push(line);
  }

  // Fallback de M102 no final caso não haja M30
  if (!m102Inserted) {
    finalLines.push('M102');
    m102Inserted = true;
    m102Line = finalLines.length;
  }

  return {
    patchedContent: finalLines.join('\n'),
    originalLinesCount: lines.length,
    patchedLinesCount: finalLines.length,
    m101Line,
    m102Line,
    spindleReplacedCount,
    targetSpeed
  };
}
