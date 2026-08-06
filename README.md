# LegisCompare - Derecho Comparado

Aplicacion web que apoya el trabajo de analisis de derecho comparado,
inspirada en el piloto "Comparative Law++" (BCN Chile, IFLAPARL 2026):
automatiza la busqueda, organizacion y trazabilidad de fuentes normativas,
sin reemplazar el criterio juridico. El sistema prepara un informe
analitico preliminar (matriz, timeline, ejes juridicos); los hallazgos,
implicancias y el informe final los redacta el abogado.

Flujo: consulta inicial -> seleccion de jurisdicciones y ejes ->
busqueda y analisis de fuentes oficiales -> matriz comparada -> timeline
-> informe analitico preliminar (editable, imprimible) -> redaccion
humana del informe final.

## Estructura

```
site/
  index.html          pagina de consulta (punto de entrada)
  dossier.html         dossier analitico comparado
  data/fuentes_oficiales.json  catalogo curado de fuentes oficiales por pais
  css/app.css             estilos
  js/app.js               logica de la pagina de consulta
  js/dossier.js            logica del dossier
  js/busqueda_api.js       cliente de busqueda, con fallback al directorio simple (cache 30min)
netlify/functions/buscar.js      busqueda (conectores reales + Groq de respaldo)
netlify/functions/sintetizar.js  borrador de sintesis comparada (Groq, opcional)
netlify/functions/consultar.js   consultas de seguimiento sobre el informe (Groq)
netlify.toml            configuracion de build/deploy de Netlify
```

## Como funciona la busqueda

El sitio no depende de una sola API de busqueda web paga. Combina tres
piezas:

