// processFolder.ts

import slugify from "@sindresorhus/slugify";
import matter from "gray-matter";
import elixir from "highlight.js/lib/languages/elixir";
import { common as commonLanguagesRecord } from "lowlight";
import { Root as MdastRoot } from "mdast";
import fs from "node:fs";
import path from "node:path";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeExternalLinks from "rehype-external-links";
import rehypeHighlight from "rehype-highlight";
import rehypeMathjaxChtml from "rehype-mathjax/chtml";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkCallouts from "remark-callouts";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { remarkObsidianLink } from "remark-obsidian-link";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import m from ".";
import * as lib from "./lib";
import { toLinkBuilder } from "./toLinkBuilder";
import { Metamark } from "./types";
import { MediaFileData, MediaPathMap, ProcessMediaOptions } from "./processMedia";

// Extend existing types without redefining namespaces
declare module "./types" {
  namespace Metamark {
    namespace Obsidian {
      namespace Vault {
        interface ProcessOptions {
          // Make sure debug is explicitly declared
          debug?: number;
          // Add media-related properties
          mediaOptions?: ProcessMediaOptions;
          mediaData?: MediaFileData[];
          mediaPathMap?: MediaPathMap;
          // Option to determine if media details should be included in output
          includeMediaData?: boolean;
        }
      }
    }
  }
}

/**
 * Process an Obsidian vault directory and return file data for public files
 */
export async function processFolder(
  dirPath: string,
  opts?: Metamark.Obsidian.Vault.ProcessOptions,
): Promise<Metamark.Obsidian.Vault.FileData[]> {
  // Normalize the input path
  dirPath = path.normalize(dirPath);
  
  // Create logging function based on debug level
  const debugLevel = opts?.debug || 0;
  const log = createLogger(debugLevel);
  
  log(1, "🔍 Processing Obsidian vault: " + dirPath);
   
  // Get the allowed file paths (public files only)
  const allowedFiles: Set<string> =
    opts?.filePathAllowSetBuilder?.(dirPath) ??
    buildDefaultAllowedFileSet(dirPath, log);

  log(1, `📄 Found ${allowedFiles.size} allowed files to process`);

  // Build link transformer
  const toLink = toLinkBuilder({
    filePathAllowSet: allowedFiles,
    toSlug: m.utility.toSlug,
    prefix: opts?.notePathPrefix ?? "/content",
    ...(opts?.toLinkBuilderOpts || {})
  });

  // Create unified processor
  const processor = buildMarkdownProcessor({ toLink });

  // Media path map (can be passed in or will be empty if not available)
  const mediaPathMap: MediaPathMap = opts?.mediaPathMap || {};

  // Process pages
  const pages: Metamark.Obsidian.Vault.FileData[] = [];

  for (const filePath of allowedFiles) {
    // Skip non-markdown files
    if (typeof filePath !== 'string' || !filePath.endsWith('.md')) continue;
    
    try {
      log(2, `⚙️ Processing file: ${filePath}`);
      
      // Parse file
      const { name: fileName } = path.parse(filePath);
      const raw = fs.readFileSync(filePath, "utf8");
      const { content: markdown, data: frontmatter } = matter(raw);

      // Process to HTML
      const mdastRoot = processor.parse(markdown) as MdastRoot;
      let htmlString = processor.processSync(markdown).toString();

      // Replace image paths with optimized versions if available
      if (Object.keys(mediaPathMap).length > 0) {
        htmlString = replaceImagePaths(htmlString, mediaPathMap, dirPath);
        log(2, `🖼️ Replaced image paths in: ${fileName}`);
      }

      // Calculate relative path from vault root
      const relativePath = path.relative(dirPath, filePath);

      // Build file data object
      const file: Metamark.Obsidian.Vault.FileData = {
        fileName,
        slug: slugify(fileName, { decamelize: false }),
        frontmatter,
        firstParagraphText: lib.mdast.getFirstParagraphText(mdastRoot) ?? "",
        plain: lib.hast.getPlainText(htmlString),
        html: htmlString,
        toc: lib.hast.getToc(htmlString),
        originalFilePath: relativePath,
      };

      pages.push(file);
      log(2, `✅ Processed: ${fileName}`);
    } catch (error) {
      log(0, `❌ Error processing ${filePath}: ${error}`);
    }
  }

  log(1, `🎉 Successfully processed ${pages.length} files`);
  
  // If includeMediaData is true, add the media data to the first page object only
  // This is useful if you need the media data elsewhere but don't want to duplicate it
  if (opts?.includeMediaData && pages.length > 0 && opts?.mediaData) {
    // Create a special property on the first page to hold the media catalog
    // @ts-ignore - Adding custom property
    pages[0]._mediaData = opts.mediaData;
    log(1, `📊 Added media catalog to first page object`);
  }
  
  return pages;
}

/**
 * Replace image paths in HTML with optimized versions
 */
function replaceImagePaths(
  html: string, 
  mediaPathMap: MediaPathMap,
  basePath: string
): string {
  // Use regex to find image tags and replace their src attributes
  return html.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/g, (match, src) => {
    // Determine if this is a relative path that needs replacement
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
      // External or already absolute path, don't replace
      return match;
    }
    
    // Normalize path to match our media catalog
    let normalizedPath = src;
    
    // Check if it's in our media map
    if (mediaPathMap[normalizedPath]) {
      // Replace with optimized path
      const newSrc = mediaPathMap[normalizedPath];
      return match.replace(src, newSrc);
    }
    
    // Try checking with base path
    const fullPath = path.relative(basePath, path.resolve(basePath, normalizedPath));
    if (mediaPathMap[fullPath]) {
      const newSrc = mediaPathMap[fullPath];
      return match.replace(src, newSrc);
    }
    
    // If not found, keep original
    return match;
  });
}

/**
 * Build the unified processor with a single wiki link parser
 */
function buildMarkdownProcessor({ toLink }: { toLink: ReturnType<typeof toLinkBuilder> }) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkObsidianLink, { toLink })
    .use(remarkCallouts)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeExternalLinks)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypeHighlight, {
      languages: { ...commonLanguagesRecord, elixir },
    })
    .use(rehypeMathjaxChtml, {
      chtml: {
        fontURL: "https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2",
      },
    })
    .use(rehypeStringify);
}

/**
 * Build a set of allowed file paths (public files only)
 */
function buildDefaultAllowedFileSet(
  dirPath: string,
  log: (level: number, message: string) => void
): Set<string> {
  const allowedFiles = new Set<string>();

  function scanDirectory(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    log(3, `📂 Scanning directory: ${currentPath}`);

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories
        if (entry.name.startsWith(".")) {
          log(3, `⏭️ Skipping hidden directory: ${entry.name}`);
          continue;
        }
        // Recursively scan subdirectories
        scanDirectory(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const raw = fs.readFileSync(entryPath, "utf8");
          const { data: frontmatter } = matter(raw);

          if (frontmatter?.public) {
            allowedFiles.add(entryPath);
            log(3, `✅ Found public file: ${entry.name}`);
          } else {
            log(3, `⏭️ Skipping non-public file: ${entry.name}`);
          }
        } catch (error) {
          log(0, `❌ Error reading ${entryPath}: ${error}`);
        }
      }
    }
  }

  scanDirectory(dirPath);
  return allowedFiles;
}

/**
 * Create a logger function based on debug level
 * @param level Debug level (0-3)
 * @returns Logging function
 */
function createLogger(level: number) {
  return function log(messageLevel: number, message: string) {
    if (messageLevel <= level) {
      console.log(message);
    }
  };
}