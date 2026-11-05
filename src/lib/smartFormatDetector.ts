/**
 * Smart Format Detector & Converter for Notes & Workspace
 * Handles clipboard data copied from:
 * 1. Websites & Web Articles (Chrome, Safari, Edge, Firefox)
 * 2. MS Word, Google Docs, Apple Pages, Notion & Office suites
 * 3. AI Chat interfaces (ChatGPT, Claude, Gemini, Perplexity, DeepSeek, Copilot)
 * 4. Structured Plain Text (Markdown, bullet points, numbered lists, checklists, headlines)
 */

export interface FormattedDetectionResult {
  source: 'ai_chat' | 'word_doc' | 'google_docs' | 'web_article' | 'markdown' | 'structured_text' | 'plain';
  sourceLabel: string;
  hasFormatting: boolean;
  suggestedTitle: string;
  convertedText: string;
  rawText: string;
  stats: {
    headingsCount: number;
    bulletsCount: number;
    numberedCount: number;
    checklistCount: number;
    codeBlocksCount: number;
    boldCount: number;
    tablesCount: number;
  };
}

/**
 * Clean up HTML from MS Word, AI chat, or Web pages and convert into clean structured markdown
 */
export function convertHtmlToStructuredMarkdown(html: string, fallbackPlain: string): {
  markdown: string;
  suggestedTitle: string;
  source: 'ai_chat' | 'word_doc' | 'google_docs' | 'web_article' | 'plain';
  stats: FormattedDetectionResult['stats'];
} {
  const stats = {
    headingsCount: 0,
    bulletsCount: 0,
    numberedCount: 0,
    checklistCount: 0,
    codeBlocksCount: 0,
    boldCount: 0,
    tablesCount: 0,
  };

  let suggestedTitle = '';
  let source: 'ai_chat' | 'word_doc' | 'google_docs' | 'web_article' | 'plain' = 'web_article';

  // Detect source signatures
  if (/mso-|MsoNormal|MsoListParagraph|urn:schemas-microsoft-com:office/i.test(html)) {
    source = 'word_doc';
  } else if (/docs-internal-guid|id="docs-internal-guid"|google-docs/i.test(html)) {
    source = 'google_docs';
  } else if (
    /markdown|prose|dark:prose-invert|claude|chatgpt|openai|anthropic|gemini|deepseek|perplexity|user-message|assistant-message|agent-turn/i.test(html) ||
    /hljs|language-|code-block/i.test(html)
  ) {
    source = 'ai_chat';
  }

  // Parse HTML using DOMParser in browser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove non-content tags
  const tagsToRemove = ['script', 'style', 'noscript', 'meta', 'link', 'svg', 'nav', 'footer', 'iframe'];
  tagsToRemove.forEach((t) => {
    const elems = doc.querySelectorAll(t);
    elems.forEach((e) => e.remove());
  });

  // MS Word cleanup: remove Mso conditional comments or strip bullet ignore spans
  const msoIgnoreSpans = doc.querySelectorAll('span[style*="mso-list:Ignore"], span[style*="mso-list: Ignore"]');
  msoIgnoreSpans.forEach((span) => {
    // Check if it was an ignore bullet
    const parent = span.parentElement;
    if (parent && parent.className.includes('MsoListParagraph')) {
      // mark it as a list item
      parent.setAttribute('data-is-mso-list', 'true');
    }
    span.remove();
  });

  // Process recursive node conversion
  function processNode(node: Node, depth: number = 0): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // Word List Paragraphs
    if (el.getAttribute('data-is-mso-list') === 'true' || el.className.includes('MsoListParagraph')) {
      stats.bulletsCount++;
      const text = getChildrenText(el).trim();
      return `\n• ${text}\n`;
    }

    // Headings
    if (tagName === 'h1') {
      stats.headingsCount++;
      const text = getChildrenText(el).trim();
      if (!suggestedTitle) suggestedTitle = text;
      return `\n\n# ${text}\n\n`;
    }
    if (tagName === 'h2') {
      stats.headingsCount++;
      const text = getChildrenText(el).trim();
      if (!suggestedTitle) suggestedTitle = text;
      return `\n\n## ${text}\n\n`;
    }
    if (tagName === 'h3') {
      stats.headingsCount++;
      const text = getChildrenText(el).trim();
      if (!suggestedTitle) suggestedTitle = text;
      return `\n\n### ${text}\n\n`;
    }
    if (tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
      stats.headingsCount++;
      const text = getChildrenText(el).trim();
      return `\n\n#### ${text}\n\n`;
    }

    // Code blocks
    if (tagName === 'pre') {
      stats.codeBlocksCount++;
      const codeEl = el.querySelector('code');
      const lang = codeEl ? (codeEl.className.match(/language-([a-z0-9_-]+)/i)?.[1] || '') : '';
      const text = (codeEl ? codeEl.textContent : el.textContent) || '';
      return `\n\n\`\`\`${lang}\n${text.trim()}\n\`\`\`\n\n`;
    }

    // Inline code
    if (tagName === 'code' && el.parentElement?.tagName.toLowerCase() !== 'pre') {
      const text = el.textContent || '';
      return `\`${text}\``;
    }

    // Bold / Strong
    if (tagName === 'strong' || tagName === 'b' || el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight, 10) >= 600) {
      stats.boldCount++;
      const text = getChildrenText(el);
      return text.trim() ? `**${text.trim()}** ` : '';
    }

    // Italic / Em
    if (tagName === 'em' || tagName === 'i' || el.style.fontStyle === 'italic') {
      const text = getChildrenText(el);
      return text.trim() ? `*${text.trim()}* ` : '';
    }

    // Blockquote
    if (tagName === 'blockquote') {
      const text = getChildrenText(el).trim();
      const quoteLines = text.split('\n').map((l) => `> ${l}`).join('\n');
      return `\n\n${quoteLines}\n\n`;
    }

    // Unordered List
    if (tagName === 'ul') {
      const items: string[] = [];
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toLowerCase() === 'li') {
          const li = child as HTMLElement;
          // Check for checkbox input inside li (AI task lists or GitHub tasks)
          const checkbox = li.querySelector('input[type="checkbox"]');
          if (checkbox) {
            stats.checklistCount++;
            const isChecked = (checkbox as HTMLInputElement).checked;
            checkbox.remove();
            const liText = getChildrenText(li).trim();
            items.push(`${isChecked ? '[x]' : '[ ]'} ${liText}`);
          } else {
            stats.bulletsCount++;
            const liText = getChildrenText(li).trim();
            items.push(`• ${liText}`);
          }
        } else {
          const other = processNode(child, depth + 1).trim();
          if (other) items.push(other);
        }
      });
      return `\n\n${items.join('\n')}\n\n`;
    }

    // Ordered List
    if (tagName === 'ol') {
      const items: string[] = [];
      let itemIndex = 1;
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toLowerCase() === 'li') {
          stats.numberedCount++;
          const li = child as HTMLElement;
          const liText = getChildrenText(li).trim();
          items.push(`${itemIndex}. ${liText}`);
          itemIndex++;
        } else {
          const other = processNode(child, depth + 1).trim();
          if (other) items.push(other);
        }
      });
      return `\n\n${items.join('\n')}\n\n`;
    }

    // Single List item (outside ul/ol or orphaned)
    if (tagName === 'li') {
      stats.bulletsCount++;
      return `\n• ${getChildrenText(el).trim()}\n`;
    }

    // Tables
    if (tagName === 'table') {
      stats.tablesCount++;
      return processTable(el);
    }

    // Links
    if (tagName === 'a') {
      const text = getChildrenText(el).trim();
      const href = el.getAttribute('href');
      if (href && text && !href.startsWith('javascript:')) {
        return `[${text}](${href})`;
      }
      return text;
    }

    // Paragraphs / Divs
    if (tagName === 'p' || tagName === 'div' || tagName === 'section' || tagName === 'article') {
      const text = getChildrenText(el).trim();
      if (!text) return '';
      // Check if div/p is acting as a list item
      if (text.startsWith('•') || text.startsWith('- ') || text.startsWith('* ')) {
        stats.bulletsCount++;
        return `\n${text}\n`;
      }
      return `\n\n${text}\n\n`;
    }

    if (tagName === 'br') {
      return '\n';
    }

    if (tagName === 'hr') {
      return '\n\n---\n\n';
    }

    // Generic container fallback
    return getChildrenText(el);
  }

  function getChildrenText(parent: HTMLElement): string {
    let result = '';
    parent.childNodes.forEach((child) => {
      result += processNode(child);
    });
    return result;
  }

  function processTable(tableEl: HTMLElement): string {
    const rows = tableEl.querySelectorAll('tr');
    if (!rows.length) return '';

    const tableMatrix: string[][] = [];
    rows.forEach((row) => {
      const rowCells: string[] = [];
      const cells = row.querySelectorAll('th, td');
      cells.forEach((cell) => {
        rowCells.push(cell.textContent?.trim().replace(/\|/g, '\\|') || '');
      });
      if (rowCells.length) {
        tableMatrix.push(rowCells);
      }
    });

    if (!tableMatrix.length) return '';

    const header = tableMatrix[0];
    const divider = header.map(() => '---');
    const dataRows = tableMatrix.slice(1);

    let md = `\n\n| ${header.join(' | ')} |\n| ${divider.join(' | ')} |\n`;
    dataRows.forEach((r) => {
      // pad cells if row length is less than header
      while (r.length < header.length) r.push('');
      md += `| ${r.join(' | ')} |\n`;
    });
    return md + '\n';
  }

  const rawConverted = processNode(doc.body).trim();

  // Normalize excessive newlines
  const cleaned = rawConverted
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  // If parsed HTML resulted in empty text, use fallback
  if (!cleaned && fallbackPlain) {
    return {
      markdown: fallbackPlain,
      suggestedTitle: '',
      source: 'plain',
      stats,
    };
  }

  return {
    markdown: cleaned,
    suggestedTitle,
    source,
    stats,
  };
}

