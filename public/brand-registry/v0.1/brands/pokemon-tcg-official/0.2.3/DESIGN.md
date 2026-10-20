# Pokémon TCG Official — 0.2.2

Version-matched mechanical guide of the bound learning files. No new website observation, Google/Stitch run, scope expansion or approval. Source values, exceptions and unresolved claims are authoritative; original files remain available. Component source availability does not certify runtime behavior or cross-framework compatibility.

## Scope

```json
{
  "intent": "Reusable page-purpose visual language mapped conservatively to DangoUI without globalizing campaign, database, or learning treatments.",
  "for": [
    "brand visual migration",
    "standard demo capability preview"
  ],
  "notFor": [
    "game-only content mod; this visual package is reusable beyond game products",
    "copying official content into unrelated products",
    "automatic universal Pokémon skin"
  ]
}
```

## Identity and expressive

```json
{
  "imageIdentityPolicy": {
    "scope": "full-image-concept",
    "instruction": "Preserve recognizable original Pokémon IP using the supplied official references. New illustrations, poses, materials and compositions are allowed; exact reproduction of the source illustration is not required. Keep host business labels, data and actions unchanged. Do not import source-site business fields, game states or campaign navigation. Do not claim generated art is an official asset or endorsement.",
    "basis": "Explicit user creative direction; not a claim inferred from official screenshots."
  },
  "brandThesis": "Pokémon TCG is not expressed by one paint bucket. It is expressed by purpose-specific organisms held together by authentic collectible imagery, forceful italic display hierarchy, hard section boundaries and deliberate responsive re-authoring: cinematic discovery on Home, compact productive density in the card database, and painted diagram-led instruction in Learn.",
  "invariants": [
    {
      "id": "purpose-specific-organisms",
      "rule": "Home campaign, database query and Learn instruction remain distinct visual systems; shared brand recognition comes from hierarchy, authentic objects and deliberate boundaries, not one global background color.",
      "evidenceRefs": [
        "home-desktop-campaign-stage-current",
        "database-desktop-search-organism-current",
        "learn-desktop-instruction-hierarchy-current"
      ]
    },
    {
      "id": "authentic-identity-object-boundary",
      "rule": "Keep official source assets identifiable as source evidence. New recognizable Pokémon illustrations are allowed in generated proposals and must not be represented as official originals. Preserving IP does not import card-database fields, campaign navigation, game rules or statuses into the host.",
      "evidenceRefs": [
        "home-desktop-campaign-stage-current",
        "home-mobile-campaign-stage-current",
        "learn-mobile-card-anatomy-current"
      ]
    },
    {
      "id": "mobile-is-art-directed",
      "rule": "390px layouts re-author order and object pairing rather than uniformly scaling desktop; focal asset weight, section purpose and reading order are preserved.",
      "evidenceRefs": [
        "home-mobile-campaign-stage-current",
        "home-mobile-editorial-stack-current",
        "database-mobile-search-organism-current",
        "learn-mobile-card-anatomy-current",
        "learn-mobile-field-sequence-current"
      ]
    },
    {
      "id": "productive-task-space-protected",
      "rule": "Dense task pages keep productive controls and readable results dominant; expressive mass cannot consume the database's first-task viewport.",
      "evidenceRefs": [
        "database-desktop-search-organism-current",
        "database-mobile-search-organism-current"
      ]
    }
  ],
  "assetUsage": [
    {
      "id": "official-identity-assets",
      "status": "required-authentic",
      "evidenceRefs": [
        "home-desktop-campaign-stage-current",
        "home-mobile-campaign-stage-current",
        "learn-mobile-card-anatomy-current"
      ],
      "rule": "Use official identity assets unchanged and independently layered; no source screenshot may become runtime content and no generated likeness may replace an identity subject."
    },
    {
      "id": "generated-expressive-environment",
      "status": "future-imagegen-scope",
      "evidenceRefs": [
        "home-desktop-campaign-stage-current",
        "learn-desktop-instruction-hierarchy-current"
      ],
      "rule": "ImageGen may create a source-independent environment and complete expressive composition around neutral identity slots, while the official assets are fused deterministically afterward."
    }
  ]
}
```

## Typography

```json
{
  "expressiveDisplay": {
    "status": "approved-scenario-recipe",
    "evidenceRefs": [
      "home-editorial-typography-current",
      "learn-mobile-display-typography-current"
    ],
    "rule": "Use heavy italic uppercase display typography for expressive editorial or instructional headings, with clearly quieter supporting copy.",
    "notFor": [
      "database labels",
      "form values",
      "body copy",
      "compact navigation"
    ]
  },
  "productiveText": {
    "status": "preserve-system-role",
    "evidenceRefs": [
      "database-desktop-search-organism-current",
      "database-mobile-search-organism-current"
    ],
    "rule": "Keep form labels, values and dense task copy restrained and readable; expressive display typography must not enter productive controls."
  }
}
```

