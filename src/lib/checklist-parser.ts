export interface ParsedItem {
  name: string;
  category: string;
}

export function parseMarkdownToItems(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  let currentCategory = "Inne";

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      currentCategory = trimmed.slice(3).trim();
    } else if (trimmed.startsWith("- ")) {
      const name = trimmed.slice(2).trim();
      if (name) {
        items.push({ name, category: currentCategory });
      }
    }
  }

  return items;
}