/**
 * Normalizes plain text that already contains markdown, bullet points, numbered points, or AI chat responses
 */
export function normalizeStructuredPlainText(text: string): {
  normalized: string;
  suggestedTitle: string;
  stats: FormattedDetectionResult['stats'];
  detectedSource: 'ai_chat' | 'markdown' | 'structured_text' | 'plain';
} {
  const stats = {
    headingsCount: 0,
    bulletsCount: 0,
    numberedCount: 0,
    checklistCount: 0,
    codeBlocksCount: 0,
    boldCount: 0,
    tablesCount: 0,
  };

  let suggestedTitle = '';
  let detectedSource: 'ai_chat' | 'markdown' | 'structured_text' | 'plain' = 'plain';

  // Count bold occurrences
  const boldMatches = text.match(/\*\*[^*]+\*\*/g) || [];
  stats.boldCount = boldMatches.length;

  // Count code blocks
  const codeBlockMatches = text.match(/```[\s\S]*?```/g) || [];
  stats.codeBlocksCount = codeBlockMatches.length;

  // Process line by line
  const lines = text.split('\n');
  const processedLines: string[] = [];

  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Track code blocks
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      processedLines.push(rawLine);
      continue;
    }

    if (inCodeBlock) {
      processedLines.push(rawLine);
      continue;
    }

    // Detect Markdown Headers
    if (trimmed.startsWith('# ')) {
      stats.headingsCount++;
      if (!suggestedTitle) suggestedTitle = trimmed.slice(2).trim();
      processedLines.push(rawLine);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      stats.headingsCount++;
      if (!suggestedTitle) suggestedTitle = trimmed.slice(3).trim();
      processedLines.push(rawLine);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      stats.headingsCount++;
      if (!suggestedTitle) suggestedTitle = trimmed.slice(4).trim();
      processedLines.push(rawLine);
      continue;
    }
    if (trimmed.startsWith('#### ') || trimmed.startsWith('##### ') || trimmed.startsWith('###### ')) {
      stats.headingsCount++;
      processedLines.push(rawLine);
      continue;
    }

    // Detect Underlined Headers (e.g., Line followed by === or ---)
    if (i < lines.length - 1 && trimmed.length > 0 && trimmed.length < 80) {
      const nextLineTrimmed = lines[i + 1].trim();
      if (/^={3,}$/.test(nextLineTrimmed)) {
        stats.headingsCount++;
        if (!suggestedTitle) suggestedTitle = trimmed;
        processedLines.push(`# ${trimmed}`);
        i++; // skip next line
        continue;
      }
      if (/^-{3,}$/.test(nextLineTrimmed)) {
        stats.headingsCount++;
        if (!suggestedTitle) suggestedTitle = trimmed;
        processedLines.push(`## ${trimmed}`);
        i++; // skip next line
        continue;
      }
    }

    // Detect Checklists: `- [ ]`, `* [ ]`, `[ ]`, `[x]`, `- [x]`, `* [x]`
    const checklistMatch = rawLine.match(/^(\s*)(?:[-*•]\s+)?\[([ xX])\]\s*(.*)$/);
    if (checklistMatch) {
      stats.checklistCount++;
      const indent = checklistMatch[1] || '';
      const state = checklistMatch[2].toLowerCase() === 'x' ? 'x' : ' ';
      const content = checklistMatch[3];
      processedLines.push(`${indent}[${state}] ${content}`);
      continue;
    }

    // Detect Bullets: •, -, *, –, —, ▪, ▫, ◦, ✦, ✔, ✓, ►, ▸, →, +
    const bulletMatch = rawLine.match(/^(\s*)([•\-\*–—▪▫◦✦✔✓►▸→\+])\s+(.*)$/);
    if (bulletMatch) {
      stats.bulletsCount++;
      const indent = bulletMatch[1] || '';
      const content = bulletMatch[3];
      processedLines.push(`${indent}• ${content}`);
      continue;
    }

    // Detect Numbered Lists: 1., 1), (1), Step 1:, Day 1 -
    const numberMatch = rawLine.match(/^(\s*)(?:(?:\(?(\d+)\)[\.\:]?)|(?:(\d+)\.))\s+(.*)$/);
    if (numberMatch) {
      stats.numberedCount++;
      const indent = numberMatch[1] || '';
      const num = numberMatch[2] || numberMatch[3];
      const content = numberMatch[4];
      processedLines.push(`${indent}${num}. ${content}`);
      continue;
    }

    // Detect AI Response section titles: "Key Takeaways:", "Summary:", "**Section 1:**"
    const sectionTitleMatch = trimmed.match(/^(\*\*[^*]+(?:\:|\*\*)|[A-Z][A-Za-z0-9\s]{2,30}\:)$/);
    if (sectionTitleMatch && !trimmed.includes('\n')) {
      stats.headingsCount++;
      const cleanHeading = trimmed.replace(/^\*\*|\*\*$/g, '').replace(/\:$/, '');
      if (!suggestedTitle && i === 0) suggestedTitle = cleanHeading;
      processedLines.push(`### ${cleanHeading}`);
      continue;
    }

    processedLines.push(rawLine);
  }

  // Assess detected source type
  const totalFormattingHits =
    stats.headingsCount +
    stats.bulletsCount +
    stats.numberedCount +
    stats.checklistCount +
    stats.codeBlocksCount +
    stats.boldCount;

  if (stats.codeBlocksCount > 0 || (stats.headingsCount > 1 && stats.bulletsCount > 2)) {
    detectedSource = 'ai_chat';
  } else if (text.includes('# ') || (stats.boldCount > 2 && stats.bulletsCount > 1)) {
    detectedSource = 'markdown';
  } else if (totalFormattingHits > 0) {
    detectedSource = 'structured_text';
  } else {
    detectedSource = 'plain';
  }

  return {
    normalized: processedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    suggestedTitle,
    stats,
    detectedSource,
  };
}

