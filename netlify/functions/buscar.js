// Busqueda de legislacion comparada usando Groq (gratis, sin tarjeta de
// credito). Groq no tiene busqueda web propia en su nivel gratuito, asi
// que en vez de arriesgar titulos de leyes inventados, este endpoint usa
// el catalogo curado de fuentes oficiales (site/data/fuentes_oficiales.json,
// pasado como contexto desde el cliente) y le pide al modelo que redacte,
// para cada fuente, un analisis breve y honesto de que buscar ahi para la
// consulta del usuario - sin inventar el nombre exacto de una norma que
// no pueda verificar.

exports.handler = async function (event) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["Falta GROQ_API_KEY en variables de entorno de Netlify."] }) };
  }

  const q = (event.queryStringParameters && event.queryStringParameters.q) || "";
  const fuentesParam = (event.queryStringParameters && event.queryStringParameters.fuentes) || "";
  if (!q) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "falta parametro q" }) };
  }

  let fuentesLista = [];
  try { fuentesLista = fuentesParam ? JSON.parse(fuentesParam) : []; } catch (e) { fuentesLista = []; }

  if (!fuentesLista.length) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["No hay fuentes oficiales para los paises seleccionados."] }) };
  }

  const listaFuentesTexto = fuentesLista.map((f, i) =>
    (i + 1) + ". Pais: " + f.pais + " | Fuente: " + (f.fuente || "s/d") +
    " | Tipo de normas que cubre: " + (f.tipo || "s/d") +
    " | URL: " + (f.url || "s/d")
  ).join("\n");

  const prompt = "Eres un asistente de investigacion juridica para una biblioteca parlamentaria. " +
    "Un analista quiere investigar: \"" + q + "\". " +
    "A continuacion tienes el catalogo de fuentes oficiales de legislacion disponibles para los paises consultados. " +
    "IMPORTANTE: no inventes el titulo de ninguna ley especifica que no este listada aqui explicitamente; solo tienes el " +
    "nombre del PORTAL/fuente oficial, no el texto de las normas. Para cada fuente de la lista, escribe una nota breve " +
    "(1-2 oraciones, en espanol, tono tecnico y cauteloso) explicando que tipo de norma relacionada con la consulta " +
    "el analista deberia buscar en ese portal especifico, basandote en el tipo de fuente indicado. Si el tipo de fuente " +
    "no parece relacionado con la consulta, dilo explicitamente en vez de forzar una relacion.\n\n" +
    "Fuentes:\n" + listaFuentesTexto + "\n\n" +
    "Responde UNICAMENTE con un bloque de codigo JSON (sin texto antes ni despues), un elemento por cada fuente listada, " +
    "en el mismo orden, con este formato exacto: " +
    "[{\"pais\": \"nombre del pais\", \"titulo\": \"nombre de la fuente oficial (copialo tal cual)\", \"url\": \"la URL indicada\", \"resumen\": \"tu nota de 1-2 oraciones\"}]";

  try {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const body = JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2500,
      temperature: 0.3,
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
            errores: ["Se alcanzo el limite de uso gratuito de Groq por ahora."],
            tipoError: "quota",
          }),
        };
      }
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["Groq API " + r.status + ": " + t.slice(0, 300)], tipoError: "error" }) };
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
      return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: ["No se pudo interpretar la respuesta de Groq como JSON: " + e.message], tipoError: "error" }) };
    }

    resultados = resultados
      .filter((it) => it && it.titulo && it.pais)
      .slice(0, 20)
      .map((it) => ({
        pais: it.pais,
        titulo: it.titulo,
        url: it.url || null,
        fecha: null,
        resumen: it.resumen || null,
      }));

    return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados, errores: [] }) };
  } catch (e) {
    return { statusCode: 200, headers: cors(), body: JSON.stringify({ resultados: [], errores: [e.message], tipoError: "error" }) };
  }
};

function cors() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
}
