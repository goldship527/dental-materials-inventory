export type Span = { type: "text"; value: string } | { type: "code"; value: string };

export type ManualBlock =
  | { type: "h1"; text: string }
  | { type: "h3"; text: string }
  | { type: "paragraph"; spans: Span[] }
  | { type: "ul"; items: Span[][] }
  | { type: "ol"; items: Span[][] }
  | { type: "callout"; variant: "warning"; label: string; items: Span[][] }
  | { type: "image"; alt: string; src: string };

export type ManualSection = {
  id: string;
  title: string;
  blocks: ManualBlock[];
  text: string;
};

export type ManualDoc = {
  preamble: ManualBlock[];
  sections: ManualSection[];
};

type DraftSection = {
  id: string;
  title: string;
  blocks: ManualBlock[];
};

type DraftList = {
  type: "ul" | "ol";
  items: Span[][];
};

function parseInline(text: string): Span[] {
  const parts = text.split(/(`[^`]+`)/g);

  return parts
    .filter((part) => part.length > 0)
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`")) {
        return { type: "code", value: part.slice(1, -1) };
      }

      return { type: "text", value: part };
    });
}

function spanText(spans: Span[]) {
  return spans.map((span) => span.value).join("");
}

function blockText(block: ManualBlock): string {
  switch (block.type) {
    case "h1":
    case "h3":
      return block.text;
    case "paragraph":
      return spanText(block.spans);
    case "ul":
    case "ol":
      return block.items.map(spanText).join(" ");
    case "callout":
      return [block.label, ...block.items.map(spanText)].join(" ");
    case "image":
      return `${block.alt} ${block.src}`;
  }
}

function sectionText(title: string, blocks: ManualBlock[]) {
  return [title, ...blocks.map(blockText)].join(" ").toLowerCase();
}

function sectionId(title: string, index: number) {
  const numberMatch = title.match(/^(\d+)/);

  if (numberMatch) {
    return `section-${numberMatch[1]}`;
  }

  return `section-${index + 1}`;
}

function pushBlock(target: ManualBlock[], block: ManualBlock) {
  target.push(block);
}

function flushList(target: ManualBlock[], list: DraftList | null) {
  if (!list || list.items.length === 0) {
    return null;
  }

  const previous = target[target.length - 1];

  if (list.type === "ul" && previous?.type === "paragraph") {
    const label = spanText(previous.spans).trim();

    if (/^注意[:：]$/.test(label)) {
      target.pop();
      pushBlock(target, { type: "callout", variant: "warning", label, items: list.items });
      return null;
    }
  }

  pushBlock(target, { type: list.type, items: list.items });
  return null;
}

function flushParagraph(target: ManualBlock[], lines: string[]) {
  if (lines.length === 0) {
    return [];
  }

  pushBlock(target, { type: "paragraph", spans: parseInline(lines.join(" ")) });
  return [];
}

export function parseManual(markdown: string): ManualDoc {
  const preamble: ManualBlock[] = [];
  const sections: DraftSection[] = [];
  let currentBlocks = preamble;
  let paragraphLines: string[] = [];
  let currentList: DraftList | null = null;
  let sectionIndex = 0;

  function flushText() {
    paragraphLines = flushParagraph(currentBlocks, paragraphLines);
    currentList = flushList(currentBlocks, currentList);
  }

  function startSection(title: string) {
    flushText();
    const currentSection = { id: sectionId(title, sectionIndex), title, blocks: [] };
    sectionIndex += 1;
    sections.push(currentSection);
    currentBlocks = currentSection.blocks;
  }

  markdown.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushText();
      return;
    }

    if (line.startsWith("## ")) {
      startSection(line.slice(3).trim());
      return;
    }

    if (line.startsWith("# ")) {
      flushText();
      pushBlock(currentBlocks, { type: "h1", text: line.slice(2).trim() });
      return;
    }

    if (line.startsWith("### ")) {
      flushText();
      pushBlock(currentBlocks, { type: "h3", text: line.slice(4).trim() });
      return;
    }

    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);

    if (imageMatch) {
      flushText();
      pushBlock(currentBlocks, { type: "image", alt: imageMatch[1], src: imageMatch[2] });
      return;
    }

    if (line.startsWith("- ")) {
      paragraphLines = flushParagraph(currentBlocks, paragraphLines);

      if (currentList?.type !== "ul") {
        currentList = flushList(currentBlocks, currentList);
        currentList = { type: "ul", items: [] };
      }

      currentList.items.push(parseInline(line.slice(2)));
      return;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);

    if (orderedMatch) {
      paragraphLines = flushParagraph(currentBlocks, paragraphLines);

      if (currentList?.type !== "ol") {
        currentList = flushList(currentBlocks, currentList);
        currentList = { type: "ol", items: [] };
      }

      currentList.items.push(parseInline(orderedMatch[1]));
      return;
    }

    currentList = flushList(currentBlocks, currentList);
    paragraphLines.push(line);
  });

  flushText();

  return {
    preamble,
    sections: sections.map((section) => ({
      ...section,
      text: sectionText(section.title, section.blocks),
    })),
  };
}
