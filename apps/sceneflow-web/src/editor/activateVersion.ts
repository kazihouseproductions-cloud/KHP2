import type { Clip, Edit } from "./types";

export function activateVersion(
  clip: Clip,
  versionId: string,
  author: string,
  edit: Edit,
) {
  const index = clip.versions.findIndex((v) => v.id === versionId);
  if (index < 0 || clip.active === versionId) return;
  edit(
    "Version activated",
    `Activated V${index + 1} of ${clip.name}`,
    (draft) => {
      const target = draft.clips.find((c) => c.id === clip.id);
      if (target)
        Object.assign(target, {
          active: versionId,
          editor: author,
          edited: Date.now(),
        });
    },
    false,
    clip.id,
  );
}
