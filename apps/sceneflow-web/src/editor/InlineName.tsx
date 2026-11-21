import { type Ref, useRef, useState } from "react";

export default function InlineName({
  value,
  label,
  className,
  maxLength,
  id,
  inputRef,
  readOnly,
  onActivate,
  onSave,
}: {
  value: string;
  label: string;
  className: string;
  maxLength: number;
  id?: string;
  inputRef?: Ref<HTMLInputElement>;
  readOnly?: boolean;
  onActivate?: () => void;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const discard = useRef(false);
  return (
    <input
      id={id}
      ref={inputRef}
      type="text"
      className={`sf-inline-name ${className}`}
      aria-label={label}
      title={readOnly ? value : `Rename ${value}`}
      maxLength={maxLength}
      value={draft ?? value}
      readOnly={readOnly}
      spellCheck={false}
      onFocus={onActivate}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        const name = e.currentTarget.value.trim();
        if (
          !discard.current &&
          !readOnly &&
          draft !== null &&
          name &&
          name !== value
        )
          onSave(name);
        discard.current = false;
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (
          e.nativeEvent.isComposing ||
          e.nativeEvent.keyCode === 229 ||
          (e.key !== "Enter" && e.key !== "Escape")
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        discard.current = e.key === "Escape";
        e.currentTarget.blur();
      }}
    />
  );
}
