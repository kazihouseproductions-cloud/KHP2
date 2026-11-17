import { useState } from "react";
import { MemberAvatar } from "@/components/ui/member-avatar";
import type { Member } from "@/lib/members";

// Store a small square thumbnail so a camera photo fits in the local profile.
async function makeThumbnail(file: File) {
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 192;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing unavailable");
    const crop = Math.min(image.width, image.height);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 192, 192);
    context.drawImage(
      image,
      (image.width - crop) / 2,
      (image.height - crop) / 2,
      crop,
      crop,
      0,
      0,
      192,
      192,
    );
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    image.close();
  }
}

export function ProfilePicture({
  member,
  onChange,
  busy,
  onBusy,
}: {
  member: Pick<Member, "initials" | "color" | "photo">;
  onChange: (photo?: string) => void;
  busy: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  async function select(file: File) {
    onBusy(true);
    setError("");
    try {
      onChange(await makeThumbnail(file));
    } catch {
      setError("This picture could not be read. Choose a PNG, JPEG, or WebP image.");
    } finally {
      onBusy(false);
    }
  }
  return (
    <div>
      <div className="flex items-center gap-3">
        <MemberAvatar member={member} large />
        <div className="min-w-0">
          <label className="grid gap-1 text-sm font-medium">
            Profile picture
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              className="w-full min-w-0 text-xs text-neutral-600 file:mr-2 file:cursor-pointer file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-2 file:py-1.5"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void select(file);
              }}
            />
          </label>
          {member.photo && (
            <button
              type="button"
              disabled={busy}
              className="mt-1 text-xs underline"
              onClick={() => onChange(undefined)}
            >
              Remove picture
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
