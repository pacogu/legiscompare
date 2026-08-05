// Capa de interaccion conversacional sobre un informe ya generado. El
// analista puede preguntar, pedir precisiones o reformulaciones sobre
// los resultados de su busqueda, manteniendo SIEMPRE trazabilidad a las
// fuentes oficiales usadas: el modelo debe citar [Pais - Fuente] en cada
// afirmacion y no puede responder con contenido que no provenga de las
// fuentes listadas.

exports.handler = async function (event) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: "Falta GROQ_API_KEY en variables de entorno de Netlify." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "body invalido" }) };
  }
  const { consulta, resultados, pregunta, historial } = body;
  if (!consulta || !resultados || !resultados.length || !pregunta) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "faltan consulta, resultados o pregunta" }) };
  }

  const listaFuentes = resultados.map((r, i) =>
    "[" + (i + 1) + "] " + r.pais + " - " + r.titulo + (r.fecha ? " (" + r.fecha + ")" : "") +
    (r.url ? " - " + r.url : "") + (r.resumen ? "\n  Nota: " + r.resumen : "")
  ).join("\n");

  const historialTexto = (historial || [])
    .slice(-6)
    .map((h) => (h.rol === "usuario" ? "Analista: " : "Asistente: ") + h.texto)
    .join("\n");

  const prompt = "Eres un asistente de investigacion juridica para un analista de una biblioteca parlamentaria, " +
    "respondiendo preguntas de seguimiento sobre un informe de derecho comparado ya generado. " +
    "Consulta original del informe: \"" + consulta + "\".\n\n" +
    "Fuentes disponibles (UNICA base de conocimiento permitida, numeradas):\n" + listaFuentes + "\n\n" +
    (historialTexto ? "Conversacion previa:\n" + historialTexto + "\n\n" : "") +
    "Pregunta nueva del analista: \"" + pregunta + "\"\n\n" +
    "REGLAS ESTRICTAS: responde UNICAMENTE con informacion que puedas atribuir a una o mas de las fuentes listadas arriba. " +
    "Cada afirmacion relevante debe terminar con el numero de fuente entre corchetes, ej: [1] o [2][3]. " +
    "Si la pregunta pide algo que no esta cubierto por las fuentes listadas, dilo explicitamente y sugiere revisar la fuente " +
    "oficial correspondiente en vez de inventar una respuesta. No des asesoria legal ni concluyas por el analista: presenta " +
    "la informacion disponible para que el la interprete. Responde en espanol, tono tecnico, en maximo 150 palabras.";

  try {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.2,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      if (r.status === 429) {
        return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: "Se alcanzo el limite de uso gratuito de Groq. Espera unos minutos y vuelve a intentar." }) };
      }
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: "Groq API " + r.status + ": " + t.slice(0, 300) }) };
    }
    const data = await r.json();
    const texto = ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "").trim();
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ respuesta: texto || "Sin respuesta generada." }) };
  } catch (e) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: e.message }) };
  }
};

function cors() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
}
