import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("./") && !/\.\w+$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});
const { emptyProject } = await import("./types.ts");
const { filenameShots, placeIntake, renderSpans, resolveShot, visibleAt } =
  await import("./mediaPlan.ts");
const intake = (name, duration) => ({
  name,
  version: {
    id: crypto.randomUUID(),
    mediaId: "blob",
    duration,
    filename: `${name}.mp4`,
    author: "Editor",
    created: 1,
    thumbnail: "",
    stage: "Not Set",
  },
});
const unexpected = (question) => {
  throw Error(`Unexpected question: ${question.title}`);
};
const add = (p, target, ...items) =>
  placeIntake(p, target, items, "Editor", unexpected);
const parent = { kind: "cell", layerId: "parent", time: 0 };

test("shot parsing detects pairs inside a filename without assuming the first pair is correct", () => {
  assert.deepEqual(filenameShots("prefix_1_002_final.mov"), ["01_02"]);
  assert.deepEqual(filenameShots("alpha_01_02_beta_03_04.webm"), [
    "01_02",
    "03_04",
  ]);
  assert.deepEqual(filenameShots("01_02_03.webm"), ["01_02", "02_03"]);
  assert.deepEqual(filenameShots("animatic.mov"), []);
});

test("resolve a written scene and shot in order without prompting", async () => {
  for (const filename of [
    "01_04.mov",
    "animation_01_04_final.mov",
    "01_04_01_04.mov",
    "render-01_04-01.mov",
    "KHP04_01_04.mov",
    "version_04_01_04_take_01.mov",
    "ep04_01_04_v02.mov",
    "Scene01_Shot004_take01.mov",
    "anim_01-04_v02.mov",
  ]) {
    assert.equal(await resolveShot(filename, unexpected), "01_04", filename);
  }
  assert.equal(await resolveShot("04_01.mov", unexpected), "04_01");
});

test("ask about competing or missing pairs and accept the editor's numbers", async () => {
  for (const [filename, candidates] of [
    ["01_04_to_04_01.mov", ["01_04", "04_01"]],
    ["01_04_01.mov", ["01_04", "04_01"]],
    ["take_04_v01.mov", []],
  ]) {
    const result = await resolveShot(filename, (question) => {
      assert.equal(question.kind, "shot");
      assert.deepEqual(
        question.options.map((option) => option.value),
        candidates,
      );
      return "7_11";
    });
    assert.equal(result, "07_11");
  }
});

test("choosing a different parent keeps the resolved filename as the child's shot", async () => {
  const p = emptyProject();
  await add(p, parent, intake("04_01", 2));
  const name = await resolveShot("01_04_01_04.mov", unexpected);
  await placeIntake(
    p,
    { kind: "new-layer", layerId: "parent", time: 0 },
    [intake(name, 1)],
    "Editor",
    (question) => {
      assert.equal(question.kind, "parent");
      assert.ok(question.title.includes("01_04"));
      return p.clips[0].id;
    },
  );
  assert.equal(p.clips.at(-1).name, "01_04");
  assert.equal(p.clips.at(-1).parentId, p.clips[0].id);
});

test("natural parent ordering, new-layer matching and explicit cell ownership are distinct", async () => {
  const p = emptyProject();
  await add(p, parent, intake("01_10", 2), intake("01_02", 3));
  assert.deepEqual(
    p.clips.map((c) => [c.name, c.start]),
    [
      ["01_02", 0],
      ["01_10", 3],
    ],
  );
  await add(
    p,
    { kind: "new-layer", layerId: "parent", time: 0 },
    intake("01_10", 1),
  );
  const child = p.clips.at(-1);
  assert.deepEqual(
    [p.layers[1].name, child.start, child.parentId],
    ["new layer", 3, p.clips[1].id],
  );
  await add(
    p,
    { kind: "cell", layerId: p.layers[1].id, parentId: p.clips[0].id, time: 2 },
    intake("01_10", 1),
  );
  assert.deepEqual(
    [p.clips.at(-1).start, p.clips.at(-1).parentId],
    [0, p.clips[0].id],
  );
});

test("hiding one child reveals the lower layer in playback and full export", async () => {
  const p = emptyProject();
  await add(p, parent, intake("01_01", 2), intake("01_02", 2));
  await add(
    p,
    { kind: "new-layer", layerId: "parent", time: 0 },
    intake("01_01", 2),
    intake("01_02", 2),
  );
  const [firstParent, secondParent, firstChild, secondChild] = p.clips;
  assert.equal(visibleAt(p, 0), firstChild);
  firstChild.hidden = true;
  assert.equal(visibleAt(p, 1), firstParent);
  assert.equal(visibleAt(p, 2), secondChild);
  assert.deepEqual(
    renderSpans(p).map((s) => s.clip?.id),
    [firstParent.id, secondChild.id],
  );
  p.layers[1].visible = false;
  assert.equal(visibleAt(p, 2), secondParent);
  p.layers[1].visible = true;
  assert.equal(visibleAt(p, 0), firstParent);
  firstChild.hidden = false;
  assert.equal(visibleAt(p, 0), firstChild);
});

