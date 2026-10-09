const list = value => Array.isArray(value) ? value : [];
const dimensions = ['composition', 'assetAuthenticity', 'colorRoles', 'informationDensity', 'typographyGraphics', 'motionSemantics', 'brandRecognition'];
const region = value => Array.isArray(value) && value.length === 4 && value.every(Number.isFinite);
const image = value => Boolean(value?.path && /^[a-f0-9]{64}$/i.test(value.sha256 || ''));

// The producer sees the same requirements that the consumer validates. This
// describes output evidence, never supplies ratings or inferred verdicts.
export function buildLearningQaOutputContract(goal, inventory) {
  if (goal?.goalType !== 'brand-learning-capability-test' || !list(goal.referencePages).some(page => page.core !== false)) return null;
  return {
    schema: 'brand-learning-qa-output/v1',
    assessmentSchema: 'brand-visual-qa-assessment/v2',
    fidelityReportOwner: 'deterministic-validator',
    qualityAttempt: 'assessment.attempt and inventory.attempt must match qa-input-manifest.attempt (default 1); this is not the workflow stage number',
    scope: goal.scope || {},
    sourcePages: list(goal.referencePages).filter(page => page.core !== false).map(page => ({
      sourcePageId: page.id,
      demoPageId: list(goal.demoPages).find(demo => demo.mapsToSourcePageId === page.id)?.id || null,
      dimensions,
    })),
    patterns: list(inventory?.pages).flatMap(page => list(page.patterns).filter(pattern => pattern.salience === 'high').map(pattern => ({
      demoPageId: page.demoPageId, id: pattern.id,
      compositionLayerIds: list(pattern.compositionSupport?.layers).map(layer => layer.id),
    }))),
    mustPreserveIds: list(goal.mustPreserve).map(item => item.id),
    mustNotReplaceIds: list(goal.mustNotReplace).map(item => item.id),
    learningProofRequired: true,
    evidenceFields: {
      page: ['sourcePageId', 'demoPageId', 'sourceScreenshot:{path,sha256}', 'demoScreenshot:{path,sha256}', 'dimensions.<name>:{rating,observations}', 'visualPatterns', 'mustPreserve', 'mustNotReplace'],
      observation: ['sourceRegion:[x,y,width,height]', 'demoRegion:[x,y,width,height]', 'finding'],
      pattern: ['id', 'status', 'sourceRegion', 'demoRegion', 'finding', 'compositionLayers:[{id,status,finding}]'],
      generative: ['generativeProofReview.status', 'generativeProofReview.ruleChecks:[{recipeId,status,finding}]'],
    },
    instructions: [
      'Bind source/demo regions to the actual same-viewport and state captures; different scroll states need explicit per-pattern capture bindings.',
      'Unobserved or unsupported items stay unverified and block learning completion. A local regression PASS alone is not learning completion.',
      'Keep frozen scope, quality thresholds and asset permissions unchanged. Do not author fidelity-pass by hand; the validator derives it.',
    ],
  };
}

export function validateLearningQaAssessment(assessment, contract) {
  if (!contract) return;
  const missing = [];
  const require = (condition, field) => { if (!condition) missing.push(field); };
  require(assessment?.schema === contract.assessmentSchema, 'schema');
  for (const expected of contract.sourcePages) {
    const page = list(assessment?.pages).find(item => item.sourcePageId === expected.sourcePageId);
    const prefix = `pages[sourcePageId=${expected.sourcePageId}]`;
    require(Boolean(page), prefix);
    if (!page) continue;
    require(Boolean(page.demoPageId) && (!expected.demoPageId || page.demoPageId === expected.demoPageId), `${prefix}.demoPageId`);
    require(image(page.sourceScreenshot), `${prefix}.sourceScreenshot`);
    require(image(page.demoScreenshot), `${prefix}.demoScreenshot`);
    for (const name of expected.dimensions) {
      const value = page.dimensions?.[name];
      require(Number.isInteger(value?.rating) && value.rating >= 0 && value.rating <= 4, `${prefix}.dimensions.${name}.rating`);
      require(list(value?.observations).length > 0 && value.observations.every(item => region(item.sourceRegion) && region(item.demoRegion) && Boolean(item.finding)), `${prefix}.dimensions.${name}.observations`);
    }
  }
  for (const expected of contract.patterns) {
    const page = list(assessment?.pages).find(item => item.demoPageId === expected.demoPageId);
    const pattern = list(page?.visualPatterns).find(item => item.id === expected.id);
    const prefix = `visualPatterns[${expected.id}]`;
    require(Boolean(pattern?.status && pattern.finding) && region(pattern?.sourceRegion) && region(pattern?.demoRegion), prefix);
    for (const id of expected.compositionLayerIds) {
      const layer = list(pattern?.compositionLayers).find(item => item.id === id);
      require(Boolean(layer?.status && layer.finding), `${prefix}.compositionLayers[${id}]`);
    }
  }
  const pages = list(assessment?.pages);
  for (const id of contract.mustPreserveIds) require(pages.some(page => list(page.mustPreserve).some(item => item.id === id && item.status)), `mustPreserve[${id}]`);
  for (const id of contract.mustNotReplaceIds) require(pages.some(page => list(page.mustNotReplace).some(item => item.id === id && typeof item.violated === 'boolean')), `mustNotReplace[${id}]`);
  require(Boolean(assessment?.generativeProofReview?.status), 'generativeProofReview.status');
  require(list(assessment?.generativeProofReview?.ruleChecks).length >= 2 && assessment.generativeProofReview.ruleChecks.every(item => Boolean((item.recipeId || item.id) && item.status && item.finding)), 'generativeProofReview.ruleChecks');
  if (missing.length) {
    const error = new Error(`LEARNING_QA_OUTPUT_INCOMPLETE: ${missing.join(', ')}`);
    error.code = 'LEARNING_QA_OUTPUT_INCOMPLETE'; error.missingFields = missing;
    throw error;
  }
}
