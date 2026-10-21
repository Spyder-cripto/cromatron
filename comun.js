// Cromatron · parte común del juego y del editor: medidas de pantalla (REGLAS §6), dibujo, caja de herramientas,
// tira de niveles, desbloqueo (§6.1), código de solución (§7) y la partida con el ratón y el teclado (§5).
'use strict';
(function () {
  const M = globalThis.CromatronMotor;
  const { T, N } = M;

  // ---------- medidas del original (ventana de 640 × 480) ----------
  const ANCHO = 640, ALTO = 480;
  const TAB = { x: 60, y: 30, c: 24 };               // tablero 15 × 15
  const CAJA = { x: 460, y: 20, c: 26, cols: 6, filas: 4 };
  const PISTAS = { x0: 450, y0: 125, x1: 620, y1: 475 };
  const MENSAJE = { x0: 330, y0: 385, x1: 400, y1: 420 };
  // La tira va 14 px más abajo que en el original para dejar sitio al nombre del nivel (Fali).
  const posNumero = (n) => ({ x: 10 + 20 * ((n - 1) % 25), y: 435 + 16 * Math.floor((n - 1) / 25) });
  const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [-1, -1, 0, 1, 1, 1, 0, -1];

  // ---------- estilo Jardín ----------
  // Estilos de fondo (las piezas son iguales en todos). Se elige con ?estilo=… mientras Fali decide.
  const ESTILOS = {
    jardin: { fondo: '#dcebc9', cesped: '#f1f8e8', rejilla: '#cfe1bb', texto: '#2f5a2a', caja: '#e9f3dc', cajaBorde: '#a9c78f' },
    arcoiris: { fondo: '#ffffff', cesped: '#fffdf6', rejilla: '#e7dcf7', texto: '#3b2a6b', caja: '#f7f1ff', cajaBorde: '#c4aef0' },
    caramelo: { fondo: '#fff8ee', cesped: '#f3fff7', rejilla: '#cdeedd', texto: '#7a1f4f', caja: '#ffeaf3', cajaBorde: '#ff9fc2' },
    cielo: { fondo: '#ffffff', cesped: '#f5f9ff', rejilla: '#d3e3f7', texto: '#173a6b', caja: '#edf5ff', cajaBorde: '#8ec5ff' },
  };
  const ESTILO = (() => {
    let e = null;
    try { e = new URLSearchParams(location.search).get('estilo'); } catch (err) { /* sin dirección */ }
    return ESTILOS[e] ? e : (globalThis.CROMATRON_ESTILO || 'arcoiris');
  })();
  if (typeof document !== 'undefined') document.documentElement.dataset.estilo = ESTILO;
  const C = {
    ...ESTILOS[ESTILO], seto: '#5d9e4b', setoOscuro: '#3f7a35', setoHoja: '#7fbf62',
    metal: '#9aa6ad', metalOscuro: '#55626a',
    espejo: '#7b3fe4', espejoCara: '#f4f0ff', bender: '#ff7a00', cristal: '#5fe0ff', cristalBorde: '#0077b6',
    conducto: '#14b8a6', conductoBorde: '#0f766e', lazo: '#d946ef', tele: '#8b5cf6', teleFondo: '#ede9fe',
  };
  const RGB = ['#000000', '#0000ff', '#00c800', '#00c8ff', '#ff0000', '#ff00ff', '#ffc800', '#ffffff'];
  const TEXTOS = {
    gana: '¡Logrado!', ganado: '(ganado)', seguir: 'Pulsa un nivel o la barra espaciadora para seguir.',
  };

  const centro = (x, y) => [TAB.x + TAB.c * x + TAB.c / 2, TAB.y + TAB.c * y + TAB.c / 2];
  const centroHueco = (i) => [CAJA.x + CAJA.c * (i % CAJA.cols) + CAJA.c / 2, CAJA.y + CAJA.c * Math.floor(i / CAJA.cols) + CAJA.c / 2];
  const rad = (d) => (d * Math.PI) / 4;              // dirección (0 = N, en sentido horario) a giro del lienzo

  // Fondo del cuadro: en el estilo Arcoíris, un degradado pastel; en los demás, liso.
  function pintarFondo(ctx) {
    if (ESTILO === 'arcoiris') {
      const g = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
      [['#ffd9ec', 0], ['#fff0c4', 0.28], ['#d6f8e4', 0.52], ['#d6ecff', 0.76], ['#eadcff', 1]].forEach(([c, t]) => g.addColorStop(t, c));
      ctx.fillStyle = g;
    } else ctx.fillStyle = C.fondo;
    ctx.fillRect(0, 0, ANCHO, ALTO);
  }

  // Marco de adorno (tablero y caja): moldura arcoíris con filo oscuro y remaches de colores en las esquinas.
  const ARCO = ['#ff3b3b', '#ff9f1c', '#f5c400', '#2ecc71', '#22b8d6', '#3b82f6', '#8b5cf6', '#ec4899'];
  function marco(ctx, x, y, w, h) {
    const m = 9, r = 10;                                   // grosor de la moldura y redondeo
    const g = ctx.createLinearGradient(x - m, y - m, x + w + m, y + h + m);
    ARCO.forEach((c, i) => g.addColorStop(i / (ARCO.length - 1), c));
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x - m, y - m, w + 2 * m, h + 2 * m, r);
    ctx.shadowColor = 'rgba(60,30,90,0.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1; ctx.strokeStyle = '#3b2a6b';
    ctx.beginPath(); ctx.roundRect(x - m + 0.5, y - m + 0.5, w + 2 * m - 1, h + 2 * m - 1, r); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
    [[x - m + 5, y - m + 5], [x + w + m - 5, y - m + 5], [x - m + 5, y + h + m - 5], [x + w + m - 5, y + h + m - 5]].forEach(([cx, cy], i) => {
      ctx.beginPath(); ctx.arc(cx, cy, 3.4, 0, 7); ctx.fillStyle = ['#ffe14d', '#ffffff', '#ffffff', '#ffe14d'][i]; ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = '#3b2a6b'; ctx.stroke();
    });
  }

  // ---------- dibujo de piezas (planas y centradas; «norte» local = −y) ----------
  function linea(ctx, pts, color, ancho) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function dibujarPared(ctx, cx, cy, s) {
    // Muro de ladrillo: bloque macizo que corta el rayo.
    const h = s / 2, k = s / 24;
    ctx.fillStyle = '#7a2e1d'; ctx.fillRect(cx - h, cy - h, s, s);
    ctx.fillStyle = '#d9553a';
    const filas = [[0, [[0, 11], [12, 12]]], [8, [[0, 5], [6, 12], [19, 5]]], [16, [[0, 11], [12, 12]]]];
    for (const [y, ladrillos] of filas) for (const [x, w] of ladrillos) ctx.fillRect(cx - h + (x + 0.8) * k, cy - h + (y + 0.8) * k, (w - 1.6) * k, 6.4 * k);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (const [y, ladrillos] of filas) for (const [x, w] of ladrillos) ctx.fillRect(cx - h + (x + 0.8) * k, cy - h + (y + 0.8) * k, (w - 1.6) * k, 1.2 * k);
  }
  // Una pieza en (cx, cy) con lado s. luzEstrella: color recibido (para pintar la estrella encendida o apagada).
  function dibujarPieza(ctx, pz, cx, cy, s, luzEstrella) {
    if (pz.tipo === T.PARED) return dibujarPared(ctx, cx, cy, s);
    const k = s / 24;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    switch (pz.tipo) {
      case T.LASER: {
        ctx.rotate(rad(pz.p));
        ctx.fillStyle = C.metal; ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(-4.5, -3, 9, 13, 2.5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = RGB[pz.color]; ctx.fillRect(-3, 2, 6, 3); ctx.fillRect(-3, 6.5, 6, 2);
        ctx.beginPath(); ctx.arc(0, -4, 3.6, 0, 7); ctx.fillStyle = RGB[pz.color]; ctx.fill(); ctx.strokeStyle = '#333'; ctx.stroke();
        break;
      }
      case T.ESPEJO: case T.BENDER: {
        // La cara buena mira hacia (p+6); el bender va 22,5° antes (REGLAS §3.2).
        ctx.rotate(rad(pz.p + 6) - (pz.tipo === T.BENDER ? Math.PI / 8 : 0));
        const tono = pz.tipo === T.BENDER ? C.bender : C.espejo;
        ctx.beginPath(); ctx.moveTo(-9, -1); ctx.quadraticCurveTo(0, 5, 9, -1);
        ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 5.5; ctx.lineCap = 'round'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-9, -1); ctx.quadraticCurveTo(0, 5, 9, -1);
        ctx.strokeStyle = tono; ctx.lineWidth = 3.6; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-8, -2.5); ctx.quadraticCurveTo(0, 3, 8, -2.5);
        ctx.strokeStyle = C.espejoCara; ctx.lineWidth = 1.3; ctx.stroke();
        if (pz.tipo === T.BENDER) { linea(ctx, [[0, 3], [0, 8]], '#2b2140', 3.4); linea(ctx, [[0, 3], [0, 8]], C.bender, 1.8); }
        break;
      }
      case T.FILTRO: {
        ctx.rotate(rad(pz.p));
        ctx.fillStyle = RGB[pz.color]; ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(-3, -9, 6, 18, 3); ctx.fill(); ctx.stroke();
        linea(ctx, [[-1, -6], [-1, 6]], 'rgba(255,255,255,0.7)', 1);
        break;
      }
      case T.PRISMA: {
        ctx.rotate(rad(pz.p));
        ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8.5, 7); ctx.lineTo(-8.5, 7); ctx.closePath();
        ctx.fillStyle = 'rgba(207,250,254,0.95)'; ctx.fill(); ctx.strokeStyle = '#0e7490'; ctx.lineWidth = 1.8; ctx.stroke();
        linea(ctx, [[2, -1], [6, 5]], '#ff0000', 1.2); linea(ctx, [[0.5, 0], [4.5, 6]], '#00c800', 1.2); linea(ctx, [[-1, 1], [3, 7]], '#0000ff', 1.2);
        break;
      }
      case T.DOPPLER: {
        ctx.rotate(rad(pz.p + 2));                    // «adelante» = p+2
        ctx.fillStyle = '#f7f7f2'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(-4, -9, 8, 18, 2); ctx.fill(); ctx.stroke();
        for (const [y, col] of [[-5, '#ff0000'], [0, '#00c800'], [5, '#0000ff']]) linea(ctx, [[-3, y], [3, y]], col, 2);
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(3.5, -8.5); ctx.lineTo(-3.5, -8.5); ctx.closePath(); ctx.fillStyle = '#333'; ctx.fill();
        break;
      }
      case T.DIVISOR: {
        ctx.rotate(rad(pz.p));
        linea(ctx, [[0, -10], [0, 10]], C.cristalBorde, 4.2);
        linea(ctx, [[0, -9], [0, 9]], C.cristal, 2.4);
        break;
      }
      case T.ENTRELAZADOR: {
        ctx.rotate(rad(pz.p));                        // salidas por p y p+4; entra el haz que va hacia p+2
        linea(ctx, [[0, -9], [0, 9]], '#2b2140', 5); linea(ctx, [[0, -9], [0, 9]], C.lazo, 3);
        linea(ctx, [[-9, 0], [0, 0]], '#2b2140', 5); linea(ctx, [[-9, 0], [0, 0]], C.lazo, 3);
        for (const [a, b] of [[0, -9], [0, 9]]) { ctx.beginPath(); ctx.arc(a, b, 2.8, 0, 7); ctx.fillStyle = '#ffe14d'; ctx.fill(); ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 1.2; ctx.stroke(); }
        ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
        break;
      }
      case T.CONDUCTO: {
        ctx.rotate(rad(pz.p));
        ctx.fillStyle = 'rgba(20,184,166,0.28)'; ctx.fillRect(-4.5, -12, 9, 24);
        linea(ctx, [[-4.5, -12], [-4.5, 12]], C.conductoBorde, 2); linea(ctx, [[4.5, -12], [4.5, 12]], C.conductoBorde, 2);
        linea(ctx, [[-3, -12], [-3, 12]], C.conducto, 1); linea(ctx, [[3, -12], [3, 12]], C.conducto, 1);
        break;
      }
      case T.TELE: {
        ctx.strokeStyle = '#7d5fb3'; ctx.lineWidth = 1.4;
        const arco = ['#ff3b3b', '#ff9f1c', '#ffe14d', '#2ecc71', '#22d3ee', '#3b82f6', '#8b5cf6', '#ec4899'];
        for (let i = 0; i < 8; i++) { const a = rad(i); linea(ctx, [[Math.sin(a) * 4.5, -Math.cos(a) * 4.5], [Math.sin(a) * 10, -Math.cos(a) * 10]], arco[i], 2.2); }
        ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 7); ctx.fillStyle = C.teleFondo; ctx.fill(); ctx.strokeStyle = C.tele; ctx.lineWidth = 1.6; ctx.stroke();
        break;
      }
      case T.ESTRELLA: {
        const llega = luzEstrella || 0;
        const bien = llega === pz.color;
        if (pz.color === 0) {
          // Negra: maciza si no le llega luz; clara y rayada si le llega.
          for (let i = 0; i < 8; i++) { const a = rad(i); linea(ctx, [[0, 0], [Math.sin(a) * 9, -Math.cos(a) * 9]], bien ? '#111' : '#bbb', bien ? 3 : 2); }
          if (!bien) for (let i = 0; i < 8; i++) { const a = rad(i) + 0.4; linea(ctx, [[0, 0], [Math.sin(a) * 7, -Math.cos(a) * 7]], '#555', 0.8); }
        } else {
          const col = RGB[pz.color];
          if (bien) {
            for (let i = 0; i < 8; i++) { const a = rad(i); linea(ctx, [[0, 0], [Math.sin(a) * 10, -Math.cos(a) * 10]], '#333', 4.5); }
            for (let i = 0; i < 8; i++) { const a = rad(i); linea(ctx, [[0, 0], [Math.sin(a) * 9.5, -Math.cos(a) * 9.5]], col, 3); }
            ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
          } else {
            for (let i = 0; i < 8; i++) { const a = rad(i); linea(ctx, [[0, 0], [Math.sin(a) * 8, -Math.cos(a) * 8]], '#333', 2.6); }
            for (let i = 0; i < 8; i++) { const a = rad(i); linea(ctx, [[0, 0], [Math.sin(a) * 7.5, -Math.cos(a) * 7.5]], col, 1.2); }
          }
        }
        break;
      }
      default: break;
    }
    ctx.restore();
  }

  // ---------- rayos (REGLAS §6): medio segmento hacia el lado d = OR de lo que sale por d y lo que entra por d ----------
  function dibujarRayos(ctx, res) {
    for (let i = 0; i < N * N; i++) {
      const x = i % N, y = Math.floor(i / N);
      const [cx, cy] = centro(x, y);
      const ejes = new Set();
      const tramos = [];
      for (let d = 0; d < 8; d++) {
        const c = res.sale[i][d] | res.entra[i][(d + 4) % 8];
        if (!c) continue;
        ejes.add(d % 4);
        tramos.push([d, c]);
      }
      for (const [d, c] of tramos) {
        const ex = cx + DX[d] * TAB.c / 2, ey = cy + DY[d] * TAB.c / 2;
        linea(ctx, [[cx, cy], [ex, ey]], 'rgba(30,40,30,0.55)', 3);
      }
      for (const [d, c] of tramos) {
        const ex = cx + DX[d] * TAB.c / 2, ey = cy + DY[d] * TAB.c / 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.strokeStyle = RGB[c]; ctx.lineWidth = 1.4; ctx.lineCap = 'butt'; ctx.stroke();
      }
      if (ejes.size >= 2) {
        let c = 0; for (const [, cc] of tramos) c |= cc;
        ctx.fillStyle = RGB[c]; ctx.fillRect(cx - 1, cy - 1, 2, 2);
      }
    }
  }

  function texto(ctx, t, x, y, tam, color, alinear) {
    ctx.font = `bold ${tam}px Verdana, Tahoma, sans-serif`; ctx.fillStyle = color; ctx.textAlign = alinear || 'left'; ctx.textBaseline = 'top';
    ctx.fillText(t, x, y);
  }
  function textoEnCaja(ctx, t, x0, y0, x1, tam, color) {
    ctx.font = `bold ${tam}px Verdana, Tahoma, sans-serif`;
    const lineas = [];
    for (const parrafo of String(t).split('\n')) {
      let l = '';
      for (const p of parrafo.split(' ')) {
        const prueba = l ? l + ' ' + p : p;
        if (ctx.measureText(prueba).width > x1 - x0 && l) { lineas.push(l); l = p; } else l = prueba;
      }
      lineas.push(l);
    }
    lineas.forEach((l, i) => texto(ctx, l, x0, y0 + i * (tam + 4), tam, color));
  }
  function numeroTira(ctx, n, estado) {
    const { x, y } = posNumero(n);
    const col = { actual: '#ffffff', hecho: '#2a5bd7', abierto: '#2e9b3a', cerrado: '#d33a2c' }[estado];
    ctx.font = 'bold 12px Verdana, Tahoma, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.lineWidth = 3; ctx.strokeStyle = '#1d2a1b'; ctx.lineJoin = 'round'; ctx.strokeText(String(n), x, y);
    ctx.fillStyle = col; ctx.fillText(String(n), x, y);
  }

  // ---------- cuadro de pistas con botón «Pista» (decisión de Fali) ----------
  const BOTON_PISTA = { x: 489, y: 198, w: 92, h: 22 };   // centrado en el cuadro de pistas (Fali)
  function dibujarCuadroPista(ctx, p) {
    const P = PISTAS, B = BOTON_PISTA;
    if (p.ganado) return textoEnCaja(ctx, TEXTOS.seguir, P.x0, BOTON_PISTA.y, P.x1, 12, C.texto);
    if (!p.nivel || !p.nivel.pista) return;
    ctx.fillStyle = p.verPista ? '#ffffff' : '#ffd23f'; ctx.strokeStyle = '#2b2140'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(B.x, B.y, B.w, B.h, 6); ctx.fill(); ctx.stroke();
    texto(ctx, p.verPista ? 'Ocultar pista' : 'Pista', B.x + B.w / 2, B.y + 5, 11, '#2b2140', 'center');
    if (p.verPista) textoEnCaja(ctx, p.nivel.pista, P.x0, B.y + B.h + 10, P.x1, 12, C.texto);
  }
  // Nombre del nivel y «¡Logrado!» / «(ganado)», a la derecha, entre la caja y la pista (el marco grueso ocupa su sitio
  // original bajo el tablero).
  function dibujarCabecera(ctx, p, completado) {
    const cx = (PISTAS.x0 + PISTAS.x1) / 2;
    // El nombre va debajo del tablero, centrado (Fali).
    if (p.nivel && p.nivel.nombre) texto(ctx, p.nivel.nombre, TAB.x + TAB.c * N / 2, 406, 22, C.texto, 'center');
    if (p.ganado) {
      ctx.font = 'bold 20px Verdana, Tahoma, sans-serif';
      const g = ctx.createLinearGradient(cx - 60, 0, cx + 60, 0);
      ['#ff3b3b', '#ff9f1c', '#2ecc71', '#3b82f6', '#8b5cf6'].forEach((c, i) => g.addColorStop(i / 4, c));
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.lineJoin = 'round';
      ctx.strokeText(TEXTOS.gana, cx, 152); ctx.fillStyle = g; ctx.fillText(TEXTOS.gana, cx, 152);
    } else if (completado) texto(ctx, TEXTOS.ganado, cx, 156, 12, C.texto, 'center');
  }
  // Devuelve true si la pulsación era el botón (y cambia lo que se ve).
  function pulsarCuadroPista(p, px, py) {
    const B = BOTON_PISTA;
    if (p.ganado || !p.nivel || !p.nivel.pista) return false;
    if (px < B.x || px > B.x + B.w || py < B.y || py > B.y + B.h) return false;
    p.verPista = !p.verPista; p.dibujar(); return true;
  }

  // ---------- desbloqueo (REGLAS §6.1) ----------
  function nivelesAbiertos(total, hechos) {
    let h = -1;
    for (let i = total - 1; i >= 0; i--) if (hechos.has(i)) { h = i; break; }
    let n = 1 + (h > 8) + (h > 18) + (h > 25) + 2 * (h > 34);
    const abiertos = new Set(hechos);
    for (let i = 0; i < total && n > 0; i++) if (!hechos.has(i)) { abiertos.add(i); n--; }
    return abiertos;
  }

  // ---------- código de solución (REGLAS §7): N-LL- + 2 letras en base 52 por pieza móvil ----------
  const LETRAS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const ordenMoviles = (moviles) => moviles.map((m, i) => ({ m, i })).sort((a, b) => a.m.tipo - b.m.tipo || a.m.color - b.m.color || valor(a.m) - valor(b.m));
  function valor(m) { const casilla = m.enCaja ? 225 + m.hueco : m.y * N + m.x; return casilla + 285 * m.p; }
  function codigoSolucion(nivel, moviles) {
    let s = `9-${String(nivel).padStart(2, '0')}-`;
    for (const { m } of ordenMoviles(moviles)) { const v = valor(m); s += LETRAS[Math.floor(v / 52)] + LETRAS[v % 52]; }
    return s;
  }
  // Devuelve la colocación nueva [{x,y,p,enCaja,hueco}] por índice de pieza, o null si el texto no vale.
  function leerCodigo(texto, nivel, moviles, ocupada) {
    const m = String(texto).trim().match(/^(\d+)-(\d+)-([a-zA-Z]*)$/);
    if (!m || Number(m[1]) !== 9 || Number(m[2]) !== nivel || m[3].length !== 2 * moviles.length) return null;
    // Al pegar, las piezas se emparejan por (tipo, color), sin mirar dónde estaban.
    const porTipo = moviles.map((x, i) => ({ x, i })).sort((a, b) => a.x.tipo - b.x.tipo || a.x.color - b.x.color);
    const nuevo = new Array(moviles.length);
    const usadas = new Set();
    for (let k = 0; k < porTipo.length; k++) {
      const a = LETRAS.indexOf(m[3][2 * k]), b = LETRAS.indexOf(m[3][2 * k + 1]);
      const v = a * 52 + b, p = Math.floor(v / 285), casilla = v % 285;
      if (a < 0 || b < 0 || p > 7) return null;
      if (usadas.has(casilla)) return null;
      usadas.add(casilla);
      if (casilla >= 225) { if (casilla - 225 >= CAJA.cols * CAJA.filas) return null; nuevo[porTipo[k].i] = { enCaja: true, hueco: casilla - 225, p }; }
      else { const x = casilla % N, y = Math.floor(casilla / N); if (ocupada(x, y)) return null; nuevo[porTipo[k].i] = { enCaja: false, x, y, p }; }
    }
    return nuevo;
  }

  // ---------- cifrado de soluciones (REGLAS §8): protección contra curiosos ----------
  // Clave del cifrado de soluciones (protección contra curiosos, REGLAS §8): la usan el juego, el editor y preparar_web.js.
  const CLAVE = 'cromatron·soluciones·2026';
  function flujo(clave, n) {
    let h = 2166136261;
    for (const ch of clave) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; out[i] = h & 255; }
    return out;
  }
  const aB64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const deB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  function cifrar(obj, clave) {
    const b = new TextEncoder().encode(JSON.stringify(obj)); const k = flujo(clave, b.length);
    return aB64(b.map((x, i) => x ^ k[i]));
  }
  function descifrar(txt, clave) {
    const b = deB64(txt); const k = flujo(clave, b.length);
    return JSON.parse(new TextDecoder().decode(b.map((x, i) => x ^ k[i])));
  }

  // ---------- la partida: tablero + caja + ratón + teclado ----------
  // nivel = { fijas: [[t,p,c,x,y]], caja: [[t,c]], pista }
  class Partida {
    constructor(lienzo, opciones) {
      this.lienzo = lienzo; this.ctx = lienzo.getContext('2d'); this.op = opciones || {};
      this.arrastre = null; this.res = null;
      this.preparar();
    }
    preparar() {
      const l = this.lienzo;
      const ajustar = () => {
        if (this.bloqueado) return;
        const r = window.devicePixelRatio || 1;
        const w = l.clientWidth || ANCHO;
        l.width = Math.round(w * r); l.height = Math.round(w * r * ALTO / ANCHO);
        this.escala = (w * r) / ANCHO; this.dibujar();
      };
      this.ajustar = ajustar;
      window.addEventListener('resize', ajustar);
      l.addEventListener('contextmenu', (e) => e.preventDefault());
      l.addEventListener('pointerdown', (e) => this.bajar(e));
      l.addEventListener('pointermove', (e) => this.mover(e));
      l.addEventListener('pointerup', (e) => this.subir(e));
      l.addEventListener('pointercancel', () => { this.arrastre = null; this.dibujar(); });
    }
    punto(e) {
      const r = this.lienzo.getBoundingClientRect();
      return [(e.clientX - r.left) * ANCHO / r.width, (e.clientY - r.top) * ALTO / r.height];
    }
    cargar(nivel, numero, colocacion) {
      this.nivel = nivel; this.numero = numero; this.verPista = false;
      this.fijas = nivel.fijas.map(([tipo, p, color, x, y]) => ({ tipo, p, color, x, y }));
      this.moviles = nivel.caja.map(([tipo, color]) => ({ tipo, color, p: 0, enCaja: true, hueco: 0 }))
        .sort((a, b) => a.tipo - b.tipo || a.color - b.color);
      this.moviles.forEach((m, i) => { m.hueco = i; });
      if (colocacion && colocacion.length === this.moviles.length) colocacion.forEach((c, i) => Object.assign(this.moviles[i], c));
      this.recalcular();
    }
    reiniciar() {
      this.moviles.forEach((m, i) => { m.enCaja = true; m.hueco = i; m.p = 0; delete m.x; delete m.y; });
      this.recalcular(); this.cambio();
    }
    colocacion() { return this.moviles.map((m) => (m.enCaja ? { enCaja: true, hueco: m.hueco, p: m.p } : { enCaja: false, x: m.x, y: m.y, p: m.p })); }
    piezaEn(x, y) {
      return this.fijas.find((f) => f.x === x && f.y === y) || this.moviles.find((m) => !m.enCaja && m.x === x && m.y === y) || null;
    }
    recalcular() {
      const piezas = [...this.fijas, ...this.moviles.filter((m) => !m.enCaja && !(this.arrastre && this.arrastre.m === m && this.arrastre.movido))]
        .map((f) => [f.tipo, f.p, f.color, f.x, f.y]);
      this.res = M.recalcular(M.crearTablero(piezas));
      this.ganado = this.res.ganado && this.fijas.some((f) => f.tipo === T.ESTRELLA);
      this.dibujar();
    }
    cambio() { if (this.op.alCambiar) this.op.alCambiar(this); }
    // --- ratón (REGLAS §5.2) ---
    queHay(px, py) {
      const x = Math.floor((px - TAB.x) / TAB.c), y = Math.floor((py - TAB.y) / TAB.c);
      if (x >= 0 && x < N && y >= 0 && y < N) return { donde: 'tablero', x, y };
      const i = Math.floor((px - CAJA.x) / CAJA.c), j = Math.floor((py - CAJA.y) / CAJA.c);
      if (i >= 0 && i < CAJA.cols && j >= 0 && j < CAJA.filas) return { donde: 'caja', hueco: j * CAJA.cols + i };
      if (this.op.alPulsarFuera) return { donde: 'fuera', px, py };
      return null;
    }
    movilEn(h) {
      if (!h) return null;
      if (h.donde === 'caja') return this.moviles.find((m) => m.enCaja && m.hueco === h.hueco) || null;
      if (h.donde === 'tablero') return this.moviles.find((m) => !m.enCaja && m.x === h.x && m.y === h.y) || null;
      return null;
    }
    bajar(e) {
      if (this.bloqueado) return;
      const [px, py] = this.punto(e);
      const h = this.queHay(px, py);
      const m = this.movilEn(h);
      if (!m) { if (h && h.donde === 'fuera' && e.button === 0) this.op.alPulsarFuera(px, py); return; }
      this.lienzo.setPointerCapture(e.pointerId);
      this.arrastre = { m, x0: px, y0: py, px, py, boton: e.button, movido: false };
    }
    mover(e) {
      if (!this.arrastre) return;
      const [px, py] = this.punto(e);
      const a = this.arrastre;
      a.px = px; a.py = py;
      if (!a.movido && Math.hypot(px - a.x0, py - a.y0) > 2) { a.movido = true; this.recalcular(); }
      if (a.movido) this.dibujar();
    }
    subir(e) {
      const a = this.arrastre; if (!a) return;
      this.arrastre = null;
      if (!a.movido) {
        a.m.p = (a.m.p + (a.boton === 2 ? 1 : 7)) % 8;     // izquierdo: −45°; derecho: +45°
        this.recalcular(); this.cambio(); return;
      }
      const [px, py] = this.punto(e);
      const h = this.queHay(px, py);
      if (h && h.donde === 'tablero' && !this.piezaEn(h.x, h.y)) { a.m.enCaja = false; a.m.x = h.x; a.m.y = h.y; }
      else if (h && h.donde === 'caja' && !this.moviles.some((m) => m.enCaja && m.hueco === h.hueco)) { a.m.enCaja = true; a.m.hueco = h.hueco; delete a.m.x; delete a.m.y; }
      this.recalcular(); this.cambio();
    }
    // --- código de solución ---
    copiar() { return codigoSolucion(this.numero, this.moviles); }
    pegar(txt) {
      const ocupada = (x, y) => this.fijas.some((f) => f.x === x && f.y === y);
      const nuevo = leerCodigo(txt, this.numero, this.moviles, ocupada);
      if (!nuevo) return false;
      nuevo.forEach((c, i) => { const m = this.moviles[i]; delete m.x; delete m.y; Object.assign(m, c); });
      this.recalcular(); this.cambio(); return true;
    }
    // --- dibujo ---
    dibujar() {
      const ctx = this.ctx; if (!ctx || !this.escala) return;
      ctx.setTransform(this.escala, 0, 0, this.escala, 0, 0);
      pintarFondo(ctx);
      // tablero
      marco(ctx, TAB.x, TAB.y, TAB.c * N, TAB.c * N);
      marco(ctx, CAJA.x, CAJA.y, CAJA.c * CAJA.cols, CAJA.c * CAJA.filas);
      ctx.fillStyle = C.cesped; ctx.fillRect(TAB.x, TAB.y, TAB.c * N, TAB.c * N);
      ctx.strokeStyle = C.rejilla; ctx.lineWidth = 1;
      for (let i = 0; i <= N; i++) {
        ctx.beginPath(); ctx.moveTo(TAB.x + i * TAB.c + 0.5, TAB.y); ctx.lineTo(TAB.x + i * TAB.c + 0.5, TAB.y + N * TAB.c); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(TAB.x, TAB.y + i * TAB.c + 0.5); ctx.lineTo(TAB.x + N * TAB.c, TAB.y + i * TAB.c + 0.5); ctx.stroke();
      }
      if (!this.nivel) { if (this.op.alDibujar) this.op.alDibujar(ctx, this); return; }
      const luz = (x, y) => this.res.entra[y * N + x].reduce((a, b) => a | b, 0);
      for (const f of this.fijas) if (f.tipo === T.PARED) dibujarPared(ctx, ...centro(f.x, f.y), TAB.c);
      dibujarRayos(ctx, this.res);
      for (const f of this.fijas) if (f.tipo !== T.PARED) dibujarPieza(ctx, f, ...centro(f.x, f.y), TAB.c, luz(f.x, f.y));
      const a = this.arrastre && this.arrastre.movido ? this.arrastre : null;
      for (const m of this.moviles) if (!m.enCaja && (!a || a.m !== m)) dibujarPieza(ctx, m, ...centro(m.x, m.y), TAB.c);
      // caja de herramientas
      for (let i = 0; i < CAJA.cols * CAJA.filas; i++) {
        const [cx, cy] = centroHueco(i);
        ctx.fillStyle = C.cajaBorde; ctx.fillRect(cx - 13, cy - 13, 26, 26);
        ctx.fillStyle = C.caja; ctx.fillRect(cx - 12, cy - 12, 24, 24);
      }
      for (const m of this.moviles) if (m.enCaja && (!a || a.m !== m)) dibujarPieza(ctx, m, ...centroHueco(m.hueco), 24);
      if (a) dibujarPieza(ctx, a.m, a.px, a.py, TAB.c);
      if (this.op.alDibujar) this.op.alDibujar(ctx, this);
    }
  }

  // Título con cada letra de un color.
  if (typeof document !== 'undefined') {
    const pintarTitulo = () => {
      const h = document.querySelector('h1'); if (!h || h.dataset.pintado) return;
      const colores = ['#ff3b3b', '#ff9f1c', '#f5c400', '#2ecc71', '#22b8d6', '#3b82f6', '#8b5cf6', '#ec4899'];
      let i = 0; h.dataset.pintado = '1';
      h.innerHTML = [...h.textContent].map((ch) => (ch === ' ' ? ' ' : `<span style="color:${colores[i++ % colores.length]}">${ch}</span>`)).join('');
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintarTitulo); else pintarTitulo();
  }

  globalThis.Cromatron = {
    ANCHO, ALTO, TAB, CAJA, PISTAS, MENSAJE, posNumero, C, RGB, TEXTOS,
    dibujarCuadroPista, pulsarCuadroPista, pintarFondo, marco, dibujarCabecera,
    centro, centroHueco, dibujarPieza, dibujarPared, dibujarRayos, texto, textoEnCaja, numeroTira,
    nivelesAbiertos, codigoSolucion, leerCodigo, cifrar, descifrar, CLAVE, Partida,
  };
})();
