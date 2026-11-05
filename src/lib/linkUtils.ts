/**
 * Utility functions for URL detection, tokenization, domain extraction,
 * and high-resolution favicon resolution.
 */

// Trailing punctuation characters that should be trimmed from detected URLs
const TRAILING_PUNCTUATION_REGEX = /[.,:;!?)}\]]+$/;

/**
 * Creates a fresh RegExp instance for detecting URLs and link-like domain patterns
 */
export function createUrlRegex(): RegExp {
  return /(?:https?:\/\/|ftp:\/\/)[^\s<>"'{}|\\^`]+|(?:www\.)[^\s<>"'{}|\\^`]+|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|org|net|edu|gov|io|ai|app|dev|co|me|so|xyz|tech|online|store|site|club|design|info|biz|tv|cc|to|is|gg|ly|fm|sh|page|news|live|link|pro|cloud|in|uk|de|ca|au|fr|nl|ru|br|jp|kr|it|es|pl|ch|se|no|za|nz|hk|sg|id|my|ph|vn|th|bd|pk|sa|ae|eg|ng|ke|ar|mx|cl|co|pe|ve|cu|[a-zA-Z]{2,})(?::\d+)?(?:\/[^\s<>"'{}|\\^`]*)?/gi;
}

export const URL_REGEX = createUrlRegex();

export interface LinkToken {
  type: 'text' | 'link';
  content: string;
  url?: string;
  domain?: string;
  path?: string;
}

export interface ExtractedLink {
  id: string;
  original: string;
  url: string;
  domain: string;
  path: string;
  faviconUrl: string;
}

/**
 * Normalizes a URL string by ensuring it starts with http:// or https://
 */
export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Safely extracts the domain/hostname from a raw URL
 */
export function extractDomain(rawUrl: string): string {
  try {
    const normalized = normalizeUrl(rawUrl);
    const parsed = new URL(normalized);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    // Fallback: extract substring up to the first slash
    const stripped = rawUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    const firstSlash = stripped.indexOf('/');
    return firstSlash !== -1 ? stripped.substring(0, firstSlash) : stripped;
  }
}

/**
 * Extracts the pathname + search query for friendly display in cards
 */
export function extractPath(rawUrl: string): string {
  try {
    const normalized = normalizeUrl(rawUrl);
    const parsed = new URL(normalized);
    const fullPath = parsed.pathname + parsed.search;
    return fullPath === '/' ? '' : fullPath;
  } catch {
    const stripped = rawUrl.replace(/^https?:\/\//i, '');
    const firstSlash = stripped.indexOf('/');
    return firstSlash !== -1 ? stripped.substring(firstSlash) : '';
  }
}

/**
 * Generates high-res favicon URL via Google S2 Favicon service (64px)
 */
export function getFaviconUrl(domain: string): string {
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

/**
 * Cleans a URL match by separating any accidental trailing punctuation
 */
function cleanUrlMatch(rawMatch: string): { cleanUrl: string; trailing: string } {
  const matchTrailing = rawMatch.match(TRAILING_PUNCTUATION_REGEX);
  if (matchTrailing) {
    const punctuation = matchTrailing[0];
    const clean = rawMatch.slice(0, -punctuation.length);
    return { cleanUrl: clean, trailing: punctuation };
  }
  return { cleanUrl: rawMatch, trailing: '' };
}

/**
 * Tokenizes plain text into a sequence of text strings and link objects
 */
export function tokenizeTextWithLinks(text: string): LinkToken[] {
  if (!text) return [];

  const tokens: LinkToken[] = [];
  let lastIndex = 0;

  // Use a fresh regex instance to prevent state bugs
  const regex = createUrlRegex();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchRaw = match[0];

    // Push preceding text token if any
    if (matchStart > lastIndex) {
      tokens.push({
        type: 'text',
        content: text.slice(lastIndex, matchStart),
      });
    }

    const { cleanUrl, trailing } = cleanUrlMatch(matchRaw);

    if (cleanUrl) {
      const fullNormalizedUrl = normalizeUrl(cleanUrl);
      const domain = extractDomain(cleanUrl);
      const path = extractPath(cleanUrl);

      tokens.push({
        type: 'link',
        content: cleanUrl,
        url: fullNormalizedUrl,
        domain,
        path,
      });
    }

    // If there was trailing punctuation, append as text
    if (trailing) {
      tokens.push({
        type: 'text',
        content: trailing,
      });
    }

    lastIndex = matchStart + matchRaw.length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return tokens;
}

/**
 * Extracts a deduplicated list of all links found in a text
 */
export function extractAllLinks(text: string): ExtractedLink[] {
  if (!text) return [];

  const tokens = tokenizeTextWithLinks(text);
  const linksMap = new Map<string, ExtractedLink>();

  for (const token of tokens) {
    if (token.type === 'link' && token.url && token.domain) {
      const normalizedKey = token.url.toLowerCase();
      if (!linksMap.has(normalizedKey)) {
        linksMap.set(normalizedKey, {
          id: `link-${linksMap.size}-${token.domain}`,
          original: token.content,
          url: token.url,
          domain: token.domain,
          path: token.path || '',
          faviconUrl: getFaviconUrl(token.domain),
        });
      }
    }
  }

  return Array.from(linksMap.values());
}