/**
 * Main entry point: Inspects clipboard data from paste event,
 * determines if HTML or plain text is best, converts and detects formats.
 */
export function detectAndConvertClipboard(clipboardData: DataTransfer): FormattedDetectionResult {
  const html = clipboardData.getData('text/html') || '';
  const plain = clipboardData.getData('text/plain') || '';

  // Case 1: Rich HTML available from MS Word, Google Docs, Web article, or AI Chat
  const hasRichHtml =
    html.trim().length > 0 &&
    (html.includes('<h') ||
      html.includes('<ul') ||
      html.includes('<ol') ||
      html.includes('<li') ||
      html.includes('<table') ||
      html.includes('<blockquote') ||
      html.includes('<pre') ||
      html.includes('Mso') ||
      html.includes('docs-internal') ||
      html.includes('markdown') ||
      html.includes('<strong>') ||
      html.includes('<b>'));

  if (hasRichHtml) {
    const htmlResult = convertHtmlToStructuredMarkdown(html, plain);
    const totalHits =
      htmlResult.stats.headingsCount +
      htmlResult.stats.bulletsCount +
      htmlResult.stats.numberedCount +
      htmlResult.stats.checklistCount +
      htmlResult.stats.codeBlocksCount +
      htmlResult.stats.boldCount +
      htmlResult.stats.tablesCount;

    let sourceLabel = 'Web Article';
    if (htmlResult.source === 'word_doc') sourceLabel = 'MS Word Document';
    else if (htmlResult.source === 'google_docs') sourceLabel = 'Google Docs';
    else if (htmlResult.source === 'ai_chat') sourceLabel = 'AI Chat Response';

    return {
      source: htmlResult.source,
      sourceLabel,
      hasFormatting: totalHits > 0,
      suggestedTitle: htmlResult.suggestedTitle,
      convertedText: htmlResult.markdown,
      rawText: plain || htmlResult.markdown,
      stats: htmlResult.stats,
    };
  }

  // Case 2: Plain text (or markdown from AI Chat copy button)
  const plainResult = normalizeStructuredPlainText(plain);
  const totalPlainHits =
    plainResult.stats.headingsCount +
    plainResult.stats.bulletsCount +
    plainResult.stats.numberedCount +
    plainResult.stats.checklistCount +
    plainResult.stats.codeBlocksCount +
    plainResult.stats.boldCount;

  let sourceLabel = 'Plain Text';
  if (plainResult.detectedSource === 'ai_chat') sourceLabel = 'AI Chat (Markdown)';
  else if (plainResult.detectedSource === 'markdown') sourceLabel = 'Markdown Formatting';
  else if (plainResult.detectedSource === 'structured_text') sourceLabel = 'Structured Points & Headlines';

  return {
    source: plainResult.detectedSource,
    sourceLabel,
    hasFormatting: totalPlainHits > 0,
    suggestedTitle: plainResult.suggestedTitle,
    convertedText: plainResult.normalized,
    rawText: plain,
    stats: plainResult.stats,
  };
}

/**
 * Helper to auto-format any existing note text into clean headlines, bullets, and points
 */
export function autoFormatNoteText(text: string): {
  formattedText: string;
  suggestedTitle: string;
  stats: FormattedDetectionResult['stats'];
} {
  const result = normalizeStructuredPlainText(text);
  return {
    formattedText: result.normalized,
    suggestedTitle: result.suggestedTitle,
    stats: result.stats,
  };
}
