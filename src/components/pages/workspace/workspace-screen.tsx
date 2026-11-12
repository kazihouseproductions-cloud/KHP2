"use client";

import { useEffect, useMemo, useState } from "react";
import { Breadcrumbs, type Crumb } from "@/components/layout/breadcrumbs";
import { Sidebar } from "@/components/layout/sidebar";
import { WorkspaceUtilities } from "@/components/layout/workspace-utilities";
import { TaskAnalytics } from "@/components/pages/analytics/task-analytics";
import { TaskDashboard } from "@/components/pages/dashboard/task-dashboard";
import { TaskSchedule } from "@/components/pages/schedule/task-schedule";
import { MemberTasks } from "@/components/pages/tasks/member-tasks";
import { TaskBoard } from "@/components/pages/tasks/task-board";
import { Icon } from "@/components/ui/icon";
import { useBoardRoute } from "@/hooks/use-board-route";
import { memberTasksHref, resolveNodeRoute } from "@/lib/board-route";
import { demoMembers, previewMember } from "@/lib/members";
import { sections } from "@/lib/navigation";
import { indexBoardItems, isTaskBoard } from "@/lib/workspaces";
import { listenToBoardStorage, useBoardStore } from "@/stores/board-store";
import { BoardCanvas } from "./board-canvas";
import { BoardMemberFilter } from "./board-member-filter";
import { BoardSurface } from "./board-surface";
import { PinForm } from "./pin-form";

export function WorkspaceScreen() {
  const items = useBoardStore((s) => s.items);
  const ready = useBoardStore((s) => s.ready);
  const route = useBoardRoute();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState<{ parentId: string | null } | null>(null);
  useEffect(listenToBoardStorage, []);
  useEffect(() => {
    const closeOverlays = () => {
      setForm(null);
      setSidebarOpen(false);
    };
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("hashchange", closeOverlays);
    window.addEventListener("keydown", closeMenu);
    return () => {
      window.removeEventListener("hashchange", closeOverlays);
      window.removeEventListener("keydown", closeMenu);
    };
  }, []);

  const tree = useMemo(() => indexBoardItems(items), [items]);
  const path = resolveNodeRoute(route, tree.byId);
  const current = path.at(-1);
  const parentId = current?.item.id ?? null;
  const boardHref = current?.href ?? "#/";
  const memberId = route.kind === "home" || route.kind === "node" ? route.tasksFor : undefined;
  const taskMember = demoMembers.find((member) => member.id === memberId);
  const currentSection =
    route.kind === "tool" ? sections.find((s) => s.id === route.name) : undefined;
  const invalidRoute =
    route.kind === "invalid" ||
    (memberId !== undefined && !taskMember) ||
    (route.kind === "tool" && !currentSection) ||
    (route.kind === "node" && !current);
  const showTasks = current && isTaskBoard(current.item, path.length);
  const crumbs: Crumb[] = currentSection
    ? [{ title: currentSection.label, href: `#/tool/${currentSection.id}` }]
    : [{ title: "Board", href: "#/" }];
  for (const step of path) crumbs.push({ title: step.item.title, href: step.href });
  if (taskMember)
    crumbs.push({ title: taskMember.name, href: memberTasksHref(boardHref, taskMember.id) });

  return (
    <div className="workspace-shell">
      <button
        type="button"
        className="skip-link"
        onClick={() => document.getElementById("board-main")?.focus()}
      >
        Skip to board
      </button>
      <Sidebar
        active={currentSection?.id ?? "workspace"}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main id="board-main" tabIndex={-1} className="board-main">
        {currentSection?.id === "tasks" ? (
          <MemberTasks member={previewMember} byId={tree.byId} />
        ) : currentSection?.id === "calendar" || currentSection?.id === "gantt" ? (
          <TaskSchedule key={currentSection.id} tool={currentSection.id} byId={tree.byId} />
        ) : currentSection?.id === "dashboard" ? (
          <TaskDashboard />
        ) : currentSection?.id === "analytics" ? (
          <TaskAnalytics />
        ) : currentSection || invalidRoute ? (
          <div className="tool-view">
            {ready && (
              <div>
                <h1 className="mb-2 text-3xl font-semibold">
                  {currentSection?.label ?? "Board unavailable"}
                </h1>
                <p className="text-sm text-neutral-600">
                  {currentSection?.id === "members"
                    ? "No members have been added."
                    : currentSection
                      ? "This tool is not connected to the local workspace."
                      : memberId && !taskMember
                        ? "This member is unavailable."
                        : "This pin is unavailable in this browser."}
                </p>
                <a
                  className="mt-5 inline-block text-sm font-medium text-brand hover:underline"
                  href="#/"
                >
                  Back to Workspace
                </a>
              </div>
            )}
          </div>
        ) : (
          <BoardSurface
            boardId={
              taskMember
                ? `member:${taskMember.id}`
                : showTasks
                  ? `tasks:${parentId}`
                  : (parentId ?? "root")
            }
          >
            {taskMember ? (
              <MemberTasks
                key={taskMember.id}
                member={taskMember}
                byId={tree.byId}
                boardHref={boardHref}
              />
            ) : current && showTasks ? (
              <TaskBoard key={current.item.id} path={path} sectionId={current.item.id} />
            ) : (
              <BoardCanvas
                key={parentId ?? "root"}
                path={path}
                items={tree.children.get(parentId) ?? []}
                onAdd={() => setForm({ parentId })}
              />
            )}
          </BoardSurface>
        )}
        <div className="board-header">
          <button
            type="button"
            className="mobile-menu icon-action"
            aria-label="Open navigation"
            aria-controls="main-sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <Breadcrumbs crumbs={crumbs} />
        </div>
      </main>
      <WorkspaceUtilities />
      {!currentSection && !invalidRoute && !taskMember && (
        <BoardMemberFilter boardHref={boardHref} />
      )}
      {form && <PinForm {...form} onClose={() => setForm(null)} />}
    </div>
  );
}
