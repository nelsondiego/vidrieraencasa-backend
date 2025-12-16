# Especificación de API - Vidriera En Casa

Esta documentación detalla los endpoints disponibles en la API de Vidriera En Casa.

## Autenticación (`/auth`)

### Registro de Usuario

Crea una nueva cuenta de usuario.

- **Endpoint:** `POST /auth/register`
- **Headers:** `Content-Type: application/json`
- **Payload:**
  ```json
  {
    "email": "usuario@ejemplo.com",
    "password": "passwordSeguro123" // Mínimo 8 caracteres
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "id": 1,
      "email": "usuario@ejemplo.com"
    },
    "session": {
      "token": "uuid-token-session",
      "expiresAt": "2024-12-31T23:59:59.999Z"
    }
  }
  ```
- **Errores:**
  - `400 Bad Request`: Datos inválidos (email incorrecto, password corto).
  - `409 Conflict`: El email ya está registrado.

### Iniciar Sesión

Autentica a un usuario existente.

- **Endpoint:** `POST /auth/login`
- **Headers:** `Content-Type: application/json`
- **Payload:**
  ```json
  {
    "email": "usuario@ejemplo.com",
    "password": "passwordSeguro123"
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "id": 1,
      "email": "usuario@ejemplo.com"
    },
    "session": {
      "token": "uuid-token-session",
      "expiresAt": "2024-12-31T23:59:59.999Z"
    }
  }
  ```
- **Errores:**
  - `400 Bad Request`: Datos inválidos.
  - `401 Unauthorized`: Credenciales incorrectas.

### Cerrar Sesión

Invalida la sesión actual.

- **Endpoint:** `POST /auth/logout`
- **Headers:** `Authorization: Bearer <token>`
- **Payload:** Ninguno
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true
  }
  ```

### Obtener Usuario Actual

Obtiene la información del usuario autenticado.

- **Endpoint:** `GET /auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "id": 1,
      "email": "usuario@ejemplo.com",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
  ```
- **Errores:**
  - `401 Unauthorized`: Token inválido o expirado.

---

## Almacenamiento (`/storage`)

### Subir Imagen

Sube una imagen para ser analizada posteriormente.

- **Endpoint:** `POST /storage/upload`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
- **Payload (FormData):**
  - `file`: Archivo de imagen (binario)
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "image": {
      "id": 10,
      "userId": 1,
      "filename": "vidriera.jpg",
      "r2Key": "1/1700000000000-vidriera.jpg",
      "mimeType": "image/jpeg",
      "sizeBytes": 102400,
      "uploadedAt": "2024-01-01T12:00:00.000Z"
    }
  }
  ```
- **Errores:**
  - `400 Bad Request`: No se envió ningún archivo.

---

## Análisis (`/analysis`)

### Analizar Imagen

Inicia el proceso de análisis con IA para una imagen previamente subida. Consume 1 crédito.

- **Endpoint:** `POST /analysis/analyze`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Payload:**
  ```json
  {
    "imageId": 10
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "analysisId": 5,
    "diagnosis": {
      "strengths": ["Buena iluminación", "Productos visibles"],
      "issues": ["Desorden visual", "Falta de precios"],
      "recommendations": [
        "Agrupar productos por color",
        "Añadir etiquetas de precio claras"
      ],
      "suggestedSignageText": "¡Oferta de Verano! 50% OFF"
    }
  }
  ```
- **Errores:**
  - `402 Payment Required`: No tienes créditos suficientes.
  - `403 Forbidden`: La imagen no pertenece al usuario.
  - `404 Not Found`: Imagen no encontrada.
  - `500 Internal Server Error`: Error en el servicio de IA (se reembolsa el crédito automáticamente).

### Historial de Análisis

Obtiene una lista paginada de los análisis realizados por el usuario.

