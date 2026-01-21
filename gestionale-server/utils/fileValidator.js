/**
 * Validatore per file upload
 * Incrementale, non distruttivo
 */

const path = require('path');

class FileValidator {
  constructor() {
    // Tipi MIME consentiti (documenti comuni per studio ingegneria)
    this.allowedMimeTypes = [
      // Documenti
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      // Immagini
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      // CAD/Disegni
      'application/acad',
      'application/x-dwg',
      'image/vnd.dwg',
      // Archivi
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      // Testo
      'text/plain',
      'text/csv'
    ];

    // Estensioni consentite
    this.allowedExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.jpg', '.jpeg', '.png', '.gif', '.webp',
      '.dwg', '.dxf',
      '.zip', '.rar', '.7z',
      '.txt', '.csv'
    ];

    // Dimensione massima: 50MB
    this.maxFileSize = 50 * 1024 * 1024;
  }

  /**
   * Valida file upload
   */
  validate(file) {
    if (!file) {
      return { valid: false, error: 'File mancante' };
    }

    // Valida dimensione
    if (file.size > this.maxFileSize) {
      return {
        valid: false,
        error: `File troppo grande. Dimensione massima: ${this.maxFileSize / 1024 / 1024}MB`
      };
    }

    // Valida estensione
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Tipo file non consentito. Estensioni consentite: ${this.allowedExtensions.join(', ')}`
      };
    }

    // Valida MIME type (se disponibile)
    if (file.mimetype && !this.allowedMimeTypes.includes(file.mimetype)) {
      // Warning ma non bloccante (alcuni browser riportano MIME type errati)
      console.warn(`MIME type non riconosciuto: ${file.mimetype} per file ${file.originalname}`);
    }

    // Sanitizza nome file
    const sanitizedName = this.sanitizeFileName(file.originalname);
    if (sanitizedName !== file.originalname) {
      file.originalname = sanitizedName;
    }

    return { valid: true };
  }

  /**
   * Sanitizza nome file per prevenire path traversal
   */
  sanitizeFileName(fileName) {
    // Rimuove path separators
    let sanitized = path.basename(fileName);
    
    // Rimuove caratteri pericolosi
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');
    
    // Limita lunghezza
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      sanitized = name.substring(0, 255 - ext.length) + ext;
    }

    return sanitized || 'file';
  }

  /**
   * Genera nome file sicuro con timestamp
   */
  generateSafeFileName(originalName) {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const sanitizedName = this.sanitizeFileName(name);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${sanitizedName}_${timestamp}_${random}${ext}`;
  }
}

module.exports = new FileValidator();





