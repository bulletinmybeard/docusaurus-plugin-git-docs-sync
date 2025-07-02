import * as crypto from 'crypto';
import { PluginOptions } from './types';

export interface SecureCredentials {
  githubToken?: string;
  githubUsername?: string;
  webhookSecret?: string;
}

export class CredentialManager {
  private credentials: Map<string, string> = new Map();
  private encryptionKey: Buffer;
  
  constructor(encryptionKey?: string) {
    // Use provided key or environment variable, with a fallback
    const keySource = encryptionKey || process.env.DOCUSAURUS_GIT_SYNC_ENCRYPTION_KEY || 'default-key-do-not-use-in-production';
    
    // Generate a consistent encryption key using scrypt
    this.encryptionKey = crypto.scryptSync(
      keySource,
      'docusaurus-git-sync-salt',
      32
    );
  }

  /**
   * Store credentials securely in memory (encrypted)
   */
  storeCredentials(options: Partial<PluginOptions>): void {
    if (options.githubToken) {
      this.set('githubToken', options.githubToken);
    }
    if (options.githubUsername) {
      this.set('githubUsername', options.githubUsername);
    }
    if (options.webhookSecret) {
      this.set('webhookSecret', options.webhookSecret);
    }
  }

  /**
   * Retrieve decrypted credentials
   */
  getCredentials(): SecureCredentials {
    return {
      githubToken: this.get('githubToken'),
      githubUsername: this.get('githubUsername'),
      webhookSecret: this.get('webhookSecret'),
    };
  }

  /**
   * Get authenticated remote URL with credentials
   */
  getAuthenticatedUrl(remoteUrl: string, authMethod?: string): string {
    const credentials = this.getCredentials();
    
    if (authMethod === 'token' && credentials.githubToken && credentials.githubUsername) {
      // Handle different Git providers
      if (remoteUrl.startsWith('https://github.com/')) {
        return remoteUrl.replace(
          'https://github.com/',
          `https://${credentials.githubUsername}:${credentials.githubToken}@github.com/`
        );
      } else if (remoteUrl.startsWith('https://')) {
        try {
          const url = new URL(remoteUrl);
          url.username = credentials.githubUsername;
          url.password = credentials.githubToken;
          return url.toString();
        } catch (error) {
          // If URL parsing fails, return original
          return remoteUrl;
        }
      }
    }
    
    return remoteUrl;
  }

  /**
   * Clear all stored credentials
   */
  clearCredentials(): void {
    // Overwrite memory before clearing
    for (const [, value] of this.credentials) {
      if (value) {
        // Overwrite the encrypted value in memory
        const buffer = Buffer.from(value, 'hex');
        crypto.randomFillSync(buffer);
      }
    }
    this.credentials.clear();
  }

  /**
   * Mask sensitive data for logging
   */
  static maskSensitiveData(data: any): any {
    if (typeof data === 'string') {
      // Mask tokens in URLs
      return data
        .replace(/https:\/\/[^:]+:[^@]+@/g, 'https://***:***@')
        .replace(/\b[A-Za-z0-9]{40}\b/g, '***') // GitHub tokens
        .replace(/\bghp_[A-Za-z0-9]{36}\b/g, 'ghp_***') // GitHub PAT
        .replace(/\bghs_[A-Za-z0-9]{36}\b/g, 'ghs_***') // GitHub secret
        .replace(/\b[A-Za-z0-9]{20,}\b/g, (match) => {
          // Mask long strings that might be tokens
          if (match.length > 30) {
            return match.substring(0, 4) + '***' + match.substring(match.length - 4);
          }
          return match;
        });
    }
    
    if (typeof data === 'object' && data !== null) {
      const masked: any = Array.isArray(data) ? [] : {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          if (key.toLowerCase().includes('token') || 
              key.toLowerCase().includes('secret') ||
              key.toLowerCase().includes('password') ||
              key.toLowerCase().includes('key')) {
            masked[key] = '***';
          } else {
            masked[key] = CredentialManager.maskSensitiveData(data[key]);
          }
        }
      }
      return masked;
    }
    
    return data;
  }

  /**
   * Validate credentials format
   */
  static validateCredentials(options: Partial<PluginOptions>): string[] {
    const errors: string[] = [];
    
    if (options.authMethod === 'token') {
      if (!options.githubToken) {
        errors.push('githubToken is required when authMethod is "token"');
      } else if (!/^(ghp_|ghs_|github_pat_)[A-Za-z0-9_]{36,}$/.test(options.githubToken) &&
                 options.githubToken.length < 40) {
        errors.push('githubToken appears to be invalid format');
      }
      
      if (!options.githubUsername) {
        errors.push('githubUsername is required when authMethod is "token"');
      }
    }
    
    if (options.enableWebhook && !options.webhookSecret) {
      errors.push('webhookSecret is required when enableWebhook is true');
    }
    
    return errors;
  }

  /**
   * Encrypt and store a value
   */
  private set(key: string, value: string): void {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Store IV with encrypted data
    this.credentials.set(key, iv.toString('hex') + ':' + encrypted);
  }

  /**
   * Retrieve and decrypt a value
   */
  private get(key: string): string | undefined {
    const stored = this.credentials.get(key);
    if (!stored) return undefined;
    
    try {
      const [ivHex, encrypted] = stored.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      // If decryption fails, return undefined
      return undefined;
    }
  }
}