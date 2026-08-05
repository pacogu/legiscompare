// Busqueda de legislacion comparada usando Claude (Anthropic) con la
// herramienta de busqueda web integrada (web_search): una sola llamada
// que busca en la web real y devuelve resultados estructurados de
// cualquier pais, sin necesidad de integrar una API distinta por cada
// fuente oficial.

exports.handler = async function (event) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["Falta ANTHROPIC_API_KEY en variables de entorno de Netlify."] }) };
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
    "Al final de tu respuesta, incluye UNICAMENTE un bloque de codigo JSON (sin texto despues) con este formato exacto: " +
    "[{\"pais\": \"nombre del pais\", \"titulo\": \"titulo oficial de la norma, traducido si corresponde\", \"url\": \"URL oficial de la norma especifica si existe, o del portal oficial\", \"fecha\": \"AAAA-MM-DD o AAAA si no hay mas precision, o null\", \"resumen\": \"que regula la norma, en una oracion\"}]";

  try {
    const url = "https://api.anthropic.com/v1/messages";
    const body = JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2000,
      temperature: 0.2,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
      messages: [{ role: "user", content: prompt }],
    });

    let r;
    let intentos = 0;
    const maxIntentos = 3;
    while (true) {
      intentos++;
      r = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body,
      });
      if (r.status !== 429 || intentos >= maxIntentos) break;
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
            errores: ["Se alcanzo el limite de uso o cuota de la API de Claude por ahora. Espera unos minutos y vuelve a intentar, o revisa tu plan y facturacion en console.anthropic.com."],
            tipoError: "quota",
          }),
        };
      }
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["Claude API " + r.status + ": " + t.slice(0, 300)] }) };
    }

    const data = await r.json();
    let texto = extraerTexto(data).trim();
    const bloqueJson = texto.match(/```json\s*([\s\S]*?)```/i) || texto.match(/(\[[\s\S]*\])\s*$/);
    if (bloqueJson) texto = bloqueJson[1].trim();
    texto = texto.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "").trim();

    let resultados = [];
    try {
      resultados = JSON.parse(texto);
      if (!Array.isArray(resultados)) resultados = [];
    } catch (e) {
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["No se pudo interpretar la respuesta de Claude como JSON: " + e.message] }) };
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

// La API de Claude devuelve content[] con distintos tipos de bloque
// (server_tool_use, web_search_tool_result, text). El texto final del
// modelo esta en los bloques type:"text".
function extraerTexto(data) {
  const content = data.content || [];
  let texto = "";
  for (const block of content) {
    if (block.type === "text" && block.text) texto += block.text;
  }
  return texto;
}

function cors() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
}
