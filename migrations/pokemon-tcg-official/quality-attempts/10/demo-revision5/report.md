# Attempt 10 · Demo revision 5 implementation report

Only the fictional held-out Pocket action typography was changed. A held-out-section-scoped rule now protects PAT-POCKET-06 from the host phone’s global `button` caption override.

At both 1440 and 390, executable browser probes measured `PT Sans Official`, `20px`, `italic`, and weight `700`. The approved white/black settled state and gold foreground hover remain intact. The button still changes local state, announces through `aria-live`, preserves the exact fixture URL on click and reload, creates no overflow, and preserves the prior geometry.

No QA or visual verdict is assigned here.
