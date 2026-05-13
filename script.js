const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const tocList = document.getElementById("tocList");
const workspace = document.getElementById("workspace");
const loadButton = document.getElementById("loadButton");
const folderStatus = document.getElementById("folderStatus");
const syntaxButton = document.getElementById("syntaxButton");
const syntaxModal = document.getElementById("syntaxModal");
const closeSyntaxButton = document.getElementById("closeSyntaxButton");
const syntaxCategories = document.getElementById("syntaxCategories");
const syntaxMarkdown = document.getElementById("syntaxMarkdown");
const syntaxPreview = document.getElementById("syntaxPreview");

const STORAGE_KEY = "markdown-editor-draft";
const ALLOWED_HTML_TAGS = new Set([
  "a", "abbr", "b", "br", "code", "del", "details", "div", "em", "hr", "i", "ins", "kbd", "li",
  "mark", "ol", "p", "pre", "s", "small", "span", "strong", "sub", "summary", "sup", "table",
  "tbody", "td", "th", "thead", "tr", "u", "ul"
]);
const VOID_HTML_TAGS = new Set(["br", "hr"]);
const ALLOWED_HTML_ATTRIBUTES = new Set([
  "align", "alt", "class", "colspan", "height", "href", "rowspan", "src", "title", "width"
]);

let directoryHandle = null;
let indexHandle = null;
let saveTimer = null;
let renderSequence = 0;
let headings = [];
let activeHeadingId = "";
const previewImageUrlCache = new Map();
let selectionSyncFrame = 0;
let previewScrollSyncFrame = 0;
let previewSourceElements = [];
let headingHighlightTimer = null;
let suppressEditorSelectionSync = false;
let suppressPreviewScrollSync = false;
let suppressEditorSelectionTimer = null;
let suppressPreviewScrollTimer = null;

const starterMarkdown = `# MarkdownEditor

## はじめに
左の目次から見出しへ移動できます。

## メモ
- Markdownを入力すると右側にプレビューされます。
- フォルダを読み込むと index.md を開きます。
`;

const syntaxExamples = [
  {
    label: "見出し",
    markdown: "# 見出し1\n## 見出し2\n### 見出し3"
  },
  {
    label: "文字装飾",
    markdown: "**太字**\n\n*斜体*\n\n`インラインコード`"
  },
  {
    label: "リスト",
    markdown: "- 項目A\n- 項目B\n- 項目C\n\n1. 手順A\n2. 手順B"
  },
  {
    label: "リンクと画像",
    markdown: "[OpenAI](https://openai.com)\n\n![代替テキスト](image/example.png)"
  },
  {
    label: "引用",
    markdown: "> 引用文を書きます。\n> 複数行にもできます。"
  },
  {
    label: "コードブロック",
    markdown: "```js\nconst message = \"Hello\";\nconsole.log(message);\n```"
  },
  {
    label: "表",
    markdown: "| 名前 | 役割 |\n| --- | --- |\n| A | 目次 |\n| B | 入力 |\n| C | 表示 |"
  }
];

syntaxExamples.push(
  {
    label: "Mermaid",
    markdown: "```mermaid\ngraph TD\n  A[開始] --> B{条件}\n  B -->|Yes| C[完了]\n  B -->|No| D[再確認]\n```"
  },
  {
    label: "LaTeX",
    markdown: "インライン: $E = mc^2$\n\n$$\n\\int_0^1 x^2 dx = \\frac{1}{3}\n$$"
  }
);

