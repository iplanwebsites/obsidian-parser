// remarkObsidianMedia.ts
import { Plugin } from 'unified';
import { Root, Image } from 'mdast';
import { visit } from 'unist-util-visit';
import path from 'path';

// Import types from processMedia.ts
import type { MediaFileData, MediaPathMap } from './types';

// Default placeholder image path
const DEFAULT_IMAGE = '/placeholder/400/300';

interface RemarkObsidianMediaOptions {
  mediaData?: MediaFileData[];
  mediaPathMap?: MediaPathMap;
  defaultImage?: string;
  basePath?: string;
  useAbsolutePaths?: boolean;
  preferredSize?: 'sm' | 'md' | 'lg';
}

/**
 * Plugin to transform Obsidian wiki-style media links (![[media.png]]) into HTML images
 * Prioritizes using the provided mediaPathMap for direct path conversion
 */
export const remarkObsidianMedia: Plugin<[RemarkObsidianMediaOptions?], Root> = (options = {}) => {
  const {
    mediaData = [],
    mediaPathMap = {},
    defaultImage = DEFAULT_IMAGE,
    basePath = '',
    useAbsolutePaths = false,
    preferredSize = 'md'
  } = options;
  
  // Create maps for quicker lookups
  const mediaByName = new Map<string, MediaFileData>();
  const mediaByPath = new Map<string, MediaFileData>();
  
  mediaData.forEach(item => {
    // Store by filename (lowercase for case-insensitive matching)
    mediaByName.set(item.fileName.toLowerCase(), item);
    
    // Store by original path
    mediaByPath.set(item.originalPath.toLowerCase(), item);
    
    // Also add without folder path for more flexible matching
    const nameOnly = path.basename(item.originalPath);
    if (nameOnly.toLowerCase() !== item.fileName.toLowerCase()) {
      mediaByName.set(nameOnly.toLowerCase(), item);
    }
  });
  
  // Regular expression to match Obsidian media syntax
  // This matches ![[filename.ext]] or ![[path/to/filename.ext]]
  const mediaRegex = /!\[\[(.*?)\]\]/g;
  
  return (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null) return;
      
      const { value } = node;
      // Find all matches in the text node
      const matches = Array.from(value.matchAll(mediaRegex));
      if (matches.length === 0) return;
      
      const newNodes: (Node | Image | { type: 'text'; value: string })[] = [];
      let lastIndex = 0;
      
      for (const match of matches) {
        const [fullMatch, mediaLink] = match;
        const matchIndex = match.index as number;
        
        // Add text before the match
        if (matchIndex > lastIndex) {
          newNodes.push({ type: 'text', value: value.slice(lastIndex, matchIndex) });
        }
        
        // Get the filename for alt text
        const mediaFileName = path.basename(mediaLink);
        
        // PRIORITY 1: Check if we have an exact match in the mediaPathMap
        if (mediaPathMap[mediaLink]) {
          newNodes.push({
            type: 'image',
            url: mediaPathMap[mediaLink],
            alt: mediaFileName,
            title: mediaFileName,
            data: {
              hProperties: {
                loading: 'lazy',
                class: 'obsidian-media mapped'
              }
            }
          });
        } 
        // PRIORITY 2: Try other variations of the path in mediaPathMap
        else {
          // Try with and without a leading slash
          const withLeadingSlash = mediaLink.startsWith('/') ? mediaLink : `/${mediaLink}`;
          const withoutLeadingSlash = mediaLink.startsWith('/') ? mediaLink.substring(1) : mediaLink;
          
          // Try with normalized path separators
          const normalizedPath = mediaLink.replace(/\\/g, '/');
          
          // Try variations
          const pathVariations = [
            withLeadingSlash,
            withoutLeadingSlash,
            normalizedPath,
            normalizedPath.toLowerCase(),
            path.basename(mediaLink)
          ];
          
          let found = false;
          for (const pathVar of pathVariations) {
            if (mediaPathMap[pathVar]) {
              newNodes.push({
                type: 'image',
                url: mediaPathMap[pathVar],
                alt: mediaFileName,
                title: mediaFileName,
                data: {
                  hProperties: {
                    loading: 'lazy',
                    class: 'obsidian-media mapped'
                  }
                }
              });
              found = true;
              break;
            }
          }
          
          // PRIORITY 3: Fall back to mediaData for more advanced features
          if (!found) {
            const normalizedPath = mediaLink.toLowerCase();
            const normalizedName = mediaFileName.toLowerCase();
            
            // Find the media item by checking multiple possible keys
            let mediaItem = mediaByPath.get(normalizedPath) || 
                            mediaByName.get(normalizedName) || 
                            mediaByName.get(normalizedPath);
            
            if (mediaItem) {
              // Get the preferred size with fallbacks
              const sizes = mediaItem.sizes[preferredSize] || 
                           mediaItem.sizes.md || 
                           mediaItem.sizes.sm || 
                           mediaItem.sizes.lg || 
                           mediaItem.sizes.original;
              
              if (sizes && sizes.length > 0) {
                const sizeInfo = sizes[0];
                const imagePath = useAbsolutePaths && sizeInfo.absolutePublicPath
                  ? sizeInfo.absolutePublicPath 
                  : sizeInfo.publicPath;
                
                // Create image node
                newNodes.push({
                  type: 'image',
                  url: imagePath,
                  alt: mediaFileName,
                  title: `${mediaFileName} (${sizeInfo.width}x${sizeInfo.height})`,
                  data: {
                    hProperties: {
                      width: sizeInfo.width,
                      height: sizeInfo.height,
                      loading: 'lazy',
                      class: `obsidian-media size-${preferredSize}`
                    }
                  }
                });
              } else {
                // No size variants found, use default
                newNodes.push(createDefaultImage(mediaFileName));
              }
            } else {
              // Media not found, use default image
              newNodes.push(createDefaultImage(mediaFileName));
            }
          }
        }
        
        lastIndex = matchIndex + fullMatch.length;
      }
      
      // Add any remaining text
      if (lastIndex < value.length) {
        newNodes.push({ type: 'text', value: value.slice(lastIndex) });
      }
      
      // Replace the original node with the new nodes
      parent.children.splice(index, 1, ...newNodes);
      
      // Skip the nodes we just inserted
      return index + newNodes.length - 1;
    });
  };
  
  // Helper function to create a default image node
  function createDefaultImage(alt: string): Image {
    return {
      type: 'image',
      url: defaultImage,
      alt,
      title: `Image not found: ${alt}`,
      data: {
        hProperties: {
          width: 400,
          height: 300,
          class: 'obsidian-media placeholder'
        }
      }
    };
  }
};