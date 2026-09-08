import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_panel/")({
  component: Resumen,
});

/** Lo que irá llegando al panel, en orden. Se va tachando conforme se construye. */
const proximo = [
  { titulo: "Reservas", detalle: "Ver y gestionar los cupos reservados de cada evento." },
  { titulo: "Eventos", detalle: "Crear eventos y abrir o cerrar sus reservas." },
  { titulo: "Suscriptores", detalle: "Personas apuntadas al boletín." },
  { titulo: "Boletín", detalle: "Redactar y enviar un correo a quienes estén suscritos." },
];

function Resumen() {
  return (
    <>
      <h1 className="nm-admin-title">Panel de administración</h1>
      <p className="nm-admin-lead">
        Sesión iniciada. Desde aquí se gestionarán las reservas, los eventos y el boletín de
        Nemorphic.
      </p>

      <section className="nm-admin-card" aria-labelledby="nm-admin-proximo">
        <h2 id="nm-admin-proximo" className="nm-admin-card-title">
          En construcción
        </h2>
        <ul className="nm-admin-list">
          {proximo.map((item) => (
            <li key={item.titulo}>
              <strong>{item.titulo}</strong>
              <span>{item.detalle}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