syntaxExamples.length = 0;
syntaxExamples.push(
  {
    group: "通常Markdown",
    label: "見出しと目次",
    markdown: "# 見出し1\n## 見出し2\n### 見出し3\n#### 見出し4\n\n見出しは左の目次にも反映されます。"
  },
  {
    group: "通常Markdown",
    label: "段落・改行・空白",
    markdown: "段落は空行で分けます。\n同じ段落内の次の行は、明示しない限り同じ段落として表示されます。\n\n行末に半角スペースを2つ入れると  \n明示的な改行として扱えます。\n\n行末にバックスラッシュを書いても\\\n明示的な改行になります。\n\n全角スペース:　ここに余白があります。\nコードで空白を見せる: `A  B    C`"
  },
  {
    group: "通常Markdown",
    label: "文字装飾",
    markdown: "**太字**\n\n*斜体*\n\n~~取り消し線~~\n\n`インラインコード`\n\n太字と斜体は **重要な語句** の強調に使います。"
  },
  {
    group: "通常Markdown",
    label: "リスト",
    markdown: "- 箇条書きA\n- 箇条書きB\n- 箇条書きC\n\n1. 手順A\n2. 手順B\n3. 手順C\n\n- [x] 完了したタスク\n- [ ] 未完了のタスク"
  },
  {
    group: "通常Markdown",
    label: "リンクと画像",
    markdown: "[OpenAI](https://openai.com)\n\n![代替テキスト](image/example.png)\n\n画像をクリップボードから貼り付けると `image/UUID.png` の形式で挿入されます。"
  },
  {
    group: "通常Markdown",
    label: "引用",
    markdown: "> 引用文を書きます。\n> 複数行にもできます。\n\n> 引用の中でも **強調** や `コード` が使えます。"
  },
  {
    group: "通常Markdown",
    label: "コードブロック",
    markdown: "```js\nconst message = \"Hello Markdown\";\nconsole.log(message);\n```\n\n```html\n<strong>HTMLもそのまま表示</strong>\n```"
  },
  {
    group: "通常Markdown",
    label: "表",
    markdown: "| 名前 | 役割 | 状態 |\n| --- | --- | --- |\n| A | 目次 | 自動生成 |\n| B | 入力 | 編集可能 |\n| C | 表示 | プレビュー |"
  },
  {
    group: "通常Markdown",
    label: "区切り線",
    markdown: "上の内容\n\n---\n\n下の内容\n\n***\n\n別の区切り"
  },
  {
    group: "通常Markdown",
    label: "HTMLタグ",
    markdown: "1行目<br>2行目\n\n<mark>ハイライト</mark>\n\n<sub>下付き</sub> と <sup>上付き</sup>\n\n<details>\n<summary>詳細を開く</summary>\n隠れている内容です。\n</details>"
  },
  {
    group: "Mermaid",
    label: "フローチャート",
    markdown: "```mermaid\ngraph TD\n  A[開始] --> B{条件を確認}\n  B -->|Yes| C[処理を実行]\n  B -->|No| D[差し戻し]\n  C --> E[完了]\n```"
  },
  {
    group: "Mermaid",
    label: "シーケンス図",
    markdown: "```mermaid\nsequenceDiagram\n  participant User as ユーザー\n  participant App as MarkdownEditor\n  User->>App: Markdownを入力\n  App-->>User: プレビューを更新\n```"
  },
  {
    group: "Mermaid",
    label: "クラス図",
    markdown: "```mermaid\nclassDiagram\n  class MarkdownEditor {\n    +loadFolder()\n    +renderPreview()\n    +pasteImage()\n  }\n  MarkdownEditor --> Preview\n```"
  },
  {
    group: "Mermaid",
    label: "ガントチャート",
    markdown: "```mermaid\ngantt\n  title 作業計画\n  dateFormat  YYYY-MM-DD\n  section 実装\n  Markdown対応 :done, 2026-05-01, 2d\n  Mermaid対応  :active, 2026-05-03, 2d\n  LaTeX対応    :2026-05-05, 1d\n```"
  },
  {
    group: "LaTeX",
    label: "インライン数式",
    markdown: "文章中に $E = mc^2$ のように書けます。\n\n円周の式は $C = 2\\pi r$ です。"
  },
  {
    group: "LaTeX",
    label: "ブロック数式",
    markdown: "$$\n\\int_0^1 x^2 dx = \\frac{1}{3}\n$$\n\n$$\na^2 + b^2 = c^2\n$$"
  },
  {
    group: "LaTeX",
    label: "分数・平方根・添字",
    markdown: "$$\n\\frac{1}{2} + \\sqrt{x} + x_i^2\n$$\n\nインラインでも $\\alpha + \\beta = \\gamma$ と書けます。"
  },
  {
    group: "LaTeX",
    label: "行列",
    markdown: "$$\n\\begin{bmatrix}\n1 & 2 \\\\\n3 & 4\n\\end{bmatrix}\n\\begin{bmatrix}\nx \\\\\ny\n\\end{bmatrix}\n$$"
  }
);

function initialize() {
  configureExternalRenderers();
  editor.value = localStorage.getItem(STORAGE_KEY) || starterMarkdown;
  renderAll();
  renderSyntaxCategories();
  bindEvents();
}

function configureExternalRenderers() {
  if (window.mermaid) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "default"
    });
  }
}

function bindEvents() {
  editor.addEventListener("input", () => {
    localStorage.setItem(STORAGE_KEY, editor.value);
    renderAll();
    queueSave();
  });

  document.addEventListener("paste", handlePaste, true);
  editor.addEventListener("scroll", () => {
    if (!suppressEditorSelectionSync) scheduleSelectionSync();
  });
  preview.addEventListener("scroll", () => {
    if (!suppressPreviewScrollSync) schedulePreviewScrollSync();
  });
  editor.addEventListener("click", scheduleSelectionSync);
  editor.addEventListener("keyup", scheduleSelectionSync);
  editor.addEventListener("mouseup", scheduleSelectionSync);
  editor.addEventListener("select", scheduleSelectionSync);
  loadButton.addEventListener("click", loadFolder);
  syntaxButton.addEventListener("click", openSyntaxModal);
  closeSyntaxButton.addEventListener("click", closeSyntaxModal);
  syntaxModal.addEventListener("click", (event) => {
    if (event.target === syntaxModal) closeSyntaxModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && syntaxModal.classList.contains("open")) {
      closeSyntaxModal();
    }
  });

  document.querySelectorAll(".resizer").forEach((resizer) => {
    resizer.addEventListener("pointerdown", startResize);
  });
}

async function loadFolder() {
  if (!window.showDirectoryPicker) {
    alert("フォルダ読み込みには Chrome または Edge の File System Access API が必要です。");
    return;
  }

  try {
    const pickedDirectory = await window.showDirectoryPicker({ mode: "readwrite" });
    const hasPermission = await requestReadWritePermission(pickedDirectory);
    if (!hasPermission) {
      folderStatus.textContent = "フォルダへの書き込み権限がありません";
      return;
    }

    clearPreviewImageCache();
    directoryHandle = pickedDirectory;
    indexHandle = await directoryHandle.getFileHandle("index.md", { create: true });
    const file = await indexHandle.getFile();
    editor.value = await file.text();
    localStorage.setItem(STORAGE_KEY, editor.value);
    folderStatus.textContent = `${directoryHandle.name} / index.md`;
    renderAll();
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error(error);
      alert("フォルダを読み込めませんでした。");
    }
  }
}

