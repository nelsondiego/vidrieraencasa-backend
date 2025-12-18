# 📡 Propuesta Actualizada: Notificaciones Real-Time con Cloudflare Durable Objects

Este documento describe la arquitectura y el flujo propuesto para notificar al frontend en tiempo real cuando un pago es procesado y acreditado exitosamente, utilizando **Cloudflare Durable Objects** para gestionar conexiones WebSocket persistentes.

## 1. Objetivo

Eliminar la necesidad de que el frontend haga *polling* constante para verificar si un pago se completó. En su lugar, el backend mantendrá una conexión WebSocket abierta con el cliente para enviar actualizaciones instantáneas.

## 2. Arquitectura

La solución se basa en **Cloudflare Workers** y **Durable Objects**. Los Durable Objects actúan como "servidores WebSocket" distribuidos que pueden mantener el estado de la conexión y coordinar mensajes.

### Componentes

1.  **Worker Principal (Router):**
    *   Maneja las solicitudes HTTP tradicionales.
    *   Intercepta las solicitudes de actualización a WebSocket (`Upgrade: websocket`) y las dirige al Durable Object correspondiente.
2.  **Durable Object (`NotificationHub`):**
    *   Gestiona las conexiones WebSocket activas.
    *   Almacena en memoria qué usuario está conectado en qué socket (o usa un patrón de "Sala" por usuario).
    *   Recibe señales del webhook de pagos y retransmite el mensaje al socket del usuario específico.
3.  **Frontend (Cliente):**
    *   Se conecta al WebSocket al iniciar la sesión o el checkout.
    *   Escucha eventos como `PAYMENT_CONFIRMED`.

## 3. Flujo de Datos

### Paso 1: Conexión del Frontend (Handshake)

1.  El Frontend inicia una conexión WebSocket segura (`wss://`) al endpoint `/notifications/ws?token=<JWT>`.
2.  El Worker valida el token JWT para obtener el `userId`.
3.  El Worker obtiene el ID del Durable Object basado en el `userId` (Pattern: **Un DO por usuario** o **Un DO global sharded**).
    *   *Recomendación:* Usar un DO por usuario (`NotificationUserDO`) simplifica la lógica, o un DO "Hub" si se espera baja concurrencia por usuario pero alta global. Para este caso, un DO por usuario es ideal para aislamiento.
4.  El Worker pasa la petición al Durable Object.
5.  El Durable Object acepta la conexión (`state.acceptWebSocket(ws)`).

### Paso 2: Procesamiento del Pago (Webhook)

1.  Mercado Pago llama al webhook (`POST /payments/webhook`).
2.  El Worker procesa el pago y actualiza la base de datos (D1).
3.  **Nuevo:** El Worker instancia el *Stub* del Durable Object correspondiente al usuario (`idFromName(userId.toString())`).
4.  El Worker llama a un método del DO, ej: `stub.broadcastPaymentSuccess(data)`.

### Paso 3: Notificación (Push)

1.  El Durable Object recibe la llamada interna.
2.  Itera sobre los WebSockets activos para ese usuario (normalmente 1, pero pueden ser varios tabs).
3.  Envía el payload JSON al cliente.

## 4. Estructura del Mensaje (Payload)

El mensaje enviado por el WebSocket será un JSON string:

```json
{
  "type": "PAYMENT_CONFIRMED",
  "data": {
    "paymentId": "1234567890",
    "status": "approved",
    "planType": "addon_3",
    "creditsAdded": 3,
    "totalCredits": 8,
    "timestamp": "2024-05-20T10:30:00Z"
  }
}
```

## 5. Implementación Técnica (Resumen)

### A. Configuración (`wrangler.toml`)

```toml
[durable_objects]
bindings = [
  { name = "NOTIFICATION_HUB", class_name = "NotificationHub" }
]

[[migrations]]
tag = "v1"
new_classes = ["NotificationHub"]
```

### B. Clase Durable Object (`src/do/NotificationHub.ts`)

```typescript
export class NotificationHub implements DurableObject {
  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      // Hibernation API (Más barato y eficiente)
      this.state.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    
    // API interna para disparar notificaciones desde el Webhook
    if (request.method === "POST" && request.url.endsWith("/notify")) {
      const data = await request.json();
      this.broadcast(JSON.stringify(data));
      return new Response("OK");
    }

    return new Response("Not found", { status: 404 });
  }

  // Enviar a todos los sockets conectados a este objeto
  broadcast(message: string) {
    for (const ws of this.state.getWebSockets()) {
      ws.send(message);
    }
  }
}
```

## 6. Ventajas sobre Pub/Sub

*   **Menor Costo:** Con la API de Hibernación de WebSockets, no se paga por tiempo de inactividad, solo cuando hay mensajes.
*   **Control Total:** Lógica personalizada de autenticación y manejo de estado en TypeScript.
*   **Sin Dependencias Externas:** Todo corre nativo en el ecosistema de Workers.

---

*Documento generado para planificación técnica. No representa cambios actuales en el código.*
