# Especificación de Integración Backend - Mercado Pago

Esta guía detalla el endpoint que debe implementarse en el backend para procesar los pagos recibidos desde el Payment Brick del frontend.

## Endpoint

- **URL:** `/payments/process`
- **Método:** `POST`
- **Autenticación:** Requerida (Bearer Token del usuario)

## Estructura del Request (Body)

El frontend enviará un objeto JSON con la siguiente estructura:

```json
{
  "formData": {
    "transaction_amount": 1000,
    "token": "ff8080814c11e237014c1ff593b57b4d",
    "description": "Plan Mensual 3",
    "installments": 1,
    "payment_method_id": "visa",
    "issuer_id": 24,
    "payer": {
      "email": "usuario@ejemplo.com",
      "identification": {
        "type": "DNI",
        "number": "12345678"
      }
    }
  },
  "planType": "monthly_3"
}
```

### Detalle de Campos

- **formData**: Objeto generado directamente por el Payment Brick de Mercado Pago. Contiene toda la información sensible tokenizada.
  - `token`: Token de la tarjeta (uso único).
  - `transaction_amount`: Monto a cobrar.
  - `payment_method_id`: Identificador del medio de pago (ej: "visa", "master").
  - `payer`: Datos del pagador (email imprescindible).
- **planType**: Identificador del plan que el usuario está comprando (ej: "single", "monthly_3", "addon_1").

## Lógica del Backend (Ejemplo Node.js)

El backend debe utilizar el SDK oficial de Mercado Pago (`mercadopago`) para procesar el cobro.

### 1. Configuración Inicial
```javascript
import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);
```

### 2. Procesamiento del Pago
```javascript
async function processPayment(req, res) {
  const { formData, planType } = req.body;
  const userId = req.user.id; // Obtenido del token de sesión

  try {
    // 1. Crear el pago en Mercado Pago
    const paymentData = {
      transaction_amount: formData.transaction_amount,
      token: formData.token,
      description: formData.description,
      installments: formData.installments,
      payment_method_id: formData.payment_method_id,
      issuer_id: formData.issuer_id,
      payer: {
        email: formData.payer.email,
        identification: {
          type: formData.payer.identification.type,
          number: formData.payer.identification.number
        }
      }
    };

    const result = await payment.create({ body: paymentData });

    // 2. Verificar estado del pago
    if (result.status === 'approved') {
      // 3. ACTIVAR PLAN O ASIGNAR CRÉDITOS EN BASE DE DATOS
      // Esto es crucial: Aquí debes llamar a tu lógica de negocio
      await activateUserPlan(userId, planType, result.id);
      
      return res.status(200).json({
        success: true,
        data: result
      });
    } else {
      // Pago rechazado o pendiente
      return res.status(400).json({
        success: false,
        error: "El pago no fue aprobado",
        status: result.status,
        status_detail: result.status_detail
      });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message || "Error interno al procesar el pago"
    });
  }
}
```

## Respuesta Esperada

### Éxito (200 OK)
```json
{
  "success": true,
  "data": {
    "id": 1234567890,
    "status": "approved",
    "status_detail": "accredited",
    ...
  }
}
```

### Error (400/500)
```json
{
  "success": false,
  "error": "Mensaje de error descriptivo"
}
```