async function requestReadWritePermission(handle) {
  const options = { mode: "readwrite" };
  if ((await handle.queryPermission(options)) === "granted") return true;
  return (await handle.requestPermission(options)) === "granted";
}

function queueSave() {
  if (!indexHandle) return;
  folderStatus.textContent = `${directoryHandle.name} / 保存中...`;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentMarkdown, 500);
}

async function saveCurrentMarkdown() {
  if (!indexHandle) return;

  try {
    const writable = await indexHandle.createWritable();
    await writable.write(editor.value);
    await writable.close();
    folderStatus.textContent = `${directoryHandle.name} / 保存済み`;
  } catch (error) {
    console.error(error);
    folderStatus.textContent = `${directoryHandle.name} / 保存できませんでした`;
  }
}

async function handlePaste(event) {
  const imageFiles = getPastedImageFiles(event);
  if (imageFiles.length === 0) return;

  if (!directoryHandle || !indexHandle) {
    event.preventDefault();
    alert("画像を保存するために、先にフォルダを読み込んでください。");
    return;
  }

  event.preventDefault();
  folderStatus.textContent = `${directoryHandle.name} / 画像保存中...`;

  try {
    const imageDirectory = await directoryHandle.getDirectoryHandle("image", { create: true });
    const inserted = [];

    for (const file of imageFiles) {
      const extension = extensionFromMime(file.type);
      const fileName = `${crypto.randomUUID()}${extension}`;
      const imageHandle = await imageDirectory.getFileHandle(fileName, { create: true });
      const writable = await imageHandle.createWritable();
      await writable.write(file);
      await writable.close();
      inserted.push(`![${fileName}](image/${fileName})`);
    }

    if (inserted.length > 0) {
      insertAtCursor(inserted.join("\n\n"));
      renderAll();
      await saveCurrentMarkdown();
    }
  } catch (error) {
    console.error(error);
    folderStatus.textContent = `${directoryHandle.name} / 画像保存に失敗しました`;
    alert("画像を保存できませんでした。フォルダの書き込み権限を確認してください。");
  }
}

function getPastedImageFiles(event) {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return [];

  const files = Array.from(clipboardData.files || []).filter(isImageFile);
  if (files.length > 0) return files;

  const items = Array.from(clipboardData.items || []);
  const itemFiles = items
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter(isImageFile)
    .filter(Boolean);

  if (itemFiles.length > 0) return itemFiles;

  return getDataUrlImagesFromHtml(clipboardData.getData("text/html"));
}

function isImageFile(file) {
  if (!file) return false;
  if (file.type?.startsWith("image/")) return true;
  return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name || "");
}

function getDataUrlImagesFromHtml(html) {
  if (!html) return [];

  const matches = [...html.matchAll(/<img[^>]+src=["'](data:image\/[^"']+)["']/gi)];
  return matches
    .map((match, index) => dataUrlToFile(match[1], `clipboard-image-${index + 1}`))
    .filter(Boolean);
}

function dataUrlToFile(dataUrl, baseName) {
  const match = dataUrl.match(/^data:(image\/[^;,]+)(;base64)?,(.*)$/);
  if (!match) return null;

  const mimeType = match[1];
  const isBase64 = Boolean(match[2]);
  const payload = match[3];
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], `${baseName}${extensionFromMime(mimeType)}`, { type: mimeType });
}

function extensionFromMime(mimeType) {
  const map = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg"
  };
  return map[mimeType] || ".png";
}

function insertAtCursor(text) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const prefix = before && !before.endsWith("\n") ? "\n" : "";
  const suffix = after && !after.startsWith("\n") ? "\n" : "";
  const insertion = `${prefix}${text}${suffix}`;

  editor.value = `${before}${insertion}${after}`;
  const cursor = before.length + insertion.length;
  editor.setSelectionRange(cursor, cursor);
  localStorage.setItem(STORAGE_KEY, editor.value);
}

function renderAll() {
  const sequence = ++renderSequence;
  headings = extractHeadings(editor.value);
  preview.innerHTML = markdownToHtml(editor.value, headings);
  renderAdvancedBlocks(preview, sequence, true);
  cachePreviewSourceElements();
  renderToc();
  resolvePreviewImages(sequence);
  scheduleSelectionSync();
}

function scheduleSelectionSync() {
  if (suppressEditorSelectionSync) return;
  cancelAnimationFrame(selectionSyncFrame);
  selectionSyncFrame = requestAnimationFrame(syncPreviewToEditorSelection);
}

function schedulePreviewScrollSync() {
  if (suppressPreviewScrollSync) return;
  cancelAnimationFrame(previewScrollSyncFrame);
  previewScrollSyncFrame = requestAnimationFrame(syncEditorToPreviewTop);
}

