# Metamark

A markdown utility.

## Obsidian

A primary use case for metamark is processing Obsidian vaults.

If you have an Obsidian vault, you want to share some or all of the content of
that vault, and the popular methods of doing so (e.g., Obsidian Publish) are
undesirable, then this might be a good reason to try metamark.

```ts
import metamark from "metamark";

const vaultData = metamark.obsidian.vault.process("../path/to/vault/");
const jsonString = metamark.utility.jsonStringify(vaultData);
metamark.utility.writeToFileSync("./content.json", jsonString);
```

### The tricky bit: wiki links

The "hard problem" of processing an Obsidian vault is wiki links (`[[Wiki
Link]]`). Those links resolve to a file path within your vault
(`vaultDir/wiki-link`). When you turn them into html, they need to resolve to a
url path (`/content/wiki-link`). This library helps you manage that.

There are a couple fundamental questions when processing a vault. (1) Which
files are public and which are not? (2) How do you want to transform wiki links
when a linked file is public/private? This includes both what is displayed and,
if public, what the link URL is.

This is a complicated issue, and controlling the behavior results in complicated
options when you call `m.obsidian.vault.process(dirPath, opts)`. Please see
[types.ts](./src/types.ts) jsdocs for `Metamark.Obsidian.Vault.ProcessOpts` to
learn more.
