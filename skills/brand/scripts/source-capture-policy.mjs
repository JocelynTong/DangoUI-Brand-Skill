export function buildRenderedCollectorArgs(args = []) {
  const output = [];
  const addFlag = (flag) => {
    if (!output.includes(flag)) output.push(flag);
  };

  // HTTP/CSS extraction is discovery seed only. A learn-brand run must always
  // produce browser-native visual evidence before Evidence can pass.
  addFlag("--force-browser");

  for (const flag of ["--slow", "--dark-mode"]) {
    if (args.includes(flag)) addFlag(flag);
  }

  for (const option of ["--width", "--height", "--page-id", "--out-dir"]) {
    const index = args.indexOf(option);
    if (index >= 0 && index < args.length - 1) output.push(option, args[index + 1]);
  }

  return output;
}

export function classifyBrowserFailure(message = "") {
  return /permission|not permitted|access denied|security policy|site-safety|blocked by/i.test(String(message))
    ? "ACCESS_POLICY_BLOCKED"
    : "BROWSER_RENDERED_EVIDENCE_FAILED";
}
