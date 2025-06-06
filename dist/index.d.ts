import { Root as Root$1 } from 'hast';
import { Root } from 'mdast';
import { Link, WikiLink as WikiLink$1, ToLink } from 'remark-obsidian-link';
import { Processor } from 'unified';

/**
 * Interface for media file data
 */
interface MediaFileData {
    originalPath: string;
    fileName: string;
    fileExt: string;
    mimeType: string;
    sizes: {
        [key: string]: {
            width: number;
            height: number;
            format: string;
            outputPath: string;
            publicPath: string;
            absolutePublicPath?: string;
            size: number;
        }[];
    };
    metadata: {
        width?: number;
        height?: number;
        format?: string;
        size?: number;
        exif?: any;
    };
}
/**
 * Options for processing media files
 */
interface ProcessMediaOptions {
    mediaOutputFolder?: string;
    mediaPathPrefix?: string;
    optimizeImages?: boolean;
    imageSizes?: Array<{
        width: number | null;
        height: number | null;
        suffix: string;
    }>;
    imageFormats?: Array<{
        format: string;
        options: any;
    }>;
    skipExisting?: boolean;
    forceReprocessMedias?: boolean;
    domain?: string;
    debug?: number;
}
/**
 * Media path mapping for image replacement
 */
interface MediaPathMap {
    /** Maps original relative paths to optimized public paths */
    [originalPath: string]: string;
}
/**
 * Process media files in an Obsidian vault directory
 * @param dirPath Path to the Obsidian vault directory
 * @param opts Processing options
 * @returns Object containing media data and path mapping
 */
declare function processMedia(dirPath: string, opts?: ProcessMediaOptions): Promise<{
    mediaData: MediaFileData[];
    pathMap: MediaPathMap;
}>;

type MdastLink = Link;
type WikiLink = WikiLink$1;
interface FileData {
    fileName: string;
    slug: string;
    firstParagraphText: string;
    plain: string;
    frontmatter: Record<string, any>;
    html: string;
    toc: TocItem[];
    originalFilePath: string;
}
interface ProcessOptions {
    /**
     * Given a dirpath, build a `Set<string>` of filepaths,
     * representing pages that should be turned into html,
     * and linked to from other pages.
     *
     * The default behavior is to check the file's `frontmatter`
     * for `public: true`. Only if `public` exists and is set to
     * `true` is the filePath added to the `FilePathAllowSet`.
     */
    filePathAllowSetBuilder?: FilePathAllowSetBuilder;
    /**
     * This builder function constructs the unified.js processor
     * that is used to both parse markdown into mdast, and transform
     * markdown into html. It takes in a `toLink` function that can
     * be controlled as well via `toLinkBuilderOpts`
     *
     * The default behavior is a collection of common markdown and
     * html plugins.
     */
    unifiedProcessorBuilder?: UnifiedProcessorBuilder;
    /**
     * These options control the `toLinkBuilder` function execution. In short,
     * `remark-obsidian-link` requires a `toLink` function, and this function
     * builds that function. For example,
     *
     * ```ts
     * const toLink = toLinkBuilder(opts);
     * const mdastLink = toLink(wikiLink);
     * ```
     *
     * By default the options are:
     *
     * ```ts
     * {
     *   filePathAllowSet: [override or default],
     *   prefix: '/content',
     *   toSlug: (s: string) => slugify(s, {decamelize: false}),
     * }
     * ```
     *
     * The resulting behavior is approximately as follows:
     *
     * ```ts
     * // original string slice from markdown: "[[Wiki Link]]"
     * const wikiLinkInput = { value: "Wiki Link" };
     * const mdastLinkOutput = { value: "Wiki Link", uri: "content/wiki-link" }
     * ```
     */
    toLinkBuilderOpts?: ToLinkBuilderOpts;
    notePathPrefix?: string;
    assetPathPrefix?: string;
    debug?: number;
    mediaOptions?: ProcessMediaOptions;
    mediaData?: MediaFileData[];
    mediaPathMap?: MediaPathMap;
    useAbsolutePaths?: boolean;
    preferredSize?: 'sm' | 'md' | 'lg';
    includeMediaData?: boolean;
}
type FilePathAllowSetBuilder = (dirPath: string) => Set<string>;
type UnifiedProcessorBuilder = (_: {
    toLink: ToLink;
}) => Processor<Root, Root, Root$1, Root$1, string>;
type ToLinkBuilderOpts = {
    filePathAllowSet: Set<string>;
    toSlug: (s: string) => string;
    /**
     * The prefix to use for links. If notePathPrefix is provided in ProcessOptions,
     * it will override the default '/content'
     */
    prefix: string;
};
type ToLinkBuilder = (_: ToLinkBuilderOpts) => ToLink;
interface TocItem {
    title: string;
    depth: number;
    id: string;
}

/**
 * Process an Obsidian vault directory and return file data for public files
 * @param dirPath Path to the Obsidian vault directory
 * @param opts Processing options including media handling
 * @returns Array of processed file data objects
 */
declare function processFolder(dirPath: string, opts?: ProcessOptions): Promise<FileData[]>;

declare function toSlug(s: string): string;
declare function getFileName(filePath: string): string;
declare function getFrontmatterAndMd(filePath: string): {
    md: string;
    frontmatter: {
        [key: string]: any;
    };
};
declare function jsonStringify(o: any): string;
declare function writeToFileSync(filePath: string, content: string): void;

declare const MAIN: {
    processFolder: typeof processFolder;
    processMedia: typeof processMedia;
    obsidian: {
        vault: {
            process: typeof processFolder;
            processMedia: typeof processMedia;
        };
    };
    utility: {
        toSlug(s: string): string;
        getFileName(filePath: string): string;
        getFrontmatterAndMd(filePath: string): {
            md: string;
            frontmatter: {
                [key: string]: any;
            };
        };
        jsonStringify(o: any): string;
        writeToFileSync(filePath: string, content: string): void;
    };
    toSlug(s: string): string;
    getFileName(filePath: string): string;
    getFrontmatterAndMd(filePath: string): {
        md: string;
        frontmatter: {
            [key: string]: any;
        };
    };
    jsonStringify(o: any): string;
    writeToFileSync(filePath: string, content: string): void;
};

export { type FileData, type FilePathAllowSetBuilder, type MdastLink, type MediaFileData, type MediaPathMap, type ProcessMediaOptions, type ProcessOptions, type ToLinkBuilder, type ToLinkBuilderOpts, type TocItem, type UnifiedProcessorBuilder, type WikiLink, MAIN as default, getFileName, getFrontmatterAndMd, jsonStringify, processFolder, processMedia, toSlug, writeToFileSync };