## Color roles

```json
[
  {
    "id": "home-identity-black-cap",
    "status": "approved-page-recipe",
    "evidenceRefs": [
      "home-navigation-color-current"
    ],
    "allowedRoles": [
      "Home navigation cap",
      "Home campaign surround"
    ],
    "forbiddenRoles": [
      "global app surface",
      "database result surface",
      "Learn instruction field"
    ],
    "reason": "Current identity-bearing Home proves this role at desktop and 390px, but no same-role cross-page action/state set exists."
  },
  {
    "id": "learn-navy-instruction-field",
    "status": "approved-section-recipe",
    "evidenceRefs": [
      "learn-navy-field-color-current",
      "learn-mobile-field-sequence-current"
    ],
    "allowedRoles": [
      "field-of-play instructional organism"
    ],
    "forbiddenRoles": [
      "global brand primary",
      "database search shell",
      "Home campaign"
    ],
    "reason": "The color is tied to explanatory diagrams and section containment."
  },
  {
    "id": "database-orange-search",
    "status": "approved-component-recipe",
    "evidenceRefs": [
      "database-search-action-current"
    ],
    "allowedRoles": [
      "card database Search default treatment"
    ],
    "forbiddenRoles": [
      "global primary action",
      "Home campaign action",
      "Learn CTA"
    ],
    "reason": "Per primary-color-and-cta, a task-local Search control does not establish global brand or action color."
  }
]
```

## Motion and interaction

```json
{
  "status": "static-and-scroll-only",
  "approved": [
    "native-scroll progression",
    "section sequence",
    "default control appearance"
  ],
  "notApproved": [
    "carousel state changes",
    "database search execution",
    "advanced-search disclosure",
    "Learn accordion expansion",
    "hover/focus styling"
  ],
  "reason": "The sole current observation has complete scroll timelines but no fresh action trace with triggered, settled and restored states."
}
```

## Unresolved and evidence boundary

```json
{
  "status": "READY_FOR_DESIGN_DIRECTION_WITH_INTERACTION_LIMITS",
  "evidenceBoundary": {
    "soleSourceObservation": "migrations/pokemon-tcg-official/recapture-2026-09-27/source-observation-manifest-full.json",
    "evidenceFile": "migrations/pokemon-tcg-official/brand-evidence.json",
    "forbiddenInheritance": [
      "previous-run source captures",
      "previous-run action traces",
      "old QA or PASS verdicts",
      "pokemon-tcg-pitch-black",
      "pokemon30"
    ],
    "interactionLimit": "Current evidence supports static/default control treatment and native-scroll composition only. It does not authorize enabled click/hover/focus/restored behavior."
  },
  "unresolvedClaims": [
    {
      "id": "enabled-interactions",
      "reason": "Fresh action traces for triggered, settled and restored states are absent.",
      "owner": "evidence-agent",
      "requiredForDemo": "only-if-enabled"
    },
    {
      "id": "global-primary-action",
      "reason": "Same-role cross-page and hover/focus evidence is absent; campaign discovery and database Search are different jobs.",
      "owner": "brand-interpreter",
      "requiredForDemo": false
    },
    {
      "id": "exact-learn-paint-token",
      "reason": "Current evidence supports the instructional color role, not an exact reusable global token.",
      "owner": "evidence-agent",
      "requiredForDemo": false
    }
  ]
}
```

## DTCG original values

