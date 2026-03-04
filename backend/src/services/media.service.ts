import axios from 'axios';
import dns from 'dns/promises';
import https from 'https';
import net from 'net';
import sharp from 'sharp';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { debugLog, maskUrl } from '../utils/logger';

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
  private readonly allowHttpInDevelopment: boolean;
  private readonly allowedHosts: string[];
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
    this.allowHttpInDevelopment =
      process.env.NODE_ENV === 'development' && process.env.ALLOW_INSECURE_MEDIA_HTTP === 'true';

    const configuredHosts = (process.env.MEDIA_ALLOWED_HOSTS || '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    try {
      const freshchatHost = process.env.FRESHCHAT_API_URL
        ? new URL(process.env.FRESHCHAT_API_URL).hostname.toLowerCase()
        : '';
      this.allowedHosts = [...new Set([...configuredHosts, freshchatHost].filter(Boolean))];
    } catch {
      this.allowedHosts = configuredHosts;
    }
    
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
      const safeUrl = await this.assertSafeMediaUrl(url);
      debugLog(`⬇️ Baixando mídia autorizada: ${maskUrl(safeUrl.toString())}`);
      
      const response = await axios.get(safeUrl.toString(), {
        responseType: 'arraybuffer',
        timeout: 30000,
        httpsAgent: this.httpsAgent,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024
      });

      const originalBuffer = Buffer.from(response.data);
      const originalSize = originalBuffer.length;
      
      const rawContentType = response.headers['content-type'] || '';
      const contentType = this.normalizeMimeType(rawContentType, safeUrl.toString());

      if (!this.allowedMimeTypes.has(contentType)) {
        console.warn(`Midia ignorada (MIME nao suportado): ${contentType}`);
        return null;
      }

      let type: 'image' | 'audio' | 'video' = 'image';
      if (contentType.startsWith('audio/')) type = 'audio';
      else if (contentType.startsWith('video/')) type = 'video';

      // ✅ COMPRESSÃO AUTOMÁTICA
      let finalBuffer = originalBuffer;
      let compressedSize = originalSize;

      if (type === 'image' && originalSize > this.IMAGE_MAX_SIZE) {
        debugLog(`🗜️ Comprimindo imagem: ${this.formatBytes(originalSize)}`);
        
        const compressed = await this.compressImage(originalBuffer, contentType);
        
        if (compressed) {
          finalBuffer = compressed;
          compressedSize = compressed.length;
          
          const reduction = Math.round((1 - compressedSize / originalSize) * 100);
          debugLog(`✅ Comprimido: ${this.formatBytes(compressedSize)} (${reduction}% reducao)`);
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
        console.error(`Falha de certificado TLS ao baixar midia autorizada: ${maskUrl(url)}`);
      } else if (error.message?.includes('Bloqueado por politica de seguranca')) {
        console.warn(`Download de midia bloqueado por seguranca: ${maskUrl(url)}`);
      } else {
        console.error(`Falha ao baixar midia autorizada ${maskUrl(url)}:`, error.message);
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

      debugLog(`📐 Dimensoes originais: ${metadata.width}x${metadata.height}`);

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
      debugLog(`📐 Dimensoes finais: ${newMetadata.width}x${newMetadata.height}`);

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
      const safeUrl = await this.assertSafeMediaUrl(url);
      const response = await axios.head(safeUrl.toString(), {
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

  private async assertSafeMediaUrl(rawUrl: string): Promise<URL> {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new Error('Bloqueado por politica de seguranca: URL de midia invalida');
    }

    const protocolAllowed =
      parsedUrl.protocol === 'https:' || (this.allowHttpInDevelopment && parsedUrl.protocol === 'http:');

    if (!protocolAllowed) {
      throw new Error('Bloqueado por politica de seguranca: protocolo de midia nao permitido');
    }

    if (parsedUrl.username || parsedUrl.password) {
      throw new Error('Bloqueado por politica de seguranca: URL autenticada nao permitida');
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (this.isLocalHostname(hostname)) {
      throw new Error('Bloqueado por politica de seguranca: host local nao permitido');
    }

    if (this.allowedHosts.length > 0 && !this.isAllowedHost(hostname)) {
      throw new Error('Bloqueado por politica de seguranca: host fora da allowlist');
    }

    const resolvedAddresses = net.isIP(hostname)
      ? [{ address: hostname }]
      : await dns.lookup(hostname, { all: true, verbatim: true });

    if (resolvedAddresses.length === 0) {
      throw new Error('Bloqueado por politica de seguranca: host sem resolucao DNS valida');
    }

    for (const entry of resolvedAddresses) {
      if (this.isPrivateOrReservedIp(entry.address)) {
        throw new Error('Bloqueado por politica de seguranca: endereco privado ou reservado');
      }
    }

    return parsedUrl;
  }

  private isAllowedHost(hostname: string): boolean {
    return this.allowedHosts.some((allowedHost) =>
      hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)
    );
  }

  private isLocalHostname(hostname: string): boolean {
    return hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local');
  }

  private isPrivateOrReservedIp(address: string): boolean {
    const family = net.isIP(address);
    if (family === 4) {
      const octets = address.split('.').map((value) => Number(value));
      const [a, b] = octets;

      return (
        a === 10 ||
        a === 127 ||
        a === 0 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 198 && (b === 18 || b === 19))
      );
    }

    if (family === 6) {
      const normalized = address.toLowerCase();
      return (
        normalized === '::1' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe80') ||
        normalized === '::'
      );
    }

    return true;
  }
}
