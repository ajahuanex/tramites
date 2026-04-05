export const FULL_PB_SCHEMA = [
  {
    "name": "operadores",
    "type": "auth",
    "fields": [
      { "name": "dni", "type": "text", "required": false, "unique": false, "min": 8, "max": 8, "pattern": "^[0-9]{8}$" },
      { "name": "nombre", "type": "text", "required": false },
      { "name": "perfil", "type": "select", "required": false, "values": ["MESA_PARTES", "OPERADOR", "JEFE", "ADMINISTRADOR", "OTI"] },
      { "name": "sede", "type": "text" }
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''",
    "createRule": "@request.auth.perfil = 'ADMINISTRADOR' || @request.auth.perfil = 'OTI'",
    "updateRule": "id = @request.auth.id || @request.auth.perfil = 'ADMINISTRADOR' || @request.auth.perfil = 'OTI'",
    "deleteRule": "@request.auth.perfil = 'OTI'",
    "authOptions": {
      "allowUsernameAuth": true,
      "allowEmailAuth": false,
      "requireEmail": false
    }
  },
  {
    "name": "sedes",
    "type": "base",
    "fields": [
      { "name": "nombre", "type": "text", "required": false, "unique": false },
      { "name": "es_centro_entrega", "type": "bool" }
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
    "fields": [
      { "name": "operador", "type": "relation", "required": false, "collectionId": "operadores", "maxSelect": 1 },
      { "name": "dni_ruc_remitente", "type": "text", "required": false },
      { "name": "remitente", "type": "text", "required": false },
      { "name": "tipo_documento", "type": "select", "values": ["Oficio", "Memorándum", "Carta", "Expediente", "Otro"] },
      { "name": "numero_doc", "type": "text", "required": false },
      { "name": "asunto", "type": "text" },
      { "name": "estado", "type": "select", "required": false, "values": ["RECIBIDO", "DERIVADO", "EN PROCESO", "OBSERVADO", "RECHAZADO", "ATENDIDO", "ARCHIVADO", "ENTREGADO"] },
      { "name": "area_destino", "type": "text", "required": false },
      { "name": "observaciones", "type": "text" },
      { "name": "fecha_registro", "type": "date", "required": false },
      { "name": "fecha_entrega", "type": "date" }
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
    "fields": [
      { "name": "expediente_id", "type": "text", "required": false },
      { "name": "expediente_dni", "type": "text" },
      { "name": "operador_id", "type": "text", "required": false },
      { "name": "operador_nombre", "type": "text" },
      { "name": "operador_perfil", "type": "text" },
      { "name": "accion", "type": "text", "required": false },
      { "name": "fecha", "type": "date", "required": false },
      { "name": "estado_anterior", "type": "text" },
      { "name": "estado_nuevo", "type": "text" },
      { "name": "detalles", "type": "text" },
      { "name": "ip_publica", "type": "text" },
      { "name": "user_agent", "type": "text" }
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''",
    "createRule": "@request.auth.id != ''"
  },
  {
    "name": "historial_documentos",
    "type": "base",
    "fields": [
      { "name": "expediente_id", "type": "text", "required": false },
      { "name": "accion", "type": "text" },
      { "name": "detalles", "type": "text" },
      { "name": "fecha", "type": "date" }
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''",
    "createRule": "@request.auth.id != ''"
  },
  {
    "name": "reportes_generados",
    "type": "base",
    "fields": [
      { "name": "generado_por", "type": "relation", "required": false, "collectionId": "operadores", "maxSelect": 1 },
      { "name": "generado_por_nombre", "type": "text" },
      { "name": "tipo_reporte", "type": "select", "required": false, "values": ["REPORTE_DIARIO", "ENTREGA_DIARIA", "REPORTE_MENSUAL"] },
      { "name": "fecha_reporte", "type": "text", "required": false },
      { "name": "total_registros", "type": "number" },
      { "name": "sede", "type": "text" },
      { "name": "hash_verificacion", "type": "text", "required": false, "unique": false },
      { "name": "snapshot", "type": "json" }
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "",
    "createRule": "@request.auth.id != ''"
  }
];
