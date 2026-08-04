# LegisCompare - Derecho Comparado

Aplicacion web que apoya el trabajo de analisis de derecho comparado,
inspirada en el piloto "Comparative Law++" (BCN Chile, IFLAPARL 2026):
automatiza la busqueda, organizacion y trazabilidad de fuentes normativas,
sin reemplazar el criterio juridico. El sistema prepara un informe
analitico preliminar (matriz, timeline, ejes juridicos); los hallazgos,
implicancias y el informe final los redacta el abogado.

Flujo: consulta inicial -> seleccion de jurisdicciones y ejes ->
busqueda en vivo -> matriz comparada -> timeline -> informe analitico
preliminar (editable, imprimible) -> redaccion humana del informe final.

## Estructura

```
site/
  index.html          pagina de consulta (punto de entrada)
  dossier.html         dossier analitico comparado
  data/                  matriz curada de fuentes normativas (JSON)
  css/app.css             estilos
  js/app.js               logica de la pagina de consulta
  js/dossier.js            logica del dossier
  js/busqueda_api.js       cliente de busqueda en APIs externas (con cache 30min)
netlify/functions/buscar.js  proxy serverless (evita CORS, protege API keys)
netlify.toml            configuracion de build/deploy de Netlify
```

## Como funciona la busqueda

Adaptado de `portal-legislativo/pages/ForeignLegislation.tsx` (BCN Chile,
Escritorio ATP): en vez de mantener un conector distinto por cada pais, el
sistema hace una sola llamada a Gemini con la herramienta de Google Search
(grounding). Gemini busca en la web real y devuelve resultados
estructurados (pais, titulo, url, fecha, resumen) de cualquier jurisdiccion,
no solo las que tienen una API publica propia. Esto cubre Chile, Alemania,
y en general cualquier pais, sin necesidad de integrar APIs una por una.

Los filtros de "jurisdicciones" y "ejes juridicos" en la interfaz son
opcionales: si se seleccionan, se pasan como contexto al prompt para
acotar la busqueda; si no, busca en un ambito global.

## Como desplegar en Netlify

1. Sube este repositorio a GitHub.
2. En Netlify: Add new site > Import an existing project, conecta el repo.
3. Build settings: sin build command, publish directory = `site`.
4. En Site settings > Environment variables agrega `GEMINI_API_KEY`
   (gratis en https://aistudio.google.com/apikey, marcar "Contains secret
   values"). Se usa tanto para la busqueda como para el borrador de sintesis.
5. Deploy. La busqueda funciona via `/.netlify/functions/buscar`.

## Desarrollo local

Sin build. Para probar las funciones serverless localmente:

```
npm install -g netlify-cli
netlify dev
```

## Sin datos precargados

Este proyecto no usa catalogo curado ni matriz estatica: cada resultado
que se muestra viene en vivo de la API oficial del pais en el momento
de la busqueda. Chile y Alemania no tienen API publica de busqueda por
palabra clave, asi que para esos dos paises el sistema muestra
explicitamente "sin fuente en vivo disponible" en vez de datos
guardados de antemano.
