const keys = ["evidenceFidelity", "structuralFidelity", "generativeProof"];

// All consumers use the validator's canonical result. Legacy fields are only
// accepted when the canonical field is absent, never to repair a blocked result.
export function readCanonicalLearningProof(report) {
  const canonical = report?.learningProof;
  const source = canonical ?? report?.proofs ?? report?.proofStatus ?? {};
  const proofStatus = Object.fromEntries(keys.map(key => {
    const value = source[key];
    const status = typeof value === "string" ? value : value?.status;
    return [key, ["pass", "fail"].includes(status) ? status : "pending"];
  }));
  const protocolBlocked = (report?.protocolFailures?.length || 0) > 0;
  const hardBlocked = (report?.hardFailures?.length || 0) > 0;
  const scoped = report?.completionScope === "scoped-regression";
  const required = canonical ? canonical.required === true : true;
  const canonicalPassed = !canonical || canonical.status === "learning-proof-pass";
  const threeProofsPassed = report?.status === "fidelity-pass" && required && canonicalPassed
    && !scoped && !protocolBlocked && !hardBlocked && keys.every(key => proofStatus[key] === "pass");
  return { required, proofStatus, threeProofsPassed,
    status: threeProofsPassed ? "learning-proof-pass" : protocolBlocked || scoped ? "protocol-blocked" : hardBlocked || keys.some(key => proofStatus[key] === "fail") ? "learning-proof-fail" : "incomplete" };
}
