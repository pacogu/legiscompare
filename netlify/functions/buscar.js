// Busqueda de legislacion comparada usando Gemini con la herramienta de
// Google Search (grounding): una sola llamada que busca en la web real y
// devuelve resultados estructurados de cualquier pais, sin necesidad de
// integrar una API distinta por cada fuente oficial.
// Adaptado de portal-legislativo/pages/ForeignLegislation.tsx (BCN Chile).

exports.handler = async function (event) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["Falta GEMINI_API_KEY en variables de entorno de Netlify."] }) };
  }

  const q = (event.queryStringParameters && event.queryStringParameters.q) || "";
  const paises = (event.queryStringParameters && event.queryStringParameters.paises) || "";
  if (!q) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "falta parametro q" }) };
  }

  const contextoPaises = paises ? "Limita la busqueda a estos paises o bloques: " + paises + "." : "Ambito global, con foco en fuentes oficiales vigentes.";

  const prompt = "Actua como consultor de derecho comparado de una biblioteca parlamentaria. " +
    "Busca evidencia juridica de alta precision y vigencia para la consulta: \"" + q + "\". " +
    contextoPaises + " " +
    "Devuelve HASTA 12 resultados reales (no inventados), priorizando leyes vigentes, reglamentos y tratados de fuentes oficiales. " +
    "Responde UNICAMENTE con un bloque de codigo JSON (sin texto antes ni despues) con este formato exacto: " +
    "[{\"pais\": \"nombre del pais\", \"titulo\": \"titulo de la norma\", \"url\": \"URL oficial\", \"fecha\": \"AAAA-MM-DD o AAAA si no hay mas precision, o null\", \"resumen\": \"una oracion breve\"}]";

  try {
    const model = "gemini-2.0-flash";
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
    const body = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.2 },
    });

    let r;
    let intentos = 0;
    const maxIntentos = 3;
    while (true) {
      intentos++;
      r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
      if (r.status !== 429 || intentos >= maxIntentos) break;
      // Backoff simple antes de reintentar por cuota momentanea.
      await new Promise((resolve) => setTimeout(resolve, 1200 * intentos));
    }

    if (!r.ok) {
      const t = await r.text();
      if (r.status === 429) {
        return {
          statusCode: 200,
          headers: cors(),
          body: JSON.stringify({
            resultados: [],
            errores: ["Se alcanzo el limite de uso gratuito de la API de Gemini por ahora. Espera unos minutos y vuelve a intentar, o revisa tu plan y facturacion en Google AI Studio."],
            tipoError: "quota",
          }),
        };
      }
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["Gemini API " + r.status + ": " + t.slice(0, 200)] }) };
    }
    const data = await r.json();
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    let texto = parts.map((p) => p.text || "").join("\n").trim();
    texto = texto.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "").trim();

    let resultados = [];
    try {
      resultados = JSON.parse(texto);
      if (!Array.isArray(resultados)) resultados = [];
    } catch (e) {
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["No se pudo interpretar la respuesta de Gemini como JSON: " + e.message] }) };
    }

    resultados = resultados
      .filter((it) => it && it.titulo && it.pais)
      .slice(0, 12)
      .map((it) => ({
        pais: it.pais,
        titulo: it.titulo,
        url: it.url || null,
        fecha: it.fecha || null,
        resumen: it.resumen || null,
      }));

    return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados, errores: [] }) };
  } catch (e) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: [e.message] }) };
  }
};

function cors() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
}
