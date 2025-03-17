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

/**
 * Process an Obsidian vault directory and return file data for public files
 */
export function processFolder(
  dirPath: string,
  opts?: Metamark.Obsidian.Vault.ProcessOptions,
): Metamark.Obsidian.Vault.FileData[] {
  // Normalize the input path
  dirPath = path.normalize(dirPath);
   
  // Get the allowed file paths (public files only)
  const allowedFiles: Set<string> =
    opts?.filePathAllowSetBuilder?.(dirPath) ??
    buildDefaultAllowedFileSet(dirPath);

  // Build link transformer
  const toLink = toLinkBuilder({
    filePathAllowSet: allowedFiles,
    toSlug: m.utility.toSlug,
    prefix: opts?.notePathPrefix ?? "/content",
    ...(opts?.toLinkBuilderOpts || {})
  });

  // Create unified processor
  const processor = buildMarkdownProcessor({ toLink });

  // Process pages
  const pages: Metamark.Obsidian.Vault.FileData[] = [];

  for (const filePath of allowedFiles) {
    // Skip non-markdown files
    if (typeof filePath !== 'string' || !filePath.endsWith('.md')) continue;
    
    try {
      // Parse file
      const { name: fileName } = path.parse(filePath);
      const raw = fs.readFileSync(filePath, "utf8");
      const { content: markdown, data: frontmatter } = matter(raw);

      // Process to HTML
      const mdastRoot = processor.parse(markdown) as MdastRoot;
      const htmlString = processor.processSync(markdown).toString();

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
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }

  return pages;
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
function buildDefaultAllowedFileSet(dirPath: string): Set<string> {
  const allowedFiles = new Set<string>();

  function scanDirectory(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        scanDirectory(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const raw = fs.readFileSync(entryPath, "utf8");
          const { data: frontmatter } = matter(raw);

          if (frontmatter?.public) {
            allowedFiles.add(entryPath);
          }
        } catch (error) {
          console.error(`Error reading ${entryPath}:`, error);
        }
      }
    }
  }

  scanDirectory(dirPath);
  return allowedFiles;
}