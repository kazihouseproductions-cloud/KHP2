export type ImportOption = { value: string; label: string; detail?: string };
export type ImportQuestion = {
  kind: "shot" | "choose" | "parent";
  title: string;
  description: string;
  options: ImportOption[];
};
export type AskImport = (question: ImportQuestion) => Promise<string>;

function button(text: string, className: string, click: () => void) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = text;
  node.onclick = click;
  return node;
}

/** Native modal semantics provide focus containment and restore the initiating control. */
export function askImport(
  question: ImportQuestion,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const dialog = document.createElement("dialog");
    dialog.className = "sf-dialog sf-import-dialog";
    const title = document.createElement("h2");
    title.id = crypto.randomUUID();
    title.textContent = question.title;
    title.tabIndex = -1;
    const description = document.createElement("p");
    description.id = crypto.randomUUID();
    description.textContent = question.description;
    dialog.setAttribute("aria-labelledby", title.id);
    dialog.setAttribute("aria-describedby", description.id);
    dialog.append(title, description);
    let closed = false;
    function finish(answer?: string) {
      if (closed) return;
      closed = true;
      signal.removeEventListener("abort", cancel);
      dialog.close();
      dialog.remove();
      if (answer === undefined)
        reject(new DOMException("Import canceled.", "AbortError"));
      else resolve(answer);
    }
    const cancel = () => finish();
    const form = document.createElement("form");
    const choices = document.createElement("div");
    choices.className = "sf-import-choices";
    const actions = document.createElement("div");
    actions.className = "sf-import-actions";
    actions.append(button("Cancel", "sf-import-cancel", cancel));
    if (question.kind === "parent") {
      const label = document.createElement("label");
      label.textContent = "Destination";
      const select = document.createElement("select");
      const blank = new Option("Choose a destination", "", true, true);
      blank.disabled = true;
      select.add(blank);
      for (const option of question.options)
        select.add(new Option(option.label, option.value));
      select.required = true;
      label.append(select);
      form.append(label);
      form.onsubmit = (e) => {
        e.preventDefault();
        finish(select.value);
      };
    } else {
      for (const option of question.options) {
        const choice = button("", "sf-import-option", () =>
          finish(option.value),
        );
        const label = document.createElement("strong");
        label.textContent = option.label;
        choice.append(label);
        if (option.detail) {
          const detail = document.createElement("span");
          detail.textContent = option.detail;
          choice.append(detail);
        }
        choices.append(choice);
      }
      if (question.options.length) form.append(choices);
      if (question.kind === "shot") {
        const fields = document.createElement("div");
        fields.className = "sf-import-fields";
        const inputs = ["Scene", "Shot"].map((name) => {
          const label = document.createElement("label");
          label.textContent = name;
          const input = document.createElement("input");
          input.inputMode = "numeric";
          input.pattern = "[0-9]+";
          input.required = true;
          input.placeholder = name === "Scene" ? "01" : "02";
          label.append(input);
          fields.append(label);
          return input;
        });
        form.append(fields);
        form.onsubmit = (e) => {
          e.preventDefault();
          finish(inputs.map((i) => i.value).join("_"));
        };
      } else form.onsubmit = (e) => e.preventDefault();
    }
    if (question.kind !== "choose") {
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "sf-primary";
      submit.textContent =
        question.kind === "shot" ? "Use these numbers" : "Use destination";
      actions.append(submit);
    }
    form.append(actions);
    dialog.append(form);
    dialog.oncancel = (e) => {
      e.preventDefault();
      cancel();
    };
    dialog.onclose = cancel;
    dialog.onkeydown = (e) => e.stopPropagation();
    signal.addEventListener("abort", cancel, { once: true });
    document.body.append(dialog);
    try {
      dialog.showModal();
      title.focus();
    } catch (error) {
      signal.removeEventListener("abort", cancel);
      dialog.remove();
      reject(error);
    }
  });
}
