<template>
  <div
    class="dango-library-cover brand-cover"
    data-cover-kind="typographic-composition"
    data-cover-direction="original-library-cover"
    aria-hidden="true"
    inert
  >
    <div class="dango-library-cover__type">
      Dango
      <span>Design → Build</span>
    </div>
    <div class="dango-library-cover__shade"></div>
    <span class="dango-library-cover__label">让结构清晰可读</span>
  </div>
</template>

<style scoped>
.dango-library-cover {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 20%, #494968, #191a28);
  color: #ddd6ff;
}

.dango-library-cover__type {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ddd6ff;
  font-family: Inter, system-ui, sans-serif;
  font-size: 64px;
  font-weight: 700;
  letter-spacing: -4px;
}

.dango-library-cover__type span {
  margin-top: 20px;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 3px;
}

.dango-library-cover__shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent 48%, #000b);
}

.dango-library-cover__label {
  position: absolute;
  left: 25px;
  bottom: 22px;
  color: #fff;
  font-family: Inter, system-ui, sans-serif;
  font-size: 20px;
  font-weight: 600;
}

@media (max-width: 800px) {
  .dango-library-cover__type { font-size: 52px; }
  .dango-library-cover__label { left: 22px; bottom: 19px; font-size: 18px; }
}
</style>
