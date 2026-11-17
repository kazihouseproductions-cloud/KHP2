import {
  type ChangeEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Point } from "@/lib/board-geometry";
import type { BoardImage } from "@/lib/board-model";

export function useImagePlacement({
  onPlace,
  onRetain,
  onSelect,
  announce,
}: {
  onPlace: (image: BoardImage, point: Point) => void;
  onRetain: (url: string) => void;
  onSelect: () => void;
  announce: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BoardImage | null>(null);
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  const pendingRef = useRef<BoardImage | null>(null);
  const urlRef = useRef<string | null>(null);
  const cursorRef = useRef<Point>({ x: 0, y: 0 });
  const requestRef = useRef(0);
  const cancel = useCallback(() => {
    requestRef.current += 1;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    pendingRef.current = null;
    setPending(null);
  }, []);
  useEffect(() => {
    function move(event: globalThis.PointerEvent) {
      cursorRef.current = { x: event.clientX, y: event.clientY };
      if (pendingRef.current) setCursor(cursorRef.current);
    }
    function key(event: KeyboardEvent) {
      if (
        urlRef.current &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        ["v", "h", "c", "n", "t"].includes(event.key.toLowerCase()) &&
        !(event.target as HTMLElement).closest("input, textarea, [contenteditable], dialog")
      )
        cancel();
      if (event.key === "Escape" && urlRef.current) {
        event.preventDefault();
        cancel();
      }
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("keydown", key);
      requestRef.current += 1;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [cancel]);

  function choose() {
    cancel();
    onSelect();
    inputRef.current?.click();
  }
  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    cancel();
    if (file.type && !file.type.startsWith("image/")) {
      announce("Choose an image file.");
      return;
    }
    const request = ++requestRef.current;
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error("Image could not be opened"));
        image.src = url;
      });
      if (request !== requestRef.current) return;
      if (!dimensions.width || !dimensions.height) throw new Error("Empty image");
      const image = { src: url, name: file.name, ...dimensions };
      pendingRef.current = image;
      setPending(image);
      setCursor(cursorRef.current);
    } catch {
      if (request === requestRef.current) {
        cancel();
        announce("This image could not be opened. Choose another file.");
      }
    }
  }
  function onPointerDownCapture(event: PointerEvent<HTMLDivElement>) {
    const image = pendingRef.current;
    if (!image || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onPlace(image, { x: event.clientX, y: event.clientY });
    onRetain(image.src);
    urlRef.current = null;
    pendingRef.current = null;
    setPending(null);
  }
  return { inputRef, pending, cursor, choose, cancel, onChange, onPointerDownCapture };
}
