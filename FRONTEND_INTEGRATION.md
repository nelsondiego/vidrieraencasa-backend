# Guía de Integración para el Frontend - Vidriera En Casa

Este documento resume los cambios recientes en la lógica de créditos y planes, específicamente enfocados en el **Free Tier** y la transición a planes de pago.

## 1. Registro de Usuario y Crédito Inicial

Cada vez que un usuario se registra mediante el endpoint `POST /auth/register`, el backend realiza automáticamente lo siguiente:
- Crea la cuenta del usuario.
- Asigna un plan de tipo `freetier`.
- Carga **1 crédito** inicial de regalo.

**Importante para el Frontend:**
- El crédito Free Tier **no tiene fecha de expiración**. En la respuesta de la API (por ejemplo, en `/auth/me` o `/credits/status`), la fecha de fin vendrá como `null`.
- Debes mostrar al usuario que tiene 1 análisis disponible de regalo al iniciar.

## 2. Lógica de Consumo

El sistema de créditos prioriza automáticamente el uso de créditos:
1. Primero se consumen los créditos de **Planes** (incluyendo el Free Tier).
2. Si no hay créditos en el plan, se consumen los **Add-ons** (packs de créditos extra).

## 3. Compra de Créditos y Transición

Cuando un usuario decide comprar un plan pago (`single`, `monthly_3`, `monthly_10`) o un pack de créditos (`addon_1`, `addon_3`, `addon_5`):

- **Desactivación del Free Tier:** En el momento en que el pago es aprobado (ya sea vía webhook o procesamiento directo), el sistema **desactiva automáticamente** cualquier plan `freetier` activo.
- **Persistencia:** Los créditos gratuitos no se acumulan con los pagos; el plan de pago reemplaza al plan gratuito.

## 4. Endpoints Relevantes para el Frontend

### Obtener Estado de Créditos
- **Endpoint:** `GET /credits/status` (o similar, según implementación actual)
- **Campos clave:**
    - `plan.type`: Puede ser `"freetier"`, `"single"`, `"monthly_3"`, o `"monthly_10"`.
    - `plan.endDate`: Será `null` si el tipo es `"freetier"`.
    - `creditsRemaining`: Total de créditos disponibles para usar.

### Listado de Precios y Planes
Los planes disponibles para compra (que deben mostrarse en la UI de precios) son:
- **Análisis Único:** `single`
- **Plan Mensual 3:** `monthly_3`
- **Plan Mensual 10:** `monthly_10`
- **Packs Extra:** `addon_1`, `addon_3`, `addon_5`

**Nota:** El `freetier` NO debe aparecer como una opción de compra, ya que se asigna solo una vez al registrarse.

## 5. Recomendaciones de UI/UX

1. **Estado inicial:** "¡Bienvenido! Tienes 1 análisis gratuito para comenzar."
2. **Sin fecha de vencimiento:** Si el plan es `freetier`, evita mostrar mensajes de "Vence en X días". Puedes usar "Crédito de regalo disponible".
3. **Upgrade:** Una vez que el usuario compra un plan, el texto de "Free Tier" debe desaparecer de la interfaz para mostrar el nombre del nuevo plan adquirido.
