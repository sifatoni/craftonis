export interface TranscriptItem {
  speaker?: string;
  text: string;
  timestampMs?: number;
  flagged?: boolean;
}

const MAX_TOKENS_ESTIMATE = 45000; // safe limit, ~45K tokens ≈ ~180K chars
const CHARS_PER_TOKEN = 4;
const MAX_CHARS = MAX_TOKENS_ESTIMATE * CHARS_PER_TOKEN;

function transcriptToText(items: TranscriptItem[]): string {
  return items
    .map(t => {
      const time = t.timestampMs
        ? `[${Math.floor(t.timestampMs / 60000)}:${String(Math.floor((t.timestampMs % 60000) / 1000)).padStart(2, '0')}]`
        : '';
      const speaker = t.speaker ? `${t.speaker}: ` : '';
      return `${time} ${speaker}${t.text}`.trim();
    })
    .join('\n');
}

// Strategy 1: Smart Truncation
// Keep: bookmarked lines, first 15%, last 15%, sample middle every 3rd line
export function smartTruncate(items: TranscriptItem[]): string {
  if (items.length === 0) return 'No transcript available.';

  const totalChars = transcriptToText(items).length;
  if (totalChars <= MAX_CHARS) {
    return transcriptToText(items); // fits, no truncation needed
  }

  const firstChunk = Math.floor(items.length * 0.15);
  const lastChunk = Math.floor(items.length * 0.15);
  const middleItems = items.slice(firstChunk, items.length - lastChunk);

  const selected: TranscriptItem[] = [
    ...items.slice(0, firstChunk),
    ...middleItems.filter((t, i) => t.flagged || i % 3 === 0),
    ...items.slice(items.length - lastChunk),
  ];

  const truncatedText = transcriptToText(selected);
  if (truncatedText.length <= MAX_CHARS) {
    return `[Note: Long transcript intelligently sampled for key moments]\n\n${truncatedText}`;
  }

  // Still too long — hard truncate with note
  return `[Note: Transcript truncated to fit context limit]\n\n${truncatedText.slice(0, MAX_CHARS)}`;
}

// Strategy 2: Split into chunks for map-reduce
export function splitIntoChunks(items: TranscriptItem[], chunkSizeChars: number = MAX_CHARS): TranscriptItem[][] {
  const chunks: TranscriptItem[][] = [];
  let currentChunk: TranscriptItem[] = [];
  let currentChars = 0;

  for (const item of items) {
    const itemChars = (item.text + (item.speaker || '')).length + 20;
    if (currentChars + itemChars > chunkSizeChars && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }
    currentChunk.push(item);
    currentChars += itemChars;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks;
}

// Main export: process transcript intelligently
// Returns { text, needsChunking, chunks }
export function processTranscript(items: TranscriptItem[]): {
  text: string;
  needsChunking: boolean;
  chunks: string[];
} {
  if (items.length === 0) {
    return { text: 'No transcript available.', needsChunking: false, chunks: [] };
  }

  const fullText = transcriptToText(items);
  
  // Under limit: use directly
  if (fullText.length <= MAX_CHARS) {
    return { text: fullText, needsChunking: false, chunks: [] };
  }

  // Try smart truncation first
  const truncated = smartTruncate(items);
  if (truncated.length <= MAX_CHARS * 1.1) {
    return { text: truncated, needsChunking: false, chunks: [] };
  }

  // Need chunking: split into chunks
  const itemChunks = splitIntoChunks(items);
  const textChunks = itemChunks.map(chunk => transcriptToText(chunk));
  return { text: '', needsChunking: true, chunks: textChunks };
}
