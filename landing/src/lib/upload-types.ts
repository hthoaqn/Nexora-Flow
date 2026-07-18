/** Accepted document types for pitch decks + project reports. */

export const UPLOAD_EXTENSIONS = [
  // decks
  '.pdf',
  '.ppt',
  '.pptx',
  '.key',
  // docs / reports
  '.doc',
  '.docx',
  '.odt',
  '.rtf',
  '.txt',
  '.md',
  // sheets / data annex
  '.xls',
  '.xlsx',
  '.csv',
  // archives (multi-file reports)
  '.zip',
] as const

export const UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
] as const

/** HTML accept attribute value */
export const UPLOAD_ACCEPT = [
  ...UPLOAD_EXTENSIONS,
  ...UPLOAD_MIME_TYPES,
].join(',')

export const UPLOAD_ACCEPT_LABEL_VI =
  'PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, CSV, TXT, MD, RTF, ODT, ZIP'
export const UPLOAD_ACCEPT_LABEL_EN =
  'PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, CSV, TXT, MD, RTF, ODT, ZIP'

const EXT_SET = new Set(UPLOAD_EXTENSIONS.map((e) => e.toLowerCase()))

export function isAllowedUploadFile(file: File): boolean {
  const name = file.name || ''
  const dot = name.lastIndexOf('.')
  if (dot >= 0) {
    const ext = name.slice(dot).toLowerCase()
    if (EXT_SET.has(ext)) return true
  }
  if (file.type && (UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
    return true
  }
  // Some browsers leave type empty — allow if extension matched; already checked
  return false
}

export function filterAllowedFiles(files: FileList | File[]): {
  accepted: File[]
  rejected: File[]
} {
  const list = Array.from(files)
  const accepted: File[] = []
  const rejected: File[] = []
  for (const f of list) {
    if (isAllowedUploadFile(f)) accepted.push(f)
    else rejected.push(f)
  }
  return { accepted, rejected }
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
