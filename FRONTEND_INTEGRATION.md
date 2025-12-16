# Guía de Integración Frontend - Vidriera En Casa

Este documento detalla soluciones a problemas comunes y guías de uso de la API para el equipo de Frontend.

## Problemas Resueltos Recientemente

### Error `Invalid ID` al llamar a `/analysis/history`

**Síntoma:**
El frontend recibe un error `400 Bad Request` con el mensaje `{"error": "Invalid ID"}` al intentar obtener el historial de análisis.

**Causa:**
Existía un conflicto de rutas en la API. La ruta dinámica `GET /analysis/:id` estaba definida antes que `GET /analysis/history`. Como resultado, el servidor interpretaba la palabra "history" como si fuera un `:id`, intentaba convertirlo a número, fallaba (`NaN`) y devolvía el error.

**Solución (Backend):**
Se ha corregido el orden de las rutas en el backend. Ahora `GET /analysis/history` se define antes que `GET /analysis/:id`.

**Acción Requerida (Frontend):**
Ninguna acción requerida en el código del frontend. Simplemente reintentar la petición.

---

## Guía de Consumo de API

### Manejo de Errores
La API utiliza códigos de estado HTTP estándar. El frontend debe manejar estos casos:

*   **400 Bad Request:** Datos enviados incorrectos (ej. validación fallida). Revisar `error` en el body.
*   **401 Unauthorized:** Token no válido o expirado. **Acción:** Redirigir a login.
*   **403 Forbidden:** El usuario no tiene permiso para acceder al recurso (ej. intentar ver un análisis de otro usuario).
*   **404 Not Found:** Recurso no encontrado.
*   **429 Too Many Requests:** (Opcional) Límite de peticiones excedido.
*   **500 Internal Server Error:** Error inesperado en el servidor.

### Autenticación
Todas las rutas protegidas requieren el header:
`Authorization: Bearer <TOKEN>`

El token se obtiene en la respuesta de `/auth/login` o `/auth/register`.

### Paginación
Los endpoints de listado (como `/analysis/history`) soportan paginación mediante query params:
*   `page`: Número de página (empieza en 1).
*   `limit`: Cantidad de elementos por página.

Ejemplo: `/analysis/history?page=2&limit=5`

### Descarga de Archivos (PDF)
Para descargar archivos, se recomienda usar el endpoint directo que devuelve el stream del archivo con los headers correctos para forzar la descarga en el navegador.

*   **Endpoint:** `GET /analysis/:id/pdf`
*   **Uso en Frontend:**
    Se recomienda hacer una petición con `axios` o `fetch` configurando `responseType: 'blob'`, y luego crear una URL temporal para descargar.

    ```javascript
    const downloadPdf = async (analysisId) => {
      try {
        const response = await api.get(`/analysis/${analysisId}/pdf`, {
          responseType: 'blob', // Importante
        });
        
        // Crear link temporal
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `analisis-${analysisId}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (error) {
        console.error("Error descargando PDF", error);
      }
    };
    ```

## Endpoints Clave

| Acción | Método | Endpoint | Notas |
| :--- | :--- | :--- | :--- |
| **Login** | POST | `/auth/login` | Devuelve `session.token` |
| **Registro** | POST | `/auth/register` | Requiere `fullName`, `email`, `password` |
| **Perfil** | GET | `/auth/me` | Devuelve datos del usuario (incluyendo `fullName`) |
| **Subir Imagen** | POST | `/storage/upload` | Usar `FormData` con campo `file`. Devuelve URL CDN. |
| **Analizar** | POST | `/analysis/analyze` | Requiere `imageId` |
| **Historial** | GET | `/analysis/history` | Paginado. Incluye URLs CDN. |
| **Créditos** | GET | `/credits/available` | Saldo actual |

### Nuevas Características (CDN & Campos)

#### URLs de Imágenes y PDFs
Ahora la API devuelve URLs absolutas que apuntan al CDN (`cdn.vidrieraencasa.com` o proxy local).
Ya no es necesario construir URLs manualmente en el frontend.

**Ejemplo de respuesta (`/analysis/history`):**
```json
{
  "success": true,
  "history": [
    {
      "id": 1,
      "imageUrl": "https://cdn.vidrieraencasa.com/users/1/image.jpg",
      "pdfUrl": "https://cdn.vidrieraencasa.com/reports/1/report.pdf",
      ...
    }
  ]
}
```

#### Campo `fullName` en Usuario
El usuario ahora tiene un campo `fullName`.
*   **Registro:** El payload de `/auth/register` ahora requiere `fullName`.
*   **Respuesta:** Los objetos de usuario en `/auth/login`, `/auth/register` y `/auth/me` incluyen `fullName`.
