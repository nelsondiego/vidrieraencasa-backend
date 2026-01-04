# Requerimiento Técnico: Puntaje de Atracción Global y Lógica Freemium

Este documento detalla los cambios necesarios en el backend para implementar el nuevo modelo de negocio basado en un "Puntaje de Atracción" visible para todos, pero con detalles bloqueados para el nivel gratuito.

## 1. Cambios en el Modelo de Datos (Análisis)

Se requiere que el objeto de análisis devuelto por los endpoints `GET /analysis/:id` y `POST /analysis/analyze` incluya dos nuevos campos obligatorios:

### A. Campo `score` (Dentro de `diagnosis`)

Debe ser un número entero entre **0 y 100**. Representa el "Puntaje de Atracción" de la vidriera.

- **Disponibilidad**: Obligatorio para **todos** los análisis (Free y Pago).
- **Propósito**: Dar un feedback inmediato y cuantitativo al usuario.

### B. Campo `isFreeTier` (Nivel superior)

Un valor booleano para identificar el origen del crédito utilizado.

- **true**: Si el análisis fue realizado usando el crédito de regalo inicial (`freetier`).
- **false**: Si el análisis fue realizado usando créditos comprados (packs o planes).

```json
{
  "id": 123,
  "status": "completed",
  "isFreeTier": true, // <--- REQUERIDO
  "diagnosis": {
    "score": 65,     // <--- REQUERIDO (0-100)
    "overallAssessment": "...",
    "strengths": [...],
    "issues": [...],
    "priorityFixes": [...],
    "recommendations": [...],
    "suggestedSignageText": "..."
  }
}
```

## 2. Actualización del Prompt de la IA

Es necesario ajustar las instrucciones enviadas al modelo de lenguaje (IA) para que:

1.  **Generación de Score**: Analice la vidriera y asigne un puntaje de 0 a 100 basado en criterios de impacto visual, orden, iluminación y claridad del mensaje.
2.  **Formato JSON**: Incluya siempre la clave `"score": <valor>` en el objeto JSON que devuelve con el diagnóstico.

## 3. Lógica de Negocio y Endpoints

### Endpoints afectados:

- `POST /analysis/analyze`: Debe procesar el nuevo campo `score` desde la IA y guardarlo. Debe determinar si el crédito usado es `freetier` para setear `isFreeTier`.
- `GET /analysis/:id`: Debe devolver ambos campos en la respuesta.
- `GET /analysis/history`: (Opcional pero recomendado) Incluir el `score` en el listado para mostrarlo en el historial del usuario.

## 4. Objetivo de Conversión (UX)

El frontend utilizará estos campos para:

1.  **Todos los usuarios**: Mostrar el círculo con el puntaje de atracción.
2.  **Usuarios Pago**: Mostrar todo el desglose detallado y permitir descarga de PDF.
3.  **Usuarios Free**: Mostrar el puntaje como "gancho", pero bloquear el resto del contenido con un mensaje de venta: _"Tu vidriera tiene potencial, pero hay puntos críticos fallando. Para ver los 5 cambios críticos... paga $6.000"_.