```json
{
  "$description": "Pokémon TCG Official DTCG token contract generated from Brand MOD token mirrors.",
  "$extensions": {
    "echo.brand.schema": "brand-mod.tokens.dtcg/v0.1",
    "echo.brand.sourceFile": "migrations/pokemon-tcg-official/brand-mod.json",
    "echo.brand.note": "DTCG is canonical for reusable token values; mapped/styleOnly are compatibility mirrors for current demo consumers."
  },
  "mapped": {
    "du-bg-1": {
      "$type": "color",
      "$value": "#FFFFFF",
      "$description": "site-evidence topColors and light content/input surfaces",
      "$extensions": {
        "echo.brand.target": "--du-bg-1",
        "echo.brand.channel": "mapped",
        "echo.brand.status": "mapped",
        "echo.brand.usage": "Light content and input surfaces.",
        "echo.brand.legacyKey": "--du-bg-1",
        "echo.brand.evidence": "site-evidence topColors and light content/input surfaces"
      }
    },
    "du-bg-2": {
      "$type": "color",
      "$value": "#EDEDED",
      "$description": "site-evidence .content-bg--flat",
      "$extensions": {
        "echo.brand.target": "--du-bg-2",
        "echo.brand.channel": "mapped",
        "echo.brand.status": "mapped",
        "echo.brand.usage": "Restrained light page/title surface.",
        "echo.brand.legacyKey": "--du-bg-2",
        "echo.brand.evidence": "site-evidence .content-bg--flat"
      }
    },
    "du-text-1": {
      "$type": "color",
      "$value": "#131415",
      "$description": "site-evidence --color-black",
      "$extensions": {
        "echo.brand.target": "--du-text-1",
        "echo.brand.channel": "mapped",
        "echo.brand.status": "mapped",
        "echo.brand.usage": "Primary text on light surfaces.",
        "echo.brand.legacyKey": "--du-text-1",
        "echo.brand.evidence": "site-evidence --color-black"
      }
    },
    "du-text-2": {
      "$type": "color",
      "$value": "#494949",
      "$description": "site-evidence .main-nav",
      "$extensions": {
        "echo.brand.target": "--du-text-2",
        "echo.brand.channel": "mapped",
        "echo.brand.status": "mapped",
        "echo.brand.usage": "Secondary neutral copy.",
        "echo.brand.legacyKey": "--du-text-2",
        "echo.brand.evidence": "site-evidence .main-nav"
      }
    }
  },
  "styleOnly": {
    "style-font-database": {
      "$type": "fontFamily",
      "$value": "Flexo-Regular, arial, sans-serif",
      "$description": "card-db-search-state computed font-family",
      "$extensions": {
        "echo.brand.target": "--style-font-database",
        "echo.brand.channel": "styleOnly",
        "echo.brand.status": "style-only",
        "echo.brand.usage": "Database labels and controls only.",
        "echo.brand.legacyKey": "--style-font-database",
        "echo.brand.evidence": "card-db-search-state computed font-family"
      }
    },
    "style-database-results-texture": {
      "$type": "string",
      "$value": "url(https://assets.pokemon.com/static2/_ui/img/chrome/content_bg.png)",
      "$description": "card-db-results computed background-image",
      "$extensions": {
        "echo.brand.target": "--style-database-results-texture",
        "echo.brand.channel": "styleOnly",
        "echo.brand.status": "style-only",
        "echo.brand.usage": "Database results mosaic only.",
        "echo.brand.legacyKey": "--style-database-results-texture",
        "echo.brand.evidence": "card-db-results computed background-image"
      }
    }
  }
}
```

## Semantic roles

```json
{
  "surface.page": {
    "kind": "mappedToken",
    "value": "#EDEDED",
    "target": "--du-bg-2",
    "dtcgPath": "mapped.du-bg-2",
    "status": "mapped"
  },
  "surface.card": {
    "kind": "mappedToken",
    "value": "#FFFFFF",
    "target": "--du-bg-1",
    "dtcgPath": "mapped.du-bg-1",
    "status": "mapped"
  },
  "text.primary": {
    "kind": "mappedToken",
    "value": "#131415",
    "target": "--du-text-1",
    "dtcgPath": "mapped.du-text-1",
    "status": "mapped"
  },
  "text.secondary": {
    "kind": "mappedToken",
    "value": "#494949",
    "target": "--du-text-2",
    "dtcgPath": "mapped.du-text-2",
    "status": "mapped"
  },
  "border.subtle": {
    "kind": "unresolvedEvidenceRole",
    "value": null,
    "target": null,
    "status": "rejected",
    "sources": [
      "border-token-evidence-recheck.json"
    ],
    "evidenceRefs": [
      "border-token-evidence-recheck.json:disposition"
    ],
    "reason": "No reviewed rendered source region proves #5E5E5E as an ordinary subtle divider. Keep the DangoUI baseline and do not create a brand mapping or runtime consumer."
  },
  "action.primary.fill": {
    "kind": "unresolvedEvidenceRole",
    "value": null,
    "target": null,
    "status": "missing",
    "sources": [
      "brand-evidence.json:card-db-search-shell",
      "action-evidence-v02.json:card-database-search"
    ],
    "evidenceRefs": [
      "card-db-search-shell",
      "card-database-search"
    ],
    "reason": "The available rendered and computed observations do not establish a distinct brand action color. Consumers must keep the DangoUI Button baseline until direct evidence exists."
  },
  "typography.body.family": {
    "kind": "styleOnlyToken",
    "value": "Flexo-Regular, arial, sans-serif",
    "target": "--style-font-database",
    "dtcgPath": "styleOnly.style-font-database",
    "status": "style-only",
    "scope": "card database controls only"
  }
}
```

