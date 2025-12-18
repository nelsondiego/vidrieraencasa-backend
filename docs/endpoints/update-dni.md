# Update User DNI

Endpoint para actualizar el Documento Nacional de Identidad (DNI) del usuario autenticado.

**URL:** `/auth/me/dni`  
**Method:** `PUT`  
**Auth:** Required (Bearer Token)

## Request Body

```json
{
  "dni": "12345678"
}
```

| Campo | Tipo   | Requerido | Descripción |
|-------|--------|-----------|-------------|
| `dni` | string | Sí        | El nuevo número de DNI del usuario. |

## Success Response

**Code:** `200 OK`

```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "fullName": "John Doe",
    "dni": "12345678",
    "passwordHash": "...",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Error Response

**Code:** `401 Unauthorized`

```json
{
  "error": "Unauthorized"
}
```

**Code:** `400 Bad Request` (Validation Error)

```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "code": "invalid_type",
        "expected": "string",
        "received": "undefined",
        "path": ["dni"],
        "message": "Required"
      }
    ],
    "name": "ZodError"
  }
}
```
