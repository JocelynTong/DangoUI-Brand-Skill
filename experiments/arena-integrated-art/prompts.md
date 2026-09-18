# Built-in ImageGen prompts

执行方式：Codex 内置 `image_gen`。

## 成功：arena background

```text
Use case: stylized-concept
Asset type: mobile app portrait Hero background, 4:5 crop-safe, no foreground hero character
Primary request: a premium cinematic indoor creature-battle championship arena at night, seen from low ringside level with a raised circular battle platform in the middle distance and a dense cheering audience surrounding it.
Scene/backdrop: thousands of layered spectator silhouettes and raised hands fill the lower foreground and side tiers; large abstract red-versus-blue vertical team banners hang from rafters; LED ribbon boards, truss lights, haze, smoke, sparks, camera flashes, and confetti create deep atmospheric perspective.
Composition: central platform and arena vanishing point sit slightly above center; the lower-center foreground is open enough for a large mascot to be composited later but is still crossed by crowd hands and warm smoke so the mascot can feel embedded; the rear platform has a clear grounded spot for a smaller rival; modest darker breathing room at upper-left for optional UI copy.
Lighting/mood: cold electric blue from camera-left, hot magenta-red from camera-right, warm amber energy glow rising from lower center and visibly bouncing onto smoke, hands, platform edges, and nearby banners; volumetric spotlights and controlled bloom.
Constraints: background environment and crowd only; no recognizable characters, no human faces in focus, no trading cards, no logos, no text, no interface, no phone frame, no buttons, no watermark.
```

## 成功：transparent lightning overlay

```text
Use case: stylized-concept
Asset type: compositing overlay for a cinematic mobile Hero
Primary request: a dramatic branching burst of warm golden-yellow electrical lightning and small sparks radiating outward from an empty center.
Composition: portrait canvas, energy concentrated in the lower-middle area, open transparent center reserved for a character.
Background: genuinely transparent alpha background.
Constraints: electricity and sparks only; no character, no creature, no object, no text, no logo, no frame, no watermark.
```

## 被拦截的两条整图策略

1. 直接使用角色名并引用 A crop，要求一次生成 Pikachu、Mewtwo、观众、擂台和统一光源。
2. 不使用角色名，仅用黄色电气鼠与紫色念力对手的物理描述，仍引用 A crop。

两条均在输出阶段被安全策略拦截；详见 `generation-failures.json`。
