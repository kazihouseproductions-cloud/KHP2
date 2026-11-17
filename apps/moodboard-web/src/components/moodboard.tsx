"use client";

import { Copy, Layers, RotateCcw, Trash2 } from "lucide-react";
import Image from "next/image";
import { type CSSProperties, useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  type BoardDocument,
  createLibrary,
  libraryImageSources,
  libraryReducer,
} from "@/lib/board-library";
import { type BoardAction, isItemLocked, layerZIndex, noteColors } from "@/lib/board-model";
import { BoardCard } from "./board-card";
import { BoardConnections } from "./board-connections";
import { AppSwitcher, BottomToolbar, Sidebar } from "./board-controls";
import { BoardLibrary } from "./board-library";
import { CollectionCard } from "./collection-card";
import { LayersPanel } from "./layers-panel";
import { ShareBoardDialog } from "./share-board-dialog";
import { useBoardCanvas } from "./use-board-canvas";
import { useImagePlacement } from "./use-image-placement";

export function Moodboard() {
  const [library, dispatch] = useReducer(libraryReducer, undefined, createLibrary);
  const [commentAuthor, setCommentAuthor] = useState("");
  const retainedImages = useRef(new Set<string>());
  useEffect(() => {
    const reachable = libraryImageSources(library.boards);
    for (const url of retainedImages.current) {
      if (!reachable.has(url)) {
        URL.revokeObjectURL(url);
        retainedImages.current.delete(url);
      }
    }
  }, [library.boards]);
  useEffect(
    () => () => {
      for (const url of retainedImages.current) URL.revokeObjectURL(url);
    },
    [],
  );
  const onAction = useCallback(
    (action: BoardAction) => {
      if (library.activeId)
        dispatch({ type: "edit", id: library.activeId, action, now: Date.now() });
    },
    [library.activeId],
  );
  const document = library.boards.find((board) => board.id === library.activeId);
  if (!document)
    return (
      <BoardLibrary
        boards={library.boards}
        onCreate={() => dispatch({ type: "create", id: crypto.randomUUID(), now: Date.now() })}
        onOpen={(id) => dispatch({ type: "open", id })}
      />
    );
  return (
    <BoardWorkspace
      key={document.id}
      document={document}
      onAction={onAction}
      onRename={(title) => dispatch({ type: "rename", id: document.id, title, now: Date.now() })}
      onExit={() => dispatch({ type: "close" })}
      commentAuthor={commentAuthor}
      onCommentAuthorChange={setCommentAuthor}
      onRetainImage={(url) => {
        retainedImages.current.add(url);
      }}
    />
  );
}

