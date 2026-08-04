// Genera un borrador de sintesis comparada por eje juridico, usando la API
// de Claude (Anthropic) sobre las fuentes encontradas en vivo. Este texto
// es SIEMPRE un borrador que debe validar un abogado: el sistema no emite
// un informe legal definitivo (principio del piloto Comparative Law++).

exports.handler = async function (event) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: "Falta ANTHROPIC_API_KEY en variables de entorno de Netlify. Sin esto no se puede generar el borrador de sintesis." }) };
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
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: "Anthropic API " + r.status + ": " + t.slice(0, 200) }) };
    }
    const data = await r.json();
    const texto = (data.content && data.content[0] && data.content[0].text) || "";
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ borrador: texto }) };
  } catch (e) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: e.message }) };
  }
};

function cors() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
}
