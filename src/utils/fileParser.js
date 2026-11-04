import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Configure pdfjs worker for Vite
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (err) {
    console.warn('PDF.js worker initialization notice:', err);
  }
}

/**
 * Clean and standardize HTML extracted from Word docs into plain text
 * keeping only <u>...</u> tags for underlined words and blanks.
 */
function cleanMammothHtml(html) {
  if (!html) return '';
  
  // Replace paragraph endings and breaks with newlines
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<\/th>/gi, '\t')
    .replace(/<\/tr>/gi, '\n');

  // Strip all HTML tags EXCEPT <u> and </u>
  text = text.replace(/<(?!\/?u\b)[^>]+>/gi, '');

  // Decode standard HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize excessive empty lines
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Extract text from a Word document (.docx)
 * Preserves underlines as <u>...</u> tags!
 */
export async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  
  // Custom style map mapping Word underline runs to <u>
  const options = {
    styleMap: [
      "u => u",
      "r[style-name='Underline'] => u"
    ]
  };

  const result = await mammoth.convertToHtml({ arrayBuffer }, options);
  const text = cleanMammothHtml(result.value);
  return {
    text,
    messages: result.messages || [],
    isScanned: false
  };
}

/**
 * Helper to convert an ArrayBuffer to base64 string safely
 */
export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * Extract text from a digital or scanned PDF (.pdf)
 * If the PDF is scanned or image-based (text density < 20 chars/page),
 * base64 data is attached so AI vision OCR can read it directly.
 */
export async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  let fullText = '';
  const numPages = pdf.numPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Join items with appropriate whitespace
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
  }

  const cleanText = fullText.trim();
  const charDensity = cleanText.length / Math.max(1, numPages);
  // Mark as scanned if average chars per page is low (< 20)
  const isScanned = charDensity < 20;

  // Generate base64 if scanned or text is empty, so Gemini Vision OCR can read it
  let pdfBase64 = null;
  if (isScanned || !cleanText) {
    pdfBase64 = arrayBufferToBase64(arrayBuffer);
  }

  return {
    text: cleanText,
    pdfBase64,
    numPages,
    charDensity,
    isScanned
  };
}

/**
 * Extract plain text (.txt)
 */
export async function extractPlainText(file) {
  const text = await file.text();
  return {
    text: text.trim(),
    isScanned: false
  };
}

/**
 * Unified file extractor supporting .docx, .pdf, .txt
 */
export async function parseDocumentFile(file) {
  if (!file) throw new Error('No file provided');

  const fileName = (file.name || '').toLowerCase();

  if (fileName.endsWith('.docx')) {
    return await extractDocxText(file);
  }

  if (fileName.endsWith('.pdf')) {
    return await extractPdfText(file);
  }

  if (fileName.endsWith('.txt')) {
    return await extractPlainText(file);
  }

  throw new Error('Unsupported file format. Please upload .docx, .pdf, or .txt');
}