1. **Conectores reales a APIs oficiales gratuitas** (sin llave, sin
   costo), integrados en `netlify/functions/buscar.js`:
   - **Brasil** - Camara de Diputados (`dadosabertos.camara.leg.br`) - verificado en vivo, funcionando.
   - **Reino Unido** - `legislation.gov.uk` (feed Atom) - verificado en vivo, funcionando.
   - **Union Europea** - EUR-Lex / CELLAR (SPARQL publico) - endpoint verificado en vivo (consulta base funciona); cubre los 27 paises del bloque.
   - **Irlanda** - Oireachtas (`api.oireachtas.ie`) - verificado en vivo, funcionando.
   - **Colombia** y **Panama** - portales de datos abiertos con patron CKAN estandar (`/api/3/action/package_search`), usado identicamente por cientos de gobiernos en el mundo. Alta confianza por ser un estandar fijo, aunque no se pudo confirmar la respuesta exacta en esta sesion.
   - **Paises Bajos** - Tweede Kamer (OData v4, patron estandar).
   - **Suecia** - Riksdagen (`data.riksdagen.se/dokumentlista`), documentado publicamente.
   - **Dinamarca** - Retsinformation.dk (REST v2).
   - **Suiza** - OpenParlData.ch (REST v1).
   - **Nueva Zelanda** - legislation.govt.nz (REST OpenAPI v0).
   - **Canada** - Justice Laws Website (OData).
   - **Polonia** - Sejm/ELI API (`api.sejm.gov.pl/eli/acts/search`) - verificado en vivo, funcionando (titulo, fecha, tipo de norma reales).
   - **Japon** - e-Gov Law API v1 (`laws.e-gov.go.jp/api/1/keyword`) - formato de respuesta confirmado por documentacion oficial (`LawNumbers[].LawName/LawId/PromulgationDate`).
   - **Israel** - Knesset OData (`knesset.gov.il/Odata/ParliamentInfo.svc/KNS_Bill`) - sin llave, implementado segun documentacion oficial (`substringof('texto',Name)`), pendiente de confirmar en el sitio real.
   - **Noruega** - Stortinget (`data.stortinget.no/eksport/saker`) - verificado en vivo (devuelve casos/proyectos reales con titulo, id y fecha). Esta API no tiene busqueda de texto en el servidor, asi que el conector trae los "saker" de la sesion parlamentaria actual (con fallback a la sesion anterior) y filtra por palabra clave del lado del servidor, sobre datos 100% reales.
   - **España** - BOE, API de legislacion consolidada (`boe.es/datosabiertos/api/legislacion-consolidada`) - oficial, sin llave, con busqueda de texto libre (`query=`); documentacion tecnica publica en PDF, pendiente de confirmar el formato exacto de respuesta en el sitio real.
   - **Luxemburgo** - Legilux (`data.legilux.public.lu/sparql`), SPARQL publico sobre la ontologia JOLux (bien documentada, incluso reutilizada por Suiza/Fedlex); mismo patron que el conector de la Union Europea, pendiente de confirmar en el sitio real.
   - **Austria** - RIS-OGDService (`data.bka.gv.at/ris/OGDService.asmx`), servicio SOAP oficial sin llave, documentado en el manual tecnico del RIS (busqueda por "Suchworte" en Bundesrecht consolidado); requiere parsear XML doblemente escapado dentro del sobre SOAP, pendiente de confirmar en el sitio real.
   - **Chile** - LeyChile / BCN (`datos.bcn.cl/sparql`), SPARQL publico sobre la ontologia bcn-norms (`bcnnorms:Norm`, `dc:title`), mismo patron que Union Europea y Luxemburgo, pendiente de confirmar en el sitio real.
   - **Corea del Sur** (opcional) - DRF `lawSearch.do` del Ministerio de Legislacion (`open.law.go.kr`), con busqueda de texto real por "query". Requiere una llave gratuita propia (identificador OC, registro instantaneo y sin costo en open.law.go.kr) configurada como `LAW_KR_OC` en Netlify; sin ella, Corea del Sur sigue funcionando igual via Groq como cualquier pais sin conector.
   - **Italia** - Normattiva, API Open Data oficial del Istituto Poligrafico e Zecca dello Stato (`api.normattiva.it/t/normattiva.api/bff-opendata/v1/api/v1/ricerca/semplice`), sin llave, ambiente de produccion. Busqueda de texto libre real (`testoRicerca`); implementado a partir de la especificacion tecnica oficial en PDF (con ejemplos reales de request/response), mayor confianza que los conectores basados solo en documentacion inferida, pendiente de confirmar en el sitio real.

   Cada conector esta aislado con manejo de errores propio: si uno falla
   (cambio de formato, caida del servicio, etc.), no afecta a los demas
   paises ni a Groq como respaldo. Colombia, Panama, Paises Bajos, Suecia,
   Dinamarca, Suiza, Nueva Zelanda, Canada e Israel estan implementados
   segun su documentacion publica pero no se pudieron verificar en vivo
   con datos reales - probar en el sitio desplegado y ajustar el mapeo de
   campos si el formato real difiere.

   El catalogo tiene otras fuentes con "Tiene_API: Si" que quedan sin
   conector real: Francia (Légifrance/PISTE), Corea del Sur
   (open.law.go.kr) y Alemania (Bundestag DIP) exigen registrar una
   cuenta/llave gratuita (no solo llamar sin credenciales) - si el
   analista consigue una llave gratuita de alguna de estas, se puede
   integrar facilmente como variable de entorno adicional (igual que
   `GROQ_API_KEY`). Estados Unidos (`api.congress.gov`) tambien requiere
   llave gratuita instantanea (sin tarjeta), buen candidato si interesa.
   Costa Rica, Paraguay y Republica Checa no tienen una API REST de
   busqueda documentada publicamente (solo portales de datos abiertos
   genericos o sitios web). Australia tiene un dominio de API
   (`api.prod.legislation.gov.au`) pero sin documentacion publica
   confirmada del formato de consulta. Chile (BCN) tiene un endpoint
   SPARQL publico pero su vocabulario RDF no se pudo confirmar con
   consultas de ejemplo documentadas. Se agregan sumando una funcion
   `buscarNombrePais(q)` en `netlify/functions/buscar.js` y añadiendo el
   pais a `CONECTORES_REALES`.
2. **Catalogo curado** en `site/data/fuentes_oficiales.json`: 46 paises y
   bloques (Union Europea, Alemania, Argentina, Australia, Austria,
   Belgica, Bolivia, Brasil, Canada, Chile, Colombia, Corea del Sur,
   Costa Rica, Cuba, Dinamarca, Ecuador, Espana, Estados Unidos, Estonia,
   Finlandia, Francia, Grecia, Hungria, Irlanda, Islandia, Israel,
   Italia, Japon, Letonia, Lituania, Luxemburgo, Mexico, Nicaragua,
   Noruega, Nueva Zelanda, Paises Bajos, Panama, Paraguay, Peru, Polonia,
   Portugal, Reino Unido, Republica Checa, Suecia, Suiza, Turquia y
   Uruguay) con la fuente oficial, URL y tipo de normas que cubre cada
   pais. El sitio filtra este catalogo por los paises seleccionados y por
   coincidencia de palabras con la consulta.
