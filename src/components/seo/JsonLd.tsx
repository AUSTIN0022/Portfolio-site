/**
 * Renders one or more JSON-LD structured-data objects into the DOM.
 *
 * Emitted as a plain <script type="application/ld+json"> so it is present in
 * the server-rendered HTML — crawlers and AI agents that don't run JS still
 * read it. Data comes only from our own trusted config, so serializing it
 * into a script tag is safe here.
 */
type JsonLdObject = Record<string, unknown>

export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const items = Array.isArray(data) ? data : [data]
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Escape '<' to prevent any '</script>' breakout from string fields.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(item).replace(/</g, '\\u003c'),
          }}
        />
      ))}
    </>
  )
}
