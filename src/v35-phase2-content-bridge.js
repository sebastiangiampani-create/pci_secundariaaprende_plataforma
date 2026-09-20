(() => {
  const nativeFetch = window.fetch.bind(window);
  const fgPattern = /(?:^|\/)Matriz-PCI-Completa\/data\/(db[1-4]\.txt|rest[1-5]\.txt)(?:[?#].*)?$/i;
  const orientationPattern = /(?:^|\/)data\/orientaciones\/([^/?#]+\.txt)(?:[?#].*)?$/i;
  const fgRemoteBase = 'https://raw.githubusercontent.com/sebastiangiampani-create/Matriz-PCI-Completa/main/data/';

  async function decodeCompressedArrayText(text) {
    const compact = String(text || '').replace(/\s+/g, '');
    if (!compact) throw new Error('Payload curricular vacío.');
    const binary = atob(compact);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const data = await new Response(stream).json();
    if (!Array.isArray(data)) throw new Error('El payload curricular no contiene un arreglo.');
    return data;
  }

  async function isValidCompressedArrayResponse(response) {
    try {
      await decodeCompressedArrayText(await response.clone().text());
      return true;
    } catch (_) {
      return false;
    }
  }

  async function emptyCompressedArrayResponse() {
    const stream = new Blob(['[]'], { type: 'application/json' })
      .stream()
      .pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return new Response(btoa(binary), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  window.fetch = async function phase2ContentFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const fgMatch = String(url).match(fgPattern);

    if (fgMatch) {
      const filename = fgMatch[1];
      const localUrl = `data/formacion_general/${filename}?v=20260911-35`;
      try {
        const local = await nativeFetch(localUrl, { ...(init || {}), cache: 'no-store' });
        if (local.ok && await isValidCompressedArrayResponse(local)) {
          return local;
        }
        console.warn(`[PCI V35] Fragmento FG local inválido: ${filename}. Se usa respaldo histórico.`);
      } catch (error) {
        console.warn(`[PCI V35] No se pudo validar FG local ${filename}. Se usa respaldo histórico.`, error);
      }

      const remoteUrl = `${fgRemoteBase}${filename}?v=20260911-35`;
      const response = await nativeFetch(remoteUrl, { ...(init || {}), cache: 'no-store' });
      if (!response.ok || !await isValidCompressedArrayResponse(response)) {
        throw new Error(`No se pudo cargar Formación General (${filename}).`);
      }
      return response;
    }

    const orientationMatch = String(url).match(orientationPattern);
    if (orientationMatch) {
      try {
        const response = await nativeFetch(input, { ...(init || {}), cache: 'no-store' });
        if (response.ok && await isValidCompressedArrayResponse(response)) {
          window.__pciPhase2MissingFO = null;
          return response;
        }
        window.__pciPhase2MissingFO = orientationMatch[1];
        return emptyCompressedArrayResponse();
      } catch (_) {
        window.__pciPhase2MissingFO = orientationMatch[1];
        return emptyCompressedArrayResponse();
      }
    }

    return nativeFetch(input, init);
  };

  const style = document.createElement('style');
  style.textContent = `
    #proposal .v28-content.v35-fg{box-shadow:inset 4px 0 0 #12395c}
    #proposal .v28-content.v35-fo{box-shadow:inset 4px 0 0 #149c91}
    #proposal .v28-content.v35-dcj{box-shadow:inset 4px 0 0 #7a5a13}
    #proposal .v35-source-badge{display:inline-flex;align-items:center;width:max-content;margin:0 0 6px;padding:3px 7px;border-radius:999px;font-size:.58rem;font-weight:900;letter-spacing:.03em;text-transform:uppercase}
    #proposal .v35-source-badge.fg{background:#edf3f8;color:#12395c}
    #proposal .v35-source-badge.fo{background:#e7f8f5;color:#126e65}
    #proposal .v35-source-badge.dcj{background:#fff5dc;color:#805700}
    #proposal .v35-missing-fo{margin:0 0 16px;padding:12px 14px;border:1px solid #f0daa2;border-radius:14px;background:#fffaf0;color:#805700;font-size:.78rem;line-height:1.45}
    #proposal .v28-sub.fo{outline:1px solid rgba(18,110,101,.18)}
  `;
  document.head.appendChild(style);

  function activeOrientationLabel() {
    try {
      return typeof state !== 'undefined' && state?.active ? state.active : 'Formación Orientada';
    } catch (_) {
      return 'Formación Orientada';
    }
  }

  function isDCJOrientation() {
    return activeOrientationLabel() === 'Agro y Ambiente';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function decoratePhase2() {
    const proposal = document.getElementById('proposal');
    if (!proposal) return;

    const dcj = isDCJOrientation();
    const orientedCode = dcj ? 'DCJ' : 'FO';

    const allTab = proposal.querySelector('[data-src="ALL"]');
    const allExpected = `Todos · FG + ${orientedCode}`;
    if (allTab && allTab.textContent !== allExpected) allTab.textContent = allExpected;

    const fgTab = proposal.querySelector('[data-src="FG"]');
    if (fgTab && fgTab.textContent !== 'Formación General · FG') fgTab.textContent = 'Formación General · FG';

    const foTab = proposal.querySelector('[data-src="FO"]');
    if (foTab) {
      foTab.disabled = false;
      const expected = `${activeOrientationLabel()} · ${orientedCode}`;
      if (foTab.textContent !== expected) foTab.textContent = expected;
    }

    proposal.querySelectorAll('.v28-content[data-c]').forEach(card => {
      const id = card.dataset.c || '';
      const isOriented = id.startsWith('fo:');
      const isDcjCard = isOriented && dcj;
      card.classList.toggle('v35-fg', !isOriented);
      card.classList.toggle('v35-fo', isOriented && !dcj);
      card.classList.toggle('v35-dcj', isDcjCard);

      const body = card.querySelector(':scope > div');
      if (!body) return;
      let badge = body.querySelector('.v35-source-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'v35-source-badge';
        body.prepend(badge);
      }
      badge.className = `v35-source-badge ${isDcjCard ? 'dcj' : isOriented ? 'fo' : 'fg'}`;
      badge.textContent = isDcjCard
        ? 'DCJ · Diseño Curricular 2015'
        : isOriented
          ? 'FO · Formación Orientada'
          : 'FG · Formación General';
    });

    const list = proposal.querySelector('#v28list');
    const meta = proposal.querySelector('#v28meta');
    if (list && meta) {
      const cards = [...list.querySelectorAll('.v28-content[data-c]')];
      const fgCount = cards.filter(card => (card.dataset.c || '').startsWith('fg:')).length;
      const orientedCount = cards.filter(card => (card.dataset.c || '').startsWith('fo:')).length;
      const selectedTab = proposal.querySelector('[data-src].on')?.dataset.src;
      let text = `${cards.length} contenidos disponibles`;
      if (selectedTab === 'ALL') text += ` · ${fgCount} FG + ${orientedCount} ${orientedCode}`;
      else if (selectedTab === 'FG') text += ' · Formación General';
      else if (selectedTab === 'FO') text += dcj ? ' · Diseño Curricular Jurisdiccional 2015' : ` · ${activeOrientationLabel()}`;
      if (meta.textContent !== text) meta.textContent = text;
    }

    proposal.querySelector('.v33-missing-fo')?.remove();
    proposal.querySelector('.v34-missing-fo')?.remove();

    const existingMissingNote = proposal.querySelector('.v35-missing-fo');
    if (!window.__pciPhase2MissingFO) {
      existingMissingNote?.remove();
      return;
    }

    const work = proposal.querySelector('.v28-work');
    if (work && !existingMissingNote) {
      const note = document.createElement('div');
      note.className = 'v35-missing-fo';
      note.innerHTML = `<strong>Bolsa orientada pendiente:</strong> no se pudo cargar el archivo curricular de <strong>${escapeHtml(activeOrientationLabel())}</strong>. La Formación General sigue disponible y operativa.`;
      work.parentNode.insertBefore(note, work);
    }
  }

  let scheduled = false;
  function scheduleDecorate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decoratePhase2();
    });
  }

  const observer = new MutationObserver(scheduleDecorate);
  function start() {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scheduleDecorate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
