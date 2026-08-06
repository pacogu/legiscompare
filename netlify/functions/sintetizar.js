// Genera un borrador de sintesis comparada por eje juridico, usando Groq
// (gratis, sin tarjeta) sobre los resultados ya encontrados (fuente,
// resumen analitico obtenidos en la busqueda). Este texto es SIEMPRE un
// borrador que debe validar un abogado: el sistema no emite un informe
// legal definitivo (principio del piloto Comparative Law++).

exports.handler = async function (event) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: "Falta GROQ_API_KEY en variables de entorno de Netlify. Sin esto no se puede generar el borrador de sintesis." }) };
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
    const base = "- [" + r.pais + "] " + r.titulo + (r.url ? " - " + r.url : "");
    return r.resumen ? base + "\n  Nota: " + r.resumen : base;
  }).join("\n");
  const listaEjes = (ejes && ejes.length) ? ejes.join(", ") : "sin ejes especificos seleccionados (usa tu criterio para identificar los ejes relevantes)";

  const prompt = "Eres un asistente de investigacion juridica para un analista de la Biblioteca del Congreso " +
    "Nacional (BCN). Tu tarea NO es redactar un informe legal definitivo ni dar asesoria legal. Tu tarea es " +
    "preparar un BORRADOR de nota de Asesoria Tecnica Parlamentaria de legislacion comparada, a partir " +
    "UNICAMENTE de las fuentes oficiales listadas abajo (son resultados de busqueda en portales de fuentes " +
    "oficiales, no el texto completo de las normas). No inventes el contenido especifico de ninguna norma. Si " +
    "no hay informacion suficiente para un eje o jurisdiccion, dilo explicitamente en vez de inventar. Este " +
    "texto sera revisado y validado por un abogado antes de usarse.\n\n" +
    "Consulta: " + consulta + "\n" +
    "Ejes a comparar: " + listaEjes + "\n\n" +
    "Fuentes oficiales disponibles (unica base disponible, numeradas para citar):\n" + listaFuentes + "\n\n" +
    "Redacta el borrador siguiendo EXACTAMENTE esta estructura, tal como en las notas de Asesoria Tecnica " +
    "Parlamentaria de la BCN, usando estos mismos titulos de seccion en mayuscula/formato tal cual (texto " +
    "plano, sin markdown, sin asteriscos ni numerales tipo '#'):\n\n" +
    "RESUMEN\n" +
    "Un parrafo breve (4-6 lineas) que sintetice el hallazgo principal de la comparacion.\n\n" +
    "INTRODUCCION\n" +
    "Un parrafo que indique el objeto del informe: la consulta, las jurisdicciones y ejes comparados, y la " +
    "advertencia de que se trata de un borrador basado solo en fuentes oficiales de busqueda, pendiente de " +
    "validacion por un abogado.\n\n" +
    "I. [Nombre del primer eje juridico o bloque tematico]\n" +
    "Analisis comparado por jurisdiccion dentro de este eje, citando la fuente oficial correspondiente entre " +
    "corchetes con el numero de la lista (ej. [1]) cada vez que se mencione un hallazgo de una fuente. Si " +
    "faltan ejes en la lista de arriba, usa tu criterio para identificar 1 a 3 ejes relevantes segun la consulta " +
    "y los resultados disponibles.\n" +
    "II. [Nombre del segundo eje juridico, si corresponde]\n" +
    "(mismo formato)\n\n" +
    "VACIOS DE INFORMACION\n" +
    "Lista breve de jurisdicciones o ejes donde las fuentes disponibles no permiten sacar conclusiones.\n\n" +
    "FUENTES CITADAS\n" +
    "Lista numerada (misma numeracion usada en las citas [1], [2], etc.) de las fuentes oficiales efectivamente " +
    "citadas en el texto, formato: [n] Pais - Titulo - URL.\n\n" +
    "Usa un tono tecnico, cauteloso, neutral y no concluyente, propio de un documento de asesoria " +
    "parlamentaria (no academico, sintetico y oportuno). Maximo 500 palabras en total.";

  try {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + apiKey },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1400,
        temperature: 0.3,
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
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ borrador: texto || "Sin contenido generado." }) };
  } catch (e) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ error: e.message }) };
  }
};

function cors() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
}
