# Documentación Funcional del Backend para Agente IA - Vidriera en Casa

## 1. Visión General del Sistema

Vidriera en Casa es una plataforma SaaS diseñada para analizar vidrieras de comercios físicos utilizando Inteligencia Artificial. El backend actúa como el núcleo lógico que coordina la autenticación de usuarios, la gestión de créditos y suscripciones, el procesamiento de imágenes con IA, la generación de reportes y la gestión de pagos.

El objetivo principal del backend es proveer una API robusta, segura y eficiente que permita a los usuarios subir fotografías de sus vidrieras y recibir un diagnóstico visual accionable en formato PDF.

## 2. Entorno de Ejecución y Restricciones

El sistema opera en un entorno "Serverless Edge" (Cloudflare Pages con Edge Runtime). Esto impone restricciones específicas que el Agente IA debe considerar siempre:

- **No existe un servidor persistente**: Cada petición es efímera.
- **Sin APIs de Node.js**: No se pueden utilizar módulos nativos de Node.js (como 'fs', 'path', 'crypto' nativo de Node). Se deben usar alternativas compatibles con estándares Web (Web Crypto API, fetch, etc.).
- **Base de Datos Distribuida**: La persistencia se maneja a través de una base de datos SQL serverless (D1).
- **Almacenamiento de Objetos**: Los archivos no se guardan en disco local, sino en un servicio de almacenamiento de objetos (R2).

## 3. Módulos Funcionales

### 3.1. Autenticación y Gestión de Usuarios

El sistema implementa un mecanismo de autenticación propio y seguro.

- **Registro**: Permite crear cuentas mediante correo electrónico y contraseña. Las contraseñas se almacenan de forma segura utilizando algoritmos de hash robustos (bcrypt).
- **Inicio de Sesión**: Valida credenciales y genera sesiones seguras.
- **Sesiones**: Se gestionan mediante tokens almacenados en cookies HTTP-only, seguras y con políticas estrictas de mismo sitio (SameSite). Esto previene ataques XSS y CSRF.
- **Protección de Rutas**: Todas las operaciones sensibles requieren una sesión activa y válida.

### 3.2. Sistema de Créditos y Planes

El modelo de negocio se basa en el consumo de créditos. Un análisis equivale a un crédito.

- **Planes Mensuales**: Los usuarios pueden suscribirse a planes que otorgan una cantidad fija de créditos cada mes (ej. 3 o 10 análisis).
- **Ciclo de Vida del Plan**:
  - Los créditos se renuevan automáticamente en la fecha de corte mensual.
  - Si un plan expira o se cancela, los créditos asociados se invalidan.
  - No se permite acumular créditos no usados del mes anterior (se resetean).
- **Add-ons (Créditos Adicionales)**: Si un usuario agota su plan, puede comprar paquetes de créditos extra.
  - Estos créditos tienen una validez limitada (ej. hasta fin de mes) y se consumen solo después de agotar los del plan base.
- **Reglas de Consumo**: Al realizar un análisis, el sistema descuenta primero del plan mensual y luego de los add-ons disponibles.

### 3.3. Análisis de Imágenes con IA

Es el núcleo del servicio.

- **Subida de Imágenes**: El usuario sube una foto. El backend valida estrictamente el formato (imágenes válidas) y el tamaño máximo permitido antes de aceptarla.
- **Procesamiento**:
  - La imagen se almacena de forma segura.
  - Se envía a un servicio de IA (Gemini Vision) con un conjunto de instrucciones (prompts) diseñadas por expertos en visual merchandising.
  - El sistema debe manejar fallos de la IA: si el servicio externo falla, se implementan reintentos automáticos con espera exponencial. Si falla definitivamente, se debe reembolsar el crédito consumido al usuario y notificar el error.
- **Resultado**: La IA devuelve un diagnóstico estructurado que incluye fortalezas, debilidades y recomendaciones específicas.

### 3.4. Generación de Reportes (PDF)

Una vez completado el análisis, el sistema genera un entregable tangible.

- **Creación de Documento**: Se compila la foto original, la fecha y el texto del diagnóstico en un archivo PDF profesional.
- **Almacenamiento y Acceso**: El PDF se guarda en el almacenamiento de objetos. El usuario puede descargarlo mediante enlaces temporales seguros firmados por el backend.
- **Optimización**: Si un usuario solicita el mismo reporte varias veces, se sirve el archivo ya generado en lugar de crearlo de nuevo.

### 3.5. Pagos y Facturación

Integración con pasarela de pagos (MercadoPago) para la compra de planes y créditos.

- **Inicio de Pago**: El backend genera preferencias de pago con los detalles de la compra y metadatos del usuario.
- **Confirmación (Webhooks)**: El sistema escucha notificaciones de la pasarela de pagos para confirmar transacciones.
- **Seguridad e Idempotencia**: Se verifica la firma digital de las notificaciones para asegurar su autenticidad. Se procesan las notificaciones de manera que si llegan duplicadas, no se dupliquen los créditos o cargos.

## 4. Flujos de Datos y Lógica de Negocio

Esta sección detalla paso a paso los procesos críticos del sistema, con énfasis en la integridad transaccional y las reglas de negocio de créditos.

### 4.1. Flujo de Compra y Activación de Plan Mensual

Este flujo describe cómo un usuario adquiere una suscripción recurrente (ej. Mensual 3 o Mensual 10).

1.  **Validación Previa**:
    - El sistema verifica si el usuario ya tiene un plan mensual _activo_.
    - **Regla**: Solo se permite un plan mensual activo por usuario. Si ya existe uno, se bloquea el intento de compra de otro plan mensual.
