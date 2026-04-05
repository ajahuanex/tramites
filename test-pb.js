async function run() {
  const fields = [
    "operador", "dni_ruc_remitente", "remitente", "tipo_documento", 
    "numero_doc", "asunto", "estado", "area_destino", 
    "observaciones", "fecha_registro", "fecha_entrega"
  ];
  
  for (const f of fields) {
    const url = `http://161.132.42.78:8087/api/collections/expedientes/records?filter=${encodeURIComponent(f + " != null")}`;
    try {
      const res = await fetch(url);
      console.log(`Field ${f.padEnd(20)} -> ${res.status === 200 ? 'EXISTS' : 'MISSING'}`);
    } catch (e) {
      console.log(`Field ${f.padEnd(20)} -> ERROR: ${e.message}`);
    }
  }
}
run();
