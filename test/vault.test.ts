import { expect, test } from "vitest";
import m from "../src/index.js";
import { processFolder } from "../src/processFolder";

function setup() {
  return { vaultPath: "./test/testVault/" };
}

test("vault", async () => {
  const { vaultPath } = setup();

  // You can use either the legacy API or the new direct import
  // const vaultData = m.obsidian.vault.process(vaultPath); 
  const vaultData = await processFolder(vaultPath);

  expect(vaultData.length).toBe(3);
  expect(vaultData.find((d) => d.fileName === "other2")).toBeUndefined();

  const testFile = vaultData.find((d) => d.fileName === "Test File");
  expect(testFile?.firstParagraphText).toMatch("I am a markdown file!");
  expect(testFile?.frontmatter).toEqual(
    expect.objectContaining({
      public: true,
      tags: ["markdown", "yaml", "html"],
    })
  );
  expect(testFile?.slug).toBe("test-file");
  expect(testFile?.toc).toEqual([
    {
      depth: 1,
      id: "hello",
      title: "Hello",
    },
    {
      depth: 2,
      id: "more",
      title: "More",
    },
  ]);

  const html = testFile?.html;
  // html test wiki links
  expect(html).toMatch('<a href="/content/other1" title="">other1</a>');
  expect(html).not.toMatch('<a href="/content/other2" title="">other2</a>');
  expect(html).toMatch('<a href="/content/other3" title="">other3</a>');

  // html test default header ids and autolinks
  expect(html).toMatch('<h1 id="hello"><a href="#hello">Hello</a></h1>');
  expect(html).toMatch('<h2 id="more"><a href="#more">More</a></h2>');

  // test default external link
  expect(html).toMatch(
    '<a href="https://www.google.com" rel="nofollow">external link</a>'
  );

  // test default callout
  expect(html).toMatch("<strong><p>Tip</p></strong>");
  expect(html).toMatch(
    '<div class="callout-content" style=""><p>this is a callout section of type tip with a header</p></div>'
  );
  expect(html).toMatch(
    "<strong><p>this is a callout section of type info without a header</p></strong>"
  );

  // test default math
  //// these used to test for `math-inline` and `math-display` / I assume
  //// `display="true"` will now cover the checks for whether or not they are
  //// inline or block displayed
  expect(html).toMatch(/<mjx-container class="MathJax" jax="CHTML">/);
  expect(html).toMatch(
    /<mjx-container class="MathJax" jax="CHTML" display="true">/
  );
});
