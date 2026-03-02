import axios from 'axios';
import https from 'https';
import sharp from 'sharp';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ProcessedMedia {
  type: 'image' | 'audio' | 'video';
  url: string;
  data: string;
  mimeType: string;
  originalSize?: number;
  compressedSize?: number;
}

export class MediaService {
  private genAI: GoogleGenerativeAI;
  private httpsAgent: https.Agent;
  private readonly allowedMimeTypes = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/heic',
    'image/heif',
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/aac',
    'audio/flac',
    'audio/ogg',
    'video/mp4',
    'video/mpeg',
    'video/mov',
    'video/avi',
    'video/x-flv',
    'video/mpg',
    'video/webm',
    'video/wmv',
    'video/3gpp'
  ]);

  // ✅ CONFIGURAÇÕES DE COMPRESSÃO
  private readonly IMAGE_MAX_WIDTH = 1920;
  private readonly IMAGE_MAX_HEIGHT = 1080;
  private readonly IMAGE_QUALITY = 85;
  private readonly IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    const allowInsecureTLS = process.env.ALLOW_INSECURE_TLS === 'true';
    
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: isDevelopment && allowInsecureTLS ? false : true
    });
  }

  async processMediaForAI(mediaUrls: string[]): Promise<ProcessedMedia[]> {
    const processedMedia: ProcessedMedia[] = [];

    for (const url of mediaUrls) {
      try {
        const media = await this.downloadAndConvert(url);
        if (media) {
          processedMedia.push(media);
        }
      } catch (error: any) {
        console.error(`Erro ao processar mídia ${url}:`, error.message);
      }
    }

    return processedMedia;
  }

  /**
   * ✅ OTIMIZADO - Download e compressão automática
   */
  private async downloadAndConvert(url: string): Promise<ProcessedMedia | null> {
    try {
      console.log(`⬇️ Baixando: ${url}`);
      
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        httpsAgent: this.httpsAgent,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024
      });

      const originalBuffer = Buffer.from(response.data);
      const originalSize = originalBuffer.length;
      
      const rawContentType = response.headers['content-type'] || '';
      const contentType = this.normalizeMimeType(rawContentType, url);

      if (!this.allowedMimeTypes.has(contentType)) {
        console.warn(`Mídia ignorada (MIME não suportado): ${contentType}`);
        return null;
      }

      let type: 'image' | 'audio' | 'video' = 'image';
      if (contentType.startsWith('audio/')) type = 'audio';
      else if (contentType.startsWith('video/')) type = 'video';

      // ✅ COMPRESSÃO AUTOMÁTICA
      let finalBuffer = originalBuffer;
      let compressedSize = originalSize;

      if (type === 'image' && originalSize > this.IMAGE_MAX_SIZE) {
        console.log(`🗜️ Comprimindo imagem: ${this.formatBytes(originalSize)}`);
        
        const compressed = await this.compressImage(originalBuffer, contentType);
        
        if (compressed) {
          finalBuffer = compressed;
          compressedSize = compressed.length;
          
          const reduction = Math.round((1 - compressedSize / originalSize) * 100);
          console.log(`✅ Comprimido: ${this.formatBytes(compressedSize)} (${reduction}% redução)`);
        }
      }

      const base64 = finalBuffer.toString('base64');

      return {
        type,
        url,
        data: base64,
        mimeType: contentType,
        originalSize,
        compressedSize
      };

    } catch (error: any) {
      if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        console.error(`❌ Erro de certificado TLS para ${url}`);
      } else {
        console.error(`❌ Falha ao baixar ${url}:`, error.message);
      }
      return null;
    }
  }

  /**
   * ✅ NOVO - Compressão de imagem com Sharp
   */
  private async compressImage(
    buffer: Buffer,
    mimeType: string
  ): Promise<Buffer | null> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      console.log(`📐 Dimensões originais: ${metadata.width}x${metadata.height}`);

      // ✅ Redimensionar se necessário
      let pipeline = image.resize({
        width: this.IMAGE_MAX_WIDTH,
        height: this.IMAGE_MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true
      });

      // ✅ Converter para formato otimizado
      if (mimeType === 'image/png') {
        // PNG → JPEG (muito menor)
        pipeline = pipeline.jpeg({ quality: this.IMAGE_QUALITY });
      } else if (mimeType === 'image/webp') {
        // WebP → manter mas comprimir
        pipeline = pipeline.webp({ quality: this.IMAGE_QUALITY });
      } else {
        // JPEG → recomprimir
        pipeline = pipeline.jpeg({ quality: this.IMAGE_QUALITY });
      }

      const compressed = await pipeline.toBuffer();
      
      const newMetadata = await sharp(compressed).metadata();
      console.log(`📐 Dimensões finais: ${newMetadata.width}x${newMetadata.height}`);

      return compressed;

    } catch (error: any) {
      console.error('❌ Erro ao comprimir imagem:', error.message);
      return null;
    }
  }

  /**
   * ✅ NOVO - Análise de mídia sem processamento (para preview)
   */
  async analyzeMediaSize(url: string): Promise<{
    url: string;
    size: number;
    type: string;
    needsCompression: boolean;
  } | null> {
    try {
      const response = await axios.head(url, {
        httpsAgent: this.httpsAgent,
        timeout: 5000
      });

      const size = parseInt(response.headers['content-length'] || '0');
      const type = response.headers['content-type'] || '';

      return {
        url,
        size,
        type,
        needsCompression: size > this.IMAGE_MAX_SIZE && type.startsWith('image/')
      };

    } catch (error) {
      return null;
    }
  }
   
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }


  private normalizeMimeType(contentTypeHeader: string, url: string): string {
    const mime = (contentTypeHeader || '')
      .toLowerCase()
      .split(';')[0]
      .trim();

    if (mime === 'application/ogg') return 'audio/ogg';
    if (mime) return mime;

    const urlLower = url.toLowerCase();
    if (urlLower.includes('.ogg')) return 'audio/ogg';
    if (urlLower.includes('.mp3')) return 'audio/mpeg';
    if (urlLower.includes('.wav')) return 'audio/wav';
    if (urlLower.includes('.m4a')) return 'audio/aac';
    if (urlLower.includes('.webm')) return 'video/webm';
    if (urlLower.includes('.mp4')) return 'video/mp4';
    if (urlLower.includes('.mov')) return 'video/mov';
    if (urlLower.includes('.png')) return 'image/png';
    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'image/jpeg';
    if (urlLower.includes('.webp')) return 'image/webp';

    return '';
  }

  isSupportedMedia(url: string): boolean {
    const supportedExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.webp',
      '.mp3', '.wav', '.ogg', '.m4a',
      '.mp4', '.webm', '.mov'
    ];

    const urlLower = url.toLowerCase();
    return supportedExtensions.some(ext => urlLower.includes(ext));
  }
}