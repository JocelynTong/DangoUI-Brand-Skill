// Lossless materialization of existing learning, not another approval stage.
// Recipes remain scoped styles, never promoted to global DangoUI tokens.
export function materializeLearningDelivery(artifacts) {
  const output = structuredClone(artifacts);
  const intent = output['brand-intent.json'];
  const evidence = output['brand-evidence.json'];
  if (!intent || !evidence) return output;
  const claims = new Map((evidence.claims || []).map(claim => [claim.id, claim]));
  const recipes = (intent.styleRecipeDetails || []).map(recipe => ({
    ...recipe,
    sourceMeasurements: (recipe.evidenceRefs || []).flatMap(id => {
      const claim = claims.get(id);
      return claim?.computed ? [{ evidenceRef: id, ...claim.computed,
        sourcePageId: claim.sourcePageId, capture: claim.capture,
        state: claim.sourceProof?.state, selector: claim.sourceProof?.selector }] : [];
    }),
  }));
  if (recipes.length) {
    intent.styleRecipeDetails = recipes;
    if (output['brand-mod.json']) output['brand-mod.json'].styleRecipes = recipes;
    if (output['dangoui-adapter.json']) output['dangoui-adapter.json'].scopedRecipes = recipes.map(recipe => ({
      ...recipe, mappingKind: 'style-only', runtimeStatus: 'not-verified',
    }));
  }
  const profile = output['brand-profile.dtcg.json'];
  if (profile && recipes.length) {
    profile.$extensions ||= {};
    profile.$extensions['echo.brand.scopedRecipes'] = recipes;
  }
  return output;
}
