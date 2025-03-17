import * as lib from "./lib";
import { processVault } from "./obsidian.vault.process";

export * from "./types";

const metamark = {
  processFolder: processVault, //obsidian-optimized method




  // LEGACY export structure (metamark):
  obsidian: {
    vault: {
      process: processVault,
    },
  },
  utility: {
    ...lib.utility,
  },
};

export default metamark;
export const processFolder = processVault; 