test("fallback uses the slipped source range and selected export keeps only that placement", async () => {
  const p = emptyProject();
  await add(p, parent, intake("01_01", 10));
  await add(
    p,
    { kind: "new-layer", layerId: "parent", time: 0 },
    intake("01_01", 8),
  );
  const [base, upper] = p.clips;
  upper.offset = 2;
  upper.length = 10;
  assert.equal(visibleAt(p, 5.99), upper);
  assert.equal(visibleAt(p, 6), base);
  assert.equal(visibleAt(p, 10), undefined);
  assert.deepEqual(
    renderSpans(p).map((s) => [s.start, s.end, s.clip?.id, s.offset]),
    [
      [0, 6, upper.id, 2],
      [6, 10, base.id, 6],
    ],
  );
  assert.deepEqual(
    renderSpans(p, upper).map((s) => [s.start, s.end, s.clip?.id]),
    [
      [0, 6, upper.id],
      [6, 10, undefined],
    ],
  );
  p.layers[1].visible = false;
  assert.equal(visibleAt(p, 0), base);
});

test("a longer replacement shifts parents and children only after an explicit decision", async () => {
  const p = emptyProject();
  await add(p, parent, intake("01_01", 2), intake("01_02", 2));
  await add(
    p,
    { kind: "new-layer", layerId: "parent", time: 0 },
    intake("01_02", 2),
  );
  const [a, b, child] = p.clips;
  const target = { kind: "version", layerId: "parent", clipId: a.id, time: 0 };
  const original = a.active;
  const replace = (answer) =>
    placeIntake(p, target, [intake("", 5)], "Editor", answer);
  await assert.rejects(
    replace(() => {
      throw Error("canceled");
    }),
    /canceled/,
  );
  assert.equal(a.active, original);
  await replace(() => "keep");
  assert.deepEqual([a.length, b.start, child.start], [2, 2, 2]);
  await replace(() => "source");
  assert.deepEqual([a.length, b.start, child.start], [5, 5, 5]);
  assert.equal(a.versions[0].id, original);
  assert.equal(a.versions.length, 3);
  assert.equal(a.active, a.versions[2].id);
});

test("a newly linked child can keep its cell length or use the full source", async () => {
  for (const targetKind of ["cell", "new-layer"])
    for (const choice of ["keep", "source"]) {
      const p = emptyProject();
      await add(p, parent, intake("01_02", 8));
      p.layers.push({
        id: "upper",
        name: "Animatics",
        visible: true,
        locked: false,
      });
      const file = intake("01_02", 12);
      const target = {
        kind: targetKind,
        layerId: targetKind === "cell" ? "upper" : "parent",
        time: 0,
        parentId: p.clips[0].id,
      };
      let prompts = 0;
      await placeIntake(p, target, [file], "Editor", async (question) => {
        prompts++;
        assert.deepEqual(
          question.options.map((o) => o.label),
          ["Keep Cell Length", "Use Source Duration"],
        );
        return choice;
      });
      assert.equal(prompts, 1);
      const child = p.clips.at(-1);
      assert.equal(child.length, choice === "keep" ? 8 : 12);
      assert.deepEqual(
        [child.parentId, child.start, child.versions[0].duration],
        [p.clips[0].id, 0, 12],
      );
      assert.equal(p.clips[0].length, 8);
    }
});

test("keeping a longer child's source duration shifts the next parent and every layer in the same batch", async () => {
  const p = emptyProject();
  await add(
    p,
    parent,
    intake("01_01", 2),
    intake("01_02", 2),
    intake("01_03", 2),
  );
  const newLayer = { kind: "new-layer", layerId: "parent", time: 0 };
  await add(p, newLayer, intake("01_02", 1));
  await placeIntake(
    p,
    newLayer,
    [intake("01_01", 5), intake("01_02", 2)],
    "Editor",
    async (q) => {
      assert.equal(q.title, "Set child clip length");
      return "source";
    },
  );
  assert.deepEqual(
    p.clips.map((c) => [c.start, c.length]),
    [
      [0, 2],
      [5, 2],
      [7, 2],
      [5, 1],
      [0, 5],
      [5, 2],
    ],
  );
  const longer = p.clips[4];
  await placeIntake(
    p,
    { kind: "version", layerId: longer.layerId, clipId: longer.id, time: 0 },
    [intake("01_01", 7)],
    "Editor",
    async () => "source",
  );
  assert.deepEqual(
    p.clips.map((c) => c.start),
    [0, 7, 9, 7, 0, 7],
  );
  assert.equal(visibleAt(p, 6).id, longer.id);
});
