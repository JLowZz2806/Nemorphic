// ===============================
// NAVBAR CON BANNER AL HACER SCROLL
// ===============================
// Seleccionamos el navbar y la sección de inicio
const navbar = document.querySelector('.navbar');
const inicioSection = document.getElementById('inicio');

// Función que se ejecuta cada vez que el usuario hace scroll
function handleScroll() {
    // Obtenemos la altura de la sección de inicio
    const inicioHeight = inicioSection.offsetHeight;

    // Obtenemos cuánto ha scrolleado el usuario desde arriba
    const scrollPosition = window.scrollY;

    // Si el scroll es mayor que la altura de inicio, mostramos el banner
    if (scrollPosition > inicioHeight) {
        navbar.classList.add('navbar-scrolled');
    } else {
        // Si no, quitamos la clase para ocultar el banner
        navbar.classList.remove('navbar-scrolled');
    }
}

// Escuchamos el evento de scroll en la ventana
window.addEventListener('scroll', handleScroll);

// Llamamos la función al cargar la página para establecer el estado inicial
handleScroll();

// ===============================
// MODALES (Noticias, Tienda, Contacto)
// ===============================
const btnNoticias = document.getElementById("btnNoticias");
const btnTienda = document.getElementById("btnTienda");
const btnContactoFlotante = document.getElementById("btnContactoFlotante"); // Nuevo botón

const modalNoticias = document.getElementById("modalNoticias");
const modalTienda = document.getElementById("modalTienda");
const modalContacto = document.getElementById("modalContacto"); // Nuevo modal

const closeNoticias = document.getElementById("closeNoticias");
const closeTienda = document.getElementById("closeTienda");
const closeContacto = document.getElementById("closeContacto"); // Nuevo botón cerrar

// ✅ Funciones para abrir/cerrar modales
function abrirModal(modal) {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden"; // evita que la página se mueva
}
function cerrarModal(modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
}

// ✅ Eventos
btnNoticias.onclick = () => abrirModal(modalNoticias);
btnTienda.onclick = () => abrirModal(modalTienda);
if (btnContactoFlotante) btnContactoFlotante.onclick = () => abrirModal(modalContacto); // Evento nuevo botón

closeNoticias.onclick = () => cerrarModal(modalNoticias);
closeTienda.onclick = () => cerrarModal(modalTienda);
if (closeContacto) closeContacto.onclick = () => cerrarModal(modalContacto);

window.onclick = (e) => {
    if (e.target === modalNoticias) cerrarModal(modalNoticias);
    if (e.target === modalTienda) cerrarModal(modalTienda);
    if (e.target === modalContacto) cerrarModal(modalContacto);
};

// ===============================
// ARTISTAS (ya existente)
// ===============================
const artistas = [
    {
        nombre: "J Løwℤ",
        imagen: "Assets/artistas/jlowz.JPG", // 📸 CAMBIA ESTA RUTA POR LA FOTO REAL
        descripcion: "Arquitecto de expansión profunda y tensión contenida. J Løwℤ fusiona capas atmosféricas y graves oscuros en un viaje inmersivo.", // 📝 AGREGA AQUÍ LA DESCRIPCIÓN
        soundcloud: "https://soundcloud.com/juan-jose-lopez-775910207?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing"
    },
    {
        nombre: "DSTRKT",
        imagen: "Assets/artistas/dstrkt.JPG",
        descripcion: "Arquitecto de progresiones hipnóticas y atmósferas mentales. DSTRKT transforma la pista en un espacio de trance envolvente y movimiento constante.",
        soundcloud: "https://soundcloud.com/dstrkt_dj?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing"
    },
    {
        nombre: "Do",
        imagen: "Assets/artistas/do.JPG",
        descripcion: "Mezclas energéticas que fusionan el Groove con el Polegroup. Do garantiza una experiencia de alto voltaje en cada presentación.",
        soundcloud: "https://soundcloud.com/diazz-845252555?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing"
    },
    {
        nombre: "A.L.L",
        imagen: "Assets/artistas/all.JPG",
        descripcion: "Explorador de trance profundo y conexión auténtica. A.L.L fusiona ritmos envolventes y melodías experimentales en un viaje mental y liberador.",
        soundcloud: "https://soundcloud.com/juan-manuel-franco-404168115?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing"
    },
    {
        nombre: "ECTASY",
        imagen: "Assets/artistas/ectasy.jpeg",
        descripcion: "Ritmos rotos y experimentación. ECTASY rompe los esquemas tradicionales para ofrecer una propuesta fresca y audaz.",
        soundcloud: "https://soundcloud.com/yung-ghost-442183122?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing"
    },
];

