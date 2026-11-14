import { useEffect, useMemo, useRef, useState } from "react";
import { useMemberDirectory } from "@/stores/member-store";
import { createPortal } from "react-dom";
import { ScrollArea } from "@/components/common/scroll-area";
import { WorkspaceGlyph } from "@/components/ui/workspace-glyph";
import { sectionTasksHref } from "@/lib/board-route";
import { type Member, findMemberTasks, getWorkspaceMembers } from "@/lib/members";
import type { Task, TaskStatus } from "@/lib/tasks";
import { type BoardItem, getPinAncestry, isTaskBoard, nodeHref } from "@/lib/workspaces";
import { listenToTaskStorage, useTaskStore } from "@/stores/task-store";
import { MemberTaskForm } from "./member-task-form";
import { TaskCard } from "./task-card";
import { TaskColumns } from "./task-columns";
import { TaskForm } from "./task-form";

type TaskProject = { board: BoardItem; workspace: BoardItem; href: string; tasks: Task[] };

function groupByProject(tasks: Task[], byId: ReadonlyMap<string, BoardItem>) {
  const projects = new Map<string, TaskProject>();
  for (const task of tasks) {
    let project = projects.get(task.sectionId);
    if (!project) {
      const board = byId.get(task.sectionId);
      const path = getPinAncestry(board, (id) => byId.get(id));
      if (!board || !path.length) continue;
      const href = nodeHref(board);
      project = {
        board,
        workspace: path[0],
        href: isTaskBoard(board, path.length) ? href : sectionTasksHref(href),
        tasks: [],
      };
      projects.set(board.id, project);
    }
    project.tasks.push(task);
  }
  return projects;
}

export function MemberTasks({
  member,
  byId,
  boardHref,
  preferredSectionId,
}: {
  member: Member;
  byId: ReadonlyMap<string, BoardItem>;
  boardHref?: string;
  preferredSectionId?: string;
}) {
  const directory = useMemberDirectory();
  const allTasks = useTaskStore((state) => state.tasks);
  const [view, setView] = useState<"project" | "status">("project");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState<TaskStatus | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (boardHref) heading.current?.focus({ preventScroll: true });
  }, [boardHref]);
  useEffect(listenToTaskStorage, []);
  const memberTasks = useMemo(
    () => findMemberTasks(allTasks, member.name),
    [allTasks, member.name],
  );
  const projects = useMemo(() => groupByProject(memberTasks, byId), [memberTasks, byId]);
  const groups = Array.from(projects.values());
  const editingProject = editing && projects.get(editing.sectionId);

  return (
    <div className={boardHref ? "member-task-board" : "my-tasks"}>
      {boardHref ? (
        <header className="mb-5">
          <a href={boardHref} className="text-xs text-neutral-600 hover:underline">
            ← Back to board
          </a>
          <h1
            ref={heading}
            tabIndex={-1}
            className="mt-2 w-fit text-2xl font-semibold tracking-tight outline-none"
          >
            Tasks for {member.name}
          </h1>
        </header>
      ) : (
        <>
          <h1 className="sr-only">My Tasks</h1>
          <fieldset aria-label="Group my tasks" className="my-tasks-switch">
            {(["project", "status"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
              >
                <WorkspaceGlyph
                  icon={
                    mode === "project"
                      ? "core:interface-align-horizontal-left"
                      : "core:interface-align-vertical-top"
                  }
                  size={14}
                />
                by {mode}
              </button>
            ))}
          </fieldset>
        </>
      )}
      {boardHref ? (
        <TaskColumns
          tasks={memberTasks}
          onAdd={setCreating}
          onEdit={setEditing}
          sourceFor={(task) => {
            const project = projects.get(task.sectionId);
            return project && { title: project.board.title, href: project.href };
          }}
        />
      ) : view === "project" ? (
        <ScrollArea label="Tasks by project" className="my-tasks-projects">
          {groups.length === 0 && (
            <p className="text-sm text-neutral-600">No tasks are assigned to you yet.</p>
          )}
          {groups.map(({ board, href, tasks }) => (
            <section key={board.id} aria-label={board.title}>
              <header className="mb-4 flex items-center justify-between gap-3 border-b border-[#bcbcbc] pb-4">
                <h2 className="min-w-0 break-words text-2xl font-medium">{board.title}</h2>
                <a
                  href={href}
                  className="visit-project"
                  aria-label={`Visit project: ${board.title}`}
                >
                  Visit project
                </a>
              </header>
              <ScrollArea label={`${board.title} tasks`} className="my-task-row">
                {tasks.map((task) => (
                  <TaskCard key={task.id} task={task} showStatus onEdit={() => setEditing(task)} />
                ))}
              </ScrollArea>
            </section>
          ))}
        </ScrollArea>
      ) : (
        <ScrollArea label="Tasks by status" className="my-task-statuses">
          <TaskColumns tasks={groups.flatMap((group) => group.tasks)} onEdit={setEditing} />
        </ScrollArea>
      )}
      {creating &&
        createPortal(
          <MemberTaskForm
            member={member}
            byId={byId}
            preferredSectionId={preferredSectionId}
            status={creating}
            onClose={() => setCreating(null)}
          />,
          document.body,
        )}
      {editing &&
        memberTasks.some((task) => task.id === editing.id) &&
        createPortal(
          <TaskForm
            task={editing}
            sectionId={editing.sectionId}
            status={editing.status}
            members={getWorkspaceMembers(editingProject?.workspace, directory)}
            onClose={() => setEditing(null)}
          />,
          document.body,
        )}
    </div>
  );
}
