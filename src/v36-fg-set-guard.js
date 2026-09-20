(() => {
  const previousFetch = window.fetch.bind(window);
  const FG_FILES = ['db1.txt','db2.txt','db3.txt','db4.txt','rest1.txt','rest2.txt','rest3.txt','rest4.txt','rest5.txt'];
  const fgPattern = /(?:^|\/)Matriz-PCI-Completa\/data\/(db[1-4]\.txt|rest[1-5]\.txt)(?:[?#].*)?$/i;
  const remoteBase = 'https://raw.githubusercontent.com/sebastiangiampani-create/Matriz-PCI-Completa/5b7db29b3f1eec0aa8b066af1af3ea626046e177/data/';

  const compact = value => String(value ?? '').replace(/\s+/g, '');

  async function validateJoinedPayload(parts) {
    const joined = parts.map(compact).join('');
    if (!joined || joined.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(joined)) {
      throw new Error('La bolsa FG concatenada no es Base64 válida.');
    }
    const binary = atob(joined);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const data = JSON.parse(await new Response(stream).text());
    if (!Array.isArray(data)) throw new Error('La bolsa FG no contiene un arreglo.');
    return data.length;
  }

  async function fetchSet(kind) {
    const parts = await Promise.all(FG_FILES.map(async filename => {
      const url = kind === 'local'
        ? `data/formacion_general/${filename}?v=20260911-36`
        : `${remoteBase}${filename}?v=20260911-36`;
      const response = await previousFetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${kind}: no se pudo cargar ${filename}`);
      return compact(await response.text());
    }));
    const count = await validateJoinedPayload(parts);
    return {
      source: kind,
      count,
      parts: new Map(FG_FILES.map((filename, index) => [filename, parts[index]]))
    };
  }

  let fgSetPromise = null;
  async function resolveFGSet() {
    if (!fgSetPromise) {
      fgSetPromise = (async () => {
        try {
          const local = await fetchSet('local');
          window.__pciPhase2FGSource = 'local';
          window.__pciPhase2FGCount = local.count;
          return local;
        } catch (localError) {
          console.warn('[PCI V36] La bolsa FG local completa no pasó la validación. Se usa el respaldo histórico completo.', localError);
          const remote = await fetchSet('remote');
          window.__pciPhase2FGSource = 'remote';
          window.__pciPhase2FGCount = remote.count;
          return remote;
        }
      })();
    }
    return fgSetPromise;
  }

  window.fetch = async function phase2FGSetGuard(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const match = String(url).match(fgPattern);
    if (!match) return previousFetch(input, init);

    const set = await resolveFGSet();
    const text = set.parts.get(match[1]);
    if (typeof text !== 'string') throw new Error(`No se encontró el fragmento FG ${match[1]}.`);

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-PCI-FG-Source': set.source
      }
    });
  };
})();
