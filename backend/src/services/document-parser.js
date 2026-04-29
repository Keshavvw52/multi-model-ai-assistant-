import { readFileSync } from 'fs';
import { analyzeDocument } from './vision.js';

/**
 * Parse and analyze a document file.
 * For PDFs, we process as prompt-based analysis.
 * For images of documents, we use vision prompting.
 */
export async function parseDocument(mediaFile, query, conversationHistory = []) {
  // Build document context based on file type
  let docContext = '';

  if (mediaFile.mime_type === 'application/pdf') {
    docContext = buildPdfContext(mediaFile);
  } else {
    // Image-based document
    docContext = buildImageDocContext(mediaFile);
  }

  return await analyzeDocument(
    { ...mediaFile, docContext },
    query,
    conversationHistory
  );
}

function buildPdfContext(mediaFile) {
  return `PDF Document: ${mediaFile.original_name}
Size: ${(mediaFile.size / 1024).toFixed(1)}KB
This appears to be a PDF document. I'll analyze it based on the filename and available context.`;
}

function buildImageDocContext(mediaFile) {
  return `Document Image: ${mediaFile.original_name}
Format: ${mediaFile.mime_type}
This appears to be a scanned document or photograph of a document.`;
}

export default { parseDocument };