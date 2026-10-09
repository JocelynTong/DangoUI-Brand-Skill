// Opt-in for new goals only. State transitions are not motion measurements.
export function validInteractionEvidencePolicy(policy) {
  return policy?.schema === 'interaction-evidence/v1'
    && typeof policy.scopeReason === 'string' && policy.scopeReason.trim().length > 0
    && Array.isArray(policy.required)
    && new Set(policy.required.map(item => item?.id)).size === policy.required.length
    && policy.required.every(item => typeof item?.id === 'string' && item.id.trim()
      && ['states', 'motion'].includes(item.proof)
      && typeof item.reason === 'string' && item.reason.trim());
}

export function interactionProof(policy, id) {
  return policy?.required?.find(item => item.id === id)?.proof || 'motion';
}

export function hasOrderedInteractionStates(timeline) {
  let previous = -1;
  const frames = Array.isArray(timeline?.frames) ? timeline.frames : [];
  return ['default', 'triggered', 'settled', 'restored'].every(state => {
    const index = frames.findIndex((frame, i) => i > previous && (frame.state || frame.label) === state);
    if (index < 0) return false;
    previous = index;
    return true;
  });
}
