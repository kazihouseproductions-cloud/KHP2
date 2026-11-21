import type { Command } from "./types";

const dimensions = {
  imgAddOnLeft: [18.542, 15.8438],
  imgAddOnRight: [18.542, 15.8438],
  imgDeleteLeft: [13.1436, 15.8438],
  imgDeleteRight: [13.1436, 15.8438],
  imgEnableSnapping: [10.9632, 22],
  imgFiRrAngleSmallDown: [14, 14],
  imgFiRrAngleSmallRight: [24, 24],
  imgFiRrExpand: [24, 24],
  imgFiRrPalette: [24, 24],
  imgFiRrPencil: [24, 24],
  imgFiRrPlus: [9, 9],
  imgFiRrText: [18, 18],
  imgFiRrText1: [24, 24],
  imgFiRrTrash: [19, 19],
  imgFiRrUnlock: [11, 11],
  imgFiRrUnlock1: [5, 5],
  imgFiRrZoomIn: [24, 24],
  imgFiRrZoomOut: [24, 24],
  imgFiRsMicrophone: [24, 24.0003],
  imgFiRsUpload: [11, 11],
  imgFrame105: [14, 22],
  imgFrame30: [153.657, 54],
  imgGroup: [17.7143, 17.7008],
  imgGroup1: [14, 12],
  imgGroup2: [14, 12],
  imgLine1: [1142, 1],
  imgRearrange: [30.8092, 14],
  imgSlipTool: [36, 15],
  imgSplit: [13.1436, 15.8438],
  imgUnion: [23.0303, 17.2207],
  imgUnion1: [15.4326, 17.6963],
  imgUnion2: [25.9999, 26.4999],
  imgUnion3: [25.9999, 26.4999],
  imgUnion4: [1, 5],
  imgUnion5: [2, 10],
  imgUnion6: [13, 29.5],
  imgUnion7: [24.249, 453.5],
  imgVector1: [1, 19.5],
  imgVector52: [4.70711, 3.06066],
  imgImage3: [15.43, 15.43],
} as const;
export type DesignIconName = keyof typeof dimensions;

export const editTools = {
  delete: ["imgFiRrTrash", "Delete"],
  undo: ["imgGroup1", "Undo"],
  redo: ["imgGroup2", "Redo"],
  split: ["imgSplit", "Split"],
  "trim-left": ["imgDeleteLeft", "Delete Left"],
  "trim-right": ["imgDeleteRight", "Delete Right"],
  "add-left": ["imgAddOnLeft", "Add Video to Left"],
  "add-right": ["imgAddOnRight", "Add Video to Right"],
  snap: ["imgEnableSnapping", "Enable or disable snapping"],
  magnet: ["imgFrame105", "Snap All"],
  rearrange: ["imgRearrange", "Rearrange"],
  slip: ["imgSlipTool", "Slip Tool"],
} as const satisfies Record<Command, readonly [DesignIconName, string]>;

/** Decorative artwork exported from the Scene Flow frame. The button supplies its accessible name. */
export function DesignIcon({
  name,
  size,
  className,
}: {
  name: DesignIconName;
  size?: number;
  className?: string;
}) {
  const [width, height] = dimensions[name];
  const scale = size === undefined ? 1 : size / Math.max(width, height);
  return (
    // biome-ignore lint/performance/noImgElement: These local toolbar exports render at their design dimensions.
    <img
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      width={Math.round(width * scale)}
      height={Math.round(height * scale)}
      src={`/design/${name}.${name === "imgImage3" ? "png" : "svg"}`}
    />
  );
}
