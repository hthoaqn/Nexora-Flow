// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// MUST run before pdf-parse — Node has no DOMMatrix
import './domPolyfill'
import { ensureDomMatrixPolyfill } from './domPolyfill'
ensureDomMatrixPolyfill()

import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResultDTO } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
// @ts-ignore
import officeParser from 'officeparser';
// @ts-ignore
import AdmZip from 'adm-zip';
// CJS pdf-parse — works under Next.js Node API runtime
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>

export class DocumentExtractionError extends Error {
  public code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "DocumentExtractionError";
    this.code = code;
  }
}

export function normalize_text(value: string | null): string {
  if (!value) {
    return "";
  }
  let text = value.replace(/\x00/g, "");
  text = text.replace(/\r\n/g, "\n");
  text = text.replace(/\r/g, "\n");
  const lines = text.split("\n").map(line => {
    return line.replace(/[ \t]+/g, " ").trim();
  });
  return lines.filter(line => line).join("\n").trim();
}

export function extractTextFromXml(xml: string): string {
  const regex = /<w:t(?:\s+[^>]*)*>([\s\S]*?)<\/w:t>/g;
  let match;
  const parts: string[] = [];
  while ((match = regex.exec(xml)) !== null) {
    parts.push(match[1]);
  }
  return parts.join('');
}

export function parseDocx(buffer: Buffer): { rawText: string; blocks: any[]; embeddedImageCount: number } {
  try {
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    const blocks: any[] = [];

    const docEntry = zipEntries.find(entry => entry.entryName === 'word/document.xml');
    if (!docEntry) {
      throw new DocumentExtractionError('Không tìm thấy tệp word/document.xml trong tài liệu DOCX.', 'CORRUPTED_DOCUMENT');
    }

    const docXml = docEntry.getData().toString('utf8');

    const embeddedImages = zipEntries.filter(entry => 
      entry.entryName.startsWith('word/media/') &&
      (entry.entryName.endsWith('.png') || entry.entryName.endsWith('.jpeg') || entry.entryName.endsWith('.jpg'))
    );
    const embeddedImageCount = embeddedImages.length;

    const tables: string[] = [];
    const tableRegex = /<w:tbl(?:\s+[^>]*)*>([\s\S]*?)<\/w:tbl>/g;
    let docXmlWithPlaceholders = docXml;
    
    let tableIndex = 0;
    docXmlWithPlaceholders = docXmlWithPlaceholders.replace(tableRegex, (match) => {
      const placeholder = `___TABLE_PLACEHOLDER_${tableIndex}___`;
      tables.push(match);
      tableIndex++;
      return placeholder;
    });

    const elementRegex = /(<w:p(?:\s+[^>]*)*>[\s\S]*?<\/w:p>|___TABLE_PLACEHOLDER_\d+___)/g;
    let elementMatch;
    let paragraphCount = 0;

    while ((elementMatch = elementRegex.exec(docXmlWithPlaceholders)) !== null) {
      const matchedToken = elementMatch[1];
      if (matchedToken.startsWith('___TABLE_PLACEHOLDER_')) {
        const idx = parseInt(matchedToken.match(/\d+/)?.[0] || '0', 10);
        const tableXml = tables[idx];
        
        const rows: string[] = [];
        const rowRegex = /<w:tr(?:\s+[^>]*)*>([\s\S]*?)<\/w:tr>/g;
        let rMatch;
        let rowIndex = 0;
        
        while ((rMatch = rowRegex.exec(tableXml)) !== null) {
          const rowXml = rMatch[1];
          const cells: string[] = [];
          const cellRegex = /<w:tc(?:\s+[^>]*)*>([\s\S]*?)<\/w:tc>/g;
          let cMatch;
          while ((cMatch = cellRegex.exec(rowXml)) !== null) {
            const cellXml = cMatch[1];
            const cellText = extractTextFromXml(cellXml).trim();
            if (cellText) {
              cells.push(cellText);
            }
          }
          if (cells.length > 0) {
            const rowText = cells.join(" | ");
            rows.push(rowText);
            blocks.push({
              type: "table_row",
              tableIndex: idx,
              rowIndex: rowIndex,
              text: rowText
            });
            rowIndex++;
          }
        }
      } else {
        const paragraphText = extractTextFromXml(matchedToken).trim();
        if (paragraphText) {
          blocks.push({
            type: "paragraph",
            index: paragraphCount++,
            text: paragraphText
          });
        }
      }
    }

    zipEntries.forEach(entry => {
      if (entry.entryName.startsWith('word/header') && entry.entryName.endsWith('.xml')) {
        const headerXml = entry.getData().toString('utf8');
        const headerText = extractTextFromXml(headerXml).trim();
        if (headerText) {
          blocks.push({
            type: "header",
            source: entry.entryName,
            text: `[Header] ${headerText}`
          });
        }
      }
      if (entry.entryName.startsWith('word/footer') && entry.entryName.endsWith('.xml')) {
        const footerXml = entry.getData().toString('utf8');
        const footerText = extractTextFromXml(footerXml).trim();
        if (footerText) {
          blocks.push({
            type: "footer",
            source: entry.entryName,
            text: `[Footer] ${footerText}`
          });
        }
      }
    });

    const rawText = blocks.map(b => b.text).join('\n');
    return { rawText, blocks, embeddedImageCount };
  } catch (err: any) {
    if (err instanceof DocumentExtractionError) throw err;
    throw new DocumentExtractionError(`Lỗi phân tích file Word DOCX: ${err.message}`, 'DOCX_EXTRACTION_FAILED');
  }
}

