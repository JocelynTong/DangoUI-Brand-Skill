// Shared lexical inspection only; never execute host configuration or infer merged values.
export function lexicalTokens(code) {
  const tokens = [];
  for (let i = 0; i < code.length;) {
    if (/\s/.test(code[i])) { i++; continue; }
    if (code.slice(i, i + 2) === '//') { const end = code.indexOf('\n', i); i = end < 0 ? code.length : end + 1; continue; }
    if (code.slice(i, i + 2) === '/*') { const end = code.indexOf('*/', i + 2); if (end < 0) throw new Error('MODULE_SOURCE_UNTERMINATED_COMMENT'); i = end + 2; continue; }
    if ('\'"`'.includes(code[i])) {
      const quote = code[i++]; let value = '', closed = false;
      while (i < code.length) { const ch = code[i++]; if (ch === '\\') { value += ch + (code[i++] || ''); continue; } if (ch === quote) { closed = true; break; } value += ch; }
      if (!closed) throw new Error('MODULE_SOURCE_UNTERMINATED_STRING');
      tokens.push({ kind: quote === '`' ? 'template' : 'string', value }); continue;
    }
    const identifier = /^[A-Za-z_$][\w$]*/.exec(code.slice(i));
    if (identifier) { tokens.push({ kind: 'word', value: identifier[0] }); i += identifier[0].length; }
    else tokens.push({ kind: 'punctuation', value: code[i++] });
  }
  return tokens;
}

export function moduleConfigLiterals(code) {
  const tokens = lexicalTokens(code);
  return Object.fromEntries(['sourceRoot', 'framework'].map(key => {
    const declarations = tokens.flatMap((token, i) =>
      ['word', 'string'].includes(token.kind) && token.value === key && tokens[i + 1]?.value === ':'
        ? [{ value: tokens[i + 2], end: tokens[i + 3] }] : []);
    const declaration = declarations[0];
    const value = declarations.length === 1 && declaration.value?.kind === 'string'
      && declaration.end?.kind === 'punctuation' && [',', '}'].includes(declaration.end.value)
      ? declaration.value.value : undefined;
    return [key, value];
  }));
}
