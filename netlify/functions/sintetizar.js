// Genera un borrador de sintesis comparada por eje juridico, usando
// AI/ML API (aimlapi.com, modelo perplexity/sonar) sobre los resultados
// ya encontrados (titulo, resumen y fecha obtenidos por la busqueda).
// Este texto es SIEMPRE un borrador que debe validar un abogado: el
// sistema no emite un informe legal definitivo (principio del piloto
// Comparative Law++).

exports.handler = async function (event) {
  const apiKey = process.env.AIMLAPI_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: "Falta AIMLAPI_API_KEY en variables de entorno de Netlify. Sin esto no se puede generar el borrador de sintesis." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "body invalido" }) };
  }
  const { consulta, ejes, resultados } = body;
  if (!consulta || !resultados || !resultados.length) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "faltan consulta o resultados" }) };
  }

  const listaFuentes = resultados.map((r) => {
    const base = "- [" + r.pais + "] " + r.titulo + (r.fecha ? " (" + r.fecha + ")" : "") + (r.url ? " - " + r.url : "");
    return r.resumen ? base + "\n  Resumen: " + r.resumen : base;
  }).join("\n");
  const listaEjes = (ejes && ejes.length) ? ejes.join(", ") : "sin ejes especificos seleccionados (usa tu criterio para identificar los ejes relevantes)";

  const prompt = "Eres un asistente de investigacion juridica para un analista de una biblioteca parlamentaria. " +
    "Tu tarea NO es redactar un informe legal definitivo ni dar asesoria legal. Tu tarea es preparar un BORRADOR " +
    "de sintesis comparada, organizado por eje juridico, a partir UNICAMENTE de las fuentes normativas listadas abajo. " +
    "No inventes contenido de las normas que no puedas inferir razonablemente de los titulos y resumenes disponibles. " +
    "Si no hay informacion suficiente para un eje o jurisdiccion, dilo explicitamente en vez de inventar. " +
    "Este texto sera revisado y validado por un abogado antes de usarse.\n\n" +
    "Consulta: " + consulta + "\n" +
    "Ejes a comparar: " + listaEjes + "\n\n" +
    "Fuentes encontradas (unica base disponible):\n" + listaFuentes + "\n\n" +
    "Devuelve un texto breve (maximo 300 palabras) organizado por eje juridico, señalando semejanzas, diferencias " +
    "y vacios de informacion entre las jurisdicciones listadas. Usa un tono tecnico, cauteloso y no concluyente.";

  try {
    const url = "https://api.aimlapi.com/v1/chat/completions";
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: "perplexity/sonar",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 900,
        temperature: 0.3,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      if (r.status === 429) {
        return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: "Se alcanzo el limite de uso o creditos de AI/ML API. Espera unos minutos y vuelve a intentar." }) };
      }
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: "AI/ML API " + r.status + ": " + t.slice(0, 300) }) };
    }
    const data = await r.json();
    const texto = ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "").trim();
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ borrador: texto || "Sin contenido generado." }) };
  } catch (e) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: e.message }) };
  }
};

function cors() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
}