export function parsePptx(buffer: Buffer): { rawText: string; blocks: any[]; embeddedImageCount: number; pageCount: number } {
  try {
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();
    const blocks: any[] = [];

    const slideEntries = zipEntries.filter(entry => 
      entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')
    );
    
    if (slideEntries.length === 0) {
      throw new DocumentExtractionError('Không tìm thấy tệp slide XML nào trong tài liệu PPTX.', 'CORRUPTED_DOCUMENT');
    }

    slideEntries.sort((a, b) => {
      const numA = parseInt(a.entryName.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      const numB = parseInt(b.entryName.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      return numA - numB;
    });

    const pageCount = slideEntries.length;

    const embeddedImages = zipEntries.filter(entry => 
      entry.entryName.startsWith('ppt/media/') &&
      (entry.entryName.endsWith('.png') || entry.entryName.endsWith('.jpeg') || entry.entryName.endsWith('.jpg'))
    );
    const embeddedImageCount = embeddedImages.length;

    const extractPptxText = (pXml: string): string => {
      const tRegex = /<a:t(?:\s+[^>]*)*>([\s\S]*?)<\/a:t>/g;
      let tMatch;
      const parts: string[] = [];
      while ((tMatch = tRegex.exec(pXml)) !== null) {
        parts.push(tMatch[1]);
      }
      return parts.join('');
    };

    slideEntries.forEach(entry => {
      const slideNum = parseInt(entry.entryName.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
      const slideXml = entry.getData().toString('utf8');

      const tables: string[] = [];
      const tableRegex = /<a:tbl(?:\s+[^>]*)*>([\s\S]*?)<\/a:tbl>/g;
      let slideXmlWithPlaceholders = slideXml;
      
      let tableIndex = 0;
      slideXmlWithPlaceholders = slideXmlWithPlaceholders.replace(tableRegex, (match) => {
        const placeholder = `___TABLE_PLACEHOLDER_${tableIndex}___`;
        tables.push(match);
        tableIndex++;
        return placeholder;
      });

      const elementRegex = /(<a:p(?:\s+[^>]*)*>[\s\S]*?<\/a:p>|___TABLE_PLACEHOLDER_\d+___)/g;
      let elementMatch;

      while ((elementMatch = elementRegex.exec(slideXmlWithPlaceholders)) !== null) {
        const matchedToken = elementMatch[1];
        if (matchedToken.startsWith('___TABLE_PLACEHOLDER_')) {
          const idx = parseInt(matchedToken.match(/\d+/)?.[0] || '0', 10);
          const tableXml = tables[idx];
          
          const rows: string[] = [];
          const rowRegex = /<a:tr(?:\s+[^>]*)*>([\s\S]*?)<\/a:tr>/g;
          let rMatch;
          let rowIndex = 0;
          
          while ((rMatch = rowRegex.exec(tableXml)) !== null) {
            const rowXml = rMatch[1];
            const cells: string[] = [];
            const cellRegex = /<a:tc(?:\s+[^>]*)*>([\s\S]*?)<\/a:tc>/g;
            let cMatch;
            while ((cMatch = cellRegex.exec(rowXml)) !== null) {
              const cellXml = cMatch[1];
              const cellText = extractPptxText(cellXml).trim();
              if (cellText) {
                cells.push(cellText);
              }
            }
            if (cells.length > 0) {
              const rowText = cells.join(" | ");
              rows.push(rowText);
              blocks.push({
                type: "table_row",
                slide: slideNum,
                tableIndex: idx,
                rowIndex: rowIndex,
                text: rowText
              });
              rowIndex++;
            }
          }
        } else {
          const paragraphText = extractPptxText(matchedToken).trim();
          if (paragraphText) {
            blocks.push({
              type: "text",
              slide: slideNum,
              text: paragraphText
            });
          }
        }
      }

      const notesEntry = zipEntries.find(e => e.entryName === `ppt/notesSlides/notesSlide${slideNum}.xml`);
      if (notesEntry) {
        const notesXml = notesEntry.getData().toString('utf8');
        const notesParagraphs: string[] = [];
        let pMatch;
        const pRegex = /<a:p(?:\s+[^>]*)*>([\s\S]*?)<\/a:p>/g;
        while ((pMatch = pRegex.exec(notesXml)) !== null) {
          const text = extractPptxText(pMatch[1]).trim();
          if (text) notesParagraphs.push(text);
        }
        if (notesParagraphs.length > 0) {
          blocks.push({
            type: "notes",
            slide: slideNum,
            text: `[Speaker Notes] ${notesParagraphs.join('\n')}`
          });
        }
      }
    });

    const rawText = blocks.map(b => b.text).join('\n');
    return { rawText, blocks, embeddedImageCount, pageCount };
  } catch (err: any) {
    if (err instanceof DocumentExtractionError) throw err;
    throw new DocumentExtractionError(`Lỗi phân tích file PowerPoint PPTX: ${err.message}`, 'PPTX_EXTRACTION_FAILED');
  }
}

async function ocrEmbeddedImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
  const client = getAiClient();
  if (!client) return '';
  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: mimeType
          }
        },
        "Extract all readable text from this image as plain text. Do not add any comments or headers."
      ]
    });
    return response.text || '';
  } catch (err) {
    console.error("Embedded image OCR failed", err);
    return '';
  }
}

let aiClient: any = null;

/** Prefer current Gemini flash models; env override supported. */
export const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  process.env.GOOGLE_GEMINI_MODEL ||
  'gemini-2.0-flash'

const GEMINI_MODEL_FALLBACKS = [
  GEMINI_MODEL,
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
].filter((v, i, a) => a.indexOf(v) === i)

function getAiClient() {
  if (!aiClient) {
    const key =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY
    if (key && key !== 'MY_GEMINI_API_KEY' && key.trim().length > 10) {
      aiClient = new GoogleGenAI({
        apiKey: key.trim(),
        httpOptions: {
          headers: {
            'User-Agent': 'nexora-flow-ocr',
          }
        }
      });
    }
  }
  return aiClient;
}