function syncPreviewToEditorSelection() {
  const sourceIndex = Math.min(editor.selectionStart, editor.selectionEnd);
  const target = findPreviewSourceElement(sourceIndex);
  if (!target) return;

  const editorRelativeY = getEditorSelectionY(sourceIndex) - editor.getBoundingClientRect().top;
  const previewRect = preview.getBoundingClientRect();
  const targetRect = getPreviewSourceRect(target, sourceIndex) || target.getBoundingClientRect();
  const targetRelativeY = targetRect.top - previewRect.top;
  suppressPreviewSyncFor(180);
  preview.scrollTop += targetRelativeY - editorRelativeY;
}

function syncEditorToPreviewTop() {
  const sourceIndex = getPreviewTopSourceIndex();
  if (sourceIndex === null) return;

  const editorY = getEditorSelectionY(sourceIndex);
  const editorTop = editor.getBoundingClientRect().top;
  suppressEditorSyncFor(180);
  editor.scrollTop += editorY - editorTop;
}

function suppressPreviewSyncFor(duration) {
  suppressPreviewScrollSync = true;
  clearTimeout(suppressPreviewScrollTimer);
  suppressPreviewScrollTimer = setTimeout(() => {
    suppressPreviewScrollSync = false;
  }, duration);
}

function suppressEditorSyncFor(duration) {
  suppressEditorSelectionSync = true;
  clearTimeout(suppressEditorSelectionTimer);
  suppressEditorSelectionTimer = setTimeout(() => {
    suppressEditorSelectionSync = false;
  }, duration);
}

function getPreviewTopSourceIndex() {
  if (previewSourceElements.length === 0) return null;

  const previewRect = preview.getBoundingClientRect();
  const previewTop = previewRect.top + 1;
  let previous = previewSourceElements[0];

  for (const element of previewSourceElements) {
    const rect = element.getBoundingClientRect();
    if (rect.bottom >= previewTop) {
      return getPreviewCaretSourceIndex(element, previewRect, previewTop) ?? getElementSourceIndexForTop(element);
    }
    previous = element;
  }

  return getPreviewCaretSourceIndex(previous, previewRect, previewTop) ?? getElementSourceIndexForTop(previous);
}

function getElementSourceIndexForTop(element) {
  const textStart = Number(element.dataset.sourceTextStart);
  if (Number.isFinite(textStart)) return textStart;
  return Number(element.dataset.sourceStart) || 0;
}

function getPreviewCaretSourceIndex(element, previewRect, y) {
  const textStart = Number(element.dataset.sourceTextStart);
  if (!Number.isFinite(textStart)) return null;

  const sampleXs = [
    previewRect.left + 28,
    previewRect.left + 72,
    previewRect.left + previewRect.width * 0.5,
    previewRect.right - 28
  ];

  for (const x of sampleXs) {
    const caret = getCaretAtPoint(x, y + 2);
    if (!caret || !element.contains(caret.node)) continue;

    const offset = getTextOffsetWithinElement(element, caret.node, caret.offset);
    if (offset !== null) return textStart + offset;
  }

  return null;
}

function getCaretAtPoint(x, y) {
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y);
    if (position) return { node: position.offsetNode, offset: position.offset };
  }

  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (range) return { node: range.startContainer, offset: range.startOffset };
  }

  return null;
}

function getTextOffsetWithinElement(element, targetNode, targetOffset) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node = walker.nextNode();

  while (node) {
    if (node === targetNode) return offset + targetOffset;
    offset += node.textContent.length;
    node = walker.nextNode();
  }

  return null;
}

function findPreviewSourceElement(sourceIndex) {
  const mathElement = findMathSourceElement(sourceIndex);
  if (mathElement) return mathElement;

  let previous = null;
  let bestMatch = null;
  let bestMatchSize = Infinity;

  for (const element of previewSourceElements) {
    const start = Number(element.dataset.sourceStart);
    const end = Number(element.dataset.sourceEnd);
    if (start <= sourceIndex && sourceIndex <= end) {
      const size = end - start;
      if (size < bestMatchSize) {
        bestMatch = element;
        bestMatchSize = size;
      }
      continue;
    }
    if (start > sourceIndex) return bestMatch || previous || element;
    previous = element;
  }

  return bestMatch || previous;
}

function findMathSourceElement(sourceIndex) {
  for (const element of previewSourceElements) {
    if (!element.classList.contains("math-inline") && !element.classList.contains("math-block")) continue;

    const start = Number(element.dataset.sourceStart);
    const end = Number(element.dataset.sourceEnd);
    const tolerance = element.classList.contains("math-inline") ? 1 : 0;
    if (start <= sourceIndex && sourceIndex <= end + tolerance) return element;
  }

  return null;
}

function cachePreviewSourceElements() {
  previewSourceElements = Array.from(preview.querySelectorAll("[data-source-start]"))
    .filter((element) => element.offsetParent !== null)
    .sort((a, b) => Number(a.dataset.sourceStart) - Number(b.dataset.sourceStart));
}

function getPreviewSourceRect(element, sourceIndex) {
  if (element.classList.contains("math-inline") || element.classList.contains("math-block")) {
    return element.getBoundingClientRect();
  }

  const textStart = Number(element.dataset.sourceTextStart);
  if (!Number.isFinite(textStart)) return null;

  const displayOffset = clamp(sourceIndex - textStart, 0, element.innerText.length);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = displayOffset;
  let textNode = walker.nextNode();

  while (textNode) {
    if (remaining <= textNode.textContent.length) {
      const range = document.createRange();
      const offset = Math.min(remaining, textNode.textContent.length);
      const start = Math.max(0, Math.min(offset, textNode.textContent.length - 1));
      const end = Math.min(textNode.textContent.length, start + 1);
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
      const rect = range.getBoundingClientRect();
      range.detach();
      if (rect.top || rect.left || rect.width || rect.height) return rect;
      return textNode.parentElement?.getBoundingClientRect() || null;
    }
    remaining -= textNode.textContent.length;
    textNode = walker.nextNode();
  }

  return null;
}

