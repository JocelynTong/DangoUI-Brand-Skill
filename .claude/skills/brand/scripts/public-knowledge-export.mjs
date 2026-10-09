// Public distribution policy only; never mutate the internal evidence source.
export function isNonPublicReference(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  return host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || host === 'echo.tech' || host.endsWith('.echo.tech')
    || /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)
    || host === '::1' || host === '0.0.0.0' || host.startsWith('::ffff:')
    || /^(?:fc|fd)[0-9a-f]{2}:|^fe[89ab][0-9a-f]:/i.test(host);
}

export function nonPublicReferences(text, extension = '') {
  // Decode JSON escapes before inspecting addresses, including escaped slashes.
  if (extension === '.json') text = JSON.stringify(JSON.parse(text));
  return [...text.matchAll(/https?:\/\/[^\s"'<>\\)]+/gi)]
    .map(match => match[0]).filter(isNonPublicReference);
}

export function exportPublicKnowledge(text, extension) {
  const refs = nonPublicReferences(text, extension);
  if (!refs.length) return { text, omittedReferences: 0 };
  const replacement = '[non-public reference omitted]';
  const redact = value => {
    if (typeof value === 'string') return value.replace(/https?:\/\/[^\s"'<>\\)]+/gi, url => isNonPublicReference(url) ? replacement : url);
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') {
      if (Object.keys(value).some(key => nonPublicReferences(key).length)) throw Error('Non-public reference in a knowledge record key requires review');
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redact(child)]));
    }
    return value;
  };
  if (extension === '.json') {
    const record = redact(JSON.parse(text));
    if (!record || Array.isArray(record) || typeof record !== 'object') throw Error('Public knowledge records must be objects');
    record.publicExport = { nonPublicReferencesOmitted: refs.length, evidenceAccess: 'Some original references are withheld; this copy does not provide independent evidence access.' };
    return { text: JSON.stringify(record, null, 2) + '\n', omittedReferences: refs.length };
  }
  return { text: redact(text) + '\n\n> Public export: non-public references omitted; original evidence is not accessible from this copy.\n', omittedReferences: refs.length };
}
