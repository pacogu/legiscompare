// Busqueda de legislacion comparada usando AI/ML API (aimlapi.com) con el
// modelo perplexity/sonar, hecho especificamente para busqueda web con
// resultados y citas reales. Una sola llamada que busca en la web real y
// devuelve el nombre real de la norma para cualquier pais.

exports.handler = async function (event) {
  const apiKey = process.env.AIMLAPI_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["Falta AIMLAPI_API_KEY en variables de entorno de Netlify."] }) };
  }

  const q = (event.queryStringParameters && event.queryStringParameters.q) || "";
  const paises = (event.queryStringParameters && event.queryStringParameters.paises) || "";
  const fuentesParam = (event.queryStringParameters && event.queryStringParameters.fuentes) || "";
  if (!q) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "falta parametro q" }) };
  }

  const contextoPaises = paises ? "Limita la busqueda a estos paises o bloques: " + paises + "." : "Ambito global, con foco en fuentes oficiales vigentes.";

  let fuentesLista = [];
  try { fuentesLista = fuentesParam ? JSON.parse(fuentesParam) : []; } catch (e) { fuentesLista = []; }
  const contextoFuentes = fuentesLista.length
    ? "\n\nPara cada pais, busca preferentemente directamente en su fuente oficial de legislacion (dominio exacto). " +
      "Usa estos portales oficiales como punto de partida de la busqueda, no te limites a ellos si no encuentras nada:\n" +
      fuentesLista.map((f) => "- " + f.pais + ": " + (f.fuente || "") + (f.url ? " (" + f.url + ")" : "")).join("\n")
    : "";

  const prompt = "Actua como consultor de derecho comparado de una biblioteca parlamentaria. " +
    "Busca el NOMBRE REAL Y EXACTO de leyes, reglamentos o tratados vigentes relacionados con: \"" + q + "\". " +
    contextoPaises + contextoFuentes + " " +
    "Devuelve HASTA 12 resultados reales (no inventados), cada uno con el titulo oficial de la norma (no el nombre del portal ni del sitio donde se busco). " +
    "Si el titulo original no esta en espanol, tradúcelo al espanol entre parentesis junto al titulo original, por ejemplo: " +
    "\"Bundesdatenschutzgesetz (Ley Federal de Proteccion de Datos)\". " +
    "El campo resumen debe describir brevemente el CONTENIDO de la norma (que regula), no donde se encontro. " +
    "Responde UNICAMENTE con un bloque de codigo JSON (sin texto antes ni despues) con este formato exacto: " +
    "[{\"pais\": \"nombre del pais\", \"titulo\": \"titulo oficial de la norma, traducido si corresponde\", \"url\": \"URL oficial de la norma especifica si existe, o del portal oficial\", \"fecha\": \"AAAA-MM-DD o AAAA si no hay mas precision, o null\", \"resumen\": \"que regula la norma, en una oracion\"}]";

  try {
    const url = "https://api.aimlapi.com/v1/chat/completions";
    const body = JSON.stringify({
      model: "perplexity/sonar",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2500,
      temperature: 0.2,
    });

    let r;
    let intentos = 0;
    const maxIntentos = 3;
    while (true) {
      intentos++;
      r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + apiKey },
        body,
      });
      if (r.status !== 429 || intentos >= maxIntentos) break;
      await new Promise((resolve) => setTimeout(resolve, 1500 * intentos));
    }

    if (!r.ok) {
      const t = await r.text();
      if (r.status === 429) {
        return {
          statusCode: 200,
          headers: cors(),
          body: JSON.stringify({
            resultados: [],
            errores: ["Se alcanzo el limite de uso o creditos de AI/ML API por ahora. Espera unos minutos y vuelve a intentar, o revisa tu saldo en aimlapi.com/app/billing."],
            tipoError: "quota",
          }),
        };
      }
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["AI/ML API " + r.status + ": " + t.slice(0, 300)] }) };
    }

    const data = await r.json();
    let texto = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    texto = texto.trim();
    const bloqueJson = texto.match(/```json\s*([\s\S]*?)```/i) || texto.match(/(\[[\s\S]*\])\s*$/);
    if (bloqueJson) texto = bloqueJson[1].trim();
    texto = texto.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "").trim();

    let resultados = [];
    try {
      resultados = JSON.parse(texto);
      if (!Array.isArray(resultados)) resultados = [];
    } catch (e) {
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["No se pudo interpretar la respuesta como JSON: " + e.message] }) };
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