function getEditorSelectionY(sourceIndex) {
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  const style = getComputedStyle(editor);
  const mirroredProperties = [
    "boxSizing", "width", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "fontFamily", "fontSize", "fontWeight",
    "fontStyle", "letterSpacing", "textTransform", "lineHeight", "tabSize"
  ];

  mirroredProperties.forEach((property) => {
    mirror.style[property] = style[property];
  });

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.left = "-9999px";
  mirror.style.top = "0";
  mirror.style.height = "auto";
  mirror.style.minHeight = "0";
  mirror.style.overflow = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.wordBreak = "normal";
  mirror.style.width = `${editor.clientWidth}px`;

  mirror.textContent = editor.value.slice(0, sourceIndex);
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const y = editor.getBoundingClientRect().top + marker.offsetTop - editor.scrollTop;
  mirror.remove();
  return y;
}

async function renderAdvancedBlocks(container, sequence, updateSelectionSync = false) {
  renderMathBlocks(container);
  await renderMermaidBlocks(container, sequence);
  if (updateSelectionSync && sequence === renderSequence) {
    cachePreviewSourceElements();
    scheduleSelectionSync();
  }
}

function renderMathBlocks(container) {
  if (!window.katex) return;

  container.querySelectorAll(".math-inline, .math-block").forEach((element) => {
    const latex = element.dataset.latex || element.textContent;
    katex.render(latex, element, {
      displayMode: element.classList.contains("math-block"),
      throwOnError: false,
      strict: "ignore"
    });
  });
}

async function renderMermaidBlocks(container, sequence) {
  if (!window.mermaid) return;

  const diagrams = Array.from(container.querySelectorAll(".mermaid-diagram"));
  if (diagrams.length === 0) return;

  diagrams.forEach((diagram, index) => {
    diagram.id = `mermaid-${sequence}-${index}`;
    diagram.classList.add("mermaid");
    diagram.textContent = diagram.dataset.mermaid || "";
  });

  try {
    await mermaid.run({ nodes: diagrams });
  } catch (error) {
    console.error(error);
    diagrams.forEach((diagram) => {
      diagram.classList.remove("mermaid");
      diagram.innerHTML = `<pre><code>${escapeHtml(diagram.dataset.mermaid || "")}</code></pre>`;
    });
  }
}

