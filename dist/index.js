import slugify from '@sindresorhus/slugify';
import { readFileSync } from 'fs';
import matter from 'gray-matter';
import { fromHtml } from 'hast-util-from-html';
import { heading } from 'hast-util-heading';
import { toText } from 'hast-util-to-text';
import elixir from 'highlight.js/lib/languages/elixir';
import { toString } from 'mdast-util-to-string';
import path from 'path';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import { remarkObsidianLink } from 'remark-obsidian-link';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
let _toSlug = (title) => slugify(title);
let _toRoute = (title) => `/content/${_toSlug(title)}`;
export function metamark(filePath, { toSlug, toRoute } = {}) {
    if (toSlug)
        _toSlug = toSlug;
    if (toRoute)
        _toRoute = toRoute;
    const { name: title } = path.parse(filePath);
    const content = readFileSync(filePath, 'utf8');
    const { data: frontmatter, content: md } = matter(content);
    const mdast = getMdast(md);
    const html = getHtml(md);
    return {
        title,
        slug: _toSlug(title),
        route: _toRoute(title),
        frontmatter,
        firstParagraphText: getFirstParagraphText(mdast),
        toc: getTocFromHtml(html),
        content: { html },
    };
}
function getFirstParagraphText(mdast) {
    const firstParagraph = mdast.children.find((child) => child.type === 'paragraph');
    return toString(firstParagraph);
}
function getTocFromHtml(html) {
    const hast = fromHtml(html);
    const flatToc = [];
    visit(hast, heading, (node) => {
        var _a;
        const tagName = node === null || node === void 0 ? void 0 : node.tagName;
        flatToc.push({
            title: toText(node),
            depth: parseInt(tagName === null || tagName === void 0 ? void 0 : tagName.at(1)) || -1,
            id: (_a = node === null || node === void 0 ? void 0 : node.properties) === null || _a === void 0 ? void 0 : _a.id,
        });
    });
    return flatToc;
}
function getMdast(md) {
    const processor = getMdastProcessor();
    const mdast = processor.parse(md);
    return processor.runSync(mdast);
}
function getHtml(md) {
    const processor = getHastProcessor();
    return processor.processSync(md).toString();
}
function getMdastProcessor() {
    return unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkObsidianLink, { toUri: (s) => _toRoute(s) });
}
function getHastProcessor() {
    return getMdastProcessor()
        .use(remarkRehype)
        .use(rehypeSlug)
        .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
        .use(rehypeHighlight, { languages: { elixir } })
        .use(rehypeStringify);
}
