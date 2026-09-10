# Roadmap

Estado a **10 de septiembre de 2026**.

---

## Hecho

- [x] Rediseño del sitio en TanStack Start, con el sistema visual `nm-*`
- [x] Artistas y lanzamientos con reproductores de SoundCloud
- [x] **Reserva de cupos**: formulario público con acompañantes dinámicos y código
      de puerta de 4 caracteres
- [x] **Panel de administración** (`/admin`) con clave compartida y sesión sellada
- [x] Gestión de reservas: alta manual, edición, cancelación y borrado
- [x] Gestión de suscriptores del boletín
- [x] **Control de entrada** (`/puerta`) con clave propia por evento, sin permiso
      para editar
- [x] **Control de pagos**: precio reservando y en puerta, cuánto debe cada reserva,
      y registro de dónde se cobró
- [x] Boletín: el formulario guarda nombre y correo
- [x] Verificación automática: `npm run check` y `npm run test:panel` (47 comprobaciones)
- [x] Imágenes optimizadas: de 30 MB a 2,6 MB

---

## Siguiente

### 1. Envío del boletín

Lo único que falta para cerrar el ciclo del newsletter. Los suscriptores ya se
guardan con su nombre; falta redactar y enviar desde el panel.

Decidido (ver [`.claude/skills/email/SKILL.md`](.claude/skills/email/SKILL.md)):

- Envío **manual** desde `/admin`, con asunto y cuerpo libres.
- Cada correo encabezado con el nombre de quien lo recibe.
- Proveedor: **SMTP de Gmail** con App Password, por ser lo que mejor llega sin
  dominio propio. Migrar a Resend cuando haya dominio es cambiar un archivo.
- Enlace de baja obligatorio, funcionando sin login.
- Envío por lotes con barra de progreso: una función de Vercel no aguanta cientos
  de correos en una sola petición.

### 2. Analítica de la web

Pendiente de decidir. Recomendación: empezar por **Vercel Analytics** (un clic, sin
cookies, sin datos personales) y valorar después Microsoft Clarity para mapas de
calor — pero Clarity exige añadir un aviso de privacidad, porque hoy el formulario
de reservas promete que los datos no se comparten con nadie.

---

## Más adelante

- **Sección de eventos en el panel**, para que el equipo cree y edite eventos sin
  tocar código. Descartada por ahora: siempre se habla con el grupo antes de
  anunciar algo, así que se crean a mano. Haría falta también que la landing leyera
  los eventos de la base en vez de tenerlos escritos en el JSX.
- **Dominio propio** (`nemorphic.co` o similar). Mejora la imagen y la entrega del
  correo. Para enviar basta verificar el dominio; no hace falta buzón ni otro Gmail.
- **Aforo a prueba de reservas simultáneas**. Hoy dos personas podrían llevarse las
  últimas entradas a la vez. Solo importa cuando haya un aforo ajustado; se
  resuelve con una función en Postgres.
- **Exportar a CSV** las reservas y los suscriptores.
- **Fotos de artistas** pendientes de subir a `public/Assets/artistas/`.