function extractHeadings(markdown) {
  const lines = markdown.split(/\r?\n/);
  const result = [];
  const used = new Map();
  let inCodeBlock = false;

  lines.forEach((line, lineIndex) => {
    if (/^\s*```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) return;

    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) return;

    const level = match[1].length;
    const text = stripMarkdown(match[2]);
    const base = slugify(text) || `heading-${lineIndex + 1}`;
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    result.push({ id, level, text, lineIndex });
  });

  return result;
}

function markdownToHtml(markdown, headingSource) {
  const headingByLine = new Map(headingSource.map((heading) => [heading.lineIndex, heading]));
  const lines = markdown.split(/\r?\n/);
  const lineStarts = getLineStartOffsets(markdown, lines);
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (isHorizontalRule(line)) {
      html.push(`<hr ${sourceRangeAttributes(lineStarts[index], lineStarts[index] + lines[index].length)}>`);
      index += 1;
      continue;
    }

    if (/^\s*\$\$\s*$/.test(line)) {
      const startLine = index;
      const latex = [];
      index += 1;
      while (index < lines.length && !/^\s*\$\$\s*$/.test(lines[index])) {
        latex.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const endLine = Math.max(startLine, index - 1);
      html.push(`<div class="math-block" ${sourceRangeAttributes(lineStarts[startLine], lineStarts[endLine] + lines[endLine].length)} data-latex="${escapeAttr(latex.join("\n"))}">${escapeHtml(latex.join("\n"))}</div>`);
      continue;
    }

    if (/^\s*```/.test(line)) {
      const startLine = index;
      const language = line.replace(/^\s*```/, "").trim().toLowerCase();
      const code = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const endLine = Math.max(startLine, index - 1);
      const codeText = code.join("\n");
      const range = sourceRangeAttributes(lineStarts[startLine], lineStarts[endLine] + lines[endLine].length);
      if (language === "mermaid") {
        html.push(`<div class="diagram-block mermaid-diagram" ${range} data-mermaid="${escapeAttr(codeText)}"><pre><code>${escapeHtml(codeText)}</code></pre></div>`);
      } else if (["latex", "tex", "math"].includes(language)) {
        html.push(`<div class="math-block" ${range} data-latex="${escapeAttr(codeText)}">${escapeHtml(codeText)}</div>`);
      } else {
        html.push(`<pre ${range}><code class="language-${escapeAttr(language)}">${escapeHtml(codeText)}</code></pre>`);
      }
      continue;
    }

    const heading = headingByLine.get(index);
    if (heading) {
      const headingMarker = lines[index].match(/^#{1,6}\s+/)?.[0] || "";
      html.push(`<h${heading.level} id="${escapeAttr(heading.id)}" data-heading-id="${escapeAttr(heading.id)}" ${sourceRangeAttributes(lineStarts[index], lineStarts[index] + lines[index].length, lineStarts[index] + headingMarker.length)}>${inlineMarkdown(heading.text, lineStarts[index] + headingMarker.length)}</h${heading.level}>`);
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const startLine = index;
      const headerCells = splitTableRow(lines[index]);
      const alignments = splitTableRow(lines[index + 1]).map(getTableAlignment);
      const rows = [];
      index += 2;
      while (index < lines.length && /\|/.test(lines[index]) && lines[index].trim()) {
        rows.push({ cells: splitTableRow(lines[index]), start: lineStarts[index], end: lineStarts[index] + lines[index].length });
        index += 1;
      }
      html.push(renderTable(headerCells, alignments, rows, lineStarts[startLine], lineStarts[startLine] + lines[startLine].length));
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const startLine = index;
      const quoteLines = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      const endLine = Math.max(startLine, index - 1);
      html.push(`<blockquote ${sourceRangeAttributes(lineStarts[startLine], lineStarts[endLine] + lines[endLine].length)}>${paragraphsFromLines(quoteLines)}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        const marker = lines[index].match(/^\s*[-*+]\s+/)?.[0] || "";
        items.push({ text: lines[index].replace(/^\s*[-*+]\s+/, ""), start: lineStarts[index], end: lineStarts[index] + lines[index].length, textStart: lineStarts[index] + marker.length });
        index += 1;
      }
      html.push(`<ul>${items.map((item) => renderListItem(item)).join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        const marker = lines[index].match(/^\s*\d+\.\s+/)?.[0] || "";
        items.push({ text: lines[index].replace(/^\s*\d+\.\s+/, ""), start: lineStarts[index], end: lineStarts[index] + lines[index].length, textStart: lineStarts[index] + marker.length });
        index += 1;
      }
      html.push(`<ol>${items.map((item) => renderListItem(item)).join("")}</ol>`);
      continue;
    }

    const paragraph = [];
    const paragraphStart = index;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !headingByLine.has(index) &&
      !/^\s*```/.test(lines[index]) &&
      !/^\s*>\s?/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !isHorizontalRule(lines[index]) &&
      !isTableStart(lines, index)
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    html.push(`<p>${renderParagraphLines(paragraph, paragraphStart, lineStarts, lines)}</p>`);
  }

  return html.join("\n");
}

function inlineMarkdown(text, sourceOffset = null) {
  const tokens = [];
  const store = (value) => {
    const token = `@@MDTOKEN${tokens.length}@@`;
    tokens.push(value);
    return token;
  };

  let output = text
    .replace(/`([^`]+)`/g, (_, code) => store(`<code>${escapeHtml(code)}</code>`))
    .replace(/(^|[^\\])\$([^$\n]+?)\$/g, (match, prefix, latex, offset) => {
      const mathStart = offset + prefix.length;
      const range = sourceOffset === null ? "" : ` ${sourceRangeAttributes(sourceOffset + mathStart, sourceOffset + mathStart + latex.length + 2)}`;
      return `${prefix}${store(`<span class="math-inline"${range} data-latex="${escapeAttr(latex)}">${escapeHtml(latex)}</span>`)}`;
    })
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, src) => {
      const safeSrc = sanitizeUrl(src);
      const renderSrc = getImageRenderSrc(safeSrc);
      return store(`<img src="${escapeAttr(renderSrc)}" alt="${escapeAttr(alt)}" data-local-src="${escapeAttr(safeSrc)}">`);
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label, href) => {
      const safeHref = sanitizeUrl(href);
      return store(`<a href="${escapeAttr(safeHref)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`);
    })
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s+[^<>]*?)?\s*\/?>/g, (tag) => {
      const safeTag = sanitizeHtmlTag(tag);
      return safeTag ? store(safeTag) : tag;
    });

  output = escapeHtml(output)
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");

  return output.replace(/@@MDTOKEN(\d+)@@/g, (_, tokenIndex) => tokens[Number(tokenIndex)]);
}