## Scoped recipes

```json
[
  {
    "id": "campaign-discovery-action",
    "evidenceRefs": [
      "home-campaign-action-current",
      "home-campaign-radius-current",
      "home-campaign-spacing-current",
      "home-campaign-shadow-current"
    ],
    "scope": "Home campaign only",
    "statesApproved": [
      "default"
    ],
    "statesBlocked": [
      "hover",
      "focus",
      "pressed"
    ],
    "sourceMeasurements": [
      {
        "evidenceRef": "home-campaign-action-current",
        "property": "background-color/color",
        "value": "rgb(255, 255, 255) / rgb(0, 0, 0)",
        "sourcePageId": "home-desktop",
        "capture": {
          "path": "migrations/pokemon-tcg-official/recapture-2026-09-27/home/desktop-input-scroll/frames/000.jpg"
        },
        "state": "default",
        "selector": "a.button.button--thirty.button__cta"
      },
      {
        "evidenceRef": "home-campaign-radius-current",
        "property": "border-radius",
        "value": "16px",
        "sourcePageId": "home-desktop",
        "capture": {
          "path": "migrations/pokemon-tcg-official/recapture-2026-09-27/home/desktop-input-scroll/frames/000.jpg"
        },
        "state": "default",
        "selector": "a.button.button--thirty.button__cta"
      },
      {
        "evidenceRef": "home-campaign-spacing-current",
        "property": "padding",
        "value": "14px 20px",
        "sourcePageId": "home-desktop",
        "capture": {
          "path": "migrations/pokemon-tcg-official/recapture-2026-09-27/home/desktop-input-scroll/frames/000.jpg"
        },
        "state": "default",
        "selector": "a.button.button--thirty.button__cta"
      },
      {
        "evidenceRef": "home-campaign-shadow-current",
        "property": "box-shadow",
        "value": "rgba(0, 0, 0, 0.35) 0px 16px 24px -16px",
        "sourcePageId": "home-desktop",
        "capture": {
          "path": "migrations/pokemon-tcg-official/recapture-2026-09-27/home/desktop-input-scroll/frames/000.jpg"
        },
        "state": "default",
        "selector": "a.button.button--thirty.button__cta"
      }
    ]
  },
  {
    "id": "database-search-action",
    "evidenceRefs": [
      "database-search-action-current"
    ],
    "scope": "Card database Search only",
    "statesApproved": [
      "default"
    ],
    "statesBlocked": [
      "hover",
      "focus",
      "pressed"
    ],
    "sourceMeasurements": [
      {
        "evidenceRef": "database-search-action-current",
        "property": "background-color",
        "value": "rgb(238, 107, 47)",
        "sourcePageId": "card-database-mobile-390",
        "capture": {
          "path": "migrations/pokemon-tcg-official/recapture-2026-09-27/card-database/mobile-390-input-scroll/frames/scroll-0844.jpg"
        },
        "state": "default",
        "selector": "#simpleSubmit"
      }
    ]
  }
]
```

## DangoUI mapping

