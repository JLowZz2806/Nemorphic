export type Artista = {
  nombre: string;
  imagen: string;
  descripcion: string;
  soundcloud: string;
};

export const artistas: Artista[] = [
  {
    nombre: "J Løwℤ",
    imagen: "/Assets/artistas/jlowz.JPG",
    descripcion:
      "Arquitecto de expansión profunda y tensión contenida. J Løwℤ fusiona capas atmosféricas y graves oscuros en un viaje inmersivo.",
    soundcloud:
      "https://soundcloud.com/juan-jose-lopez-775910207?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
  },
  {
    nombre: "DSTRKT",
    imagen: "/Assets/artistas/dstrkt.JPG",
    descripcion:
      "Arquitecto de progresiones hipnóticas y atmósferas mentales. DSTRKT transforma la pista en un espacio de trance envolvente y movimiento constante.",
    soundcloud:
      "https://soundcloud.com/dstrkt_dj?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
  },
  {
    nombre: "Do",
    imagen: "/Assets/artistas/do.JPG",
    descripcion:
      "Mezclas energéticas que fusionan el Groove con el Polegroup. Do garantiza una experiencia de alto voltaje en cada presentación.",
    soundcloud:
      "https://soundcloud.com/diazz-845252555?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
  },
  {
    nombre: "A.L.L",
    imagen: "/Assets/artistas/all.JPG",
    descripcion:
      "Explorador de trance profundo y conexión auténtica. A.L.L fusiona ritmos envolventes y melodías experimentales en un viaje mental y liberador.",
    soundcloud:
      "https://soundcloud.com/juan-manuel-franco-404168115?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
  },
  {
    nombre: "ECTASY",
    imagen: "/Assets/artistas/ectasy.jpeg",
    descripcion:
      "Ritmos rotos y experimentación. ECTASY rompe los esquemas tradicionales para ofrecer una propuesta fresca y audaz.",
    soundcloud:
      "https://soundcloud.com/yung-ghost-442183122?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
  },
];

export type Lanzamiento = { titulo: string; embed: string };

export const lanzamientos: Lanzamiento[] = [
  {
    titulo: "Nemorphic Session #1 - Nyrae",
    embed:
      "https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/nemorphic/nms-001-nyrae&color=%236a0dad",
  },
  {
    titulo: "Nemorphic Session #2 - A.L.L B2B DO",
    embed:
      "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A2258242973&color=%23051e36&auto",
  },
  {
    titulo: "Nemorphic Session #3 - /// N W M N",
    embed:
      "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A2271021080&color=%23051e36&auto",
  },
  {
    titulo: "Nemorphic Session #4 - Hazrloner",
    embed:
      "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A2279106629&color=%23051e36&auto",
  },
  {
    titulo: "Nemorphic Session #5 - DSTRKT - Residente Nemorphic",
    embed:
      "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A2288759009&color=%23051e36&auto",
  },
  {
    titulo: "Nemorphic Session #6 - Jacobo Gringberg",
    embed:
      "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A2296846181&color=%23051e36&auto",
  },
  {
    titulo: "Nemorphic Session #7 - ECTASY",
    embed:
      "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A2304731705&color=%23051e36&auto",
  },
];

export const LOGO = "/Assets/logo nemorphic.png";
export const HERO_BG = "/Assets/inicio.png";
