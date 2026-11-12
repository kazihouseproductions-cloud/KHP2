import Image from "next/image";

const dimensions = {
  workspace: [25.2143, 25.2143],
  board: [18.6176, 18.6176],
  tasks: [19.6429, 16.9286],
  calendar: [18.6429, 18.6429],
  gantt: [18.6429, 18.6429],
  dashboard: [18.6429, 18.6429],
  analytics: [18.6429, 10.5],
  assistant: [15.9286, 18.6429],
  attendance: [18.6429, 18.6429],
  hours: [15.9286, 18.6429],
  activity: [18.6429, 18.6429],
  members: [18.6429, 17.2857],
  account: [29.8571, 29.8571],
  chat: [27.5788, 27.5715],
  bell: [29.8571, 29.8346],
  logout: [29.8571, 29.8571],
  apps: [28.4286, 28.4286],
  chevron: [5.16634, 12.0003],
} as const;

export type ShellIconName = keyof typeof dimensions;

export function ShellIcon({ name, size = 19 }: { name: ShellIconName; size?: number }) {
  const [width, height] = dimensions[name];
  return (
    <span
      aria-hidden="true"
      className={`shell-icon shell-icon-${name}`}
      style={{ width: size, height: size }}
    >
      <Image src={`/design/shell/${name}.svg`} alt="" width={width} height={height} unoptimized />
    </span>
  );
}
