(() => {
  const $id = id => document.getElementById(id);
  const current = () => ensure(state.active);
  const ALL_SOCIAL = new Set(['Historia','Geografía','Formación Ética y Ciudadana','Economía']);

  const style = document.createElement('style');
  style.textContent = `
    #copyC5C6,.social-box{display:none!important}
    .bag-filter{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:8px 0 10px}
    .bag-filter button{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:9px;padding:7px 3px;font-size:.62rem;font-weight:900}
    .bag-filter button.active{background:var(--ink);color:#fff;border-color:var(--ink)}
    .drag-handle,.map-grip{font-weight:900;cursor:grab;touch-action:none;user-select:none}
    .map-grip{display:inline-block;margin-right:4px;color:var(--muted)}
    .composition-palette{width:100%;display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:7px;padding-top:7px;border-top:1px solid var(--line)}
    .composition-palette .hint{font-size:.6rem;color:var(--muted);font-weight:700}
    .rule-chip{border:1px dashed var(--ink);background:#fff;border-radius:999px;padding:6px 10px;font-size:.62rem;font-weight:900;cursor:grab;touch-action:none}
    .rule-chip.lab{background:var(--mint-soft)}
    .rule-chip.taller{background:var(--band)}
    .social-config{min-height:48px;border:1.5px dashed var(--mint-dark);border-radius:8px;padding:8px;background:var(--mint-soft);font-size:.56rem;line-height:1.3}
    .social-config strong{display:block;font-size:.62rem;margin-bottom:3px}
    .social-config.ready,.drop.ready{outline:2px solid var(--mint-dark)}
    .drop.format-empty{background:#fffdf5}
    .drop.format-empty:after{content:'Arrastrá LABORATORIO o TALLER para definir este espacio';display:block;margin-top:5px;color:#8a6414;font-size:.48rem;line-height:1.25}
    .drag-ghost{position:fixed;z-index:10000;pointer-events:none;background:#fff;border:1px solid var(--ink);border-radius:9px;padding:7px 10px;max-width:240px;font:700 12px Archivo,Arial,sans-serif;box-shadow:0 8px 24px rgba(18,57,92,.18);transform:translate(10px,10px)}
    .rule-block{background:var(--danger-soft)!important;color:var(--danger)!important;border:1px solid #efb8c4}
    .rule-block strong{display:block;margin-bottom:3px}
  `;
  document.head.appendChild(style);

  const pairTerm = t => t % 2 ? t + 1 : t - 1;
  const levelFromTerm = t => Math.ceil(t / 2);
  const slotInfo = slot => {
    const m = slot && slot.match(/^(.*)-c(\d+)$/);
    if (!m) return null;
    return {key:m[1], term:Number(m[2]), year:levelFromTerm(Number(m[2]))};
  };
  const pairSlot = slot => {
    const i = slotInfo(slot);
    if (!i) return null;
    return `${i.key}-c${pairTerm(i.term)}`;
  };
  const sameSet = (a,b) => a.size === b.size && [...a].every(x => b.has(x));
  const socialAt = slot => new Set((current().placements[slot] || []).map(byId).filter(Boolean).filter(s => SOCIAL.has(s.name) && s.year === 3).map(s => s.name));
  const placedCount = slot => (current().placements[slot] || []).map(byId).filter(Boolean).length;

  function showBlocked(message, resolution='') {
    const box = $id('validation');
    if (box) {
      box.className = 'validation rule-block';
      box.innerHTML = `<strong>Acción no permitida</strong>${esc(message)}${resolution ? `<br><span>${esc(resolution)}</span>` : ''}`;
    }
    toast(message, true);
  }

  function socialOption() {
    const m = current();
    if (!['A','B'].includes(m.socialOption)) m.socialOption = 'A';
    return m.socialOption;
  }

  function socialHasContent() {
    return ['socialA-c5','socialA-c6','socialB-c5','socialB-c6'].some(slot => (current().placements[slot] || []).length);
  }

  function setSocialOption(option) {
    if (!['A','B'].includes(option)) return;
    if (option === socialOption()) return;
    if (socialHasContent()) {
      showBlocked('No se puede cambiar la opción de Ciencias Sociales mientras haya materias ubicadas en los laboratorios de Nivel 3.','Mové o quitá primero esas materias y después cambiá la definición institucional.');
      return;
    }
    current().socialOption = option;
    current().valid = false;
    save();
    renderOffer();
    toast(option === 'A' ? 'Ciencias Sociales Nivel 3: Opción A, 4 materias juntas.' : 'Ciencias Sociales Nivel 3: Opción B, dos agrupamientos 2+2.');
  }

  function foTypes() {
    const m = current();
    m.foTypes = m.foTypes || {'3':{},'4':{}};
    return m.foTypes;
  }
  function foPair(level) { return level === 3 ? [5,6] : [7,8]; }
  function getFoType(level, term) { return foTypes()[String(level)]?.[String(term)] || null; }
  function setFoType(level, term, type) {
    if (![3,4].includes(level) || !['lab','taller'].includes(type)) return;
    const [a,b] = foPair(level), other = term === a ? b : a;
    const key = `foN${level}`;
    if (placedCount(`${key}-c${a}`) || placedCount(`${key}-c${b}`)) {
      showBlocked(`No se puede cambiar el formato de Formación Orientada de ${level}.º con materias ya ubicadas.`,'Mové primero las materias fuera de esos espacios y luego redefiní Laboratorio/Taller.');
      return;
    }
    const all = foTypes();
    all[String(level)] = {};
    all[String(level)][String(term)] = type;
    all[String(level)][String(other)] = type === 'lab' ? 'taller' : 'lab';
    current().valid = false;
    save();
    renderOffer();
    toast(`Nivel ${level}: ${type === 'lab' ? 'Laboratorio' : 'Taller'} en C${term}; el formato complementario quedó en C${other}.`);
  }

  function encodePayload(payload) {
    if (payload.kind === 'subject') return `subject:${encodeURIComponent(payload.id)}`;
    if (payload.kind === 'move') return `move:${encodeURIComponent(payload.from)}:${encodeURIComponent(payload.id)}`;
    if (payload.kind === 'format') return `format:${payload.type}`;
    if (payload.kind === 'social-option') return `social-option:${payload.option}`;
    return '';
  }
  function decodePayload(raw) {
    if (!raw) return null;
    if (raw.startsWith('subject:')) return {kind:'subject', id:decodeURIComponent(raw.slice(8))};
    if (raw.startsWith('move:')) {
      const rest = raw.slice(5), idx = rest.indexOf(':');
      if (idx < 0) return null;
      return {kind:'move', from:decodeURIComponent(rest.slice(0,idx)), id:decodeURIComponent(rest.slice(idx+1))};
    }
    if (raw.startsWith('format:')) return {kind:'format', type:raw.slice(7)};
    if (raw.startsWith('social-option:')) return {kind:'social-option', option:raw.slice(14)};
    return {kind:'subject', id:raw};
  }

  function bindTouchDrag(handle, payload, text) {
    if (!handle) return;
    handle.onpointerdown = e => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      e.preventDefault();
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = text;
      document.body.appendChild(ghost);
      const move = ev => { ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`; };
      const cleanup = () => { ghost.remove(); handle.removeEventListener('pointermove',move); handle.removeEventListener('pointerup',up); handle.removeEventListener('pointercancel',cancel); };
      const up = ev => {
        const target = document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-slot],[data-social-config]');
        cleanup();
        if (target) dropPayload(target,payload);
      };
      const cancel = () => cleanup();
      move(e);
      handle.setPointerCapture?.(e.pointerId);
      handle.addEventListener('pointermove',move);
      handle.addEventListener('pointerup',up);
      handle.addEventListener('pointercancel',cancel);
    };
  }

  item = function(s) {
    const u = usage(s.id), cls = u.size >= 2 ? 'complete' : u.size === 1 ? 'partial' : '';
    return `<div class="subject ${u.size >= 2 ? 'used-two' : ''}" draggable="true" data-sub="${esc(s.id)}"><span class="drag-handle">⠿</span><span><strong>${esc(s.name)} · ${s.year}.º</strong><small>${s.origin === 'FO' ? 'Formación Orientada' : s.origin === 'CUSTOM' ? 'Materia agregada' : 'Formación General'}</small></span><span class="usage ${cls}">${usageLabel(s)}</span></div>`;
  };

  renderBag = function() {
    const box = $id('bagContent'), m = current();
    m.bagYear = Number(m.bagYear) || 1;
    const y = m.bagYear, d = DATA.formacion_orientada[state.active] || {};
    let html = `<div class="subhead">Formación General · filtrar por año</div><div class="bag-filter">${[1,2,3,4,5].map(n => `<button type="button" data-bag-year="${n}" class="${n === y ? 'active' : ''}">${n}.º</button>`).join('')}</div>`;
    html += `<section class="year"><div class="year-head"><strong>${y}.º año · Formación General</strong><span>C${y*2-1} / C${y*2}</span></div>${fg().filter(s => s.year === y && s.origin === 'FG').map(item).join('')}</section>`;
    if (y >= 3) {
      html += `<section class="year"><div class="year-head"><strong>${y}.º año · Formación Orientada</strong><span>PCI ${esc(state.active)}</span></div>`;
      if (!d.sinAlternativas) html += `<div class="modes"><button data-alt="A" class="${m.alt === 'A' ? 'active' : ''}">Alternativa A</button><button data-alt="B" class="${m.alt === 'B' ? 'active' : ''}">Alternativa B</button></div>`;
      html += `${fo().filter(s => s.year === y).map(item).join('')}</section>`;
    }
    const custom = m.custom.filter(s => s.year === y);
    if (custom.length) html += `<section class="year"><div class="subhead">Materias agregadas · ${y}.º</div>${custom.map(item).join('')}</section>`;
    box.innerHTML = html;
    box.querySelectorAll('[data-bag-year]').forEach(b => b.onclick = () => { m.bagYear = Number(b.dataset.bagYear); save(); renderBag(); });
    box.querySelectorAll('[data-alt]').forEach(b => b.onclick = () => { m.alt = b.dataset.alt; m.valid = false; save(); renderOffer(); });
    box.querySelectorAll('[data-sub]').forEach(el => {
      const id = el.dataset.sub, s = byId(id);
      el.ondragstart = e => e.dataTransfer.setData('text/plain', encodePayload({kind:'subject',id}));
      bindTouchDrag(el.querySelector('.drag-handle'), {kind:'subject',id}, s?.name || id);
    });
  };

  placed = function(slot) {
    return (current().placements[slot] || []).map(id => {
      const s = byId(id); if (!s) return '';
      return `<div class="placed ${s.origin === 'FO' ? 'fo' : s.origin === 'CUSTOM' ? 'custom' : ''}" draggable="true" data-map-id="${esc(id)}" data-from="${esc(slot)}"><span class="map-grip">⠿</span>${esc(s.name)}<button data-rm="${esc(id)}" data-slot="${esc(slot)}">×</button></div>`;
    }).join('');
  };

  rowDefs = function() {
    const rows = [
      {k:'lengua',l:'Lengua y Literatura',annual:true},
      {k:'matematica',l:'Matemática',annual:true},
      {k:'adicional',l:'Lengua Adicional',annual:true},
      {k:'naturales',l:'Laboratorios · Ciencias Naturales',a:t=>true},
      {k:'socialConfig',l:'Definición · Ciencias Sociales Nivel 3',socialConfig:true},
      {k:'socialA',l:'Laboratorios · Ciencias Sociales',a:t=>true}
    ];
    if (socialOption() === 'B') rows.push({k:'socialB',l:'Ciencias Sociales · segundo laboratorio',a:t=>t===5||t===6});
    rows.push(
      {k:'artes',l:'Talleres · Artes',a:t=>ARTS.has(t)},
      {k:'tecnologias',l:'Talleres · Tecnologías',a:t=>t>=1&&t<=8},
      {k:'ef',l:'Talleres · Educación Física',a:t=>true},
      {k:'foN3',l:'Formación Orientada · Nivel 3',a:t=>t===5||t===6},
      {k:'foN4',l:'Formación Orientada · Nivel 4',a:t=>t===7||t===8},
      {k:'foLab5',l:'FO · Laboratorios · Nivel 5',a:t=>t===9||t===10},
      {k:'foTaller5',l:'FO · Talleres · Nivel 5',a:t=>t===9||t===10},
      {k:'proyecto',l:'Proyecto de Vinculación con el Futuro',annualLevel:5},
      {k:'otros',l:'Otros formatos pedagógicos',a:t=>true}
    );
    return rows;
  };

  const baseLabel = label;
  label = function(k,t) {
    if (k === 'foN3' || k === 'foN4') {
      const level = Number(k.slice(-1)), type = getFoType(level,t);
      return type ? `${type === 'lab' ? 'Laboratorio FO' : 'Taller FO'} · C${t}` : `Espacio FO · C${t}`;
    }
    if (k === 'foLab5') return `Laboratorio FO · C${t}`;
    if (k === 'foTaller5') return `Taller FO · C${t}`;
    if (k === 'socialB') return `Laboratorio Social B · C${t}`;
    return baseLabel(k,t);
  };

  function activeDestination(slot) {
    const i = slotInfo(slot); if (!i) return true;
    const row = rowDefs().find(r => r.k === i.key);
    return !!row && (row.a ? row.a(i.term) : true);
  }

  const baseValidTarget = validTarget;
  validTarget = function(slot,s) {
    if (slot === 'proyecto-n5') {
      if (s.year !== 5) return [false,'El Proyecto de Vinculación corresponde al Nivel 5.'];
      return [s.origin === 'FO','El Proyecto de Vinculación recibe espacios curriculares de Formación Orientada de 5.º.'];
    }
    const i = slotInfo(slot);
    if (!i) return baseValidTarget(slot,s);
    if (s.year && s.year !== i.year) return [false,`No se puede ubicar ${s.name} de ${s.year}.º en un espacio de ${i.year}.º.`];
    if (!activeDestination(slot)) return [false,'Ese destino no forma parte de la estructura prescripta para este nivel.'];

    if (i.key === 'tecnologias' && i.term > 8) return [false,'Tecnologías se distribuye en C1-C8. En 5.º, Tecnología orientada forma parte de los Talleres de la Orientación.'];

    if (i.key === 'socialA' || i.key === 'socialB') {
      if (s.origin !== 'FG' || !SOCIAL.has(s.name)) return [false,'Los laboratorios de Ciencias Sociales reciben las materias FG sociales del mismo año. Las integraciones con FO se realizan moviendo una materia ya ubicada desde un espacio de la Orientación.'];
      if (i.year === 3) {
        const max = socialOption() === 'A' ? 4 : 2;
        if (i.key === 'socialB' && socialOption() !== 'B') return [false,'El segundo laboratorio de Sociales solo existe cuando la escuela define la Opción B (2+2).'];
        if (socialAt(slot).size >= max) return [false, socialOption() === 'A' ? 'La Opción A de Sociales de 3.º se conforma con las cuatro materias en un único laboratorio por cuatrimestre.' : 'La Opción B de Sociales de 3.º admite exactamente dos materias en cada laboratorio.'];
      }
    }

    if (i.key === 'naturales') {
      if (s.origin !== 'FG' || !NATURAL.has(s.name)) return [false,'Los laboratorios de Ciencias Naturales reciben materias FG de Ciencias Naturales del mismo año. Las integraciones con FO se realizan moviendo una materia ya ubicada desde un espacio de la Orientación.'];
    }

    if (i.key === 'foN3' || i.key === 'foN4') {
      const level = Number(i.key.slice(-1));
      if (!getFoType(level,i.term)) return [false,'Primero definí por drag & drop si este espacio FO es Laboratorio o Taller.'];
      return [s.origin === 'FO','Este espacio recibe materias/materializaciones de Formación Orientada del mismo año.'];
    }

    if (i.key === 'foLab5' || i.key === 'foTaller5') return [s.origin === 'FO','Este espacio recibe materias/materializaciones de Formación Orientada de 5.º.'];
    if (i.key === 'otros') {
      const c = classify(s);
      return [c === 'otros','Otros formatos pedagógicos recibe EDI, Tutoría o espacios agregados por la escuela.'];
    }
    return baseValidTarget(slot,s);
  };

  function addPair(slot,id) {
    const pair = pairSlot(slot), p = current().placements;
    p[slot] = p[slot] || [];
    if (!p[slot].includes(id)) p[slot].push(id);
    if (pair && activeDestination(pair)) {
      p[pair] = p[pair] || [];
      if (!p[pair].includes(id)) p[pair].push(id);
    }
  }

  function removePair(slot,id) {
    const pair = pairSlot(slot), p = current().placements;
    p[slot] = (p[slot] || []).filter(x => x !== id);
    if (pair) p[pair] = (p[pair] || []).filter(x => x !== id);
  }

  function validatePairTarget(slot,s) {
    const a = validTarget(slot,s);
    if (!a[0]) return a;
    const pair = pairSlot(slot);
    if (!pair || !activeDestination(pair)) return [true,''];
    if ((current().placements[pair] || []).includes(s.id)) return [true,''];
    const b = validTarget(pair,s);
    return b[0] ? [true,''] : b;
  }

  assign = function(slot,id) {
    const s = byId(id); if (!s) return;
    const check = validatePairTarget(slot,s);
    if (!check[0]) { showBlocked(check[1]); return; }
    addPair(slot,id);
    current().valid = false;
    picked = null;
    save();
    renderOffer();
    const i = slotInfo(slot);
    toast(i ? `${s.name} quedó ubicada en C${i.term} y replicada visualmente en C${pairTerm(i.term)}.` : `${s.name} ubicada en el espacio anual.`);
  };

  removeOne = function(slot,id) {
    removePair(slot,id);
    current().valid = false;
    save();
    renderOffer();
  };

  function minFoComponents(slot) {
    if (slot.startsWith('foN3-c')) return 1;
    if (slot.startsWith('foN4-c')) return 2;
    if (slot.startsWith('foLab5-c') || slot.startsWith('foTaller5-c')) return 2;
    return 0;
  }

  function canRemoveFromFoPair(source,id) {
    const slots = [source, pairSlot(source)].filter(Boolean);
    for (const slot of slots) {
      const min = minFoComponents(slot);
      if (!min) continue;
      const after = (current().placements[slot] || []).filter(x => x !== id).map(byId).filter(Boolean).length;
      if (after < min) {
        const i = slotInfo(slot);
        if (i?.year === 3) return [false,`No se puede integrar esta materia porque el espacio FO de C${i.term} quedaría vacío. En 3.º una sola materia es válida, pero el espacio mínimo prescripto no puede desaparecer.`];
        return [false,`No se puede integrar esta materia porque el espacio FO de C${i?.term || ''} quedaría con ${after} materia${after===1?'':'s'} y necesita al menos ${min}.`];
      }
    }
    return [true,''];
  }

  function isFgLab(slot) {
    return /^(naturales|socialA|socialB)-c\d+$/.test(slot);
  }
  function isFoLabOrWorkshop(slot) {
    return /^(foN3|foN4|foLab5|foTaller5)-c\d+$/.test(slot);
  }

  function canIntegrate(source,target,s) {
    if (!isFoLabOrWorkshop(source) || !isFgLab(target)) return [false,'La integración FG + FO se realiza moviendo una materia desde un Laboratorio/Taller de la Orientación hacia un Laboratorio de Ciencias Sociales o Ciencias Naturales.'];
    const from = slotInfo(source), to = slotInfo(target);
    if (!from || !to || from.year !== to.year || s.year !== to.year) return [false,'La integración solo puede realizarse entre espacios curriculares del mismo año de estudio.'];
    if (to.year < 3) return [false,'Los laboratorios integrados FG + FO se habilitan a partir de 3.º año.'];
    const src = canRemoveFromFoPair(source,s.id);
    if (!src[0]) return src;
    return [true,''];
  }

  function movePair(source,target,id) {
    const s = byId(id); if (!s || source === target) return;
    if (isFgLab(target) && s.origin === 'FO') {
      const integrated = canIntegrate(source,target,s);
      if (!integrated[0]) { showBlocked(integrated[1],'La articulación se habilita únicamente si se preservan todos los espacios mínimos y la conformación mínima de cada espacio.'); return; }
      const p = current().placements;
      const old = {};
      [source,pairSlot(source),target,pairSlot(target)].filter(Boolean).forEach(slot => old[slot] = [...(p[slot] || [])]);
      removePair(source,id);
      p[target] = p[target] || [];
      if (!p[target].includes(id)) p[target].push(id);
      const tp = pairSlot(target);
      if (tp) { p[tp] = p[tp] || []; if (!p[tp].includes(id)) p[tp].push(id); }
      current().valid = false;
      save();
      renderOffer();
      toast(`${s.name} quedó integrada al laboratorio FG y dejó su asignación en el espacio FO de origen.`);
      return;
    }

    const p = current().placements;
    const srcPair = pairSlot(source), dstPair = pairSlot(target);
    const snapshots = {};
    [source,srcPair,target,dstPair].filter(Boolean).forEach(slot => snapshots[slot] = [...(p[slot] || [])]);
    removePair(source,id);
    const check = validatePairTarget(target,s);
    Object.entries(snapshots).forEach(([slot,ids]) => p[slot] = ids);
    if (!check[0]) { showBlocked(check[1]); return; }
    removePair(source,id);
    addPair(target,id);
    current().valid = false;
    save();
    renderOffer();
    toast(`${s.name} movida; la ubicación anual se actualizó en ambos cuatrimestres.`);
  }

  function dropPayload(target,payload) {
    if (!payload) return;
    if (target.dataset.socialConfig) {
      if (payload.kind !== 'social-option') { showBlocked('En esta zona solo se define la opción institucional de Ciencias Sociales de Nivel 3.'); return; }
      setSocialOption(payload.option); return;
    }
    const slot = target.dataset.slot;
    if (!slot) return;
    if (payload.kind === 'format') {
      const m = slot.match(/^foN([34])-c(\d+)$/);
      if (!m) { showBlocked('LABORATORIO/TALLER solo puede soltarse sobre los espacios FO de Nivel 3 o 4.'); return; }
      setFoType(Number(m[1]),Number(m[2]),payload.type); return;
    }
    if (payload.kind === 'social-option') { showBlocked('La opción de Ciencias Sociales debe soltarse en la fila “Definición · Ciencias Sociales Nivel 3”.'); return; }
    if (payload.kind === 'subject') { assign(slot,payload.id); return; }
    if (payload.kind === 'move') { movePair(payload.from,slot,payload.id); }
  }

  renderMatrix = function() {
    let html = '<div class="grid levels"><div></div>';
    for (let y=1;y<=5;y++) html += `<div class="level">Nivel ${y}</div>`;
    html += '</div><div class="grid"><div class="term">Espacio</div>';
    for (let t=1;t<=10;t++) html += `<div class="term">C${t}</div>`;
    html += '</div>';

    for (const r of rowDefs()) {
      html += `<div class="grid"><div class="rowlabel">${esc(r.l)}</div>`;
      if (r.annual) {
        for (let y=1;y<=5;y++) {
          const slot = `${r.k}-n${y}`;
          html += `<div class="cell annual"><div class="drop" data-slot="${slot}"><strong>C${y*2-1}+C${y*2}</strong>${placed(slot)}</div></div>`;
        }
      } else if (r.annualLevel) {
        for (let y=1;y<=5;y++) {
          if (y === r.annualLevel) {
            const slot = `${r.k}-n${y}`;
            html += `<div class="cell annual"><div class="drop" data-slot="${slot}"><strong>Anual · C${y*2-1}+C${y*2}</strong>${placed(slot)}</div></div>`;
          } else html += '<div class="cell inactive">—</div><div class="cell inactive">—</div>';
        }
      } else if (r.socialConfig) {
        for (let y=1;y<=5;y++) {
          if (y === 3) {
            const opt = socialOption();
            html += `<div class="cell annual"><div class="social-config" data-social-config="1"><strong>${opt === 'A' ? 'Opción A · 4 juntas' : 'Opción B · 2 + 2'}</strong>${opt === 'A' ? 'Un laboratorio en C5 y otro en C6, con las mismas cuatro materias.' : 'Dos laboratorios en C5 y dos en C6; cada pareja se replica en el segundo cuatrimestre.'}</div></div>`;
          } else html += '<div class="cell inactive">—</div><div class="cell inactive">—</div>';
        }
      } else {
        for (let t=1;t<=10;t++) {
          if (r.a(t)) {
            const slot = `${r.k}-c${t}`;
            const typeEmpty = (r.k === 'foN3' || r.k === 'foN4') && !getFoType(Number(r.k.slice(-1)),t);
            html += `<div class="cell"><div class="drop ${typeEmpty ? 'format-empty' : ''}" data-slot="${slot}"><strong>${label(r.k,t)}</strong>${placed(slot)}</div></div>`;
          } else html += '<div class="cell inactive">—</div>';
        }
      }
      html += '</div>';
    }

    $id('matrix').innerHTML = html;
    $id('matrix').querySelectorAll('[data-slot],[data-social-config]').forEach(z => {
      z.ondragover = e => { e.preventDefault(); e.stopPropagation(); z.classList.add('ready'); };
      z.ondragleave = () => z.classList.remove('ready');
      z.ondrop = e => { e.preventDefault(); e.stopPropagation(); z.classList.remove('ready'); dropPayload(z,decodePayload(e.dataTransfer.getData('text/plain'))); };
    });
    $id('matrix').querySelectorAll('[data-rm]').forEach(b => b.onclick = e => { e.stopPropagation(); removeOne(b.dataset.slot,b.dataset.rm); });
    $id('matrix').querySelectorAll('[data-map-id]').forEach(el => {
      const id = el.dataset.mapId, from = el.dataset.from, s = byId(id);
      el.ondragstart = e => e.dataTransfer.setData('text/plain',encodePayload({kind:'move',from,id}));
      bindTouchDrag(el.querySelector('.map-grip'),{kind:'move',from,id},s?.name || id);
    });
  };

  function validateSocial3() {
    const A5 = socialAt('socialA-c5'), A6 = socialAt('socialA-c6'), B5 = socialAt('socialB-c5'), B6 = socialAt('socialB-c6');
    if (socialOption() === 'A') {
      const ok = sameSet(A5,ALL_SOCIAL) && sameSet(A6,ALL_SOCIAL) && B5.size === 0 && B6.size === 0;
      return ok ? [true,''] : [false,'Ciencias Sociales de 3.º · Opción A: C5 y C6 deben contener las cuatro materias juntas.'];
    }
    const ok = A5.size === 2 && A6.size === 2 && B5.size === 2 && B6.size === 2 && sameSet(new Set([...A5,...B5]),ALL_SOCIAL) && sameSet(new Set([...A6,...B6]),ALL_SOCIAL) && sameSet(A5,A6) && sameSet(B5,B6);
    return ok ? [true,''] : [false,'Ciencias Sociales de 3.º · Opción B: deben quedar dos laboratorios 2+2 en C5 y las mismas dos parejas en C6.'];
  }

  function validateFoMinimums() {
    const checks = [
      ['foN3-c5',1],['foN3-c6',1],
      ['foN4-c7',2],['foN4-c8',2],
      ['foLab5-c9',2],['foLab5-c10',2],
      ['foTaller5-c9',2],['foTaller5-c10',2]
    ];
    for (const [slot,min] of checks) {
      const n = placedCount(slot), i = slotInfo(slot);
      if (n < min) {
        if (i?.year === 3) return [false,`Formación Orientada de 3.º: el espacio de C${i.term} puede quedar con una sola materia, pero no puede quedar vacío.`];
        return [false,`Formación Orientada de ${i?.year || ''}.º: el espacio de C${i?.term || ''} necesita al menos ${min} materias y actualmente tiene ${n}.`];
      }
    }
    if (placedCount('proyecto-n5') < 1) return [false,'Proyecto de Vinculación con el Futuro: falta conformar el espacio anual de 5.º.'];
    return [true,''];
  }

  validateSocial = function() {
    const v = validateSocial3();
    return {ok:v[0],msg:v[0] ? 'Ciencias Sociales de Nivel 3 respeta la definición institucional y la réplica anual.' : v[1]};
  };
  renderSocial = function() {};

  validateOffer = function() {
    const social = validateSocial3();
    if (!social[0]) { showBlocked(social[1]); return; }
    const fo = validateFoMinimums();
    if (!fo[0]) { showBlocked(fo[1]); return; }
    current().valid = true;
    save();
    renderOffer();
    toast('Mapa de la Oferta validado. Se conservaron los espacios mínimos prescriptos.');
  };

  function renderCompositionPalette() {
    const toolbar = document.querySelector('.matrix-toolbar'); if (!toolbar) return;
    let box = $id('compositionPalette');
    if (!box) { box = document.createElement('div'); box.id = 'compositionPalette'; box.className = 'composition-palette'; toolbar.appendChild(box); }
    box.innerHTML = `
      <span class="hint">Arrastrá dentro del mapa:</span>
      <span class="rule-chip" draggable="true" data-social-option="A">⠿ SOCIALES N3 · 4 JUNTAS</span>
      <span class="rule-chip" draggable="true" data-social-option="B">⠿ SOCIALES N3 · 2 + 2</span>
      <span class="rule-chip lab" draggable="true" data-format="lab">⠿ LABORATORIO FO</span>
      <span class="rule-chip taller" draggable="true" data-format="taller">⠿ TALLER FO</span>
    `;
    box.querySelectorAll('[data-social-option]').forEach(el => {
      const option = el.dataset.socialOption;
      el.ondragstart = e => e.dataTransfer.setData('text/plain',encodePayload({kind:'social-option',option}));
      bindTouchDrag(el,{kind:'social-option',option},option === 'A' ? 'Sociales N3 · 4 juntas' : 'Sociales N3 · 2+2');
    });
    box.querySelectorAll('[data-format]').forEach(el => {
      const type = el.dataset.format;
      el.ondragstart = e => e.dataTransfer.setData('text/plain',encodePayload({kind:'format',type}));
      bindTouchDrag(el,{kind:'format',type},type === 'lab' ? 'Laboratorio FO' : 'Taller FO');
    });
  }

  const baseRenderOffer = renderOffer;
  renderOffer = function() {
    baseRenderOffer();
    renderCompositionPalette();
  };

  const modal = $id('rulesModal');
  if (modal) {
    modal.innerHTML = `<div class="modal-box"><div class="row" style="justify-content:space-between"><h2>Reglas de composición</h2><button id="closeRulesV19" class="btn">Cerrar</button></div>
      <div class="rule"><strong>Principio estructural:</strong> ninguna decisión de composición o integración puede reducir los espacios mínimos prescriptos ni dejar un espacio obligatorio con una conformación inválida.</div>
      <div class="rule"><strong>Bloqueo explicado:</strong> cuando un drop viola una regla, se rechaza y se informa qué regla se rompería y, cuando corresponde, cómo resolverlo.</div>
      <div class="rule"><strong>Materias anuales en formatos cuatrimestrales:</strong> al ubicar una materia en un cuatrimestre, se replica visualmente en el otro cuatrimestre del mismo nivel y en el mismo agrupamiento. Los dos laboratorios/talleres siguen siendo espacios cuatrimestrales separados.</div>
      <div class="rule"><strong>Año de pertenencia:</strong> una materia solo puede formar parte de espacios correspondientes a su mismo año. Una materia de 1.º no puede ubicarse en 5.º.</div>
      <div class="rule"><strong>Ciencias Sociales de 3.º:</strong> Opción A = dos laboratorios en el año, uno por cuatrimestre, cada uno con Historia + Geografía + FEC + Economía. Opción B = cuatro laboratorios, dos por cuatrimestre, con agrupamientos 2+2; las mismas parejas se sostienen en ambos cuatrimestres.</div>
      <div class="rule"><strong>Laboratorios integrados FG + FO:</strong> desde 3.º puede integrarse una materia/espacio de la Orientación a un laboratorio FG de Sociales o Naturales del mismo año, pero solo si el movimiento no rompe los espacios mínimos prescriptos ni deja inválido el espacio FO de origen.</div>
      <div class="rule"><strong>Excepción FO de 3.º:</strong> un Laboratorio/Taller de la Orientación de 3.º puede quedar conformado por una sola materia. Lo que no puede ocurrir es que una articulación deje vacío ese espacio mínimo obligatorio.</div>
      <div class="rule"><strong>FO de 4.º y 5.º:</strong> los laboratorios y talleres deben quedar conformados por al menos dos espacios curriculares del mismo año.</div>
      <div class="rule"><strong>Laboratorios FG:</strong> no pueden quedar conformados por una sola materia salvo las excepciones previstas por el plan de estudios. Ciencias Sociales de 5.º es una excepción expresa; en Ciencias Naturales de 3.º no se admite una sola materia.</div>
      <div class="rule"><strong>Carga máxima:</strong> los laboratorios integrados y los laboratorios en general no pueden superar 9 horas cátedra, con las excepciones normativas correspondientes. La hora es metadato interno y no se muestra en la bolsa.</div>
      <div class="rule"><strong>Tecnologías:</strong> 8 talleres: dos en 1.º, dos en 2.º, dos en 3.º y dos en 4.º. Tecnología orientada de 5.º forma parte de los Talleres de la Orientación.</div>
      <div class="rule"><strong>Formación Orientada:</strong> 4 laboratorios (1 en 3.º, 1 en 4.º, 2 en 5.º) y 4 talleres (1 en 3.º, 1 en 4.º, 2 en 5.º).</div>
      <div class="rule"><strong>Proyecto de Vinculación con el Futuro:</strong> es un único espacio anual en 5.º y abarca C9+C10.</div>
      <div class="rule"><strong>Drag & drop:</strong> la composición se realiza arrastrando materias, formatos y decisiones estructurales dentro del mapa. Los elementos ya ubicados también pueden moverse mediante drag & drop.</div>
    </div>`;
    $id('closeRulesV19').onclick = () => modal.classList.remove('open');
  }
})();
