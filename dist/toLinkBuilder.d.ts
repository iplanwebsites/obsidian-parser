import { getSlug } from './getSlug.js';
import { WikiLink, Link } from 'remark-obsidian-link';
export declare type GetPageUri = (page: string, toSlug: typeof getSlug) => {
    uri: string;
    slug: string;
};
export declare type GetPageUriBuilder = (x: {
    frontmatter: {
        [key: string]: any;
    };
}) => GetPageUri;
export declare type ToLink = (wikiLink: WikiLink) => Link | string;
export declare function toLinkBuilder(pageAllowSet: Set<string>, getPageUri?: GetPageUri): ToLink;