const contenedorArtistas = document.getElementById("lista-artistas");

// Ordenar alfabéticamente por nombre
artistas.sort((a, b) => a.nombre.localeCompare(b.nombre));

if (contenedorArtistas) {
    for (let i = 0; i < artistas.length; i++) {
        let div = document.createElement("div");
        div.className = "col-md-4";
        div.innerHTML = `
      <div class="card bg-dark text-light h-100 artist-card-nemorphic">
        <div class="card-body text-center d-flex flex-column align-items-center">
            
            <!-- FOTO DEL DJ -->
            <div class="artist-img-container mb-3">
                <img src="${artistas[i].imagen}" alt="${artistas[i].nombre}" class="artist-img">
            </div>

            <h5 class="card-title mb-2">${artistas[i].nombre}</h5>

            <!-- DESCRIPCIÓN DESPLEGABLE -->
            <details class="artist-details mb-3">
                <summary class="btn-ver-info">Ver Info <span>▼</span></summary>
                <div class="artist-bio mt-2">
                    <p>${artistas[i].descripcion}</p>
                </div>
            </details>

            <!-- DOTÓN SOUNDCLOUD (mt-auto para empujarlo al fondo si el card crece) -->
            <a href="${artistas[i].soundcloud}" target="_blank" rel="noopener noreferrer"
                class="btn btn-sm btn-outline-info mt-auto">
                SoundCloud
            </a>
        </div>
      </div>
    `;
        contenedorArtistas.appendChild(div);
    }
}

// ===============================
// LANZAMIENTOS DINÁMICOS
// ===============================
(function renderLanzamientos() {
    const cont = document.getElementById("lista-lanzamientos");
    if (!cont) return;

    // 🎵 Lista de lanzamientos (agrega más fácilmente)
    const lanzamientos = [
        {
            titulo: "Nemorphic Session #1 - Nyrae",
            embed: "https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/nemorphic/nms-001-nyrae&color=%236a0dad"
        },
        {
            titulo: "Nemorphic Session #2 - A.L.L B2B DO",
            embed: "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A2258242973&color=%23051e36&auto"
        }

        //  Para agregar más:
        // {
        //   titulo: "Nemorphic Session #3 - Nombre del set",
        //   embed: "https://w.soundcloud.com/player/?url=LINK_EMBED&color=%236a0dad"
        // }
    ];

    cont.innerHTML = ""; // limpia antes de cargar

    lanzamientos.forEach(item => {
        const div = document.createElement("div");
        div.className = "col-md-6";

        div.innerHTML = `
      <div class="card lanzamiento-card text-center h-100">
        <div class="card-body">
          <h5 class="card-title">${item.titulo}</h5>
          <iframe
            scrolling="no"
            frameborder="no"
            allow="autoplay"
            src="${item.embed}">
          </iframe>
        </div>
      </div>
    `;

        cont.appendChild(div);
    });
})();

// ✅ Capturar el formulario de newsletter y manejar el envío
const newsletterForm = document.getElementById("newsletterForm");

if (newsletterForm) {
    newsletterForm.addEventListener("submit", function (e) {
        e.preventDefault(); // evita que recargue la página

        const emailInput = newsletterForm.querySelector('input[type="email"]');
        const email = emailInput.value;

        alert(`¡Gracias! Te has suscrito con el correo: ${email}`);

        // Opcional: limpiar el formulario
        newsletterForm.reset();

        // Cerrar modal opcionalmente
        const modalContacto = document.getElementById("modalContacto");
        if (modalContacto) modalContacto.style.display = "none";
        document.body.style.overflow = "auto";
    });
}
