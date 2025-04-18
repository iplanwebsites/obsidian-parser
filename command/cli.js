#!/usr/bin/env node

// cli.js
import { Command } from "commander";
import path from "path";
import fs from "node:fs";

import {
  processFolder,
  processMedia,
  jsonStringify,
  writeToFileSync,
  toSlug,
} from "../dist/index.js";

const program = new Command();

program
  .name("obsidian-to-json")
  .description("Convert Obsidian vault to JSON")
  .version("1.0.0")
  .requiredOption("-i, --input <path>", "Input directory path (Obsidian vault)")
  .option("-o, --output <path>", "Output JSON file path", "vault-output.json")
  .option("-n, --note-prefix <prefix>", "Note path prefix", "/notes")
  .option("-a, --asset-prefix <prefix>", "Asset path prefix", "/assets")
  .option("-d, --debug <level>", "Debug level (0-3)", "1")
  // Add media processing options
  .option("--media-output <path>", "Media output folder path", "public/media")
  .option("--media-prefix <prefix>", "Media path prefix", "/media")
  .option("--optimize-images", "Optimize images", true)
  .option("--skip-media", "Skip media processing", false)
  .option("--skip-existing", "Skip processing existing media files", false)
  .option(
    "--force-reprocess-medias",
    "Force reprocessing of media files even if they exist",
    false
  )
  .option("--domain <url>", "Domain for absolute public paths")
  .option(
    "--use-absolute-paths",
    "Use absolute paths with domain for media replacements in articles",
    true
  )
  .option(
    "--media-results <path>",
    "Save media processing results to a JSON file",
    "media-results.json"
  )
  .parse(process.argv);

const options = program.opts();

// Self-invoking async function to allow top-level await
(async () => {
  try {
    // Convert relative paths to absolute
    const inputPath = path.resolve(process.cwd(), options.input);
    const outputPath = path.resolve(process.cwd(), options.output);
    const mediaOutputPath = path.resolve(process.cwd(), options.mediaOutput);
    const debugLevel = parseInt(options.debug);

    // Determine media results path - put in same directory as main output
    const mediaResultsPath = path.resolve(
      path.dirname(outputPath),
      options.mediaResults
    );

    console.log(`🚀 Starting Obsidian vault conversion`);
    console.log(`📂 Input: ${inputPath}`);
    console.log(`📄 Output: ${outputPath}`);
    console.log(`🖼️ Media output: ${mediaOutputPath}`);
    if (options.skipExisting) {
      console.log(`⏭️ Skip existing files: Enabled`);
    }
    if (options.forceReprocessMedias) {
      console.log(`🔄 Force reprocessing of media files: Enabled`);
    }
    if (options.domain) {
      console.log(`🌐 Domain for absolute paths: ${options.domain}`);
    }

    // Process media files first if not skipped
    let mediaData = [];
    let mediaPathMap = {};

    if (!options.skipMedia) {
      console.log(`🔄 Processing media files...`);

      const mediaResult = await processMedia(inputPath, {
        mediaOutputFolder: mediaOutputPath,
        mediaPathPrefix: options.mediaPrefix,
        optimizeImages: options.optimizeImages,
        skipExisting: options.skipExisting,
        forceReprocessMedias: options.forceReprocessMedias,
        domain: options.domain,
        debug: debugLevel,
      });

      mediaData = mediaResult.mediaData;
      mediaPathMap = mediaResult.pathMap;

      console.log(`✅ Processed ${mediaData.length} media files`);

      // Save media results to JSON file
      const mediaResultsJson = jsonStringify({
        mediaData,
        mediaPathMap,
      });

      writeToFileSync(mediaResultsPath, mediaResultsJson);
      console.log(`📝 Media results saved to: ${mediaResultsPath}`);
    } else {
      console.log(`⏭️ Skipping media processing`);
    }

    // Process the vault
    console.log(`🔄 Processing markdown files...`);

    const vaultData = await processFolder(inputPath, {
      debug: debugLevel,
      notePathPrefix: options.notePrefix,
      assetPathPrefix: options.assetPrefix,
      domain: options.domain,
      imgLinkBuilderOpts: {
        prefix: options.assetPrefix,
        toSlug: toSlug,
      },
      mediaData: mediaData,
      mediaPathMap: mediaPathMap,
      useAbsolutePaths: options.useAbsolutePaths,
    });

    // Convert to JSON and save
    console.log(`💾 Saving output to JSON...`);
    const jsonString = jsonStringify(vaultData);
    writeToFileSync(outputPath, jsonString);

    console.log(`✨ Successfully processed ${vaultData.length} files`);
    console.log(`📝 Output saved to: ${outputPath}`);
  } catch (error) {
    console.error(`❌ Error processing vault: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
})();

// Usage examples:
// npm run convert -- -i test/testVault -o testOutput.json
// npm run convert -- -i test/testVault -o testOutput.json --media-output public/assets --media-prefix /assets
// npm run convert -- -i test/testVault -o testOutput.json --skip-media
// npm run convert -- -i test/testVault -o testOutput.json --skip-existing
// npm run convert -- -i test/testVault -o testOutput.json --force-reprocess-medias
// npm run convert -- -i test/testVault -o testOutput.json --media-results media-data.json
// npm run convert -- -i test/testVault -o testOutput.json --domain https://example.com
