import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve("dist");
const repositoryPath = "/Dangoui-Design-System-Skill";
const textExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".svg"]);
const publicRoots = ["assets", "brand-previews", "brand-registry", "data"];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(filePath);
      continue;
    }

    if (!textExtensions.has(path.extname(entry.name))) continue;

    const source = await readFile(filePath, "utf8");
    let rewritten = source;

    for (const root of publicRoots) {
      const publicPath = `/${root}/`;
      const matcher = new RegExp("(^|[\\s\\\"'`(=:,])" + publicPath, "g");
      rewritten = rewritten.replace(matcher, `$1${repositoryPath}${publicPath}`);
    }

    rewritten = rewritten.replace(
      /(^|[\s\"'`(=:,])\/favicon\.svg/g,
      `$1${repositoryPath}/favicon.svg`,
    );

    if (rewritten !== source) await writeFile(filePath, rewritten);
  }
}

await visit(outputDirectory);
console.log(`Rewrote GitHub Pages public paths with base ${repositoryPath}/`);
