async function run() {
  const PB_URL = 'http://127.0.0.1:8090';
  let token = '';

  const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'test@test.com', password: 'password123' })
  });
  const authData = await authRes.json();
  token = authData.token;

  const expedientesSchema = {
    "name": "expedientes",
    "type": "base",
    "schema": [
      { "name": "operador", "type": "relation", "required": false, "options": { "collectionId": opData.id, "maxSelect": 1 } },
      { "name": "dni_ruc_remitente", "type": "text", "required": false },
      { "name": "remitente", "type": "text", "required": false },
      { "name": "tipo_documento", "type": "select", "options": { "values": ["Oficio", "Memorándum", "Carta", "Expediente", "Otro"] } },
      { "name": "numero_doc", "type": "text", "required": false },
      { "name": "asunto", "type": "text" },
      { "name": "estado", "type": "select", "required": false, "options": { "values": ["RECIBIDO", "DERIVADO", "EN PROCESO", "OBSERVADO", "RECHAZADO", "ATENDIDO", "ARCHIVADO", "ENTREGADO"] } },
      { "name": "area_destino", "type": "text", "required": false },
      { "name": "observaciones", "type": "text" },
      { "name": "fecha_registro", "type": "date", "required": false },
      { "name": "fecha_entrega", "type": "date" }
    ]
  };

  const exRes = await fetch(`${PB_URL}/api/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(expedientesSchema)
  });
  const exData = await exRes.json();
  console.log("Expedientes Created:", exData.id ? "OK" : JSON.stringify(exData, null, 2));
}
run();
