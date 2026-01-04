# Integración de Score e isFreeTier (Frontend)

Este documento detalla los cambios necesarios en el frontend para integrar la nueva lógica de puntaje (Score) y las restricciones para usuarios de nivel gratuito (Free Tier).

## 1. Nuevos Campos en el Análisis

Al consultar un análisis (`GET /analysis/:id` o `GET /analysis/history`), el objeto `analysis` ahora incluye:

- `isFreeTier`: (Boolean) Indica si el análisis fue realizado utilizando un crédito de regalo/bienvenida.
- `diagnosis.score`: (Number 0-100) El "Puntaje de Atracción Global" generado por la IA.

### Estructura de Datos
```typescript
interface Analysis {
  id: number;
  isFreeTier: boolean; // Indica si el análisis fue realizado utilizando un crédito de regalo
  diagnosis: {
    score: number; // (0-100)
    overallAssessment: string;
    focalPoints: string; // <-- Nuevo: Análisis de puntos focales
    lighting: string; // <-- Nuevo: Análisis de iluminación
    signage: string; // <-- Nuevo: Análisis de cartelería
    distribution: string; // <-- Nuevo: Análisis de distribución
    strengths: string[];
    issues: string[];
    priorityFixes: string[];
    recommendations: string[];
    suggestedSignageText: string;
  };
  // ... resto de campos
}
```

## 2. Lógica de Visualización (Restricciones Free Tier)

Según los requerimientos del negocio, si `isFreeTier === true`, el frontend debe aplicar las siguientes reglas:

### A. Pantalla de Detalle del Análisis
- **Puntaje (Score):** Debe mostrarse SIEMPRE.
- **Resumen (Overall Assessment):** Debe mostrarse SIEMPRE.
- **Secciones Específicas (FocalPoints, Lighting, Signage, Distribution):** Deben mostrarse SIEMPRE (son parte del análisis básico).
- **Detalles Bloqueados:** Los campos `strengths`, `issues`, `priorityFixes`, `recommendations` y `suggestedSignageText` deben estar **ocultos tras un blur o un banner de "Upgrade"**.

### B. Ejemplo de UI para Bloqueo
```tsx
{analysis.isFreeTier ? (
  <div className="relative">
    <DiagnosisSummary text={analysis.diagnosis.overallAssessment} />
    <div className="grid grid-cols-2 gap-4 my-4">
      <Section title="Puntos Focales" text={analysis.diagnosis.focalPoints} />
      <Section title="Iluminación" text={analysis.diagnosis.lighting} />
      <Section title="Cartelería" text={analysis.diagnosis.signage} />
      <Section title="Distribución" text={analysis.diagnosis.distribution} />
    </div>
    <div className="blur-sm select-none pointer-events-none">
      <DiagnosisDetails details={analysis.diagnosis} />
    </div>
    <UpgradeBanner message="¡Tu vidriera tiene un puntaje de {analysis.diagnosis.score}! Compra créditos para desbloquear las recomendaciones profesionales." />
  </div>
) : (
  <DiagnosisFullDetails details={analysis.diagnosis} />
)}
```

## 3. Rangos de Score (Recomendación Visual)

Para una mejor experiencia de usuario, se recomienda colorear el Score según su valor:

- **0 - 30 (Crítico):** Rojo (`#EF4444`) - No atrae clientes.
- **31 - 60 (Regular):** Amarillo/Naranja (`#F59E0B`) - Pasa desapercibida.
- **61 - 85 (Bueno):** Azul (`#3B82F6`) - Atractiva.
- **86 - 100 (Excelente):** Verde (`#10B981`) - Nivel profesional.

## 4. Resumen de Endpoints Afectados

1. **`POST /analysis/analyze`**:
   - Devuelve el objeto completo inmediatamente.
   - El frontend debe verificar `isFreeTier` en la respuesta para decidir qué mostrar tras el análisis.

2. **`GET /analysis/:id`**:
   - Devuelve los detalles del análisis.
   - Usar `isFreeTier` para la lógica de visualización mencionada arriba.

3. **`GET /analysis/history`**:
   - Cada item del historial ahora incluye `score` dentro de `diagnosis` e `isFreeTier`.
   - Ideal para mostrar el puntaje histórico en una lista o gráfico.

---
**Nota:** El backend ya maneja la persistencia y la lógica de créditos. El frontend es responsable únicamente de la máscara visual basada en el flag `isFreeTier`.