function parseJsonRobustly(text: string): any {
  let clean = text.trim();
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '');
    clean = clean.replace(/\s*```$/, '');
  }
  return JSON.parse(clean.trim());
}

const DYNAMIC_FIELD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    label: { 
      type: Type.STRING, 
      description: "Descriptive human-readable label for this discovered field (e.g., 'Funding Goal', 'Company Name', 'Founder Team', 'Tech Stack')" 
    },
    type: { 
      type: Type.STRING, 
      description: "Category of this field. Choose ONE from the specified enum groups.",
      enum: [
        "company_name", "tagline", "description", "website", "email", "phone", 
        "industry", "technology", "market", "startup_stage", "funding", "valuation", 
        "revenue", "traction", "customer", "business_model", "problem", "solution", 
        "founder", "team", "location", "social", "patent", "award", "partnership", 
        "timeline", "roadmap", "metric", "other"
      ]
    },
    value: { 
      type: Type.STRING, 
      description: "The actual extracted value (can be string, number, or comma-separated list). Keep case and do not add any unmentioned text. MUST BE NULL if not found or empty.",
      nullable: true
    },
    exact_text: { 
      type: Type.STRING, 
      description: "The EXACT word-for-word string or phrase in the document where this was found. MUST BE NULL if not found. Absolutely no rewrites, interpretations, or paraphrases.",
      nullable: true
    },
    page: { 
      type: Type.INTEGER, 
      description: "The 1-based page or slide number where this text was found. MUST BE NULL if not found.",
      nullable: true
    },
    confidence: { 
      type: Type.NUMBER, 
      description: "Confidence score from 0.0 to 1.0. If not found or not 100% sure, MUST be 0.0." 
    }
  },
  required: ["label", "type", "value", "exact_text", "page", "confidence"]
};

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    fields: {
      type: Type.ARRAY,
      items: DYNAMIC_FIELD_SCHEMA,
      description: "List of all discovered startup fields from the document. Do NOT create fields for empty or non-existent information."
    }
  },
  required: ["fields"]
};

export class AiService {
  public static async extractFromImage(base64Data: string, mimeType: string): Promise<ExtractionResultDTO> {
    const client = getAiClient();
    const extractionId = `ext-img-${Date.now()}`;

    if (!client) {
      console.warn("Không tìm thấy cấu hình API Key cho Gemini AI (GEMINI_API_KEY). Trả về demo extraction.");
      return this.generateDemoImageExtraction(extractionId);
    }

    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: `Bạn là AI Startup Document Extraction Engine.
Nhiệm vụ của bạn là đọc toàn bộ tài liệu và phát hiện TẤT CẢ các thông tin liên quan đến startup.
KHÔNG sử dụng schema cố định. Hãy tự xác định các trường thông tin xuất hiện trong tài liệu.

=========================
QUY TẮC BẮT BUỘC
=========================
1. CHỈ tạo field khi thông tin thực sự tồn tại trong tài liệu.
2. KHÔNG tạo field rỗng hoặc field bằng suy luận, đoán, tự bổ sung, tự hoàn thiện, tự sửa, tự diễn giải, tự rút gọn.
3. KHÔNG được tự nghĩ ra tên startup, email, website, funding...
4. Nếu một thông tin không tồn tại thì KHÔNG tạo field đó.
5. KHÔNG paraphrase, không dùng kiến thức bên ngoài.
6. Độ chính xác QUAN TRỌNG HƠN độ đầy đủ. Nếu không chắc chắn 100% => KHÔNG tạo field đó.

=========================
PHÂN NHÓM "type" BẮT BUỘC (Đặt theo một trong các nhóm sau):
=========================
- company_name: Tên startup
- tagline: Tagline của startup
- description: Mô tả chi tiết
- website: Website chính thức
- email: Email liên hệ
- phone: Số điện thoại
- industry: Lĩnh vực hoạt động
- technology: Công nghệ cốt lõi
- market: Thị trường mục tiêu
- startup_stage: Giai đoạn phát triển (Seed, Pre-seed, Series A,...)
- funding: Số tiền gọi vốn hoặc nhu cầu vốn
- valuation: Định giá startup
- revenue: Doanh thu của startup
- traction: Chỉ số traction/thành tựu đạt được
- customer: Khách hàng mục tiêu
- business_model: Mô hình kinh doanh
- problem: Vấn đề cần giải quyết
- solution: Giải pháp của startup
- founder: Tên người sáng lập
- team: Thông tin đội ngũ
- location: Địa chỉ/Địa điểm hoạt động
- social: Mạng xã hội của startup
- patent: Bằng sáng chế
- award: Giải thưởng đạt được
- partnership: Đối tác/Quan hệ hợp tác
- timeline: Mốc thời gian quan trọng
- roadmap: Lịch trình phát triển tương lai
- metric: Chỉ số đo lường khác
- other: Các thông tin khác không thuộc nhóm trên

Mỗi trường được phát hiện phải trả về cấu trúc gồm: label, type, value, exact_text, page, confidence.`,
            },
          ],
        },
        config: {
          systemInstruction: "You are a highly precise, extremely strict venture capital analyst. OCR and extract only real, explicit startup details from visual material. Do not invent any values.",
          responseMimeType: "application/json",
          responseSchema: EXTRACTION_SCHEMA,
        }
      });

      const extracted = parseJsonRobustly(response.text);
      return this.mapToExtractionResult(extractionId, extracted, 'real');
    } catch (e: any) {
      // Retry once with fallback model if primary model is unavailable
      for (const model of GEMINI_MODEL_FALLBACKS.slice(1)) {
        try {
          console.warn(`Retrying image OCR with model ${model}`)
          const response = await client.models.generateContent({
            model,
            contents: {
              parts: [
                { inlineData: { data: base64Data, mimeType } },
                {
                  text: `Extract all startup-related fields from this image as JSON with a "fields" array. Each field: label, type, value, exact_text, page, confidence. Only extract what is visible.`,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: EXTRACTION_SCHEMA,
            },
          })
          const extracted = parseJsonRobustly(response.text)
          return this.mapToExtractionResult(extractionId, extracted, 'real')
        } catch (err) {
          console.error(`Model ${model} failed`, err)
        }
      }
      console.error("Gemini Image OCR extraction failed, falling back to demo extraction:", e);
      throw new DocumentExtractionError(
        e?.message || 'Gemini OCR failed. Check GEMINI_API_KEY and model name.',
        'AI_EXTRACTION_FAILED',
      )
    }
  }

  /**
   * Gemini multimodal on raw file bytes (PDF / images in deck).
   * Used for scanned PDFs and when pdf-parse finds no text layer.
   */
  private static async extractViaGeminiFile(
    client: any,
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    extractionId: string,
  ): Promise<any | null> {
    const b64 = buffer.toString('base64')
    const prompt = `Bạn là AI Startup Document Extraction Engine.
Đọc TOÀN BỘ tài liệu (mọi trang / slide / ảnh) tên "${fileName}".
Trích xuất thông tin startup THỰC SỰ có trong tài liệu: tên, email, website, ngành, giai đoạn, vấn đề, giải pháp, đội ngũ, sản phẩm, gọi vốn...
CHỈ tạo field khi thấy rõ trong tài liệu. Không bịa.
Trả JSON fields[] với label, type, value, exact_text, page, confidence.
type thuộc: company_name, email, website, industry, technology, market, startup_stage, funding, problem, solution, founder, team, location, description, business_model, customer, traction, other.`

    const models = GEMINI_MODEL_FALLBACKS.filter(Boolean)
    for (const model of models) {
      try {
        console.log(`[Gemini file OCR] model=${model} mime=${mimeType} file=${fileName}`)
        const response = await client.models.generateContent({
          model,
          contents: {
            parts: [
              { inlineData: { data: b64, mimeType } },
              { text: prompt },
            ],
          },
          config: {
            systemInstruction:
              'You are a precise VC analyst. OCR and extract only explicit startup facts. Never invent.',
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_SCHEMA,
          },
        })
        const extracted = parseJsonRobustly(response.text)
        if (extracted?.fields?.length) {
          return this.mapToExtractionResult(
            extractionId,
            extracted,
            'real',
            `[Gemini multimodal OCR]\n${String(response.text || '').slice(0, 4000)}`,
            {
              pageCount: 1,
              textBlockCount: extracted.fields.length,
              embeddedImageCount: 0,
              usedImageOcr: true,
              model,
            },
          )
        }
      } catch (e: any) {
        console.warn(`[Gemini file OCR] ${model} failed:`, e?.message || e)
      }
    }
    return null
  }

  public static async extractFromDocumentBuffer(buffer: Buffer, fileName: string, mimeType: string): Promise<any> {
    const client = getAiClient();
    const extractionId = `ext-doc-${Date.now()}`;
    const extension = path.extname(fileName).toLowerCase();
    const resolvedMime =
      mimeType && mimeType !== 'application/octet-stream'
        ? mimeType
        : extension === '.pdf'
          ? 'application/pdf'
          : extension === '.docx'
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : extension === '.pptx'
              ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
              : 'application/pdf'

    let rawText = '';
    let blocks: any[] = [];
    let pageCount = 1;
    let embeddedImageCount = 0;
    let usedImageOcr = false;

    // ── PDF: try text layer, then ALWAYS prefer Gemini multimodal if thin/empty ──
    if (extension === '.pdf' || resolvedMime === 'application/pdf') {
      try {
        const pdfData = await pdfParse(buffer);
        pageCount = pdfData.numpages || 1;
        rawText = pdfData.text || '';
        const pages = rawText.split(/\u000c/);
        pages.forEach((pageText, idx) => {
          const clean = pageText.trim();
          if (clean) {
            blocks.push({ type: 'paragraph', page: idx + 1, text: clean });
          }
        });
      } catch (err: any) {
        console.error('pdf-parse failed, will try Gemini multimodal', err);
        rawText = '';
      }

      const normalizedTxt = normalize_text(rawText);
      // Scanned decks often have 0–200 garbage chars — threshold 200
      const needVision = normalizedTxt.length < 200;

      if (client && needVision) {
        usedImageOcr = true;
        const vision = await this.extractViaGeminiFile(
          client,
          buffer,
          fileName,
          'application/pdf',
          extractionId,
        );
        if (vision) return vision;
        // fall through to demo if vision failed
        console.warn('Gemini PDF multimodal returned no fields — demo fallback');
        return this.generateDemoDocExtraction(
          extractionId,
          fileName,
          rawText || `[PDF without text layer: ${fileName}]`,
        );
      }

      // Good text layer: still structure with Gemini text model below
    } else if (extension === '.docx') {
      try {
        const docxResult = parseDocx(buffer);
        rawText = docxResult.rawText;
        blocks = docxResult.blocks;
        embeddedImageCount = docxResult.embeddedImageCount;
        pageCount = Math.max(1, Math.ceil(normalize_text(rawText).length / 1500));
      } catch (e: any) {
        console.error('parseDocx failed', e);
        rawText = '';
      }
    } else if (extension === '.pptx') {
      try {
        const pptxResult = parsePptx(buffer);
        rawText = pptxResult.rawText;
        blocks = pptxResult.blocks;
        embeddedImageCount = pptxResult.embeddedImageCount;
        pageCount = pptxResult.pageCount;
      } catch (e: any) {
        console.error('parsePptx failed', e);
        rawText = '';
      }
    } else if (extension === '.txt' || extension === '.md' || extension === '.csv') {
      rawText = buffer.toString('utf8');
      blocks = [{ type: 'paragraph', page: 1, text: rawText }];
    } else {
      // Unknown — try as PDF multimodal if client
      if (client) {
        const vision = await this.extractViaGeminiFile(
          client,
          buffer,
          fileName,
          resolvedMime,
          extractionId,
        );
        if (vision) return vision;
      }
      throw new DocumentExtractionError(
        `Định dạng tài liệu không hỗ trợ: ${extension || resolvedMime}`,
        'INVALID_FILE_TYPE',
      );
    }

    // 2. Embedded image OCR for DOCX/PPTX
    let normalized = normalize_text(rawText);
    if (normalized.length < 200 && embeddedImageCount > 0 && client) {
      console.log(
        `Document text short (${normalized.length} chars), ${embeddedImageCount} images — OCR media...`,
      );
      usedImageOcr = true;
      try {
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();
        const mediaEntries = zipEntries.filter(
          (entry) =>
            (entry.entryName.startsWith('word/media/') ||
              entry.entryName.startsWith('ppt/media/')) &&
            (entry.entryName.endsWith('.png') ||
              entry.entryName.endsWith('.jpeg') ||
              entry.entryName.endsWith('.jpg')),
        );
        mediaEntries.sort((a, b) => a.entryName.localeCompare(b.entryName));
        let imgIndex = 1;
        let ocrTextAccumulator = '';
        for (const entry of mediaEntries) {
          const imgData = entry.getData();
          if (imgData.length < 8 * 1024) continue;
          if (imgIndex > 8) break;
          let imgMime = 'image/png';
          if (entry.entryName.endsWith('.jpeg') || entry.entryName.endsWith('.jpg')) {
            imgMime = 'image/jpeg';
          }
          const text = await ocrEmbeddedImage(imgData, imgMime);
          if (text.trim()) {
            ocrTextAccumulator += `\n[Ảnh ${imgIndex}]\n${text}\n`;
            blocks.push({
              type: 'embedded_image',
              source: entry.entryName,
              imageIndex: imgIndex,
              text,
            });
            imgIndex++;
          }
        }
        if (ocrTextAccumulator.trim()) {
          rawText += `\n\n=== OCR MEDIA ===\n${ocrTextAccumulator}`;
          normalized = normalize_text(rawText);
        }
      } catch (ocrErr: any) {
        console.error('Embedded images OCR failed:', ocrErr);
      }
    }

    // 2b. Still empty for office docs — try Gemini with file bytes
    if (normalized.length < 80 && client && (extension === '.pptx' || extension === '.docx')) {
      const vision = await this.extractViaGeminiFile(
        client,
        buffer,
        fileName,
        resolvedMime,
        extractionId,
      );
      if (vision) return vision;
    }

    // 3. Empty text — NEVER hard-fail apply flow: demo + filename hints
    if (!normalized.trim()) {
      console.warn(
        `[extractFromDocumentBuffer] No text for ${fileName} — demo extraction (user can edit form)`,
      );
      return this.generateDemoDocExtraction(
        extractionId,
        fileName,
        `[No extractable text layer in ${fileName}. Fill form manually or re-upload a text PDF.]`,
      );
    }

    // 4. Structure with Gemini text model
    if (!client) {
      console.log('No GEMINI_API_KEY — demo structure from raw text');
      return this.generateDemoDocExtraction(extractionId, fileName, rawText);
    }

    try {
      console.log(`Sending text len=${rawText.length} to Gemini for structure...`);
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Bạn là AI Startup Document Extraction Engine.
Nhiệm vụ của bạn là đọc toàn bộ văn bản dưới đây và phát hiện TẤT CẢ các thông tin liên quan đến startup.
Tài liệu nguồn có tên: "${fileName}".
KHÔNG sử dụng schema cố định. Hãy tự xác định các trường thông tin xuất hiện trong tài liệu.

QUY TẮC: CHỈ tạo field khi thông tin thực sự tồn tại. Không bịa. type thuộc company_name, email, website, industry, technology, market, startup_stage, funding, problem, solution, founder, team, location, description, business_model, customer, traction, other.

TEXT NGUỒN:
${rawText.slice(0, 120000)}`,
        config: {
          systemInstruction:
            'You are a highly precise VC analyst. Extract only real, explicit startup details. Do not invent.',
          responseMimeType: 'application/json',
          responseSchema: EXTRACTION_SCHEMA,
        },
      });

      const extracted = parseJsonRobustly(response.text);
      return this.mapToExtractionResult(extractionId, extracted, 'real', rawText, {
        pageCount,
        textBlockCount: blocks.length,
        embeddedImageCount,
        usedImageOcr,
      });
    } catch (e: any) {
      console.error('Gemini text extraction failed, demo fallback:', e);
      return this.generateDemoDocExtraction(extractionId, fileName, rawText);
    }
  }

  public static async extractFromDocumentFile(base64Data: string, fileName: string, fileType?: string): Promise<ExtractionResultDTO> {
    const client = getAiClient();
    const extractionId = `ext-doc-${Date.now()}`;
    const isPdf = (fileType && fileType.toLowerCase() === 'application/pdf') || fileName.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      if (!client) {
        console.log("No valid GEMINI_API_KEY provided. Returning demo PDF extraction.");
        return this.generateDemoDocExtraction(extractionId, fileName, "Content from PDF file: " + fileName);
      }

      try {
        const response = await client.models.generateContent({
          model: GEMINI_MODEL,
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: "application/pdf",
                },
              },
              {
                text: `Bạn là AI Startup Document Extraction Engine.
Nhiệm vụ của bạn là đọc toàn bộ tài liệu PDF đã cung cấp và phát hiện TẤT CẢ các thông tin liên quan đến startup.
Hãy rà soát toàn bộ tất cả các trang của tài liệu PDF để không bỏ sót bất kỳ chi tiết nào.
KHÔNG sử dụng schema cố định. Hãy tự xác định các trường thông tin xuất hiện trong tài liệu.

=========================
QUY TẮC BẮT BUỘC
=========================
1. CHỈ tạo field khi thông tin thực sự tồn tại trong tài liệu.
2. KHÔNG tạo field rỗng hoặc field bằng suy luận, đoán, tự bổ sung, tự hoàn thiện, tự sửa, tự diễn giải, tự rút gọn.
3. KHÔNG được tự nghĩ ra tên startup, email, website, funding...
4. Nếu một thông tin không tồn tại thì KHÔNG tạo field đó.
5. KHÔNG paraphrase, không dùng kiến thức bên ngoài.
6. Độ chính xác QUAN TRỌNG HƠN độ đầy đủ. Nếu không chắc chắn 100% => KHÔNG tạo field đó.

=========================
PHÂN NHÓM "type" BẮT BUỘC (Đặt theo một trong các nhóm sau):
=========================
- company_name: Tên startup
- tagline: Tagline của startup
- description: Mô tả chi tiết
- website: Website chính thức
- email: Email liên hệ
- phone: Số điện thoại
- industry: Lĩnh vực hoạt động
- technology: Công nghệ cốt lõi
- market: Thị trường mục tiêu
- startup_stage: Giai đoạn phát triển (Seed, Pre-seed, Series A,...)
- funding: Số tiền gọi vốn hoặc nhu cầu vốn
- valuation: Định giá startup
- revenue: Doanh thu của startup
- traction: Chỉ số traction/thành tựu đạt được
- customer: Khách hàng mục tiêu
- business_model: Mô hình kinh doanh
- problem: Vấn đề cần giải quyết
- solution: Giải pháp của startup
- founder: Tên người sáng lập
- team: Thông tin đội ngũ
- location: Địa chỉ/Địa điểm hoạt động
- social: Mạng xã hội của startup
- patent: Bằng sáng chế
- award: Giải thưởng đạt được
- partnership: Đối tác/Quan hệ hợp tác
- timeline: Mốc thời gian quan trọng
- roadmap: Lịch trình phát triển tương lai
- metric: Chỉ số đo lường khác
- other: Các thông tin khác không thuộc nhóm trên

Mỗi trường được phát hiện phải trả về cấu trúc gồm: label, type, value, exact_text, page, confidence.`,
              },
            ],
          },
          config: {
            systemInstruction: "You are a highly precise, extremely strict venture capital analyst. OCR and extract only real, explicit startup details from documents. Do not invent any values.",
            responseMimeType: "application/json",
            responseSchema: EXTRACTION_SCHEMA,
          }
        });

        const extracted = parseJsonRobustly(response.text);
        return this.mapToExtractionResult(extractionId, extracted, 'real');
      } catch (e) {
        console.error("Gemini PDF extraction failed, falling back to parsed representation", e);
        return this.generateDemoDocExtraction(extractionId, fileName, "Content from PDF file: " + fileName);
      }
    }

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `${Date.now()}-${fileName}`);

    try {
      await fs.writeFile(tempFilePath, Buffer.from(base64Data, 'base64'));
      const extractedText = await new Promise<string>((resolve, reject) => {
        officeParser.parseOffice(tempFilePath, (data: any, err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(data || '');
          }
        });
      });
      return await this.extractFromDocument(extractedText, fileName);
    } catch (err: any) {
      console.error("Error parsing document file in backend", err);
      return await this.extractFromDocument(`Content from file: ${fileName}`, fileName);
    } finally {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }

  public static async extractFromDocument(text: string, fileName: string): Promise<ExtractionResultDTO> {
    const client = getAiClient();
    const extractionId = `ext-doc-${Date.now()}`;

    if (!client) {
      console.log("No valid GEMINI_API_KEY provided. Returning strictly parsed document content without mock generation.");
      return this.generateDemoDocExtraction(extractionId, fileName, text);
    }

    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Bạn là AI Startup Document Extraction Engine.
Nhiệm vụ của bạn là đọc toàn bộ văn bản dưới đây và phát hiện TẤT CẢ các thông tin liên quan đến startup.
Tài liệu nguồn có tên: "${fileName}".
KHÔNG sử dụng schema cố định. Hãy tự xác định các trường thông tin xuất hiện trong tài liệu.

=========================
QUY TẮC BẮT BUỘC
=========================
1. CHỈ tạo field khi thông tin thực sự tồn tại trong tài liệu. Hãy rà soát toàn bộ tất cả các trang/slides của văn bản để không bỏ sót bất kỳ chi tiết nào.
2. KHÔNG tạo field rỗng hoặc field bằng suy luận, đoán, tự bổ sung, tự hoàn thiện, tự sửa, tự diễn giải, tự rút gọn.
3. KHÔNG được tự nghĩ ra tên startup, email, website, funding...
4. Nếu một thông tin không tồn tại thì KHÔNG tạo field đó.
5. KHÔNG paraphrase, không dùng kiến thức bên ngoài.
6. Độ chính xác QUAN TRỌNG HƠN độ đầy đủ. Nếu không chắc chắn 100% => KHÔNG tạo field đó.

=========================
PHÂN NHÓM "type" BẮT BUỘC (Đặt theo một trong các nhóm sau):
=========================
- company_name: Tên startup
- tagline: Tagline của startup
- description: Mô tả chi tiết
- website: Website chính thức
- email: Email liên hệ
- phone: Số điện thoại
- industry: Lĩnh vực hoạt động
- technology: Công nghệ cốt lõi
- market: Thị trường mục tiêu
- startup_stage: Giai đoạn phát triển (Seed, Pre-seed, Series A,...)
- funding: Số tiền gọi vốn hoặc nhu cầu vốn
- valuation: Định giá startup
- revenue: Doanh thu của startup
- traction: Chỉ số traction/thành tựu đạt được
- customer: Khách hàng mục tiêu
- business_model: Mô hình kinh doanh
- problem: Vấn đề cần giải quyết
- solution: Giải pháp của startup
- founder: Tên người sáng lập
- team: Thông tin đội ngũ
- location: Địa chỉ/Địa điểm hoạt động
- social: Mạng xã hội của startup
- patent: Bằng sáng chế
- award: Giải thưởng đạt được
- partnership: Đối tác/Quan hệ hợp tác
- timeline: Mốc thời gian quan trọng
- roadmap: Lịch trình phát triển tương lai
- metric: Chỉ số đo lường khác
- other: Các thông tin khác không thuộc nhóm trên

TEXT NGUỒN TÀI LIỆU CỦA STARTUP:
${text}`,
        config: {
          systemInstruction: "You are a highly precise, extremely strict venture capital analyst. Read and extract only real, explicit startup details from documents. Do not invent any values.",
          responseMimeType: "application/json",
          responseSchema: EXTRACTION_SCHEMA,
        }
      });

      const extracted = parseJsonRobustly(response.text);
      return this.mapToExtractionResult(extractionId, extracted, 'real');
    } catch (e) {
      console.error("Gemini text document extraction failed, falling back to strict parsed results", e);
      return this.generateDemoDocExtraction(extractionId, fileName, text);
    }
  }

  private static mapToExtractionResult(
    extractionId: string, 
    extracted: any, 
    mode: 'real' | 'demo', 
    customRawText?: string, 
    metadata?: any
  ): ExtractionResultDTO {
    const fields: any[] = [];
    const rawFields = extracted.fields || [];

    rawFields.forEach((item: any, idx: number) => {
      if (!item || typeof item !== 'object') return;
      const { label, type, value, exact_text, page, confidence } = item;

      // DO NOT create fields for empty or null values
      if (value === undefined || value === null || value === '') return;

      // Determine standard profile field mapped from type
      let fieldName = 'other';
      if (type === 'company_name') fieldName = 'startupName';
      else if (type === 'website') fieldName = 'website';
      else if (type === 'email') fieldName = 'contactEmail';
      else if (type === 'phone') fieldName = 'phoneNumber';
      else if (type === 'industry') fieldName = 'industries';
      else if (type === 'technology') fieldName = 'technologies';
      else if (type === 'market') fieldName = 'markets';
      else if (type === 'startup_stage') fieldName = 'stage';
      else if (type === 'funding') fieldName = 'fundingNeed';
      else if (type === 'problem') fieldName = 'problemStatement';
      else if (type === 'solution') fieldName = 'solutionDescription';
      else if (type === 'description' || type === 'tagline') fieldName = 'description';
      else if (type === 'revenue') fieldName = 'traction.monthlyRevenue';
      else if (type === 'traction') fieldName = 'traction.achievements';
      else if (type === 'partnership') fieldName = 'partnershipNeeds';

      // Parse value nicely if it's supposed to be an array or number
      let finalValue = value;
      if (['industries', 'technologies', 'markets', 'partnershipNeeds'].includes(fieldName)) {
        if (typeof value === 'string') {
          finalValue = value.split(/[,;\n\r]+/).map(s => s.trim()).filter(Boolean);
        } else if (!Array.isArray(value)) {
          finalValue = [String(value)];
        }
      } else if (fieldName === 'fundingNeed' || fieldName === 'traction.monthlyRevenue') {
        if (typeof value === 'string') {
          const numStr = value.replace(/[^\d.]/g, '');
          const parsedNum = parseFloat(numStr);
          finalValue = !isNaN(parsedNum) ? parsedNum : null;
        } else {
          finalValue = Number(value) || null;
        }
      }

      // Generate a unique field slug key to avoid React duplicate keys
      const uniqueFieldKey = `${fieldName}_${type || 'other'}_${idx}`;

      fields.push({
        field: uniqueFieldKey,
        mappedField: fieldName,
        label: label,
        type: type,
        value: finalValue,
        confidence: typeof confidence === 'number' ? confidence : (mode === 'real' ? 0.95 : 0.88),
        sourcePage: page || null,
        sourceText: exact_text || null,
        status: 'pending',
      });
    });

    return {
      extractionId,
      mode,
      fields,
      rawText: customRawText || JSON.stringify(extracted),
      warnings: fields.length === 0 ? ["Không tìm thấy trường thông tin tin cậy cao nào từ tài liệu đã tải lên."] : [],
      metadata,
    };
  }

  private static generateDemoImageExtraction(extractionId: string): ExtractionResultDTO {
    const extractedData = {
      fields: [
        { label: "Tên Startup", type: "company_name", value: "BioPack Green", exact_text: "BioPack Green", page: 1, confidence: 0.98 },
        { label: "Website", type: "website", value: "biopack-green.vn", exact_text: "biopack-green.vn", page: 1, confidence: 0.95 },
        { label: "Email Liên hệ", type: "email", value: "info@biopack-green.vn", exact_text: "info@biopack-green.vn", page: 1, confidence: 0.99 },
        { label: "Số Điện thoại", type: "phone", value: "+84 901 234 567", exact_text: "+84 901 234 567", page: 1, confidence: 0.92 },
        { label: "Lĩnh vực", type: "industry", value: "Greentech, Sustainability, Packaging", exact_text: "Lĩnh vực: Greentech, Sustainability, Packaging", page: 1, confidence: 0.95 },
        { label: "Công nghệ chính", type: "technology", value: "Bio-polymers, Advanced recycling", exact_text: "Công nghệ: Bio-polymers, Advanced recycling", page: 1, confidence: 0.94 },
        { label: "Thị trường", type: "market", value: "Vietnam, Southeast Asia", exact_text: "Thị trường: Vietnam, Southeast Asia", page: 1, confidence: 0.90 },
        { label: "Giai đoạn", type: "startup_stage", value: "seed", exact_text: "Giai đoạn: seed", page: 1, confidence: 0.95 },
        { label: "Mô tả", type: "description", value: "Manufacturing biodegradable alternative packaging solutions utilizing agricultural waste.", exact_text: "Manufacturing biodegradable alternative packaging...", page: 1, confidence: 0.96 },
        { label: "Vấn đề", type: "problem", value: "Plastic packaging contributes to massive environmental pollution, with slow degradation rates.", exact_text: "Vấn đề: Plastic packaging contributes to massive...", page: 1, confidence: 0.97 },
        { label: "Giải pháp", type: "solution", value: "Creating highly resilient, 100% compostable boxes and cups from bagasse.", exact_text: "Giải pháp: Creating highly resilient, 100% compostable boxes...", page: 1, confidence: 0.97 },
        { label: "Nhu cầu gọi vốn", type: "funding", value: "250000", exact_text: "$250,000", page: 1, confidence: 0.99 }
      ]
    };

    return this.mapToExtractionResult(extractionId, extractedData, 'demo');
  }

  private static parseTextDynamically(text: string, fileName: string): any {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    let startupName = nameWithoutExt
      .replace(/[_-]+/g, " ")
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    const lines = text.slice(0, 300).split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 2 && l.length < 40);
    if (lines.length > 0) {
      const candidate = lines[0];
      if (!candidate.toLowerCase().includes('pitch') && !candidate.toLowerCase().includes('deck') && !candidate.toLowerCase().includes('slide') && !candidate.toLowerCase().includes('present') && !candidate.toLowerCase().includes('content')) {
        startupName = candidate;
      }
    }

    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/);
    const contactEmail = emailMatch ? emailMatch[0] : null;

    const websiteMatch = text.match(/(https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})/);
    const website = websiteMatch ? websiteMatch[0] : null;

    const phoneMatch = text.match(/(\+?\d{1,4}[-.\s]??\d{1,3}[-.\s]??\d{1,4}[-.\s]??\d{1,4})/);
    const phoneNumber = phoneMatch ? phoneMatch[0] : null;

    const allIndustries = ['agritech', 'fintech', 'saas', 'healthtech', 'logistics', 'greentech', 'biotech', 'education', 'e-commerce', 'ai', 'deeptech', 'robotics', 'marketing', 'retail', 'sustainability'];
    const foundIndustries: string[] = [];
    const lowerText = text.toLowerCase();
    allIndustries.forEach(ind => {
      if (lowerText.includes(ind)) {
        foundIndustries.push(ind.charAt(0).toUpperCase() + ind.slice(1));
      }
    });

    const allTechs = ['machine learning', 'computer vision', 'iot', 'blockchain', 'react', 'node', 'python', 'robotics', 'cloud', 'ai', 'big data'];
    const foundTechs: string[] = [];
    allTechs.forEach(tech => {
      if (lowerText.includes(tech)) {
        foundTechs.push(tech.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
      }
    });

    let stage = null;
    const stages = ['idea', 'prototype', 'mvp', 'pre-seed', 'seed', 'growth', 'expansion'];
    for (const st of stages) {
      if (lowerText.includes(st)) {
        stage = st;
        break;
      }
    }

    const markets = ['Vietnam', 'Southeast Asia', 'Global', 'Europe', 'North America', 'Japan'];
    const foundMarkets: string[] = [];
    markets.forEach(m => {
      if (lowerText.includes(m.toLowerCase())) {
        foundMarkets.push(m);
      }
    });

    const cleanSentences = text
      .replace(/\s+/g, ' ')
      .split(/[.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    let description = null;
    let problemStatement = null;
    let solutionDescription = null;

    const descSentence = cleanSentences.find(s => s.toLowerCase().includes('giới thiệu') || s.toLowerCase().includes('khởi nghiệp') || s.toLowerCase().includes('startup') || s.toLowerCase().includes('chúng tôi') || s.toLowerCase().includes('about') || s.toLowerCase().includes('description'));
    if (descSentence) description = descSentence + '.';

    const probSentence = cleanSentences.find(s => s.toLowerCase().includes('vấn đề') || s.toLowerCase().includes('khó khăn') || s.toLowerCase().includes('rào cản') || s.toLowerCase().includes('thách thức') || s.toLowerCase().includes('problem') || s.toLowerCase().includes('friction'));
    if (probSentence) problemStatement = probSentence + '.';

    const solSentence = cleanSentences.find(s => s.toLowerCase().includes('giải pháp') || s.toLowerCase().includes('chúng tôi cung cấp') || s.toLowerCase().includes('solution') || s.toLowerCase().includes('sản phẩm') || s.toLowerCase().includes('product'));
    if (solSentence) solutionDescription = solSentence + '.';

    let fundingNeed = null;
    const fundingMatch = text.match(/(?:gọi vốn|funding|investment|cần|need|usd|vnd)\s*[:$]?\s*(\d{1,3}(?:[.,]\d{3})*(?:\s*triệu\s*vnd|\s*k\s*usd|\s*usd|\s*vnd)?)/i);
    if (fundingMatch) {
      const valStr = fundingMatch[1].toLowerCase();
      if (valStr.includes('triệu')) {
        fundingNeed = parseFloat(valStr) * 1000000;
      } else {
        const numOnly = parseInt(valStr.replace(/[^\d]/g, ''));
        if (!isNaN(numOnly)) {
          fundingNeed = numOnly;
        }
      }
    }

    const fields = [];
    if (startupName) fields.push({ label: "Tên Startup", type: "company_name", value: startupName, exact_text: startupName, page: 1, confidence: 0.90 });
    if (website) fields.push({ label: "Website", type: "website", value: website, exact_text: website, page: 1, confidence: 0.95 });
    if (contactEmail) fields.push({ label: "Email Liên hệ", type: "email", value: contactEmail, exact_text: contactEmail, page: 1, confidence: 0.95 });
    if (phoneNumber) fields.push({ label: "Số Điện thoại", type: "phone", value: phoneNumber, exact_text: phoneNumber, page: 1, confidence: 0.90 });
    if (foundIndustries.length > 0) fields.push({ label: "Lĩnh vực", type: "industry", value: foundIndustries.join(', '), exact_text: `Lĩnh vực: ${foundIndustries.join(', ')}`, page: 1, confidence: 0.90 });
    if (foundTechs.length > 0) fields.push({ label: "Công nghệ", type: "technology", value: foundTechs.join(', '), exact_text: `Công nghệ: ${foundTechs.join(', ')}`, page: 1, confidence: 0.90 });
    if (foundMarkets.length > 0) fields.push({ label: "Thị trường", type: "market", value: foundMarkets.join(', '), exact_text: `Thị trường: ${foundMarkets.join(', ')}`, page: 1, confidence: 0.85 });
    if (stage) fields.push({ label: "Giai đoạn", type: "startup_stage", value: stage, exact_text: `Giai đoạn: ${stage}`, page: 1, confidence: 0.90 });
    if (description) fields.push({ label: "Mô tả", type: "description", value: description.substring(0, 200), exact_text: description.substring(0, 100), page: 1, confidence: 0.85 });
    if (problemStatement) fields.push({ label: "Vấn đề", type: "problem", value: problemStatement.substring(0, 200), exact_text: problemStatement.substring(0, 100), page: 1, confidence: 0.85 });
    if (solutionDescription) fields.push({ label: "Giải pháp", type: "solution", value: solutionDescription.substring(0, 200), exact_text: solutionDescription.substring(0, 100), page: 1, confidence: 0.85 });
    if (fundingNeed) fields.push({ label: "Nhu cầu gọi vốn", type: "funding", value: String(fundingNeed && fundingNeed > 10000000 ? fundingNeed / 1000 : fundingNeed), exact_text: fundingMatch ? fundingMatch[1] : null, page: 1, confidence: 0.90 });

    return { fields };
  }

  private static generateDemoDocExtraction(extractionId: string, fileName: string, text?: string): ExtractionResultDTO {
    if (text && text.trim().length > 20 && !text.includes(`Content from file: ${fileName}`) && !text.includes('Pitch deck structure for')) {
      const parsed = this.parseTextDynamically(text, fileName);
      return this.mapToExtractionResult(extractionId, parsed, 'demo');
    }

    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    const cleanName = nameWithoutExt
      .replace(/[_-]+/g, " ")
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    const emptyData = {
      fields: cleanName ? [
        { label: "Tên Startup", type: "company_name", value: cleanName, exact_text: cleanName, page: 1, confidence: 0.85 }
      ] : []
    };

    return this.mapToExtractionResult(extractionId, emptyData, 'demo');
  }
}
