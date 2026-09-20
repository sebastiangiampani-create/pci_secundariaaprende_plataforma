(() => {
  const nativeFetch = window.fetch.bind(window);
  const fgPattern = /(?:^|\/)Matriz-PCI-Completa\/data\/(db[1-4]\.txt|rest[1-5]\.txt)(?:[?#].*)?$/i;
  const orientationPattern = /(?:^|\/)data\/orientaciones\/([^/?#]+\.txt)(?:[?#].*)?$/i;
  const fgRemoteBase = 'https://raw.githubusercontent.com/sebastiangiampani-create/Matriz-PCI-Completa/main/data/';

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
      const remoteUrl = `${fgRemoteBase}${fgMatch[1]}?v=20260911-33`;
      const response = await nativeFetch(remoteUrl, { ...(init || {}), cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`No se pudo cargar Formación General (${fgMatch[1]}).`);
      }
      return response;
    }

    const orientationMatch = String(url).match(orientationPattern);
    if (orientationMatch) {
      try {
        const response = await nativeFetch(input, init);
        if (response.ok) {
          window.__pciPhase2MissingFO = null;
          return response;
        }
        window.__pciPhase2MissingFO = orientationMatch[1];
        return emptyCompressedArrayResponse();
      } catch (error) {
        window.__pciPhase2MissingFO = orientationMatch[1];
        return emptyCompressedArrayResponse();
      }
    }

    return nativeFetch(input, init);
  };

  const style = document.createElement('style');
  style.textContent = `
    #proposal .v28-content.v33-fg{box-shadow:inset 4px 0 0 #12395c}
    #proposal .v28-content.v33-fo{box-shadow:inset 4px 0 0 #149c91}
    #proposal .v33-source-badge{display:inline-flex;align-items:center;width:max-content;margin:0 0 6px;padding:3px 7px;border-radius:999px;font-size:.58rem;font-weight:900;letter-spacing:.03em;text-transform:uppercase}
    #proposal .v33-source-badge.fg{background:#edf3f8;color:#12395c}
    #proposal .v33-source-badge.fo{background:#e7f8f5;color:#126e65}
    #proposal .v33-missing-fo{margin:0 0 16px;padding:12px 14px;border:1px solid #f0daa2;border-radius:14px;background:#fffaf0;color:#805700;font-size:.78rem;line-height:1.45}
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

    const allTab = proposal.querySelector('[data-src="ALL"]');
    if (allTab && allTab.textContent !== 'Todos · FG + FO') allTab.textContent = 'Todos · FG + FO';

    const fgTab = proposal.querySelector('[data-src="FG"]');
    if (fgTab && fgTab.textContent !== 'Formación General · FG') fgTab.textContent = 'Formación General · FG';

    const foTab = proposal.querySelector('[data-src="FO"]');
    if (foTab) {
      const expected = `${activeOrientationLabel()} · FO`;
      if (foTab.textContent !== expected) foTab.textContent = expected;
    }

    proposal.querySelectorAll('.v28-content[data-c]').forEach(card => {
      const id = card.dataset.c || '';
      const isFO = id.startsWith('fo:');
      card.classList.toggle('v33-fo', isFO);
      card.classList.toggle('v33-fg', !isFO);

      const body = card.querySelector(':scope > div');
      if (!body || body.querySelector('.v33-source-badge')) return;
      const badge = document.createElement('span');
      badge.className = `v33-source-badge ${isFO ? 'fo' : 'fg'}`;
      badge.textContent = isFO ? 'FO · Formación Orientada' : 'FG · Formación General';
      body.prepend(badge);
    });

    const list = proposal.querySelector('#v28list');
    const meta = proposal.querySelector('#v28meta');
    if (list && meta) {
      const cards = [...list.querySelectorAll('.v28-content[data-c]')];
      const fgCount = cards.filter(card => (card.dataset.c || '').startsWith('fg:')).length;
      const foCount = cards.filter(card => (card.dataset.c || '').startsWith('fo:')).length;
      const selectedTab = proposal.querySelector('[data-src].on')?.dataset.src;
      let text = `${cards.length} contenidos disponibles`;
      if (selectedTab === 'ALL') text += ` · ${fgCount} FG + ${foCount} FO`;
      else if (selectedTab === 'FG') text += ' · Formación General';
      else if (selectedTab === 'FO') text += ` · ${activeOrientationLabel()}`;
      if (meta.textContent !== text) meta.textContent = text;
    }

    const existingMissingNote = proposal.querySelector('.v33-missing-fo');
    if (!window.__pciPhase2MissingFO) {
      existingMissingNote?.remove();
      return;
    }

    const work = proposal.querySelector('.v28-work');
    if (work && !existingMissingNote) {
      const note = document.createElement('div');
      note.className = 'v33-missing-fo';
      note.innerHTML = `<strong>Bolsa FO pendiente:</strong> todavía no hay un archivo de contenidos priorizados para <strong>${escapeHtml(activeOrientationLabel())}</strong>. La Formación General sigue disponible y operativa; cuando se incorpore la bolsa FO, ambas fuentes funcionarán juntas desde “Todos · FG + FO”.`;
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