function paragraphsFromLines(lines) {
  return lines
    .join("\n")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${renderSimpleParagraphLines(paragraph.split("\n"))}</p>`)
    .join("");
}

function renderParagraphLines(paragraph, paragraphStart, lineStarts, allLines) {
  return paragraph.map((text, offset) => {
    const lineIndex = paragraphStart + offset;
    const visibleText = stripHardBreakMarker(text);
    const separator = getParagraphLineSeparator(text, offset, paragraph.length);
    return `<span ${sourceRangeAttributes(lineStarts[lineIndex], lineStarts[lineIndex] + allLines[lineIndex].length, lineStarts[lineIndex])}>${inlineMarkdown(visibleText, lineStarts[lineIndex])}</span>${separator}`;
  }).join("");
}

function renderSimpleParagraphLines(lines) {
  return lines.map((text, index) => {
    const visibleText = stripHardBreakMarker(text);
    return `${inlineMarkdown(visibleText)}${getParagraphLineSeparator(text, index, lines.length)}`;
  }).join("");
}

function getParagraphLineSeparator(line, index, lineCount) {
  if (index >= lineCount - 1) return "";
  return hasHardBreak(line) ? "<br>" : "\n";
}

function hasHardBreak(line) {
  return /(?: {2,}|\\)$/.test(line);
}

function stripHardBreakMarker(line) {
  return line.replace(/(?: {2,}|\\)$/, "");
}

function renderListItem(item) {
  const task = item.text.match(/^\[(x|X| )\]\s+(.*)$/);
  if (!task) {
    return `<li ${sourceRangeAttributes(item.start, item.end, item.textStart)}>${inlineMarkdown(item.text, item.textStart)}</li>`;
  }

  const checked = task[1].toLowerCase() === "x" ? " checked" : "";
  return `<li class="task-list-item" ${sourceRangeAttributes(item.start, item.end, item.textStart)}><input type="checkbox" disabled${checked}> ${inlineMarkdown(task[2], item.textStart + task[0].length - task[2].length)}</li>`;
}

function getLineStartOffsets(markdown, lines) {
  const offsets = [];
  let position = 0;

  for (const line of lines) {
    offsets.push(position);
    position += line.length + 1;
  }

  return offsets;
}

function sourceRangeAttributes(start, end, textStart = null) {
  const textStartAttribute = textStart === null ? "" : ` data-source-text-start="${textStart}"`;
  return `data-source-start="${start}" data-source-end="${Math.max(start, end)}"${textStartAttribute}`;
}

function isHorizontalRule(line) {
  return /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line);
}

function isTableStart(lines, index) {
  return index + 1 < lines.length && /\|/.test(lines[index]) && isTableSeparator(lines[index + 1]);
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(row) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function getTableAlignment(separator) {
  if (/^:-+:$/.test(separator)) return "center";
  if (/^-+:$/.test(separator)) return "right";
  if (/^:-+$/.test(separator)) return "left";
  return "";
}

function renderTable(headers, alignments, rows, start, end) {
  const alignStyle = (index) => alignments[index] ? ` style="text-align: ${alignments[index]}"` : "";
  const thead = headers.map((header, index) => `<th${alignStyle(index)}>${inlineMarkdown(header)}</th>`).join("");
  const tbody = rows
    .map((row) => `<tr ${sourceRangeAttributes(row.start, row.end)}>${headers.map((_, index) => `<td${alignStyle(index)}>${inlineMarkdown(row.cells[index] || "")}</td>`).join("")}</tr>`)
    .join("");
  return `<table ${sourceRangeAttributes(start, end)}><thead><tr ${sourceRangeAttributes(start, end)}>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

async function resolvePreviewImages(sequence) {
  const images = Array.from(preview.querySelectorAll("img[data-local-src]"));
  const currentLocalSources = new Set();

  for (const image of images) {
    if (sequence !== renderSequence) return;
    const src = image.getAttribute("data-local-src");
    if (!directoryHandle || !src || isExternalUrl(src)) continue;
    currentLocalSources.add(src);

    const cachedUrl = previewImageUrlCache.get(src);
    if (cachedUrl) {
      if (image.src !== cachedUrl) image.src = cachedUrl;
      continue;
    }

    try {
      const fileHandle = await getFileHandleByPath(src);
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);
      previewImageUrlCache.set(src, url);
      image.src = url;
    } catch {
      image.alt = `${image.alt || "image"} (見つかりません)`;
    }
  }

  for (const [src, url] of previewImageUrlCache) {
    if (!currentLocalSources.has(src)) {
      URL.revokeObjectURL(url);
      previewImageUrlCache.delete(src);
    }
  }
}

function getImageRenderSrc(src) {
  if (!src || isExternalUrl(src)) return src;
  return previewImageUrlCache.get(src) || src;
}

