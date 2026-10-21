// Cromatron · el juego: niveles de Fali (niveles.js), tira de niveles, pistas, teclado y partida guardada.
'use strict';
(function () {
  const K = globalThis.Cromatron;
  const GUARDA = new URLSearchParams(location.search).get('vista') === 'editor' ? 'cromatron-partida-vista' : 'cromatron-partida-v1';
  const lienzo = document.getElementById('lienzo');

  // Un nivel suelto compartido por enlace (#nivel=…) se juega aparte, sin tocar la partida.
  const suelto = location.hash.startsWith('#nivel=') ? leerSuelto(location.hash.slice(7)) : null;
  // Vista previa desde el editor: los niveles guardados en el editor de este navegador (no los publicados).
  const vista = !suelto && new URLSearchParams(location.search).get('vista') === 'editor';
  const niveles = suelto ? [suelto] : vista ? nivelesDelEditor() : ((globalThis.CROMATRON_NIVELES || {}).niveles || []).slice(0, 50);

  if (vista) { const v = document.getElementById('volverEditor'); if (v) v.hidden = false; }

  function nivelesDelEditor() {
    const Mo = globalThis.CromatronMotor;
    let d = {};
    try { d = JSON.parse(localStorage.getItem('cromatron-editor-v1') || '{}'); } catch (e) { /* sin guardado */ }
    return convertir(d.niveles || []);
  }
  function convertir(lista) {
    const Mo = globalThis.CromatronMotor;
    return lista.slice(0, 50).map((nv) => ({
      nombre: nv.nombre || '', pista: nv.pista || '',
      sol: K.cifrar(nv.piezas.filter((f) => Mo.MOVILES.has(f[0])).map((f) => f.slice(0, 5)), K.CLAVE),
      fijas: nv.piezas.filter((f) => !Mo.MOVILES.has(f[0])),
      caja: nv.piezas.filter((f) => Mo.MOVILES.has(f[0])).map((f) => [f[0], f[0] === Mo.T.FILTRO ? f[2] : 0]),
    }));
  }

  function leerSuelto(txt) {
    try {
      const n = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(txt.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
      if (Array.isArray(n.fijas) && Array.isArray(n.caja)) return { nombre: n.nombre || '', pista: n.pista || '', fijas: n.fijas, caja: n.caja };
    } catch (e) { /* enlace roto: se ignora */ }
    return null;
  }

  let estado = { hechos: [], actual: 0, tableros: {} };
  if (!suelto) {
    try { estado = Object.assign(estado, JSON.parse(localStorage.getItem(GUARDA) || '{}')); } catch (e) { /* sin guardado */ }
  }
  const guardar = () => { if (suelto) return; try { localStorage.setItem(GUARDA, JSON.stringify(estado)); } catch (e) { /* navegador sin guardado */ } };
  const hechos = () => new Set(estado.hechos);
  const abiertos = () => K.nivelesAbiertos(niveles.length, hechos());

  let ganadoAntes = false;
  const partida = new K.Partida(lienzo, {
    alCambiar: (p) => {
      // Fanfarria al pasar a «¡Logrado!» por una jugada del jugador (no con el botón «Solución»).
      if (p.ganado && !ganadoAntes && !p.conSolucion) K.fanfarria();
      ganadoAntes = p.ganado;
      estado.tableros[estado.actual] = p.colocacion();
      // Un nivel resuelto con el botón «Solución» no cuenta como superado.
      if (p.ganado && !p.conSolucion && !estado.hechos.includes(estado.actual)) estado.hechos.push(estado.actual);
      guardar(); p.dibujar();
    },
    alPulsarFuera: (px, py) => {
      if (K.pulsarCuadroPista(partida, px, py)) return;
      for (let n = 1; n <= niveles.length; n++) {
        const { x, y } = K.posNumero(n);
        if (px >= x && px < x + 36 && py >= y - 3 && py < y + 26) { if (abiertos().has(n - 1)) ir(n - 1); return; }
      }
      if (py > 525 && px > 440) location.href = 'como-se-juega.html';
    },
    alDibujar: (ctx, p) => {
      const h = hechos(), ab = abiertos();
      for (let n = 1; n <= niveles.length; n++) {
        const i = n - 1;
        K.numeroTira(ctx, n, i === estado.actual ? 'actual' : h.has(i) ? 'hecho' : ab.has(i) ? 'abierto' : 'cerrado');
      }
      const P = K.PISTAS;
      if (!niveles.length) K.textoEnCaja(ctx, vista ? 'Todavía no has guardado niveles en el editor de este navegador.' : 'Todavía no hay niveles.', P.x0, P.y0, P.x1, 12, K.C.texto);
      else K.dibujarCuadroPista(ctx, p);
      K.dibujarCabecera(ctx, p, h.has(estado.actual));
      // «Cómo se juega», abajo a la derecha y con la letra del nombre del nivel (Fali).
      K.texto(ctx, 'Cómo se juega', 634, 530, 22, '#1f5fbf', 'right');
      ctx.fillStyle = '#1f5fbf'; ctx.fillRect(634 - ctx.measureText('Cómo se juega').width, 555, ctx.measureText('Cómo se juega').width, 1.5);
      if (suelto || vista) K.texto(ctx, suelto ? 'Nivel compartido' : 'Vista previa con tus niveles', 60, 3, 11, '#b0412f', 'left');
    },
  });

  function ir(i) {
    if (!niveles.length) return;
    estado.actual = Math.max(0, Math.min(niveles.length - 1, i));
    guardar(); partida.conSolucion = false;
    partida.cargar(niveles[estado.actual], estado.actual + 1, estado.tableros[estado.actual]);
    ganadoAntes = partida.ganado;
  }

  // Botones «Reiniciar» y «Solución» (decisión de Fali, para el móvil y el ordenador).
  const bReiniciar = document.getElementById('reiniciar'), bSolucion = document.getElementById('solucion');
  if (bReiniciar) bReiniciar.onclick = () => { partida.conSolucion = false; partida.reiniciar(); };
  if (bSolucion) {
    let aviso = 0;
    bSolucion.onclick = () => {
      const nv = partida.nivel; if (!nv || !nv.sol) return;
      if (!aviso) {
        bSolucion.textContent = '¿Ver la solución? Pulsa otra vez'; bSolucion.classList.add('aviso');
        aviso = setTimeout(() => { aviso = 0; bSolucion.textContent = 'Solución'; bSolucion.classList.remove('aviso'); }, 4000);
        return;
      }
      clearTimeout(aviso); aviso = 0; bSolucion.textContent = 'Solución'; bSolucion.classList.remove('aviso');
      mostrarSolucion(nv);
    };
  }
  function mostrarSolucion(nv) {
    let sol;
    try { sol = K.descifrar(nv.sol, K.CLAVE); } catch (e) { return; }
    // Cada pieza de la caja va a la casilla de una pieza igual (tipo y, en los filtros, color) de la solución.
    const libres = sol.map((f) => ({ f, usada: false }));
    for (const m of partida.moviles) {
      const s = libres.find((x) => !x.usada && x.f[0] === m.tipo && (m.tipo !== globalThis.CromatronMotor.T.FILTRO || x.f[2] === m.color));
      if (!s) continue;
      s.usada = true;
      Object.assign(m, { enCaja: false, x: s.f[3], y: s.f[4], p: s.f[1] }); delete m.hueco;
    }
    partida.conSolucion = true;
    partida.recalcular(); partida.cambio();
  }

  // Teclado (REGLAS §5.3)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ' || e.key === '+' || e.key === '=') {
      e.preventDefault();
      if (abiertos().has(estado.actual + 1) && estado.actual + 1 < niveles.length) ir(estado.actual + 1);
    } else if (e.key === '-') {
      if (estado.actual > 0) ir(estado.actual - 1);         // como el original: sin mirar si está abierto
    } else if (e.key === 'r') {
      partida.conSolucion = false; partida.reiniciar();
    }
  });
  document.addEventListener('copy', (e) => { if (!partida.nivel) return; e.clipboardData.setData('text/plain', partida.copiar()); e.preventDefault(); });
  document.addEventListener('paste', (e) => { if (!partida.nivel) return; partida.pegar(e.clipboardData.getData('text/plain')); e.preventDefault(); });

  function empezar() {
    partida.ajustar();
    if (niveles.length) ir(Math.min(estado.actual || 0, niveles.length - 1)); else partida.dibujar();
  }
  if (vista) {
    // En la vista previa, los niveles del fichero del PC (los mismos en todos los navegadores), si el servidor lo permite.
    fetch('api/editor', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d && Array.isArray(d.niveles) && d.niveles.length) niveles.splice(0, niveles.length, ...convertir(d.niveles));
    }).catch(() => {}).finally(empezar);
  } else empezar();
})();
