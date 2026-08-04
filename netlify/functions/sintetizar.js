// Genera un borrador de sintesis comparada por eje juridico, usando la API
// de Google Gemini sobre las fuentes encontradas en vivo. Este texto es
// SIEMPRE un borrador que debe validar un abogado: el sistema no emite un
// informe legal definitivo (principio del piloto Comparative Law++).

exports.handler = async function (event) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: "Falta GEMINI_API_KEY en variables de entorno de Netlify. Sin esto no se puede generar el borrador de sintesis." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "body invalido" }) };
  }
  const { consulta, ejes, resultados } = body;
  if (!consulta || !resultados || !resultados.length) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "faltan consulta o resultados" }) };
  }

  const listaFuentes = resultados.map((r) => "- [" + r.pais + "] " + r.titulo + (r.fecha ? " (" + r.fecha + ")" : "") + " - " + r.url).join("\n");
  const listaEjes = (ejes && ejes.length) ? ejes.join(", ") : "sin ejes especificos seleccionados (usa tu criterio para identificar los ejes relevantes)";

  const prompt = "Eres un asistente de investigacion juridica para un analista de una biblioteca parlamentaria. " +
    "Tu tarea NO es redactar un informe legal definitivo ni dar asesoria legal. Tu tarea es preparar un BORRADOR " +
    "de sintesis comparada, organizado por eje juridico, a partir UNICAMENTE de las fuentes normativas listadas abajo. " +
    "No inventes contenido de las normas que no puedas inferir razonablemente del titulo y metadatos. " +
    "Si no hay informacion suficiente para un eje o jurisdiccion, dilo explicitamente en vez de inventar. " +
    "Este texto sera revisado y validado por un abogado antes de usarse.\n\n" +
    "Consulta: " + consulta + "\n" +
    "Ejes a comparar: " + listaEjes + "\n\n" +
    "Fuentes encontradas (unica base disponible):\n" + listaFuentes + "\n\n" +
    "Devuelve un texto breve (maximo 300 palabras) organizado por eje juridico, señalando semejanzas, diferencias " +
    "y vacios de informacion entre las jurisdicciones listadas. Usa un tono tecnico, cauteloso y no concluyente.";

  try {
    const model = "gemini-2.0-flash";
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 900, temperature: 0.3 },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: "Gemini API " + r.status + ": " + t.slice(0, 200) }) };
    }
    const data = await r.json();
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const texto = parts.map((p) => p.text || "").join("\n").trim();
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ borrador: texto || "Sin contenido generado." }) };
  } catch (e) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: e.message }) };
  }
};

function cors() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
}