3. **Analisis con Groq** (gratis, sin tarjeta de credito) para los
   paises SIN conector real: el modelo redacta una nota breve indicando
   que tipo de norma buscar en cada fuente para la consulta del analista.
   Groq no tiene busqueda web propia en su nivel gratuito, asi que NUNCA
   inventa el titulo de una ley especifica que no este en el catalogo:
   solo analiza el tipo de fuente ya conocido y orienta la busqueda
   manual del analista en el portal oficial correspondiente.

Cada resultado trae ademas una estimacion de relevancia (0-100%) cuando
proviene del analisis con Groq; los resultados de conectores reales no
llevan este porcentaje porque ya son coincidencias directas de busqueda.
En la pagina de consulta, los resultados se muestran como tarjetas
seleccionables: el analista puede excluir las que no le sirvan antes de
generar el informe.

**Respaldo sin IA:** si Groq se queda sin cuota gratuita o la clave no
esta configurada, el sitio no muestra "sin resultados": cae
automaticamente al directorio simple (solo nombre de la fuente y URL),
para que la busqueda nunca quede vacia.

Para agregar mas paises al catalogo, basta con sumar un objeto nuevo a
`fuentes_oficiales.json` con los campos `pais`, `fuente`, `tipo`,
`nivel`, `url`, `tiene_api`, `api_url`, `api_tipo`, `api_docs`,
`api_params`, `formato`, `notas`.

Requiere la variable de entorno `GROQ_API_KEY` en Netlify (ver mas abajo)
para el analisis con IA; sin ella, el sitio funciona igual pero siempre
en modo directorio simple. Los resultados se cachean 30 minutos en el
navegador para no repetir llamadas con la misma consulta.

## Sintesis comparada (opcional, usa IA)

El dossier analitico (`dossier.html`) puede generar un borrador de
sintesis comparada usando Groq, a partir de las fuentes ya analizadas.
El borrador sigue la misma estructura de las notas de Asesoria Tecnica
Parlamentaria de la BCN (ver ejemplos en la carpeta de referencia del
analista): Resumen, Introduccion, uno o mas apartados numerados en
romano por eje juridico o bloque tematico (con citas `[n]` a las fuentes
oficiales), Vacios de informacion y Fuentes citadas (lista numerada
pais - titulo - URL). Esto es un paso opcional y puntual (no se ejecuta
en cada busqueda), asi que su consumo de cuota es mucho menor. Usa la
misma variable `GROQ_API_KEY`. Si no esta configurada, el dossier
funciona igual pero sin el borrador automatico (el analista redacta
directamente sus hallazgos).

## Consultas de seguimiento (capa conversacional)

El dossier analitico incluye una seccion de "Consultas sobre este
informe": el analista puede preguntar, pedir precisiones o pedir que se
reformule algo sobre los resultados ya encontrados. Cada respuesta se
genera con Groq usando UNICAMENTE las fuentes listadas en el informe
(numeradas en la seccion "Fuentes citables") y cita el numero de fuente
correspondiente en cada afirmacion (ej. "...establece un plazo de 10 dias
[2]"), manteniendo trazabilidad. Si la pregunta pide algo que las fuentes
no cubren, el modelo lo dice explicitamente en vez de inventar una
respuesta. Usa la misma variable `GROQ_API_KEY`.

## Como desplegar en Netlify

1. Sube este repositorio a GitHub.
2. En Netlify: Add new site > Import an existing project, conecta el repo.
3. Build settings: sin build command, publish directory = `site`.
4. En Site settings > Environment variables agrega `GROQ_API_KEY`
   (gratis, sin tarjeta, en https://console.groq.com/keys; marcar
   "Contains secret values"). Opcionalmente agrega `LAW_KR_OC` (gratis,
   registro instantaneo en https://open.law.go.kr) para activar el
   conector real de Corea del Sur.
5. Deploy. La busqueda funciona via `/.netlify/functions/buscar`, con
   fallback automatico al directorio simple si no hay cuota disponible.

## Desarrollo local

Sin build. Para probar el sitio basta con abrir `site/index.html` o
servirlo con cualquier servidor estatico. Para probar la funcion
serverless localmente:

```
npm install -g netlify-cli
netlify dev
```
