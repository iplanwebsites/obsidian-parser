import { expect, test } from "vitest";
import m from "../src/index";
import { processFolder, FileData, ProcessOptions } from "../src/index";

test("metamark exports", () => {
  // Legacy exports
  expect(m.obsidian.vault.process).toBeTypeOf("function");
  expect(m.utility.toSlug).toBeTypeOf("function");
  expect(m.utility.getFileName).toBeTypeOf("function");
  expect(m.utility.getFrontmatterAndMd).toBeTypeOf("function");
  
  // New direct exports
  expect(processFolder).toBeTypeOf("function");
});
