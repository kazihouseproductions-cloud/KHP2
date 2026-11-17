import { useId, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { isPinColor } from "@/lib/workspaces";

export function PinColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const panelId = useId();
  const [hexDraft, setHexDraft] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-between gap-3 text-sm font-medium">
      <span>Color</span>
      <button
        type="button"
        aria-label="Pin color"
        aria-describedby={`${panelId}-value`}
        aria-haspopup="dialog"
        popoverTarget={panelId}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50"
      >
        <span
          aria-hidden="true"
          className="size-5 rounded border border-black/15"
          style={{ backgroundColor: color }}
        />
        <span id={`${panelId}-value`} className="font-mono text-xs uppercase text-neutral-600">
          {color}
        </span>
      </button>
      <div
        id={panelId}
        popover="auto"
        role="dialog"
        aria-label="Choose color"
        className="pin-color-panel rounded-xl border border-neutral-200 bg-white p-3 shadow-lg"
      >
        <HexColorPicker
          color={color}
          onChange={(nextColor) => {
            setHexDraft(null);
            onChange(nextColor);
          }}
          style={{ width: "100%", height: 136 }}
        />
        <div className="mt-3 flex items-center gap-2">
          <input
            aria-label="Hex color"
            className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1.5 font-mono text-sm"
            value={hexDraft ?? color}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => {
              const text = event.target.value;
              setHexDraft(text);
              const hex = text.startsWith("#") ? text : `#${text}`;
              if (isPinColor(hex)) onChange(hex);
            }}
            onBlur={() => setHexDraft(null)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
              }
            }}
          />
          <button
            type="button"
            popoverTarget={panelId}
            popoverTargetAction="hide"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
