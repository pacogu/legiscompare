# LegisCompare - Derecho Comparado

Aplicacion web que apoya el trabajo de analisis de derecho comparado,
inspirada en el piloto "Comparative Law++" (BCN Chile, IFLAPARL 2026):
automatiza la busqueda, organizacion y trazabilidad de fuentes normativas,
sin reemplazar el criterio juridico. El sistema prepara un informe
analitico preliminar (matriz, timeline, ejes juridicos); los hallazgos,
implicancias y el informe final los redacta el abogado.

Flujo: consulta inicial -> seleccion de jurisdicciones y ejes ->
busqueda del nombre real de la norma en fuentes oficiales -> matriz
comparada -> timeline -> informe analitico preliminar (editable,
imprimible) -> redaccion humana del informe final.

## Estructura

```
site/
  index.html          pagina de consulta (punto de entrada)
  dossier.html         dossier analitico comparado
  data/fuentes_oficiales.json  catalogo curado de fuentes oficiales por pais
  css/app.css             estilos
  js/app.js               logica de la pagina de consulta
  js/dossier.js            logica del dossier
  js/busqueda_api.js       cliente que llama a la funcion de busqueda (con cache 30min)
netlify/functions/buscar.js      busqueda en vivo del nombre de la norma (AI/ML API, perplexity/sonar)
netlify/functions/sintetizar.js  borrador de sintesis comparada (AI/ML API, opcional)
netlify.toml            configuracion de build/deploy de Netlify
```

## Como funciona la busqueda

El sitio busca el NOMBRE REAL de la norma (no solo el portal donde
buscar). Usa AI/ML API (aimlapi.com) con el modelo `perplexity/sonar`,
construido especificamente para busqueda web con resultados y citas
reales: devuelve el titulo oficial de cada norma, traducido al espanol
cuando el original esta en otro idioma, junto con pais, URL, fecha y un
resumen de que regula.

Como contexto, cada busqueda se acota con el catalogo curado en
`site/data/fuentes_oficiales.json` (46 paises y bloques: Union Europea,
Alemania, Argentina, Australia, Austria, Belgica, Bolivia, Brasil,
Canada, Chile, Colombia, Corea del Sur, Costa Rica, Cuba, Dinamarca,
Ecuador, Espana, Estados Unidos, Estonia, Finlandia, Francia, Grecia,
Hungria, Irlanda, Islandia, Israel, Italia, Japon, Letonia, Lituania,
Luxemburgo, Mexico, Nicaragua, Noruega, Nueva Zelanda, Paises Bajos,
Panama, Paraguay, Peru, Polonia, Portugal, Reino Unido, Republica Checa,
Suecia, Suiza, Turquia y Uruguay). Esto orienta al modelo a buscar
directamente en el portal oficial de cada pais seleccionado en vez de
fuentes genericas. Para agregar mas paises, basta con sumar un objeto
nuevo a `fuentes_oficiales.json` con los campos `pais`, `fuente`, `tipo`,
`nivel`, `url`, `tiene_api`, `api_url`, `api_tipo`, `api_docs`,
`api_params`, `formato`, `notas`.

Requiere la variable de entorno `AIMLAPI_API_KEY` en Netlify (ver mas
abajo). Los resultados se cachean 30 minutos en el navegador para no
repetir llamadas con la misma consulta. Si se agota el saldo o el limite
de uso, el sitio reintenta automaticamente y, si persiste, muestra un
mensaje claro con boton de reintentar.

## Sintesis comparada (opcional, usa IA)

El dossier analitico (`dossier.html`) puede generar un borrador de
sintesis comparada por eje juridico usando el mismo modelo, a partir de
las fuentes ya encontradas. Esto es un paso opcional y puntual (no se
ejecuta en cada busqueda), asi que su consumo es mucho menor. Usa la
misma variable `AIMLAPI_API_KEY`. Si no esta configurada, el dossier
funciona igual pero sin el borrador automatico (el analista redacta
directamente sus hallazgos).

## Como desplegar en Netlify

1. Sube este repositorio a GitHub.
2. En Netlify: Add new site > Import an existing project, conecta el repo.
3. Build settings: sin build command, publish directory = `site`.
4. En Site settings > Environment variables agrega `AIMLAPI_API_KEY`
   (se obtiene en https://aimlapi.com/app/keys; marcar "Contains secret
   values"). Se usa tanto para la busqueda como para el borrador de
   sintesis.
5. Deploy. La busqueda funciona via `/.netlify/functions/buscar`.

## Desarrollo local

Sin build. Para probar el sitio basta con abrir `site/index.html` o
servirlo con cualquier servidor estatico. Para probar la funcion
serverless de sintesis localmente:

```
npm install -g netlify-cli
netlify dev
```
