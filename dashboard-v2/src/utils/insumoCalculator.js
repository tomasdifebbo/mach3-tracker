/**
 * Helper para cálculo de consumo de insumos por m²
 * 
 * Nova regra: Baseado nas dimensões máximas (X × Y) atingidas pelo corte na chapa.
 * 1. Se boundingAreaM2 estiver disponível, usa a área exata.
 * 2. Se maxXMm e maxYMm estiverem disponíveis, calcula: (maxXMm / 1000) * (maxYMm / 1000)
 * 3. Caso contrário, usa as dimensões cadastradas da chapa/material (ex: 2.70m x 1.80m = 4.86 m²).
 */
export function calculateInsumo({ 
  durationMinutes = 0, 
  pricePerM2 = 0, 
  maxXMm = null, 
  maxYMm = null, 
  boundingAreaM2 = null, 
  sheetWidthMm = 2700, 
  sheetHeightMm = 1800 
}) {
  const price = Math.max(0, Number(pricePerM2) || 0);
  
  let areaM2 = 0;
  
  if (boundingAreaM2 && Number(boundingAreaM2) > 0) {
    areaM2 = Number(boundingAreaM2);
  } else if (maxXMm && maxYMm && Number(maxXMm) > 0 && Number(maxYMm) > 0) {
    areaM2 = (Number(maxXMm) / 1000) * (Number(maxYMm) / 1000);
  } else {
    // Dimensão máxima padrão da chapa (ex: 2.70m x 1.80m = 4.86 m²)
    const sWidth = Math.max(100, Number(sheetWidthMm) || 2700);
    const sHeight = Math.max(100, Number(sheetHeightMm) || 1800);
    areaM2 = (sWidth / 1000) * (sHeight / 1000);
  }

  const totalCost = areaM2 * price;

  return {
    linearMeters: 0,
    areaM2: Number(areaM2.toFixed(4)),
    totalCost: Number(totalCost.toFixed(2))
  };
}