```json
{
  "schema": "component-mapping/v0.2",
  "brand": "pokemon-tcg-official",
  "catalog": "skills/brand/references/dangoui.design-system.json",
  "runtimeFact": "One semantically exact, low-risk native slice is consumed: the database Search submit action is a real DuButton. Hero and page compositions remain custom to preserve the approved fidelity geometry.",
  "mappings": [
    {
      "sourcePattern": "home-layered-campaign-stage",
      "targetComponent": null,
      "compositionCandidates": [
        "NavigationBar",
        "Swiper",
        "SwiperItem",
        "Image",
        "Button"
      ],
      "status": "composition-candidate-pending-runtime",
      "api": {
        "sourcePaths": [
          "node_modules/dangoui/src/navigation-bar/NavigationBar.vue",
          "node_modules/dangoui/src/swiper/Swiper.vue",
          "node_modules/dangoui/src/swiper/SwiperItem.vue",
          "node_modules/dangoui/src/image/Image.vue",
          "node_modules/dangoui/src/button/Button.vue"
        ],
        "props": {
          "Swiper": {
            "indicatorType": "bar-full|bar|number",
            "autoplay": "boolean",
            "extClass": "class"
          },
          "Image": {
            "src": "string",
            "mode": "aspectFit|aspectFill|widthFix",
            "width": "number|string",
            "height": "number|string"
          },
          "Button": {
            "type": "primary|secondary|outline|text",
            "size": "mini|small|normal|medium|large",
            "text": "string"
          }
        },
        "slots": {
          "Swiper": [
            "default"
          ],
          "Button": [
            "default"
          ]
        }
      },
      "runtimeSelectors": [
        ".source-schema-demo__hero--compact-interactive",
        ".pokemon-featured-card",
        ".source-schema-demo__cta"
      ],
      "evidenceRefs": [
        "home-stage-composition",
        "home-carousel-next"
      ],
      "boundary": "Current stage is custom DOM/CSS. DangoUI may supply controls/media primitives later, but layer coordinates, art-directed crop, black stage, card flip and campaign semantics remain composition/page logic."
    },
    {
      "sourcePattern": "home-banded-editorial-journey",
      "targetComponent": null,
      "compositionCandidates": [
        "Image",
        "Button",
        "Swiper"
      ],
      "status": "composition-candidate-pending-runtime",
      "api": {
        "sourcePaths": [
          "node_modules/dangoui/src/image/Image.vue",
          "node_modules/dangoui/src/button/Button.vue",
          "node_modules/dangoui/src/swiper/Swiper.vue"
        ],
        "props": {
          "Image": {
            "src": "string",
            "mode": "aspectFit|aspectFill|widthFix"
          },
          "Button": {
            "type": "primary|secondary|outline|text",
            "text": "string"
          },
          "Swiper": {
            "indicatorType": "bar-full|bar|number",
            "autoplay": "boolean"
          }
        },
        "slots": {
          "Swiper": [
            "default"
          ]
        }
      },
      "runtimeSelectors": [
        ".pokemon-news",
        ".pokemon-tcgl",
        ".pokemon-pocket"
      ],
      "evidenceRefs": [
        "home-responsive-reflow"
      ],
      "boundary": "The editorial bands, overlapping device/character field and alternating grid are page compositions; DangoUI primitives cannot own their structure."
    },
    {
      "sourcePattern": "database-dark-search-organism",
      "targetComponent": "Button",
      "compositionCandidates": [
        "Search",
        "Input",
        "Tag",
        "Button"
      ],
      "status": "native-runtime-consumed-with-composition-boundary",
      "api": {
        "sourcePath": "node_modules/dangoui/src/button/Button.vue",
        "verifiedProps": {
          "type": "primary",
          "size": "normal",
          "text": "Search"
        },
        "slots": [
          "default"
        ]
      },
      "runtimeSelector": ".pokemon-db__submit.du-button",
      "runtimeSelectors": [
        ".pokemon-db__submit.du-button",
        "[data-schema-section-id=\"card-database-search-shell\"]"
      ],
      "evidenceRefs": [
        "card-db-search-shell",
        "card-db-responsive",
        "card-db-search-state"
      ],
      "boundary": "Only the submit action uses native DuButton. No evidence authorizes a brand action-color token override, so the existing evidenced local button recipe remains scoped by .pokemon-db__submit. Charcoal organism, inputs, angled title plate, energy grouping, search state and responsive reading order stay style/page logic."
    },
    {
      "sourcePattern": "database-advanced-drawer",
      "targetComponent": null,
      "compositionCandidates": [
        "Card",
        "Transition"
      ],
      "status": "fallback-pending-runtime",
      "api": {
        "sourcePaths": [
          "node_modules/dangoui/src/card/Card.vue",
          "node_modules/dangoui/src/transition/Transition.vue"
        ],
        "props": {
          "Card": {
            "mode": "normal|collapse",
            "open": "boolean|null",
            "defaultOpen": "boolean|null"
          },
          "Transition": {
            "name": "string",
            "show": "boolean"
          }
        },
        "slots": {
          "Card": [
            "default",
            "left",
            "right"
          ]
        }
      },
      "runtimeSelectors": [
        "[data-schema-section-id=\"card-database-advanced-filter\"]"
      ],
      "evidenceRefs": [
        "card-db-advanced-state",
        "card-database-advanced-filter"
      ],
      "boundary": "DangoUI has no exact contract for the observed 0px → 724px → 1206.73px reversible drawer; disclosure state and timing remain page logic."
    },
    {
      "sourcePattern": "database-reversible-search-results",
      "targetComponent": null,
      "compositionCandidates": [
        "Image",
        "Card"
      ],
      "status": "composition-candidate-pending-runtime",
      "api": {
        "sourcePaths": [
          "node_modules/dangoui/src/image/Image.vue",
          "node_modules/dangoui/src/card/Card.vue"
        ],
        "props": {
          "Image": {
            "src": "string",
            "mode": "aspectFit|aspectFill|widthFix",
            "width": "number|string",
            "height": "number|string"
          },
          "Card": {
            "extClass": "class",
            "showHeader": "boolean"
          }
        },
        "slots": {
          "Card": [
            "default",
            "left",
            "right"
          ]
        }
      },
      "runtimeSelectors": [
        "[data-schema-section-id=\"card-database-results\"]"
      ],
      "evidenceRefs": [
        "card-db-search-state",
        "card-db-results",
        "card-database-search"
      ],
      "boundary": "Image/Card may host media later; query, typed state, sort, pagination, reversible reset and results grid remain application logic."
    },
    {
      "sourcePattern": "learn-painted-card-anatomy",
      "targetComponent": null,
      "compositionCandidates": [
        "Card",
        "Image"
      ],
      "status": "fallback-pending-runtime",
      "api": {
        "sourcePaths": [
          "node_modules/dangoui/src/card/Card.vue",
          "node_modules/dangoui/src/image/Image.vue"
        ],
        "props": {
          "Card": {
            "mode": "normal|collapse",
            "open": "boolean|null",
            "defaultOpen": "boolean|null"
          },
          "Image": {
            "src": "string",
            "mode": "aspectFit|aspectFill|widthFix",
            "width": "number|string"
          }
        },
        "slots": {
          "Card": [
            "default"
          ]
        }
      },
      "runtimeSelectors": [
        "[data-schema-section-id=\"learn-card-anatomy\"]"
      ],
      "evidenceRefs": [
        "learn-hierarchy"
      ],
      "boundary": "Painted yellow boundary and hotspot coordinates are unresolved style-only details and must not be represented as DangoUI Card behavior."
    },
    {
      "sourcePattern": "learn-painted-field-pairs",
      "targetComponent": null,
      "compositionCandidates": [
        "Image"
      ],
      "status": "fallback-pending-runtime",
      "api": {
        "sourcePaths": [
          "node_modules/dangoui/src/image/Image.vue"
        ],
        "props": {
          "Image": {
            "src": "string",
            "mode": "aspectFit|aspectFill|widthFix",
            "width": "number|string"
          }
        },
        "slots": {}
      },
      "runtimeSelectors": [
        "[data-schema-section-id=\"learn-field-pairs\"]"
      ],
      "evidenceRefs": [
        "learn-hierarchy"
      ],
      "boundary": "Image can host each diagram, but ordered pair semantics, navy painted field and layout are not a native DangoUI component."
    },
    {
      "sourcePattern": "learn-reduce-motion-control",
      "targetComponent": null,
      "status": "missing-unverified",
      "api": null,
      "runtimeSelectors": [
        "[data-reduced-motion]"
      ],
      "evidenceRefs": [
        "learn-reduce-motion"
      ],
      "boundary": "No visible source transition was observed, so neither a component mapping nor runtime implementation is authorized."
    }
  ]
}
```

