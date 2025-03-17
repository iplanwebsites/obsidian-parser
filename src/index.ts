import * as lib from "./lib";
import { processFolder } from "./processFolder";
import { processMedia, MediaFileData, MediaPathMap, ProcessMediaOptions } from "./processMedia";

export * from "./types";
export * from "./lib/utility"; // Export all utilities to top level

// Export the new media processing functionality
export { 
  processMedia,
  type MediaFileData,
  type MediaPathMap,
  type ProcessMediaOptions 
};

// LEGACY export structure (metamark):
const metamark = {
  ...lib.utility,
  processFolder,
  processMedia,

  obsidian: {
    vault: {
      process: processFolder,
      processMedia: processMedia,
    },
  },
  utility: {
    ...lib.utility,
  },
};

export default metamark; // Legacy export

export { processFolder };