2.  **Inicio de Pago**:
    - Se crea una preferencia en MercadoPago con `metadata` que incluye: `user_id` y `plan_type`.
    - Se redirige al usuario al checkout.
3.  **Procesamiento de Webhook (Confirmación)**:
    - MercadoPago notifica el pago aprobado.
    - El sistema valida la firma del webhook y verifica que no se haya procesado antes (idempotencia).
4.  **Activación del Plan**:
    - Se crea un registro en la tabla `plans`.
    - **Fecha Inicio**: `NOW()`.
    - **Fecha Fin**: `NOW() + 1 mes`.
    - **Fecha Reset**: `NOW() + 1 mes` (coincide con la fecha de renovación).
    - **Créditos**: Se asigna el total del plan (ej. 10).
    - **Créditos Restantes**: Se asigna el total del plan (ej. 10).
    - **Estado**: `active`.
5.  **Registro de Transacción**:
    - Se inserta un registro en `credit_transactions` con tipo `allocate` y origen `plan`.

### 4.2. Flujo de Compra y Activación de Add-on

Este flujo aplica cuando un usuario compra créditos extra (paquete único).

1.  **Inicio de Pago**:
    - Similar al plan mensual, pero con `plan_type` correspondiente (ej: `addon_1`, `addon_3`, `addon_5`) en metadata.
2.  **Procesamiento de Webhook**:
    - Validación de firma e idempotencia.
3.  **Activación del Add-on**:
    - Se crea un registro en la tabla `addons`.
    - **Créditos**: Cantidad comprada.
    - **Fecha Compra**: `NOW()`.
    - **Fecha Expiración**: **Último día del mes actual**. (Ej: Si compra el 15 de Mayo, expira el 31 de Mayo).
    - **Estado**: `active`.
4.  **Registro de Transacción**:
    - Se inserta en `credit_transactions` con tipo `allocate` y origen `addon`.

### 4.3. Flujo de Consumo de Créditos (Al iniciar análisis)

Este proceso determina qué crédito usar cuando el usuario solicita un análisis.

1.  **Verificación de Disponibilidad**:
    - Se calcula el saldo total: `(Créditos Restantes Plan Activo) + (Créditos Restantes Add-ons Activos)`.
    - Si saldo <= 0, se rechaza la solicitud.
2.  **Priorización de Consumo (Regla de Oro)**:
    - **Prioridad 1**: Créditos del Plan Mensual.
    - **Prioridad 2**: Créditos de Add-ons (ordenados por fecha de expiración más próxima).
3.  **Ejecución del Consumo**:
    - Si el Plan tiene saldo > 0:
      - Se resta 1 a `plans.credits_remaining`.
      - Se registra transacción `consume` vinculada al `plan_id`.
    - Si el Plan tiene saldo 0, pero hay Add-on:
      - Se resta 1 a `addons.credits_remaining` del add-on seleccionado.
      - Se registra transacción `consume` vinculada al `addon_id`.
4.  **Vinculación**:
    - La transacción de consumo guarda el `analysis_id` para trazabilidad.

### 4.4. Flujo de Reembolso Automático (Fallo de Análisis)

Si el análisis falla después de todos los reintentos (IA no disponible, error de sistema), el crédito debe volver al usuario.

1.  **Detección de Fallo Definitivo**:
    - El proceso de análisis captura una excepción final o agota reintentos.
2.  **Identificación de la Fuente**:
    - Se busca la transacción de `consume` asociada a este `analysis_id`.
3.  **Reversión**:
    - Si la fuente fue un **Plan**: Se suma 1 a `plans.credits_remaining`.
    - Si la fuente fue un **Add-on**: Se suma 1 a `addons.credits_remaining`.
4.  **Registro**:
    - Se crea una nueva transacción tipo `refund` en `credit_transactions`.
5.  **Notificación**:
    - Se informa al usuario del error y la devolución del crédito.

### 4.5. Flujo de Renovación Automática de Plan (Reset Mensual)

Este proceso corre periódicamente o se verifica "lazy" (al acceder).

1.  **Identificación**:
    - Se detectan planes activos donde `NOW() >= reset_date`.
2.  **Reset de Créditos (No Acumulativo)**:
    - **Acción**: `plans.credits_remaining = plans.credits`.
    - _Nota_: No importa si sobraron créditos, se sobrescriben. No se suman.
3.  **Extensión de Fechas**:
    - `plans.end_date` se incrementa en 1 mes.
    - `plans.reset_date` se incrementa en 1 mes.
4.  **Auditoría**:
    - Se registra transacción tipo `reset`.

### 4.6. Flujo de Expiración de Add-ons

Los add-ons vencen a fin de mes.

1.  **Identificación**:
    - Se detectan add-ons activos donde `NOW() > expiration_date`.
2.  **Expiración**:
    - Se actualiza `addons.status = 'expired'`.
    - Se establece `addons.credits_remaining = 0` (opcional, para claridad).
3.  **Auditoría**:
    - Se registra transacción tipo `expire` con la cantidad de créditos que se perdieron.

## 5. Manejo de Errores y Resiliencia

El backend debe ser resiliente a fallos.

- **Errores de Usuario**: Si el usuario envía datos inválidos (archivos corruptos, formatos no soportados), se responde con mensajes claros y códigos de error apropiados (4xx).
- **Errores del Sistema**: Si falla la base de datos o el almacenamiento, se registra el error internamente y se muestra un mensaje amigable al usuario, asegurando que no queden datos inconsistentes (ej. créditos descontados sin análisis realizado).
- **Limpieza**: En caso de fallos durante procesos de varios pasos (como subir imagen -> analizar), el sistema debe limpiar los archivos temporales o registros parciales para no dejar basura.