## DangoUI adapter

```json
{
  "schema": "dangoui-adapter/v0.2",
  "brand": "pokemon-tcg-official",
  "mode": "evidence-first-partial-runtime",
  "catalog": {
    "file": "skills/brand/references/dangoui.design-system.json",
    "package": "dangoui",
    "version": "3.6.16"
  },
  "tokenMappings": [
    {
      "sourceToken": "mapped.du-bg-1",
      "sourceValue": "#FFFFFF",
      "targetToken": "--du-bg-1",
      "targetExists": true,
      "mappingType": "mapped",
      "evidenceRefs": [
        "site-evidence:topColors:#FFFFFF"
      ],
      "allowedRoles": [
        "light content surface",
        "input surface"
      ],
      "forbiddenRoles": [
        "campaign stage"
      ],
      "consumerLocations": [
        ".theme-pokemon-tcg-official .source-schema-demo--pokemon-tcg-official",
        ".pokemon-db__title-plate"
      ],
      "computedVerification": "runtime-probe.json: --du-bg-1=#fff on all six Pokémon surfaces; .pokemon-db__title-plate consumes rgb(255,255,255).",
      "status": "runtime-consumed"
    },
    {
      "sourceToken": "mapped.du-bg-2",
      "sourceValue": "#EDEDED",
      "targetToken": "--du-bg-2",
      "targetExists": true,
      "mappingType": "mapped",
      "evidenceRefs": [
        "site-evidence:roleEvidence.unknown:.content-bg--flat"
      ],
      "allowedRoles": [
        "restrained page surface",
        "title surface"
      ],
      "forbiddenRoles": [
        "campaign stage",
        "card surface"
      ],
      "consumerLocations": [
        ".theme-pokemon-tcg-official .source-schema-demo--pokemon-tcg-official",
        ".pokemon-db"
      ],
      "computedVerification": "runtime-probe.json: --du-bg-2=#ededed and database background=rgb(237,237,237).",
      "status": "runtime-consumed"
    },
    {
      "sourceToken": "mapped.du-text-1",
      "sourceValue": "#131415",
      "targetToken": "--du-text-1",
      "targetExists": true,
      "mappingType": "mapped",
      "evidenceRefs": [
        "site-evidence:roleEvidence.token:--color-black"
      ],
      "allowedRoles": [
        "primary text on light surfaces"
      ],
      "forbiddenRoles": [
        "text on dark campaign media"
      ],
      "consumerLocations": [
        ".theme-pokemon-tcg-official .source-schema-demo--pokemon-tcg-official",
        ".pokemon-db__title-plate h1"
      ],
      "computedVerification": "mapping-runtime/runtime-probe.json: all six Pokémon surfaces declare --du-text-1=#131415; .pokemon-db__title-plate h1 computes rgb(19,20,21) on rgb(255,255,255).",
      "status": "runtime-consumed"
    },
    {
      "sourceToken": "mapped.du-text-2",
      "sourceValue": "#494949",
      "targetToken": "--du-text-2",
      "targetExists": true,
      "mappingType": "mapped",
      "evidenceRefs": [
        "site-evidence:roleEvidence.navigation:.main-nav"
      ],
      "allowedRoles": [
        "secondary neutral copy"
      ],
      "forbiddenRoles": [
        "primary copy",
        "active accent"
      ],
      "consumerLocations": [
        ".theme-pokemon-tcg-official .source-schema-demo--pokemon-tcg-official",
        ".pokemon-db__empty"
      ],
      "computedVerification": "runtime-probe.json: --du-text-2=#494949 on all six Pokémon surfaces; empty-state copy consumes it.",
      "status": "runtime-consumed"
    },
    {
      "sourceToken": "styleOnly.style-font-database",
      "sourceValue": "Flexo-Regular, arial, sans-serif",
      "targetToken": "--style-font-database",
      "targetExists": false,
      "mappingType": "style-only",
      "evidenceRefs": [
        "card-db-search-state"
      ],
      "allowedRoles": [
        "database labels",
        "database controls"
      ],
      "forbiddenRoles": [
        "home campaign",
        "global typography"
      ],
      "consumerLocations": [
        ".pokemon-db"
      ],
      "computedVerification": "runtime-probe.json: .pokemon-db declares and consumes Flexo-Regular, Arial, sans-serif; foreign themes expose no token.",
      "status": "runtime-consumed"
    },
    {
      "sourceToken": "styleOnly.style-database-results-texture",
      "sourceValue": "url(https://assets.pokemon.com/static2/_ui/img/chrome/content_bg.png)",
      "targetToken": "--style-database-results-texture",
      "targetExists": false,
      "mappingType": "style-only",
      "evidenceRefs": [
        "card-db-results"
      ],
      "allowedRoles": [
        "database results mosaic"
      ],
      "forbiddenRoles": [
        "campaign hero",
        "learning field",
        "global background"
      ],
      "consumerLocations": [
        ".pokemon-db__results"
      ],
      "computedVerification": "runtime-probe.json: search-results state declares and consumes content_bg.png; foreign themes expose no token.",
      "status": "runtime-consumed"
    }
  ],
  "scopedRecipes": [
    {
      "id": "campaign-discovery-action",
      "evidenceRefs": [
        "home-campaign-action-current",
        "home-campaign-radius-current",
        "home-campaign-spacing-current",
        "home-campaign-shadow-current"
      ],
      "scope": "Home campaign only",
      "statesApproved": [
        "default"
      ],
      "statesBlocked": [
        "hover",
        "focus",
        "pressed"
      ],
      "sourceMeasurements": [
        {
          "evidenceRef": "home-campaign-action-current",
          "property": "background-color/color",
          "value": "rgb(255, 255, 255) / rgb(0, 0, 0)",
          "sourcePageId": "home-desktop",
          "capture": {
            "path": "migrations/pokemon-tcg-official/recapture-2026-09-27/home/desktop-input-scroll/frames/000.jpg"
          },
          "state": "default",
          "selector": "a.button.button--thirty.button__cta"
        },
        {
          "evidenceRef": "home-campaign-radius-current",
          "property": "border-radius",
          "value": "16px",
          "sourcePageId": "home-desktop",
          "capture": {
            "path": "migrations/pokemon-tcg-official/recapture-2026-09-27/home/desktop-input-scroll/frames/000.jpg"
          },
          "state": "default",
          "selector": "a.button.button--thirty.button__cta"
        },
        {
          "evidenceRef": "home-campaign-spacing-current",
          "property": "padding",
          "value": "14px 20px",
          "sourcePageId": "home-desktop",
          "capture": {
            "path": "migrations/pokemon-tcg-official/recapture-2026-09-27/home/desktop-input-scroll/frames/000.jpg"
          },
          "state": "default",
          "selector": "a.button.button--thirty.button__cta"
        },
        {
          "evidenceRef": "home-campaign-shadow-current",
          "property": "box-shadow",
          "value": "rgba(0, 0, 0, 0.35) 0px 16px 24px -16px",
          "sourcePageId": "home-desktop",
          "capture": {
            "path": "migrations/pokemon-tcg-official/recapture-2026-09-27/home/desktop-input-scroll/frames/000.jpg"
          },
          "state": "default",
          "selector": "a.button.button--thirty.button__cta"
        }
      ],
      "mappingKind": "style-only",
      "runtimeStatus": "not-verified"
    },
    {
      "id": "database-search-action",
      "evidenceRefs": [
        "database-search-action-current"
      ],
      "scope": "Card database Search only",
      "statesApproved": [
        "default"
      ],
      "statesBlocked": [
        "hover",
        "focus",
        "pressed"
      ],
      "sourceMeasurements": [
        {
          "evidenceRef": "database-search-action-current",
          "property": "background-color",
          "value": "rgb(238, 107, 47)",
          "sourcePageId": "card-database-mobile-390",
          "capture": {
            "path": "migrations/pokemon-tcg-official/recapture-2026-09-27/card-database/mobile-390-input-scroll/frames/scroll-0844.jpg"
          },
          "state": "default",
          "selector": "#simpleSubmit"
        }
      ],
      "mappingKind": "style-only",
      "runtimeStatus": "not-verified"
    }
  ]
}
```