function BoardWorkspace({
  document,
  onAction,
  onRename,
  onExit,
  commentAuthor,
  onCommentAuthorChange,
  onRetainImage,
}: {
  document: BoardDocument;
  onAction: (action: BoardAction) => void;
  onRename: (title: string) => void;
  onExit: () => void;
  commentAuthor: string;
  onCommentAuthorChange: (name: string) => void;
  onRetainImage: (url: string) => void;
}) {
  const canvas = useBoardCanvas(document.history, onAction);
  const [layersOpen, setLayersOpen] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const imagePlacement = useImagePlacement({
    onPlace: canvas.placeImage,
    onRetain: onRetainImage,
    onSelect: () => canvas.changeTool("select"),
    announce: canvas.announce,
  });
  const { board, dispatch, tool, selectedIds, view, activeItems, selectionBounds } = canvas;
  const selected = activeItems.length === 1 ? activeItems[0] : undefined;
  const editableSelection = activeItems.filter((item) => !isItemLocked(item, board.items));
  const rotationAngle = selected
    ? selected.rotation
    : canvas.gesture?.type === "rotate"
      ? canvas.gesture.delta
      : 0;
  return (
    <main className="moodboard-shell">
      <div
        ref={canvas.canvasRef}
        className={`board-canvas tool-${tool} ${canvas.gesture?.type === "pan" ? "is-panning" : ""}`}
        role="application"
        aria-label="Moodboard canvas"
        tabIndex={-1}
        onPointerDown={canvas.canvasDown}
        onPointerDownCapture={imagePlacement.onPointerDownCapture}
        onPointerMove={canvas.pointerMove}
        onPointerUp={canvas.pointerUp}
        onPointerCancel={canvas.cancelGesture}
        style={
          {
            "--pan-x": `${view.x}px`,
            "--pan-y": `${view.y}px`,
            "--zoom": view.zoom,
          } as CSSProperties
        }
      >
        <div className="board-scene">
          {canvas.visibleItems
            .filter((item) => item.kind === "collection")
            .map((item) => (
              <CollectionCard
                key={item.id}
                item={{ ...item, locked: isItemLocked(item, board.items) }}
                members={canvas.renderedItems.filter((child) => child.parentId === item.id)}
                selected={selectedIds.includes(item.id)}
                dropTarget={canvas.dropTarget === item.id}
                tool={tool}
                onPointerDown={(event) => canvas.startCard(event, item.id)}
                onUpdate={(changes) => dispatch({ type: "update", id: item.id, changes })}
                onUnwrap={() => canvas.unwrapCollection(item.id)}
                layer={layerZIndex(item, board.items)}
                connectTarget={canvas.wire?.targetId === item.id}
              />
            ))}
          <BoardConnections
            items={canvas.renderedItems}
            connections={board.connections}
            selected={canvas.selectedEdges}
            wire={canvas.wire}
            zoom={view.zoom}
            onSelect={canvas.edgeDown}
            onKeyboardSelect={canvas.selectEdge}
            onReconnect={canvas.reconnectDown}
          />
          {canvas.visibleItems
            .filter((item) => item.kind !== "collection")
            .map((item) => (
              <BoardCard
                key={item.id}
                item={{ ...item, locked: isItemLocked(item, board.items) }}
                selected={selectedIds.includes(item.id)}
                tool={tool}
                onFocus={() => canvas.focusCard(item.id)}
                onPointerDown={(event) => canvas.startCard(event, item.id)}
                onUpdate={(changes) => dispatch({ type: "update", id: item.id, changes })}
                onInvalidLink={() => canvas.announce("Enter a valid http:// or https:// link.")}
                commentAuthor={commentAuthor}
                onCommentAuthorChange={onCommentAuthorChange}
                onPostComment={(text) =>
                  dispatch({
                    type: "reply",
                    id: item.id,
                    message: {
                      id: crypto.randomUUID(),
                      author: commentAuthor,
                      text,
                      createdAt: Date.now(),
                    },
                  })
                }
                onAddTodo={() =>
                  dispatch({ type: "todo-add", id: item.id, todoId: crypto.randomUUID() })
                }
                onUpdateTodo={(todoId, changes) =>
                  dispatch({ type: "todo-update", id: item.id, todoId, changes })
                }
                layer={layerZIndex(item, board.items)}
                connectTarget={canvas.wire?.targetId === item.id}
              />
            ))}
          {canvas.marquee && (
            <div
              className="selection-marquee"
              style={{
                left: canvas.marquee.x,
                top: canvas.marquee.y,
                width: canvas.marquee.width,
                height: canvas.marquee.height,
              }}
            />
          )}
          {activeItems.length > 1 && selectionBounds && (
            <div
              className="multi-selection-bounds"
              style={{
                left: selectionBounds.x - 5,
                top: selectionBounds.y - 5,
                width: selectionBounds.width + 10,
                height: selectionBounds.height + 10,
              }}
            />
          )}
          {tool === "rotate" &&
            selectionBounds &&
            editableSelection.some((item) => item.kind !== "collection") && (
              <>
                <div
                  className="rotation-stem"
                  style={{
                    left: selectionBounds.x + selectionBounds.width / 2,
                    top: selectionBounds.y - 32 / view.zoom,
                    height: 32 / view.zoom,
                  }}
                />
                <button
                  type="button"
                  className="rotation-handle"
                  aria-label="Drag to rotate selected objects"
                  title="Drag to rotate · Shift to snap"
                  style={{
                    left: selectionBounds.x + selectionBounds.width / 2,
                    top: selectionBounds.y - 32 / view.zoom,
                    transform: `translate(-50%, -50%) scale(${1 / view.zoom})`,
                  }}
                  onPointerDown={(event) => canvas.startRotation(event)}
                >
                  <RotateCcw size={16} />
                </button>
                <span
                  className="rotation-angle"
                  style={{
                    left: selectionBounds.x + selectionBounds.width / 2 + 24 / view.zoom,
                    top: selectionBounds.y - 40 / view.zoom,
                    transform: `scale(${1 / view.zoom})`,
                  }}
                >
                  {Math.round(rotationAngle)}°
                </span>
              </>
            )}
          {editableSelection.length > 0 &&
            selectionBounds &&
            tool === "select" &&
            !canvas.gesture && (
              <div
                className="selection-actions"
                role="toolbar"
                aria-label="Selected elements"
                style={{
                  left: selectionBounds.x,
                  top: selectionBounds.y - 46 / view.zoom,
                  transform: `scale(${1 / view.zoom})`,
                  transformOrigin: "top left",
                }}
              >
                {selectedIds.length > 1 && (
                  <span className="selected-label">{selectedIds.length} selected</span>
                )}
                {selected?.kind === "sticky" && (
                  <div className="note-colors">
                    {noteColors.map((color, index) => (
                      <button
                        type="button"
                        key={color}
                        style={{ backgroundColor: color }}
                        aria-label={`Note color ${["yellow", "pink", "green", "blue", "purple"][index]}`}
                        aria-pressed={selected.color === color}
                        onClick={() =>
                          dispatch({ type: "update", id: selected.id, changes: { color } })
                        }
                      />
                    ))}
                  </div>
                )}
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Duplicate selected elements"
                  title="Duplicate"
                  onClick={canvas.duplicateSelection}
                >
                  <Copy size={14} />
                </button>
                <button
                  className="icon-button delete-element"
                  type="button"
                  aria-label="Delete selected elements"
                  title="Delete"
                  onClick={canvas.deleteSelection}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
        </div>
      </div>
      <Sidebar
        boardTitle={document.title}
        onTitleChange={onRename}
        tool={tool}
        onTool={(next) => {
          imagePlacement.cancel();
          canvas.changeTool(next);
        }}
        onAdd={(kind) => {
          if (kind === "image") imagePlacement.choose();
          else {
            imagePlacement.cancel();
            canvas.addItem(kind);
          }
        }}
        onFiles={() => {
          imagePlacement.cancel();
          onExit();
        }}
      />
      <button
        className="elements-toggle"
        type="button"
        aria-label="Toggle layers panel"
        aria-expanded={layersOpen}
        onClick={() => setLayersOpen(!layersOpen)}
      >
        <Layers size={19} />
      </button>
      <LayersPanel
        items={board.items}
        selectedIds={selectedIds}
        onSelect={canvas.selectFromPanel}
        onUpdate={(id, changes) => dispatch({ type: "update", id, changes })}
        onReorder={(ids, targetId, position) =>
          dispatch({ type: "reorder", ids, targetId, position })
        }
        onShare={() => {
          imagePlacement.cancel();
          setSharingOpen(true);
        }}
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
      />
      <BottomToolbar
        tool={tool}
        onTool={(next) => {
          imagePlacement.cancel();
          canvas.changeTool(next);
        }}
        canUndo={canvas.history.past.length > 0}
        canRedo={canvas.history.future.length > 0}
        canRotate={editableSelection.some((item) => item.kind !== "collection")}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onRotate={() => {
          imagePlacement.cancel();
          canvas.rotateSelection();
        }}
      />
      <div className="canvas-status">
        <button
          type="button"
          onClick={canvas.resetZoom}
          title="Reset zoom to 100%"
          aria-label="Reset canvas zoom"
        >
          {Math.round(view.zoom * 100)}%
        </button>
        {canvas.selectedEdges.length > 0 && (
          <span>
            {canvas.selectedEdges.length}{" "}
            {canvas.selectedEdges.length === 1 ? "connection" : "connections"} selected
          </span>
        )}
      </div>
      <AppSwitcher />
      <input
        ref={imagePlacement.inputRef}
        type="file"
        accept="image/*"
        aria-label="Choose an image"
        hidden
        onChange={imagePlacement.onChange}
      />
      {imagePlacement.pending && (
        <div
          className="image-placement-cursor"
          style={{ left: imagePlacement.cursor.x + 12, top: imagePlacement.cursor.y + 12 }}
          role="status"
        >
          <Image
            src={imagePlacement.pending.src}
            alt=""
            width={imagePlacement.pending.width}
            height={imagePlacement.pending.height}
            unoptimized
          />
          <span>{imagePlacement.pending.name}</span>
          <small>Click to place · Esc to cancel</small>
        </div>
      )}
      {sharingOpen && (
        <ShareBoardDialog title={document.title} onClose={() => setSharingOpen(false)} />
      )}
      <div
        className={`board-notice ${canvas.notice ? "is-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {canvas.notice}
      </div>
    </main>
  );
}
