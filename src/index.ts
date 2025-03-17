import * as lib from "./lib";
import { processFolder } from "./processFolder";

export * from "./types";

export * from "./lib/utility"; ///export all utilities to top level


  // LEGACY export structure (metamark):
const metamark = {
  ...lib.utility,
  processFolder,


  obsidian: {
    vault: {
      process: processFolder,
    },
  },
  utility: {
    ...lib.utility,
  },
};

  export default metamark; //legacy export


  export { processFolder };

