const palette = [
  "#477ec4",
  "#db9254",
  "#9876c4",
  "#4c9b86",
  "#c46d89",
  "#849c53",
  "#649db0",
];

export function sceneLabel(clipName: string) {
  const match = /^(\d+)_/.exec(clipName);
  return match ? `Scene ${Number(match[1])}` : "Unknown scene";
}

export function sceneColor(scene: string, overrides: Record<string, string>) {
  if (overrides[scene]) return overrides[scene];
  const number = Number(scene.slice(6)) || 0;
  if (number < palette.length) return palette[number];
  // Additional scene numbers get stable colors without cycling the first seven.
  const hash = Math.imul(number, 0x9e3779b1);
  const channels = [16, 8, 0].map((shift) =>
    (72 + ((hash >>> shift) & 127)).toString(16),
  );
  return `#${channels.join("")}`;
}
