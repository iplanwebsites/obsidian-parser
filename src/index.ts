import * as lib from "./lib";
import { processFolder } from "./processFolder";

export * from "./types";

const metamark = {
   processFolder, //obsidian-optimized method




  // LEGACY export structure (metamark):
  obsidian: {
    vault: {
      process: processFolder,
    },
  },
  utility: {
    ...lib.utility,
  },
};

export default metamark;


export { processFolder };