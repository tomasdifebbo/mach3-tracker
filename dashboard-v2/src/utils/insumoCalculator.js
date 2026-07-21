/**
 * Helper para cálculo de consumo de insumos por m²
 * 
 * Fórmula:
 * 1. Metro Linear (m) = (feedRateMmMin / 1000) * durationMinutes
 * 2. Metro Quadrado (m²) = Metro Linear * (passWidthMm / 1000)
 * 3. Custo Insumo (R$) = Metro Quadrado * pricePerM2
 */
export function calculateInsumo({ durationMinutes = 0, pricePerM2 = 0, feedRateMmMin = 3000, passWidthMm = 100 }) {
  const dur = Math.max(0, Number(durationMinutes) || 0);
  const price = Math.max(0, Number(pricePerM2) || 0);
  const feedRate = Math.max(1, Number(feedRateMmMin) || 3000); // mm/min
  const passWidth = Math.max(1, Number(passWidthMm) || 100);   // mm

  // Converter mm/min para m/min e multiplicar pelos minutos
  const linearMeters = (feedRate / 1000) * dur;

  // Converter mm para m e calcular área m²
  const areaM2 = linearMeters * (passWidth / 1000);

  // Custo total do insumo
  const totalCost = areaM2 * price;

  return {
    linearMeters: Number(linearMeters.toFixed(2)),
    areaM2: Number(areaM2.toFixed(3)),
    totalCost: Number(totalCost.toFixed(2))
  };
}
