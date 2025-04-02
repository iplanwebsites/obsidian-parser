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
import remarkImages from 'remark-images'

import { unified } from "unified";


import remarkYoutube from 'remark-youtube';
// import remarkYoutube from '../../remark-youtube' /// for dev...
 // https://github.com/iplanwebsites/remark-youtube
//"remark-youtube": "github:iplanwebsites/remark-youtube#main",

import { remarkObsidianMedia } from "./remarkObsidianMedia"; // Import our media plugin
import m from ".";
import * as lib from "./lib";
import { toLinkBuilder } from "./toLinkBuilder"; // Import just the function
import { FileData, ProcessOptions } from "./types";
import { MediaFileData, MediaPathMap, ProcessMediaOptions } from "./processMedia";

/**
 * Process an Obsidian vault directory and return file data for public files
 * @param dirPath Path to the Obsidian vault directory
 * @param opts Processing options including media handling
 * @returns Array of processed file data objects
 */
export async function processFolder(
  dirPath: string,
  opts?: ProcessOptions,
): Promise<FileData[]> {
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
  const toLinkOptions: any = {
    filePathAllowSet: allowedFiles,
    toSlug: m.utility.toSlug,
    prefix: opts?.notePathPrefix ?? "/content"
  };
  
  // Add any additional options that might be present in toLinkBuilderOpts
  if (opts?.toLinkBuilderOpts) {
    Object.assign(toLinkOptions, opts.toLinkBuilderOpts);
  }
  
  const toLink = toLinkBuilder(toLinkOptions);

  // Media data and path map (can be passed in or will be empty if not available)
  const mediaData = opts?.mediaData || [];
  const mediaPathMap: MediaPathMap = opts?.mediaPathMap || {};
  
  // Log media info if available
  if (mediaData.length > 0) {
    log(1, `🖼️ Found ${mediaData.length} media items to process`);
  }
  if (Object.keys(mediaPathMap).length > 0) {
    log(1, `🔗 Found ${Object.keys(mediaPathMap).length} media path mappings`);
  }

  // Create unified processor with media support
  const processor = buildMarkdownProcessor({ 
    toLink,
    mediaData,
    mediaPathMap,
    useAbsolutePaths: opts?.useAbsolutePaths || false,
    preferredSize: opts?.preferredSize || 'md'
  });

  // Process pages
  const pages: FileData[] = [];

  for (const filePath of allowedFiles) {
    // Skip non-markdown files
    if (typeof filePath !== 'string' || !filePath.endsWith('.md')) continue;
    
    try {
      log(2, `⚙️ Processing file: ${filePath}`);
      
      // Parse file
      const { name: fileName } = path.parse(filePath);
      const raw = fs.readFileSync(filePath, "utf8");
      const { content: markdown, data: frontmatter } = matter(raw);

      // Process to HTML - our remarkObsidianMedia plugin will handle media links
      const mdastRoot = processor.parse(markdown) as MdastRoot;
      const htmlString = processor.processSync(markdown).toString();

      // Calculate relative path from vault root
      const relativePath = path.relative(dirPath, filePath);

      // Build file data object
      const file: FileData = {
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
  if (opts?.includeMediaData && pages.length > 0 && mediaData.length > 0) {
    // Create a special property on the first page to hold the media catalog
    // @ts-ignore - Adding custom property
    pages[0]._mediaData = mediaData;
    log(1, `📊 Added media catalog to first page object`);
    
    // Also add the path map if available
    if (Object.keys(mediaPathMap).length > 0) {
      // @ts-ignore - Adding custom property
      pages[0]._mediaPathMap = mediaPathMap;
      log(1, `🗺️ Added media path map to first page object`);
    }
  }
  
  return pages;
}

/**
 * Build the unified processor with wiki link and media support
 */
function buildMarkdownProcessor({ 
  toLink, 
  mediaData = [],
  mediaPathMap = {},
  useAbsolutePaths = false,
  preferredSize = 'md'
}: { 
  toLink: ReturnType<typeof toLinkBuilder>;
  mediaData?: MediaFileData[];
  mediaPathMap?: MediaPathMap;
  useAbsolutePaths?: boolean;
  preferredSize?: 'sm' | 'md' | 'lg';
}) {
  return unified()
    .use(remarkParse)
   .use(remarkImages, { link:false  }) 
   // Link false option isn't working. weird...
   // https://github.com/remarkjs/remark-images
    .use(remarkGfm)
    .use(remarkObsidianLink, { toLink })
    .use(remarkObsidianMedia, { 
      mediaData, 
      mediaPathMap,
      useAbsolutePaths,
      preferredSize
    })
    .use(remarkYoutube, {noHardcodedSize:true}) //, { width: '100%', height: '100%' })
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