- **Endpoint:** `GET /analysis/history?page=1&limit=10`
- **Headers:** `Authorization: Bearer <token>`
- **Query Params:**
  - `page`: Número de página (default: 1)
  - `limit`: Items por página (default: 10)
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "history": [
      {
        "id": 5,
        "userId": 1,
        "imageId": 10,
        "status": "completed",
        "diagnosis": "{...JSON string...}",
        "createdAt": "2024-01-01T12:05:00.000Z",
        "image": {
          "filename": "vidriera.jpg"
          // ...
        }
      }
    ],
    "page": 1,
    "limit": 10
  }
  ```

### Obtener Análisis por ID

Obtiene los detalles de un análisis específico.

- **Endpoint:** `GET /analysis/:id`
- **Headers:** `Authorization: Bearer <token>`
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "analysis": {
      "id": 5,
      "status": "completed",
      "diagnosis": "{...}",
      // ...
      "image": { ... }
    }
  }
  ```

### Generar PDF

Genera un reporte PDF para un análisis completado.

- **Endpoint:** `POST /analysis/generate-pdf`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Payload:**
  ```json
  {
    "analysisId": 5
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "pdfKey": "reports/1/5.pdf"
  }
  ```

### Obtener URL de Descarga de PDF

Obtiene la URL para descargar el PDF generado.

- **Endpoint:** `GET /analysis/:id/pdf-url`
- **Headers:** `Authorization: Bearer <token>`
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "url": "https://api.vidrieraencasa.com/analysis/5/pdf" // URL directa
  }
  ```

### Descargar PDF (Directo)

Descarga el archivo PDF directamente.

- **Endpoint:** `GET /analysis/:id/pdf`
- **Headers:** `Authorization: Bearer <token>`
- **Respuesta Exitosa (200 OK):** Archivo binario PDF.
- **Headers de Respuesta:**
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="analisis-5.pdf"`

---

## Créditos (`/credits`)

### Consultar Créditos Disponibles

Devuelve la cantidad total de créditos que tiene el usuario para gastar.

- **Endpoint:** `GET /credits/available`
- **Headers:** `Authorization: Bearer <token>`
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "credits": 5
  }
  ```

### Consultar Plan Activo

Devuelve información sobre el plan de suscripción activo del usuario (si tiene uno).

- **Endpoint:** `GET /credits/active-plan`
- **Headers:** `Authorization: Bearer <token>`
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "plan": {
      "id": 1,
      "type": "monthly_10",
      "credits": 10,
      "creditsRemaining": 8,
      "startDate": "2024-01-01...",
      "endDate": "2024-02-01...",
      "status": "active"
    }
  }
  ```
  _(Devuelve `null` en "plan" si no hay plan activo)_

### Consumir Crédito (Manual/Interno)

Endpoint utilizado internamente o para débitos manuales. Normalmente el consumo es automático al llamar a `/analysis/analyze`.

- **Endpoint:** `POST /credits/consume`
- **Headers:** `Authorization: Bearer <token>`
- **Payload:**
  ```json
  {
    "analysisId": 5 // Opcional
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "success": true,
    "remaining": 4
  }
  ```

### Reembolsar Crédito (Manual/Interno)

Endpoint para reembolsos manuales.

- **Endpoint:** `POST /credits/refund`
- **Headers:** `Authorization: Bearer <token>`
- **Payload:**
  ```json
  {
    "analysisId": 5
  }
  ```

---

## Pagos (`/payments`)

### Crear Preferencia de Pago (Mercado Pago)

Inicia el proceso de compra de créditos o planes.

- **Endpoint:** `POST /payments/preference`
- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Payload:**
  ```json
  {
    "planType": "single" // Opciones: "single", "monthly_3", "monthly_10", "addon"
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "id": "123456789-preference-id-mp"
  }
  ```
  _(Este ID se usa en el frontend con el SDK de Mercado Pago para abrir el checkout)_

### Webhook Mercado Pago

Endpoint público para recibir notificaciones de pago de Mercado Pago.

- **Endpoint:** `POST /payments/webhook`
- **Payload:** (Estructura enviada por Mercado Pago)
- **Respuesta:** `200 OK`
