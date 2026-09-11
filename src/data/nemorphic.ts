export type Artista = {
  nombre: string;
  imagen: string;
  descripcion: string;
  soundcloud: string;
};

export const artistas: Artista[] = [
  {
    nombre: "J Løwℤ",
    imagen: "/Assets/artistas/jlowzz.JPG",
    descripcion:
      "J Løwℤ construye paisajes intensos y profundos, combinando texturas etéreas con graves contundentes para crear una expansión constante y un portal sonoro de inmersión total, con gran tensión emocional y una identidad profundamente distintiva.",
    soundcloud:
      "https://soundcloud.com/juan-jose-lopez-775910207?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
  },
  {
    nombre: "DSTRKT",
    imagen: "/Assets/artistas/ditri.jpg",
    descripcion:
      "DSTRKT diseña progresiones hipnóticas y atmósferas densas que transforman la pista en un espacio de movimiento constante, trance envolvente y presencia emocional.",
    soundcloud:
      "https://soundcloud.com/dstrkt_dj?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
  },
  {
    nombre: "Do",
    imagen: "/Assets/artistas/do.JPG",
    descripcion:
      "Do fusiona energía, groove y una sensibilidad marcada por el polegroup para entregar sets de alto impacto, ritmo preciso y una conexión directa con la dancefloor.",
    soundcloud:
      "https://soundcloud.com/diazz-845252555?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
  },
  {
    nombre: "A.L.L",
    imagen: "/Assets/artistas/all.JPG",
    descripcion:
      "A.L.L explora el trance profundo con una visión auténtica y experimental, integrando melodías envolventes y ritmos introspectivos que invitan a la inmersión mental y la conexión emocional.",
    soundcloud:
      "https://soundcloud.com/juan-manuel-franco-404168115?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
  },
  {
    nombre: "ECTASY",
    imagen: "/Assets/artistas/ectasy.jpeg",
    descripcion:
      "ECTASY se mueve entre ritmos rotos y propuestas experimentales, apostando por una estética fresca y disruptiva que desafía los límites convencionales del sonido club.",
    soundcloud:
      "https://soundcloud.com/yung-ghost-442183122?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
  },
  {
    nombre: "Blaue Nacht",
    imagen: "/Assets/artistas/blaue.jpeg",
    descripcion:
      "Blaue Nacht propone una visión más profunda y atmosférica del techno, construyendo recorridos oscuros y sensoriales donde la tensión, el espacio y la textura se convierten en el eje central de la experiencia.",
    soundcloud:
      "https://soundcloud.com/sergio-tibaduiza?utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing",
  },
];

export type Lanzamiento = {
  titulo: string;
  embed: string;
};

export const lanzamientos: Lanzamiento[] = [
  {
    titulo: "Nemorphic Sessions",
    embed:
      "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A2092679367&color=%236b4f8a&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=true&show_artwork=true&sharing=false&download=false&show_tracklist=true",
  },
];

export const LOGO = "/Assets/logo nemorphic.png";
export const HERO_BG = "/Assets/inicio.jpg";
