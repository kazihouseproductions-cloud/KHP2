export type InterfaceIcon =
  | "workspace"
  | "tasks"
  | "calendar"
  | "gantt"
  | "dashboard"
  | "analytics"
  | "assistant"
  | "attendance"
  | "hours"
  | "activity"
  | "members"
  | "account"
  | "bell"
  | "logout"
  | "people"
  | "chat";

const controls = {
  arrowDown: "M12 4v15m-6-6 6 6 6-6",
  plus: "M12 4v16M4 12h16",
  close: "m6 6 12 12M18 6 6 18",
  chevron: "m9 5 7 7-7 7",
  check: "m5 12 4 4 10-10",
  menu: "M3 6h18M3 12h18M3 18h18",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  edit: "m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15v5Z",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
} as const;

type IconName = InterfaceIcon | keyof typeof controls;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  if (name in controls) {
    return (
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={controls[name as keyof typeof controls]} />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width={size} height={size} fill="none">
      <use href={`/design/interface.svg#${name}`} width="100%" height="100%" />
    </svg>
  );
}
