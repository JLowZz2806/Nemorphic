/**
 * El flyer de un evento, o su sustituto.
 *
 * Los eventos se anuncian antes de tener flyer — se confirma la fecha, se abre la
 * reserva y el arte llega después. Cuando falta, en vez de un hueco se pinta el
 * nombre sobre el degradado de la marca: la tarjeta sigue leyéndose y no parece
 * que la imagen esté rota.
 */
export function PosterEvento({
  posterUrl,
  nombre,
  alt,
  className,
}: {
  posterUrl: string | null;
  nombre: string;
  /** Descripción completa para quien no ve la imagen. */
  alt: string;
  className?: string | undefined;
}) {
  if (posterUrl) {
    return (
      <img
        src={posterUrl}
        alt={alt}
        className={className ?? "nm-event-poster"}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div className={`nm-event-poster nm-event-poster--sin-flyer ${className ?? ""}`.trim()}>
      {/* El nombre ya está en el texto de al lado, así que aquí es decorativo:
          repetirlo para un lector de pantalla solo sería ruido. */}
      <span aria-hidden="true">{nombre}</span>
      <span className="nm-event-poster-nota" aria-hidden="true">
        Flyer en camino
      </span>
    </div>
  );
}
