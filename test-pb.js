async function run() {
  const filterStr = `remitente = '123456' && fecha_registro >= '2026-04-05 00:00:00' && fecha_registro <= '2026-04-05 23:59:59'`;
  const url = `http://161.132.42.78:8087/api/collections/expedientes/records?filter=${encodeURIComponent(filterStr)}`;
  console.log("Testing filter:", filterStr);
  try {
    const res = await fetch(url);
    const json = await res.json();
    console.log("-> Status:", res.status, json);
  } catch (e) {
    console.log("Fetch error:", e.message);
  }
}
run();
