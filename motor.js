// Motor de Cromatron: propagación de la luz según REGLAS.md (§2–§4).
// Escrito solo a partir de REGLAS.md; sirve igual en Node y en el navegador.
'use strict';

const N = 15;
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];
const MAX_GEN = 1023;
const MAX_HACES = 32;

const T = {
  VACIO: 0, PARED: 1, LASER: 2, ESPEJO: 3, BENDER: 4, FILTRO: 5, PRISMA: 6, DOPPLER: 7,
  DIVISOR: 8, ENTRELAZADOR: 9, ESTRELLA: 10, CONDUCTO: 11, TELE: 12,
};
const MOVILES = new Set([T.ESPEJO, T.BENDER, T.FILTRO, T.PRISMA, T.DOPPLER, T.DIVISOR, T.ENTRELAZADOR]);

const m8 = (v) => ((v % 8) + 8) % 8;
// Doppler bit a bit: «adelante» R→G→B→R, «atrás» R→B→G→R (rojo 4, verde 2, azul 1).
const adelante = (c) => (c >> 1) | ((c & 1) << 2);
const atras = (c) => ((c << 1) & 7) | (c >> 2);

// Salidas de una pieza para un haz que entra yendo en d (tabla §3.1).
// Devuelve [d, color, etiqueta] en el orden en que entran en la cola.
function transferir(pieza, d, color, etiqueta, nuevaEtiqueta) {
  const t = pieza ? pieza.tipo : T.VACIO;
  if (t === T.VACIO || t === T.ESTRELLA) return [[d, color, etiqueta]];
  if (t === T.PARED || t === T.LASER) return [];
  const p = pieza.p;
  const r = m8(d - p);
  switch (t) {
    case T.ESPEJO:
      if (r === 1) return [[m8(p + 7), color, etiqueta]];
      if (r === 2) return [[m8(p + 6), color, etiqueta]];
      if (r === 3) return [[m8(p + 5), color, etiqueta]];
      return [];
    case T.BENDER:
      if (r <= 3) return [[m8(p + 7 - r), color, etiqueta]];
      return [];
    case T.FILTRO: {
      if (r !== 2 && r !== 6) return [];
      const c = color & pieza.color;
      return c ? [[d, c, etiqueta]] : [];
    }
    case T.PRISMA: {
      // Cada bit por separado, en el orden rojo, verde, azul (§3.2; al revés que el entrelazador).
      const sal = [];
      if ((color & 4) && (r === 1 || r === 2 || r === 5 || r === 6)) sal.push([d, 4, etiqueta]);
      if (color & 2) {
        const o = { 0: p + 1, 2: p + 3, 5: p + 4, 7: p + 6 }[r];
        if (o !== undefined) sal.push([m8(o), 2, etiqueta]);
      }
      if (color & 1) {
        const o = { 0: p + 6, 2: p + 4, 5: p + 3, 7: p + 1 }[r];
        if (o !== undefined) sal.push([m8(o), 1, etiqueta]);
      }
      return sal;
    }
    case T.DOPPLER:
      if (r !== 2 && r !== 6) return [];
      if (etiqueta) return [[d, color, etiqueta]];   // entrelazado: cambia en la pasada de §4.4
      return [[d, r === 2 ? adelante(color) : atras(color), 0]];
    case T.DIVISOR:
      // De canto absorbe; de frente sigue recto con su etiqueta; a 45°, recto y luego reflejado, los dos con etiqueta 0.
      if (r === 0 || r === 4) return [];
      if (r === 2 || r === 6) return [[d, color, etiqueta]];
      return [[d, color, 0], [m8(p + { 1: 7, 3: 5, 5: 3, 7: 1 }[r]), color, 0]];
    case T.ENTRELAZADOR: {
      if (r !== 2) return [];
      const sal = [];
      for (const bit of [1, 2, 4]) {
        if (!(color & bit)) continue;
        const e = nuevaEtiqueta();
        sal.push([p, bit, e], [m8(p + 4), bit, e]);
      }
      return sal;
    }
    case T.CONDUCTO:
      return r === 0 || r === 4 ? [[d, color, etiqueta]] : [];
    default:
      return [];
  }
}

