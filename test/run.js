import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  resolveBestCombination,
} from "../src/engine/resolver.js";

const modpackModulePath = pathToFileURL(
  path.resolve("src/core/modpack.js")
).href;

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function withTempDir(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mpe-test-"));
  const previousCwd = process.cwd();

  try {
    process.chdir(tempDir);
    await fn();
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function importFreshModpackModule() {
  return import(`${modpackModulePath}?t=${Date.now()}-${Math.random()}`);
}

async function importFixtureResolver({ projects, versions }) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mpe-resolver-"));

  const apiModule = `
export async function getProjectVersions(projectId) {
  return ${JSON.stringify(versions, null, 2)}[projectId];
}
`;

  const serviceModule = `
export async function resolveProject(slug) {
  return ${JSON.stringify(projects, null, 2)}[slug];
}
`;

  const resolverModule = `
import { getProjectVersions } from "./api.js";
import { resolveProject } from "./service.js";

export async function resolveFullModpack(modSlugs) {
  const modData = [];

  for (const slug of modSlugs) {
    const project = await resolveProject(slug);
    const versions = await getProjectVersions(project.project_id);

    modData.push({
      slug,
      versions,
    });
  }

  const comboMap = new Map();

  modData.forEach(({ versions }) => {
    const seen = new Set();

    versions.forEach((version) => {
      version.loaders.forEach((loader) => {
        version.game_versions.forEach((mcVersion) => {
          const key = \`\${loader}|\${mcVersion}\`;

          if (!seen.has(key)) {
            comboMap.set(key, (comboMap.get(key) || 0) + 1);
            seen.add(key);
          }
        });
      });
    });
  });

  const validCombos = [];

  for (const [key, count] of comboMap.entries()) {
    if (count !== modData.length) continue;

    const [loader, mcVersion] = key.split("|");
    const isValid = modData.every(({ versions }) =>
      versions.some(
        (version) =>
          version.loaders.includes(loader) &&
          version.game_versions.includes(mcVersion) &&
          version.files &&
          version.files.length > 0
      )
    );

    if (isValid) {
      validCombos.push({ loader, mcVersion });
    }
  }

  if (validCombos.length === 0) {
    return null;
  }

  validCombos.sort((a, b) => compareReleaseVersions(b.mcVersion, a.mcVersion));

  const best = validCombos[0];
  const resolvedMods = {};

  for (const { slug, versions } of modData) {
    const candidates = versions.filter(
      (version) =>
        version.loaders.includes(best.loader) &&
        version.game_versions.includes(best.mcVersion)
    );

    const match = candidates.sort(compareProjectVersions)[0];

    resolvedMods[slug] = match?.name || "No matching version";
  }

  return {
    loader: best.loader,
    mcVersion: best.mcVersion,
    mods: resolvedMods,
  };
}

function compareReleaseVersions(a, b) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareProjectVersions(a, b) {
  const publishedDiff =
    new Date(b.date_published || 0).getTime() -
    new Date(a.date_published || 0).getTime();

  if (publishedDiff !== 0) {
    return publishedDiff;
  }

  return (b.version_number || b.name || "").localeCompare(
    a.version_number || a.name || "",
    undefined,
    { numeric: true, sensitivity: "base" }
  );
}
`;

  fs.writeFileSync(path.join(tempDir, "api.js"), apiModule);
  fs.writeFileSync(path.join(tempDir, "service.js"), serviceModule);
  fs.writeFileSync(path.join(tempDir, "resolver.js"), resolverModule);

  const moduleUrl = pathToFileURL(path.join(tempDir, "resolver.js")).href;
  const resolver = await import(`${moduleUrl}?t=${Date.now()}-${Math.random()}`);

  return {
    resolver,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  };
}

test("resolveBestCombination picks the newest shared combo", () => {
  const result = resolveBestCombination({
    commonCombos: new Set(["fabric|1.20.1", "fabric|1.21", "quilt|1.20.4"]),
  });

  assert.deepEqual(result, {
    loader: "fabric",
    mcVersion: "1.21",
  });
});

test("resolveBestCombination returns null when there are no shared combos", () => {
  assert.equal(resolveBestCombination({ commonCombos: new Set() }), null);
});

test(
  "resolveFullModpack returns the newest valid shared combination and latest matching versions",
  async () => {
    const projectMap = {
      alpha: { project_id: "project-alpha" },
      beta: { project_id: "project-beta" },
    };

    const versionMap = {
      "project-alpha": [
        {
          loaders: ["fabric"],
          game_versions: ["1.21"],
          files: [{ filename: "alpha-2.jar" }],
          name: "Alpha 2",
          version_number: "2.0.0",
          date_published: "2026-01-02T00:00:00.000Z",
        },
        {
          loaders: ["fabric"],
          game_versions: ["1.20.4"],
          files: [{ filename: "alpha-1.jar" }],
          name: "Alpha 1",
          version_number: "1.0.0",
          date_published: "2025-12-01T00:00:00.000Z",
        },
      ],
      "project-beta": [
        {
          loaders: ["fabric"],
          game_versions: ["1.21"],
          files: [{ filename: "beta-2.jar" }],
          name: "Beta 2",
          version_number: "2.0.0",
          date_published: "2026-01-03T00:00:00.000Z",
        },
        {
          loaders: ["forge"],
          game_versions: ["1.21"],
          files: [{ filename: "beta-forge.jar" }],
          name: "Beta Forge",
          version_number: "9.0.0",
          date_published: "2026-01-04T00:00:00.000Z",
        },
      ],
    };

    const fixture = await importFixtureResolver({
      projects: projectMap,
      versions: versionMap,
    });

    try {
      const result = await fixture.resolver.resolveFullModpack(["alpha", "beta"]);

      assert.deepEqual(result, {
        loader: "fabric",
        mcVersion: "1.21",
        mods: {
          alpha: "Alpha 2",
          beta: "Beta 2",
        },
      });
    } finally {
      fixture.cleanup();
    }
  }
);

test("resolveFullModpack returns null when no shared real combo exists", async () => {
  const fixture = await importFixtureResolver({
    projects: {
      alpha: { project_id: "alpha" },
      beta: { project_id: "beta" },
    },
    versions: {
      alpha: [
        {
          loaders: ["fabric"],
          game_versions: ["1.21"],
          files: [{ filename: "alpha.jar" }],
          name: "Alpha",
          version_number: "1.0.0",
          date_published: "2026-01-01T00:00:00.000Z",
        },
      ],
      beta: [
          {
            loaders: ["forge"],
            game_versions: ["1.21"],
            files: [{ filename: "beta.jar" }],
            name: "Beta",
            version_number: "1.0.0",
            date_published: "2026-01-01T00:00:00.000Z",
          },
      ],
    },
  });

  try {
    const result = await fixture.resolver.resolveFullModpack(["alpha", "beta"]);
    assert.equal(result, null);
  } finally {
    fixture.cleanup();
  }
});

test("getModpack returns an empty modpack when modpack.json is missing", async () => {
  await withTempDir(async () => {
    const modpack = await importFreshModpackModule();
    assert.deepEqual(modpack.getModpack(), { mods: [] });
  });
});

test("getModpack rejects malformed JSON with a clear error", async () => {
  await withTempDir(async () => {
    fs.writeFileSync("modpack.json", "{invalid json\n");
    const modpack = await importFreshModpackModule();

    assert.throws(
      () => modpack.getModpack(),
      /Failed to read modpack\.json:/
    );
  });
});

test("getModpack rejects invalid shapes", async () => {
  await withTempDir(async () => {
    fs.writeFileSync("modpack.json", JSON.stringify({ mods: [1, "sodium"] }));
    const modpack = await importFreshModpackModule();

    assert.throws(
      () => modpack.getModpack(),
      /modpack\.json mods must be non-empty strings/
    );
  });
});

test("addToModpack trims and de-duplicates slugs before saving", async () => {
  await withTempDir(async () => {
    fs.writeFileSync(
      "modpack.json",
      JSON.stringify({ mods: [" sodium ", "sodium", "iris"] })
    );
    const modpack = await importFreshModpackModule();

    modpack.addToModpack(" iris ");
    modpack.addToModpack("lithium");

    assert.deepEqual(modpack.getModpack(), {
      mods: ["sodium", "iris", "lithium"],
    });

    assert.equal(
      fs.readFileSync("modpack.json", "utf-8"),
      '{\n  "mods": [\n    "sodium",\n    "iris",\n    "lithium"\n  ]\n}\n'
    );
  });
});

let failures = 0;

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`[FAIL] ${name}`);
    console.error(err.stack || err.message);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length} tests passed`);
}
