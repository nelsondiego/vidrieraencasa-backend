# Guía de Implementación: Transformación de Imágenes con Cloudflare

Este documento detalla la estrategia para transformar imágenes de **WebP (R2)** a **JPEG** utilizando la infraestructura nativa de Cloudflare, necesario para la generación de PDFs.

## 1. El Problema
*   Las imágenes se guardan en **Cloudflare R2** en formato **WebP** (optimizado para web).
*   La librería de generación de PDF (`pdf-lib`) **no soporta WebP**, solo JPG y PNG.
*   Las librerías de conversión en JS puro (WASM) son pesadas y pueden fallar en el entorno de Workers.

## 2. La Solución: Cloudflare Image Resizing
Utilizaremos **Cloudflare Image Resizing**, un servicio nativo que permite transformar imágenes al vuelo sin necesidad de código complejo en el Worker.

### Requisitos Previos (Crítico)
Para que esto funcione, se deben cumplir las siguientes condiciones en la cuenta de Cloudflare:

1.  **Plan de Pago / Add-on:** Image Resizing suele requerir un plan **Pro/Business** o la suscripción al servicio de **Images** ($5/mes). **No está incluido en el plan Free básico** sin el add-on.
2.  **Habilitación en Dashboard:**
    *   Ir a: Dashboard > Seleccionar Dominio > **Speed** > **Optimization** > **Image Resizing**.
    *   **Enable Image Resizing**: ON.
    *   **Resize from any origin**: Recomendado activar para evitar problemas de CORS/Origen.

## 3. Implementación Técnica

Existen dos formas de invocar este servicio desde un Worker. La **Opción A** es la más limpia.

### Opción A: Fetch con `cf` Object (Binding Implícito)
El runtime de Workers permite pasar instrucciones de transformación directamente en el `fetch`.

```typescript
// src/routes/analysis.ts

// 1. Construir la URL pública de la imagen en R2
// El dominio debe estar proxeado por Cloudflare (Nube Naranja)
const imageUrl = `${c.env.CDN_URL}/${analysis.image.r2Key}`;

// 2. Hacer fetch solicitando la transformación
const response = await fetch(imageUrl, {
  cf: {
    image: {
      format: "jpeg", // Forzar formato JPEG
      quality: 85,    // Calidad (opcional)
      fit: "scale-down"
    },
  },
});

if (!response.ok) {
  throw new Error(`Error transforming image: ${response.status}`);
}

const imageBuffer = await response.arrayBuffer();
```

### Opción B: URL Transformation (Magic URL)
Si la opción A falla o se prefiere construir URLs explícitas.

```typescript
// Formato: https://dominio.com/cdn-cgi/image/<opciones>/<ruta-imagen>
const transformUrl = `${c.env.CDN_URL}/cdn-cgi/image/format=jpeg,quality=85/${analysis.image.r2Key}`;

const response = await fetch(transformUrl);
const imageBuffer = await response.arrayBuffer();
```

## 4. ¿Por qué falla en Local (`wrangler dev`)?

Esta es la causa más probable de los errores `501` o `Error fetching image` durante el desarrollo:

> **Cloudflare Image Resizing NO funciona en `localhost` ni en `wrangler dev` local.**

El motor de procesamiento de imágenes reside en los servidores físicos (Edge) de Cloudflare. El runtime local (Miniflare) no tiene este motor.

### Cómo probarlo:
1.  **Deploy a Producción:** `npm run deploy` y probar el endpoint real.
2.  **Dev Remoto:** Ejecutar `npm run dev -- --remote`. Esto ejecuta el Worker en la red real de Cloudflare, donde tiene acceso al motor de imágenes.

## 5. Estrategia de Fallback (Opcional)
Si no se dispone del plan de pago de Cloudflare, la única alternativa es volver a usar una librería de JS puro (como `jpeg-js` o `sharp` compilado a WASM), pero asumiendo el coste en rendimiento y tamaño del bundle.

Dado que el objetivo es una arquitectura robusta, se recomienda encarecidamente activar **Cloudflare Image Resizing**.
