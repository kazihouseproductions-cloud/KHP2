"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs, type Crumb } from "@/components/layout/breadcrumbs";
import { Sidebar } from "@/components/layout/sidebar";
import { WorkspaceUtilities } from "@/components/layout/workspace-utilities";
import { TaskBoard } from "@/components/pages/tasks/task-board";
import { Icon } from "@/components/ui/icon";
import { useBoardRoute } from "@/hooks/use-board-route";
import { sections } from "@/lib/navigation";
import { boardLevels, resolveBoardPath } from "@/lib/workspaces";
import { listenToBoardStorage, useBoardStore } from "@/stores/board-store";
import { BoardCanvas } from "./board-canvas";
import { BoardSurface } from "./board-surface";
import { PinForm } from "./pin-form";

export function WorkspaceScreen() {
  const items = useBoardStore((s) => s.items);
  const ready = useBoardStore((s) => s.ready);
  const route = useBoardRoute();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState<{ parentId: string | null; noun: string } | null>(null);
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

  const path = resolveBoardPath(route.ids, items);
  const current = path.at(-1);
  const parentId = current?.item.id ?? null;
  const currentSection = sections.find((s) => s.id === route.section);
  const invalidRoute =
    route.invalid || path.length !== route.ids.length || (route.section && !currentSection);
  const crumbs: Crumb[] = [{ title: "Workspace", href: "#/" }];
  if (currentSection)
    crumbs.push({ title: currentSection.label, href: `#/tool/${currentSection.id}` });
  for (const step of path) crumbs.push({ title: step.item.title, href: step.href });

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
        {currentSection || invalidRoute ? (
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
          <BoardSurface boardId={parentId ?? "root"}>
            {current && path.length === boardLevels.length ? (
              <TaskBoard key={current.item.id} path={path} sectionId={current.item.id} />
            ) : (
              <BoardCanvas
                path={path}
                items={items.filter((item) => item.parentId === parentId)}
                onAdd={() => setForm({ parentId, noun: boardLevels[path.length].label })}
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
      {form && <PinForm {...form} onClose={() => setForm(null)} />}
    </div>
  );
}
