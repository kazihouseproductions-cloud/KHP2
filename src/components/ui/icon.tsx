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
  attachment: "m8 14 7.8-7.8a2.1 2.1 0 0 1 3 3l-9.5 9.5a4 4 0 1 1-5.7-5.7L14.2 2.4",
  mic: "M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0V6ZM5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-3 0h6",
  stop: "M6 6h12v12H6z",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4",
  account: "M16 7.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 20c0-3.6 3.1-6 8-6s8 2.4 8 6",
  chat: "M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.4-4.1-1L3.5 20.5l1.3-4.6a8.5 8.5 0 1 1 15.7-4.4ZM8.5 11.5h7",
  bell: "M18 9a6 6 0 1 0-12 0c0 4.7-1.5 6.6-2.3 7.5a.6.6 0 0 0 .5 1h15.6a.6.6 0 0 0 .5-1C19.5 15.6 18 13.7 18 9ZM9.8 20a2.5 2.5 0 0 0 4.4 0",
  logout: "M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M10 12h10m-4-4 4 4-4 4",
  search: "M17.5 17.5 21 21M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  send: "m3 3 19 9-19 9 3-9-3-9Zm3 9h16",
  minimize: "M5 12h14",
  back: "m14 5-7 7 7 7",
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
