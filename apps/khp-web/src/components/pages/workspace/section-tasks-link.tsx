import { sectionTasksHref } from "@/lib/board-route";

export function SectionTasksLink({ boardHref }: { boardHref: string }) {
  return (
    <a
      href={sectionTasksHref(boardHref)}
      className="mt-2 inline-flex min-h-8 items-center rounded-full border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
    >
      See All Tasks
    </a>
  );
}