function clearPreviewImageCache() {
  for (const url of previewImageUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  previewImageUrlCache.clear();
}

async function getFileHandleByPath(path) {
  const cleanPath = decodeURIComponent(path).replace(/^\.\/+/, "");
  const segments = cleanPath.split("/").filter(Boolean);
  let currentDirectory = directoryHandle;

  for (const segment of segments.slice(0, -1)) {
    currentDirectory = await currentDirectory.getDirectoryHandle(segment);
  }

  return currentDirectory.getFileHandle(segments[segments.length - 1]);
}

function renderToc() {
  if (headings.length === 0) {
    tocList.innerHTML = '<div class="toc-empty">見出しがありません</div>';
    return;
  }

  tocList.innerHTML = headings.map((heading) => (
    `<button class="toc-item toc-level-${heading.level}${heading.id === activeHeadingId ? " active" : ""}" type="button" data-heading-id="${escapeAttr(heading.id)}">${escapeHtml(heading.text)}</button>`
  )).join("");

  tocList.querySelectorAll(".toc-item").forEach((button) => {
    button.addEventListener("click", () => {
      const heading = headings.find((item) => item.id === button.dataset.headingId);
      if (heading) jumpToHeading(heading);
    });
  });
}

function jumpToHeading(heading) {
  activeHeadingId = heading.id;
  renderToc();

  const target = preview.querySelector(`[data-heading-id="${cssEscape(heading.id)}"]`);
  if (target) {
    target.scrollIntoView({ block: "start", behavior: "smooth" });
    clearTimeout(headingHighlightTimer);
    preview.querySelectorAll(".heading-highlight").forEach((element) => {
      element.classList.remove("heading-highlight");
    });
    target.classList.remove("heading-highlight");
    requestAnimationFrame(() => {
      target.classList.add("heading-highlight");
      headingHighlightTimer = setTimeout(() => {
        target.classList.remove("heading-highlight");
      }, 2000);
    });
  }

  selectEditorLine(heading.lineIndex);
}

function selectEditorLine(lineIndex) {
  const lines = editor.value.split(/\r?\n/);
  const start = lines.slice(0, lineIndex).join("\n").length + (lineIndex > 0 ? 1 : 0);
  const end = start + lines[lineIndex].length;
  const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 24;
  editor.focus({ preventScroll: true });
  editor.setSelectionRange(start, end);
  editor.scrollTop = Math.max(0, lineIndex * lineHeight - editor.clientHeight * 0.18);
}

function renderSyntaxCategories() {
  let currentGroup = "";
  syntaxCategories.innerHTML = syntaxExamples.map((example, index) => {
    const group = example.group || "Markdown";
    const groupHtml = group === currentGroup ? "" : `<div class="syntax-category-group">${escapeHtml(group)}</div>`;
    currentGroup = group;
    return `${groupHtml}<button class="syntax-category${index === 0 ? " active" : ""}" type="button" data-index="${index}">${escapeHtml(example.label)}</button>`;
  }).join("");

  syntaxCategories.querySelectorAll(".syntax-category").forEach((button) => {
    button.addEventListener("click", () => selectSyntaxExample(Number(button.dataset.index)));
  });

  selectSyntaxExample(0);
}

function selectSyntaxExample(index) {
  const example = syntaxExamples[index];
  syntaxCategories.querySelectorAll(".syntax-category").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.index) === index);
  });
  syntaxMarkdown.textContent = example.markdown;
  syntaxPreview.innerHTML = markdownToHtml(example.markdown, extractHeadings(example.markdown));
  renderAdvancedBlocks(syntaxPreview, `syntax-${index}`);
}

function openSyntaxModal() {
  syntaxModal.classList.add("open");
  syntaxModal.setAttribute("aria-hidden", "false");
  closeSyntaxButton.focus();
}

function closeSyntaxModal() {
  syntaxModal.classList.remove("open");
  syntaxModal.setAttribute("aria-hidden", "true");
  syntaxButton.focus();
}

function startResize(event) {
  const target = event.currentTarget;
  const mode = target.dataset.resizer;
  const startX = event.clientX;
  const startTocWidth = document.querySelector(".toc-panel").getBoundingClientRect().width;
  const startEditorWidth = document.querySelector(".editor-panel").getBoundingClientRect().width;

  target.classList.add("dragging");
  target.setPointerCapture(event.pointerId);

  const onPointerMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    const workspaceWidth = workspace.getBoundingClientRect().width;

    if (mode === "toc") {
      const nextTocWidth = clamp(startTocWidth + delta, 160, Math.min(420, workspaceWidth - 580));
      document.documentElement.style.setProperty("--toc-width", `${nextTocWidth}px`);
    } else {
      const tocWidth = document.querySelector(".toc-panel").getBoundingClientRect().width;
      const maxEditorWidth = Math.max(260, workspaceWidth - tocWidth - 272);
      const nextEditorWidth = clamp(startEditorWidth + delta, 260, maxEditorWidth);
      document.documentElement.style.setProperty("--editor-width", `${nextEditorWidth}px`);
    }
  };

  const onPointerUp = () => {
    target.classList.remove("dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

function stripMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_>#-]/g, "")
    .trim();
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-_]+/gu, "");
}

function sanitizeUrl(url) {
  const trimmed = url.trim();
  if (/^(javascript|vbscript):/i.test(trimmed)) return "#";
  return trimmed;
}

function sanitizeHtmlTag(tag) {
  const closing = tag.match(/^<\/\s*([a-zA-Z][a-zA-Z0-9-]*)\s*>$/);
  if (closing) {
    const tagName = closing[1].toLowerCase();
    return ALLOWED_HTML_TAGS.has(tagName) && !VOID_HTML_TAGS.has(tagName) ? `</${tagName}>` : "";
  }

  const opening = tag.match(/^<\s*([a-zA-Z][a-zA-Z0-9-]*)([^<>]*)>$/);
  if (!opening) return "";

  const tagName = opening[1].toLowerCase();
  if (!ALLOWED_HTML_TAGS.has(tagName)) return "";

  const rawAttributes = opening[2] || "";
  const selfClosing = /\/\s*$/.test(rawAttributes) || VOID_HTML_TAGS.has(tagName);
  const attributes = [];
  const attributePattern = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
  let match = attributePattern.exec(rawAttributes);

  while (match) {
    const name = match[1].toLowerCase();
    const rawValue = match[2] || "";
    match = attributePattern.exec(rawAttributes);

    if (name.startsWith("on") || name === "style" || !ALLOWED_HTML_ATTRIBUTES.has(name)) continue;

    const unquotedValue = rawValue.replace(/^["']|["']$/g, "");
    const value = name === "href" || name === "src" ? sanitizeUrl(unquotedValue) : unquotedValue;
    attributes.push(`${name}="${escapeAttr(value)}"`);
  }

  return `<${tagName}${attributes.length ? ` ${attributes.join(" ")}` : ""}${selfClosing ? ">" : ">"}`;
}

function isExternalUrl(url) {
  return /^(https?:|data:|blob:|mailto:|#)/i.test(url);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

initialize();
