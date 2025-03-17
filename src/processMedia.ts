import fs from "node:fs";
import path from "node:path";
import sharp from "sharp"; 

/**
 * Default image sizes for optimization
 */
const DEFAULT_IMAGE_SIZES = [
  { width: 640, height: null, suffix: "sm" },
 // { width: 1024, height: null, suffix: "md" },
 //{ width: 1920, height: null, suffix: "lg" },
//  { width: null, height: null, suffix: "original" } // Original size
];

/**
 * Default image formats for optimization
 */
const DEFAULT_IMAGE_FORMATS = [
 // { format: "webp", options: { quality: 80 } },
//  { format: "avif", options: { quality: 65 } },
  { format: "jpeg", options: { quality: 85, mozjpeg: true } }
];

/**
 * Interface for media file data
 */
export interface MediaFileData {
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
      size: number; // File size in bytes
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
export interface ProcessMediaOptions {
  mediaOutputFolder?: string;
  mediaPathPrefix?: string;
  optimizeImages?: boolean;
  imageSizes?: Array<{ width: number | null; height: number | null; suffix: string }>;
  imageFormats?: Array<{ format: string; options: any }>;
  debug?: number;
}

/**
 * Media path mapping for image replacement
 */
export interface MediaPathMap {
  /** Maps original relative paths to optimized public paths */
  [originalPath: string]: string;
}

/**
 * Process media files in an Obsidian vault directory
 * @param dirPath Path to the Obsidian vault directory
 * @param opts Processing options
 * @returns Object containing media data and path mapping
 */
export async function processMedia(
  dirPath: string,
  opts?: ProcessMediaOptions
): Promise<{ mediaData: MediaFileData[], pathMap: MediaPathMap }> {
  // Normalize the input path
  dirPath = path.normalize(dirPath);

  // Set default options
  const options: Required<ProcessMediaOptions> = {
    mediaOutputFolder: opts?.mediaOutputFolder || path.join(process.cwd(), "public/media"),
    mediaPathPrefix: opts?.mediaPathPrefix || "/media",
    optimizeImages: opts?.optimizeImages !== false,
    imageSizes: opts?.imageSizes || DEFAULT_IMAGE_SIZES,
    imageFormats: opts?.imageFormats || DEFAULT_IMAGE_FORMATS,
    debug: opts?.debug || 0
  };

  // Create logging function based on debug level
  const log = createLogger(options.debug);

  log(1, "🔍 Scanning media files in: " + dirPath);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(options.mediaOutputFolder)) {
    fs.mkdirSync(options.mediaOutputFolder, { recursive: true });
    log(1, "📁 Created output directory: " + options.mediaOutputFolder);
  }

  // Get all media files
  const mediaFiles = findMediaFiles(dirPath, log);
  log(1, `🖼️ Found ${mediaFiles.length} media files to process`);

  const mediaData: MediaFileData[] = [];
  const pathMap: MediaPathMap = {};

  // Process each media file
  for (const [index, filePath] of mediaFiles.entries()) {
    try {
      log(2, `⚙️ Processing media file (${index+1}/${mediaFiles.length}): ${filePath}`);
      const mediaFile = await processMediaFile(filePath, dirPath, options, log);
      mediaData.push(mediaFile);

      // Add to path map, preferring webp format and medium size if available
      const relativePath = path.relative(dirPath, filePath).replace(/\\/g, '/');
      const bestPath = findBestOptimizedPath(mediaFile);
      if (bestPath) {
        pathMap[relativePath] = bestPath;
        log(2, `🔄 Mapped ${relativePath} → ${bestPath}`);
      }
    } catch (error) {
      log(0, `❌ Error processing media file ${filePath}: ${error}`);
    }
  }

  log(1, `✅ Processed ${mediaData.length} media files successfully`);
  return { mediaData, pathMap };
}

/**
 * Find the best optimized path for a media file
 * Prefers: webp > avif > jpeg > original
 * Sizes: md > sm > lg > original
 */
