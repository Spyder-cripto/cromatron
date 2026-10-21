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

  const partida = new K.Partida(lienzo, {
    alCambiar: (p) => {
      estado.tableros[estado.actual] = p.colocacion();
      if (p.ganado && !estado.hechos.includes(estado.actual)) estado.hechos.push(estado.actual);
      guardar(); p.dibujar();
    },
    alPulsarFuera: (px, py) => {
      if (K.pulsarCuadroPista(partida, px, py)) return;
      for (let n = 1; n <= niveles.length; n++) {
        const { x, y } = K.posNumero(n);
        if (px >= x - 2 && px < x + 19 && py >= y - 2 && py < y + 17) { if (abiertos().has(n - 1)) ir(n - 1); return; }
      }
      if (py > 462 && px < 140) location.href = 'como-se-juega.html';
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
      K.texto(ctx, 'Cómo se juega', 6, 466, 12, '#1f5fbf');
      ctx.fillStyle = '#1f5fbf'; ctx.fillRect(6, 479, 96, 1);
      K.texto(ctx, suelto ? 'Cromatron · nivel compartido' : vista ? 'Vista previa con tus niveles' : 'Cromatron', 634, 466, 12, vista ? '#b0412f' : K.C.texto, 'right');
    },
  });

  function ir(i) {
    if (!niveles.length) return;
    estado.actual = Math.max(0, Math.min(niveles.length - 1, i));
    guardar();
    partida.cargar(niveles[estado.actual], estado.actual + 1, estado.tableros[estado.actual]);
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
      partida.reiniciar();
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
