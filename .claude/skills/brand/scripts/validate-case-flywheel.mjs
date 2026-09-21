export function validateDecisionCase(record) {
  const failures = []
  const trace = record?.decisionTrace
  if (!trace || !['retrospective-analysis-not-original-designer-rationale', 'contemporaneous-record'].includes(trace.recordType)) failures.push('CASE_DECISION_PROVENANCE_MISSING')
  if (!trace?.decisionQuestion || !trace?.knownInputs?.length) failures.push('CASE_DECISION_CONTEXT_MISSING')
  if (!Array.isArray(trace?.alternatives) || trace.alternatives.length < 2 || trace.alternatives.some((item) => !item.id || !item.documentedObservation || !item.expressiveBenefit || !item.productiveCostOrGap || !item.retrospectiveDisposition)) failures.push('CASE_ALTERNATIVES_AND_TRADEOFFS_MISSING')
  if (!trace?.selectionAtTime || !trace?.expertDecisionAfterFeedback || !trace?.why) failures.push('CASE_DECISION_RATIONALE_MISSING')
  if (!trace?.feedback?.source || !trace?.feedback?.summary || !trace?.feedback?.status) failures.push('CASE_FEEDBACK_MISSING')
  if (!trace?.ruleChange?.from || !trace?.ruleChange?.to || trace?.ruleChange?.status !== 'candidate' || !trace?.ruleChange?.ruleId || !trace?.nextCaseQuestion) failures.push('CASE_RULE_REVISION_MISSING')
  return failures
}

export function validateDecisionQuestion(question, methods, cases, rules) {
  const failures = []
  if (question?.schema !== 'brand-decision-question/v0.1' || !question?.id || !question?.title || !question?.scope || !question?.nextEvidenceNeeded) failures.push('DECISION_QUESTION_SCHEMA')
  if (!methods.has(question?.methodRef)) failures.push('DECISION_QUESTION_METHOD_UNRESOLVED')
  const caseRefs = question?.caseRefs || []
  if ((!caseRefs.length && question.status !== 'open-unvalidated') || new Set(caseRefs).size !== caseRefs.length || caseRefs.some((id) => !cases.has(id) || cases.get(id)?.methodRef !== question.methodRef)) failures.push('DECISION_QUESTION_CASE_SCOPE_INVALID')
  const contexts = caseRefs.map((id) => cases.get(id)?.contextKey).filter(Boolean)
  if (contexts.length !== caseRefs.length || new Set(contexts).size !== contexts.length) failures.push('DECISION_QUESTION_CASE_INDEPENDENCE_INVALID')
  const hypothesisRefs = question?.hypothesisRefs || []
  if (new Set(hypothesisRefs).size !== hypothesisRefs.length || hypothesisRefs.some((id) => !rules.has(id) || !(rules.get(id)?.originCaseIds || []).some((caseId) => caseRefs.includes(caseId)))) failures.push('DECISION_QUESTION_HYPOTHESIS_SCOPE_INVALID')
  return failures
}

export function validateCaseRule(rule, cases) {
  const failures = []
  if (rule?.schema !== 'brand-decision-rule/v0.1' || !rule?.id || !Number.isInteger(rule.version) || rule.version < 1 || !['candidate', 'approved', 'rejected', 'retired'].includes(rule.status)) failures.push('CASE_RULE_SCHEMA')
  if (!rule?.statement || !rule?.appliesWhen?.length || !rule?.notFor?.length || !rule?.falsificationQuestion || !rule?.nextTest) failures.push('CASE_RULE_BOUNDARY_MISSING')
  const origin = rule?.originCaseIds || []
  const positive = rule?.independentPositiveCaseIds || []
  if (!origin.length || origin.some((id) => !cases.has(id) || validateDecisionCase(cases.get(id)).length)) failures.push('CASE_RULE_ORIGIN_UNPROVEN')
  if (!rule?.revisionHistory?.length || rule.revisionHistory.at(-1)?.version !== rule.version) failures.push('CASE_RULE_HISTORY_MISSING')
  if (rule?.revisionHistory?.at(-1)?.status !== rule?.status) failures.push('CASE_RULE_HISTORY_STATUS_MISMATCH')
  if (new Set(positive).size !== positive.length || positive.some((id) => origin.includes(id) || !cases.has(id))) failures.push('CASE_RULE_INDEPENDENCE_INVALID')
  if (rule?.status === 'approved') {
    if (!Number.isInteger(rule.minimumIndependentPositiveCases) || rule.minimumIndependentPositiveCases < 2 || positive.length < rule.minimumIndependentPositiveCases || positive.some((id) => cases.get(id)?.reviewStatus !== 'approved' || validateDecisionCase(cases.get(id)).length || cases.get(id)?.decisionTrace?.feedback?.status !== 'approved-aesthetic-outcome' || !cases.get(id)?.reviewEvidence?.independentQA || !cases.get(id)?.reviewEvidence?.userVisualApproval)) failures.push('CASE_RULE_CROSS_CASE_VALIDATION_MISSING')
    const contexts = positive.map((id) => cases.get(id)?.contextKey).filter(Boolean)
    if (contexts.length !== positive.length || new Set(contexts).size !== positive.length || contexts.some((key) => origin.some((id) => cases.get(id)?.contextKey === key))) failures.push('CASE_RULE_CONTEXT_DIVERSITY_MISSING')
    if (!rule.reviewer || !rule.reviewedAt) failures.push('CASE_RULE_APPROVAL_MISSING')
  }
  return failures
}