function findBestOptimizedPath(mediaFile: MediaFileData): string | null {
  // Preferred size order: md, sm, lg, original
  const sizePreference = ['md', 'sm', 'lg', 'original'];
  
  // Preferred format order: webp, avif, jpeg/jpg, original
  const formatPreference = ['webp', 'avif', 'jpeg', 'jpg', mediaFile.fileExt];
  
  // Find the best available option based on preferences
  for (const size of sizePreference) {
    if (mediaFile.sizes[size]) {
      for (const format of formatPreference) {
        const formatOption = mediaFile.sizes[size]?.find(option => option.format === format);
        if (formatOption) {
          return formatOption.publicPath;
        }
      }
    }
  }
  
  // If no optimized version found, use the original
  if (mediaFile.sizes.original && mediaFile.sizes.original.length > 0) {
    return mediaFile.sizes.original[0].publicPath;
  }
  
  return null;
}

/**
 * Find all media files in a directory
 * @param dirPath Directory path
 * @param log Logging function
 * @returns Array of file paths
 */
function findMediaFiles(dirPath: string, log: (level: number, message: string) => void): string[] {
  const mediaFiles: string[] = [];
  const mediaExtensions = new Set([
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".mp4", ".webm"
  ]);

  function scanDirectory(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    log(3, `📂 Scanning directory: ${currentPath}`);

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (entry.name.startsWith(".") || entry.name === "node_modules") {
          log(3, `⏭️ Skipping directory: ${entry.name}`);
          continue;
        }
        // Recursively scan subdirectories
        scanDirectory(entryPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (mediaExtensions.has(ext)) {
          mediaFiles.push(entryPath);
          log(3, `📄 Found media file: ${entry.name}`);
        }
      }
    }
  }

  scanDirectory(dirPath);
  return mediaFiles;
}

/**
 * Process a single media file
 * @param filePath Path to the media file
 * @param rootDir Root directory path
 * @param options Processing options
 * @param log Logging function
 * @returns Media file data
 */