// Tablero: lista de piezas [tipo, p, color, x, y].
function crearTablero(piezas) {
  const celdas = new Array(N * N).fill(null);
  for (const [tipo, p, color, x, y] of piezas) {
    if (tipo === T.VACIO) continue;
    celdas[y * N + x] = { tipo, p, color, x, y };
  }
  return celdas;
}

function recalcular(celdas) {
  const entra = Array.from({ length: N * N }, () => new Array(8).fill(0));
  const sale = Array.from({ length: N * N }, () => new Array(8).fill(0));
  let laseresCortados = 0;
  let descartados = 0;
  let contadorEtiquetas = 0;
  const nuevaEtiqueta = () => ++contadorEtiquetas;

  for (let i = 0; i < N * N; i++) {
    const l = celdas[i];
    if (!l || l.tipo !== T.LASER) continue;
    let actual = [{ x: l.x, y: l.y, d: l.p, color: l.color, etiqueta: 0 }];
    let gen = 0;
    while (actual.length && gen < MAX_GEN) {
      gen++;
      const siguiente = [];
      const meter = (h) => {
        if (siguiente.length < MAX_HACES) siguiente.push(h);
        else descartados++;
      };
      for (const h of actual) {
        sale[h.y * N + h.x][h.d] |= h.color;
        const nx = h.x + DX[h.d], ny = h.y + DY[h.d];
        if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
        entra[ny * N + nx][h.d] |= h.color;
        const pieza = celdas[ny * N + nx];
        if (pieza && pieza.tipo === T.TELE) {
          let tx = nx + DX[h.d], ty = ny + DY[h.d];
          while (tx >= 0 && tx < N && ty >= 0 && ty < N) {
            const q = celdas[ty * N + tx];
            if (q && q.tipo === T.TELE) {
              meter({ x: tx, y: ty, d: h.d, color: h.color, etiqueta: h.etiqueta });
              break;
            }
            tx += DX[h.d]; ty += DY[h.d];
          }
          continue;
        }
        const salidas = transferir(pieza, h.d, h.color, h.etiqueta, nuevaEtiqueta);
        for (const [d, color, etiqueta] of salidas) meter({ x: nx, y: ny, d, color, etiqueta });
      }
      entrelazar(siguiente, celdas);
      actual = siguiente;
    }
    if (actual.length) laseresCortados++;
  }

  let ganado = true;
  for (const c of celdas) {
    if (!c || c.tipo !== T.ESTRELLA) continue;
    const i = c.y * N + c.x;
    const recibido = entra[i].reduce((a, b) => a | b, 0);
    if (recibido !== c.color) ganado = false;
  }
  return { entra, sale, ganado, laseresCortados, descartados };
}

// §4.4: tras cada generación, un haz entrelazado que acaba de cruzar un doppler cambia de color él
// (según su sentido) y su gemelo (con el opuesto). Si los dos gemelos cruzan doppler a la vez, cada uno recibe los dos.
function entrelazar(cola, celdas) {
  const cambios = new Map();   // haz -> lista de funciones de cambio
  for (const h of cola) {
    if (!h.etiqueta) continue;
    const pieza = celdas[h.y * N + h.x];
    if (!pieza || pieza.tipo !== T.DOPPLER) continue;
    const r = m8(h.d - pieza.p);
    if (r !== 2 && r !== 6) continue;
    const propio = r === 2 ? adelante : atras;
    const opuesto = r === 2 ? atras : adelante;
    for (const g of cola) {
      if (g.etiqueta !== h.etiqueta) continue;
      if (!cambios.has(g)) cambios.set(g, []);
      cambios.get(g).push(g === h ? propio : opuesto);
    }
  }
  for (const [g, fs] of cambios) for (const f of fs) g.color = f(g.color);
}

// Huella del campo de haces (formato de calibración de Cowork): por casilla, fila a fila,
// 8 cifras hex de entra[d] y 8 de sale[d].
function textoCampo(res) {
  let s = '';
  for (let i = 0; i < N * N; i++) {
    for (let d = 0; d < 8; d++) s += res.entra[i][d].toString(16);
    for (let d = 0; d < 8; d++) s += res.sale[i][d].toString(16);
  }
  return s;
}

const motor = { N, T, MOVILES, crearTablero, recalcular, textoCampo, adelante, atras };
if (typeof module !== 'undefined') module.exports = motor;
else globalThis.CromatronMotor = motor;
