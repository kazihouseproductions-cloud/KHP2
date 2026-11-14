export type WorkspaceNotification = {
  id: string;
  kind: "assignment" | "approval" | "workspace";
  title: string;
  detail: string;
  createdAt: string;
  initiallyRead?: boolean;
};

const samples: WorkspaceNotification[] = [
  {
    id: "ogopogo-color-review",
    kind: "assignment",
    title: "Review the lake color studies",
    detail: "Nadia assigned you this task in Ogopogo.",
    createdAt: "2026-11-14T10:20:00+06:00",
  },
  {
    id: "mayapur-workspace",
    kind: "workspace",
    title: "You joined Mayapur",
    detail: "Rafi added you to the Mayapur workspace.",
    createdAt: "2026-11-13T11:30:00+06:00",
  },
  {
    id: "walk-cycle-approved",
    kind: "approval",
    title: "Walk cycle approved",
    detail: "Tanvir approved your animation pass in Game Dev.",
    createdAt: "2026-11-14T09:05:00+06:00",
  },
  {
    id: "school-welcome",
    kind: "assignment",
    title: "Review the welcome text",
    detail: "Samira assigned you this task in School.",
    createdAt: "2026-11-12T15:10:00+06:00",
    initiallyRead: true,
  },
  {
    id: "office-storyboard-approved",
    kind: "approval",
    title: "Storyboard approved",
    detail: "Nadia approved your storyboard in Office.",
    createdAt: "2026-11-13T08:45:00+06:00",
    initiallyRead: true,
  },
];

export const notifications = samples.sort(
  (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
);
