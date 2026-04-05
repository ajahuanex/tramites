export const FULL_PB_SCHEMA = [
  {
    "name": "operadores",
    "type": "auth",
    "schema": [
      { "name": "dni", "type": "text", "required": false, "unique": false, "options": { "min": 8, "max": 8, "pattern": "^[0-9]{8}$" } },
      { "name": "nombre", "type": "text", "required": false, "options": {} },
      { "name": "perfil", "type": "select", "required": false, "options": { "values": ["MESA_PARTES", "OPERADOR", "JEFE", "ADMINISTRADOR", "OTI"] } },
      { "name": "sede", "type": "text", "required": false, "options": {} }
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''",
    "createRule": "@request.auth.perfil = 'ADMINISTRADOR' || @request.auth.perfil = 'OTI'",
    "updateRule": "id = @request.auth.id || @request.auth.perfil = 'ADMINISTRADOR' || @request.auth.perfil = 'OTI'",
    "deleteRule": "@request.auth.perfil = 'OTI'",
    "options": {
      "allowUsernameAuth": true,
      "allowEmailAuth": false,
      "requireEmail": false
    }
  },
  {
    "name": "sedes",
    "type": "base",
    "schema": [
      { "name": "nombre", "type": "text", "required": false, "unique": false, "options": {} }
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''",
    "createRule": "@request.auth.perfil = 'OTI'",
    "updateRule": "@request.auth.perfil = 'OTI'",
    "deleteRule": "@request.auth.perfil = 'OTI'"
  },
  {
    "name": "expedientes",
    "type": "base",
    "schema": [
      { "name": "operador", "type": "relation", "required": false, "options": { "collectionId": "operadores", "maxSelect": 1 } },
      { "name": "dni_ruc_remitente", "type": "text", "required": false, "options": {} },
      { "name": "remitente", "type": "text", "required": false, "options": {} },
      { "name": "tipo_documento", "type": "select", "options": { "values": ["Oficio", "Memorándum", "Carta", "Expediente", "Otro"] } },
      { "name": "numero_doc", "type": "text", "required": false, "options": {} },
      { "name": "asunto", "type": "text", "options": {} },
      { "name": "estado", "type": "select", "required": false, "options": { "values": ["RECIBIDO", "DERIVADO", "EN PROCESO", "OBSERVADO", "RECHAZADO", "ATENDIDO", "ARCHIVADO", "ENTREGADO"] } },
      { "name": "area_destino", "type": "text", "required": false, "options": {} },
      { "name": "observaciones", "type": "text", "options": {} },
      { "name": "fecha_registro", "type": "date", "required": false, "options": {} },
      { "name": "fecha_entrega", "type": "date", "options": {} }
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''",
    "createRule": "@request.auth.id != ''",
    "updateRule": "@request.auth.id != ''",
    "deleteRule": "@request.auth.perfil = 'ADMINISTRADOR' || @request.auth.perfil = 'OTI'"
  },
  {
    "name": "historial_acciones",
    "type": "base",
    "schema": [
      { "name": "expediente_id", "type": "text", "options": {} },
      { "name": "expediente_dni", "type": "text", "options": {} },
      { "name": "operador_id", "type": "text", "required": false, "options": {} },
      { "name": "operador_nombre", "type": "text", "options": {} },
      { "name": "operador_perfil", "type": "text", "options": {} },
      { "name": "accion", "type": "text", "required": false, "options": {} },
      { "name": "fecha", "type": "date", "required": false, "options": {} },
      { "name": "estado_anterior", "type": "text", "options": {} },
      { "name": "estado_nuevo", "type": "text", "options": {} },
      { "name": "detalles", "type": "text", "options": {} },
      { "name": "ip_publica", "type": "text", "options": {} },
      { "name": "user_agent", "type": "text", "options": {} }
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''",
    "createRule": "@request.auth.id != ''"
  },
  {
    "name": "historial_documentos",
    "type": "base",
    "schema": [
      { "name": "expediente_id", "type": "text", "required": false, "options": {} },
      { "name": "accion", "type": "text", "options": {} },
      { "name": "detalles", "type": "text", "options": {} },
      { "name": "fecha", "type": "date", "options": {} }
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''",
    "createRule": "@request.auth.id != ''"
  },
  {
    "name": "reportes_generados",
    "type": "base",
    "schema": [
      { "name": "generado_por", "type": "relation", "required": false, "options": { "collectionId": "operadores", "maxSelect": 1 } },
      { "name": "generado_por_nombre", "type": "text", "options": {} },
      { "name": "tipo_reporte", "type": "select", "required": false, "options": { "values": ["REPORTE_DIARIO", "ENTREGA_DIARIA", "REPORTE_MENSUAL"] } },
      { "name": "fecha_reporte", "type": "text", "required": false, "options": {} },
      { "name": "total_registros", "type": "number", "options": {} },
      { "name": "sede", "type": "text", "options": {} },
      { "name": "hash_verificacion", "type": "text", "required": false, "unique": false, "options": {} },
      { "name": "snapshot", "type": "json", "options": {} }
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "",
    "createRule": "@request.auth.id != ''"
  }
];
