# Host Brand Composition Grammar

Use this reference during `apply-host` direction design. It defines reusable composition capabilities, not page templates.

## Purpose

Translate a learned brand system into the host's existing task flow without hard-coding a Hero, campaign banner, VS card, dashboard or list layout. Choose only the roles the host needs, then bind brand evidence and real host content into those roles.

## Composition roles

Each candidate describes a sequence using zero or one instance of each role unless the host structure proves repetition is useful.

### `identity-environment`

Creates immediate brand context through a coherent scene, material field, type-led field or motion field. It may be compact, embedded or absent. A large Hero is only one possible implementation.

Required decision: what brand signal establishes context, and how much viewport capacity may it consume without delaying the primary task?

### `task-bridge`

Connects the brand environment to the host's primary action. It may be search, compose, scan, create, filter, resume, purchase or another real host control. Its placement must explain the transition from atmosphere to action.

Required decision: what action should become available first, and why is its placement operational rather than decorative?

### `featured-content`

Uses real business content to demonstrate the brand's visual language at high salience. It may be a matchup, recommendation, live state, collection, story, product, creator or data insight. Do not require it when the host has no meaningful featured state.

Required decision: why this content deserves focus, and how official brand assets and host content cooperate without impersonating one another?

### `business-stream`

Returns the user to repeatable work: results, feed, table, grid, editor, form, timeline or detail flow. It preserves the host's information density, interaction contract and continuation cues.

Required decision: how quickly must repeatable content enter the viewport, and which brand treatments may continue without reducing efficiency?

### `navigation-shell`

Defines the relationship among platform chrome, safe area, host navigation and the brand environment. It may be native-preserved, custom-contained or custom-immersive.

Required decision: which shell is supported by the platform and selected direction, and how are system controls protected?

## Candidate construction

1. Classify the host as `efficiency-first`, `balanced` or `immersion-first` from its actual primary task and content flow.
2. Select the minimum roles needed. Do not add a role merely to make the preview feel designed.
3. Bind every selected role to:
   - a host job and real content;
   - one or more evidence-backed brand mechanisms;
   - a DangoUI semantic/component capability or an explicit capability gap;
   - a viewport budget and continuation behavior.
4. Define relationships between roles: overlay, edge-bridge, contained transition, interleaving, persistent shell or direct handoff.
5. Generate alternatives by changing role order, relationship, visual narrative and content-entry behavior—not by renaming the same modules or changing colors.
6. For a three-option fast selection, make each opening role, business-content entry and result container observably different in the H5. A hero/header followed by search then list is one skeleton even if assets, copy or role names vary.

## Reusable mechanisms versus instances

Abstract the mechanism, not the visible noun:

| Instance in one project | Reusable mechanism |
| --- | --- |
| Pokémon stadium Hero | coherent identity environment |
| Search overlapping the Hero edge | task bridge across a visual transition |
| VS matchup | featured real-content narrative |
| Deck list | repeatable business stream |
| Yellow active chip | evidence-backed semantic emphasis |

The left column must never become a required component for another host.

## Quality checks

- Removing brand names and logos still leaves a traceable brand mechanism.
- Removing decorative assets does not break the host's primary task.
- The first actionable control appears at a time appropriate to the host classification.
- Official assets establish identity or environment; host assets remain business content.
- The transition between roles is designed, not a poster followed by an unrelated generic page.
- A direction can be expressed with different business nouns without preserving the same geometry.

## Failure codes

- `PROJECT_TEMPLATE_LEAKAGE`: a project-specific module or noun became a general requirement.
- `ROLE_WITHOUT_HOST_JOB`: a visual role has no real host purpose.
- `DECORATIVE_BRIDGE`: a transition element looks branded but does not expose a real action.
- `POSTER_THEN_GENERIC`: the identity environment and business stream have no compositional relationship.
- `SAME_GRAMMAR_RESKIN`: alternatives use the same role order and relationships with superficial visual changes.