async function processMediaFile(
  filePath: string,
  rootDir: string,
  options: Required<ProcessMediaOptions>,
  log: (level: number, message: string) => void
): Promise<MediaFileData> {
  const { base: fileName, ext: fileExt } = path.parse(filePath);
  const relativePath = path.relative(rootDir, filePath);
  const isImage = /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(fileExt);
  
  // Create media file data structure
  const mediaFile: MediaFileData = {
    originalPath: relativePath,
    fileName,
    fileExt: fileExt.slice(1), // Remove the dot
    mimeType: getMimeType(fileExt),
    sizes: {},
    metadata: {}
  };

  // Get file stats and basic metadata
  const stats = fs.statSync(filePath);
  mediaFile.metadata.size = stats.size;

  // Process image if optimization is enabled and it's an image file
  if (options.optimizeImages && isImage) {
    try {
      // Get image metadata
      const imageMetadata = await sharp(filePath).metadata();
      mediaFile.metadata.width = imageMetadata.width;
      mediaFile.metadata.height = imageMetadata.height;
      mediaFile.metadata.format = imageMetadata.format;
      mediaFile.metadata.exif = imageMetadata.exif;

      log(2, `📊 Image: ${fileName} (${imageMetadata.width}x${imageMetadata.height}, ${fileExt})`);

      // Process each image size and format
      for (const size of options.imageSizes) {
        const sizeName = size.suffix;
        mediaFile.sizes[sizeName] = [];

        for (const format of options.imageFormats) {
          // Skip avif for SVG files
          if (fileExt.toLowerCase() === '.svg' && format.format === 'avif') {
            log(3, `⏭️ Skipping AVIF conversion for SVG: ${fileName}`);
            continue;
          }

          // Create output directory structure based on relative path
          const dirStructure = path.dirname(relativePath);
          const outputDir = path.join(options.mediaOutputFolder, dirStructure);
          
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            log(3, `📁 Created directory: ${outputDir}`);
          }

          // Generate output filename
          const outputFileName = `${path.parse(fileName).name}${size.suffix !== 'original' ? `-${size.suffix}` : ''}.${format.format}`;
          const outputPath = path.join(outputDir, outputFileName);
          const publicPath = `${options.mediaPathPrefix}/${dirStructure}/${outputFileName}`.replace(/\\/g, '/');

          // Skip original size for non-original format
          if (size.suffix === 'original' && format.format !== mediaFile.metadata.format) {
            log(3, `⏭️ Skipping conversion for original size: ${fileName}`);
            continue;
          }

          // Process image with sharp
          let sharpInstance = sharp(filePath);
          
          // Resize if not original
          if (size.suffix !== 'original') {
            sharpInstance = sharpInstance.resize({
              width: size.width || undefined,
              height: size.height || undefined,
              withoutEnlargement: true,
              fit: 'inside'
            });
          }

          // Convert to format
          if (format.format === 'webp') {
            sharpInstance = sharpInstance.webp(format.options);
          } else if (format.format === 'avif') {
            sharpInstance = sharpInstance.avif(format.options);
          } else if (format.format === 'jpeg' || format.format === 'jpg') {
            sharpInstance = sharpInstance.jpeg(format.options);
          } else if (format.format === 'png') {
            sharpInstance = sharpInstance.png(format.options);
          }

          // Process and save the image
          log(3, `🔄 Converting ${fileName} to ${format.format} (${size.suffix})`);
          await sharpInstance.toFile(outputPath);

          // Get stats of the processed file
          const processedStats = fs.statSync(outputPath);
          const processedMetadata = await sharp(outputPath).metadata();

          // Add to sizes array
          mediaFile.sizes[sizeName].push({
            width: processedMetadata.width || 0,
            height: processedMetadata.height || 0,
            format: format.format,
            outputPath,
            publicPath,
            size: processedStats.size
          });

          const compressionRatio = stats.size > 0 ? 
            ((stats.size - processedStats.size) / stats.size * 100).toFixed(1) : 0;
          
          log(2, `💾 Saved: ${publicPath} (${formatBytes(processedStats.size)}, ${compressionRatio}% smaller)`);
        }
      }
    } catch (error) {
      log(0, `❌ Error optimizing image ${filePath}: ${error}`);
      // For failed image optimization, still include the original file
      const dirStructure = path.dirname(relativePath);
      const publicPath = `${options.mediaPathPrefix}/${dirStructure}/${fileName}`.replace(/\\/g, '/');
      
      mediaFile.sizes.original = [{
        width: mediaFile.metadata.width || 0,
        height: mediaFile.metadata.height || 0,
        format: mediaFile.fileExt,
        outputPath: filePath,
        publicPath,
        size: stats.size
      }];
    }
  } else {
    // For non-images or when optimization is disabled, just copy the file
    const dirStructure = path.dirname(relativePath);
    const outputDir = path.join(options.mediaOutputFolder, dirStructure);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      log(3, `📁 Created directory: ${outputDir}`);
    }

    const outputPath = path.join(outputDir, fileName);
    fs.copyFileSync(filePath, outputPath);
    
    const publicPath = `${options.mediaPathPrefix}/${dirStructure}/${fileName}`.replace(/\\/g, '/');
    
    mediaFile.sizes.original = [{
      width: 0,
      height: 0,
      format: mediaFile.fileExt,
      outputPath,
      publicPath,
      size: stats.size
    }];

    log(2, `📋 Copied: ${publicPath} (${formatBytes(stats.size)})`);
  }

  return mediaFile;
}

/**
 * Get MIME type from file extension
 * @param ext File extension
 * @returns MIME type
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
  };

  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
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

/**
 * Format bytes to human readable format
 * @param bytes Number of bytes
 * @returns Formatted string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}