## Original components

```json
[
  {
    "id": "dangoui-button-search-3.6.16",
    "package": "dangoui",
    "version": "3.6.16",
    "scope": "Original Button/Search and local import dependencies for source inspection. Vue dependency; not a standalone runtime kit, React/Taro port or host approval.",
    "externalDependencies": [
      "dangoui-icon-config",
      "vue"
    ],
    "files": [
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/dist/style.css",
        "sha256": "92cf5d8e51ead45c06635373053860d41fbf0a8eaa81509e5480cff670df250d"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/dist/theme.css",
        "sha256": "543364536843c40672bba1bc003485e1e03e4e46a85903f7d1c39e1006dfb34d"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/LICENSE",
        "sha256": "9dc312bd86c8212da887fb820586c13c9904f7d384fe6c1bfcfab0bf8a5b20eb"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/package.json",
        "sha256": "4a156bf326cb5fa4ae2e5c41f8f06970911eceff4d1141e4770a35755d28a563"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/src/button/Button.vue",
        "sha256": "621952243d5e8968a605fae85f9d3d1818fe56346afb2ebd9fea96041e32a583"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/src/button/style.scss",
        "sha256": "8187ae882057c25accd65893218047825ca2f91e8606968abb65aec5caf12c30"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/src/composables/useSize.ts",
        "sha256": "d55934e23b97f0aa5b4df7c382058611cb111cb87cff8d975daaad04f8bd0a98"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/src/divider/helpers.ts",
        "sha256": "ac56882510b3082520f789b3898b7f751fda297cc31cf87cad3158f8076d0087"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/src/helpers/index.ts",
        "sha256": "a7042a972f9da955a99303fb30231941cb249350da31ee12e4bbf267c7f16d48"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/src/icon/Icon.vue",
        "sha256": "762bddf5900b02aaa144e293347be21e30fb05c637da9f9c46462b6c510625b4"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/src/icon/iconfont-config.json",
        "sha256": "47b5ba2600ce8a50e2a6696e47e22750b3667fd2727b428c28c538adae0524aa"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/src/plugins/globalConfig.ts",
        "sha256": "e488e28b53a50ce563ab357d469166982bbd2d98bfbf357bd3a1abe46d67a2e7"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/src/search/Search.scss",
        "sha256": "5ce0a7e64746bc44fbb27cbb96440387581fe70332b4bcdf2346a62855d8f4b2"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/src/search/Search.vue",
        "sha256": "620b74151a81d68a9a9b1d9d99605c128d1eb0da335717d8249ce7063b932157"
      },
      {
        "path": "migrations/pokemon-tcg-official/component-originals/dangoui/src/upload/helpers.ts",
        "sha256": "bd6dbceff8a93512ad6c15e4acd009abb4b844b5e07f94e0ff99ede1051d6270"
      }
    ]
  }
]
```
