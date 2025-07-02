import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { compile } from '@mdx-js/mdx';
import matter from 'gray-matter';
import type { LoadContext } from '@docusaurus/types';

export interface MDXValidationReport {
  totalFiles: number;
  validFiles: number;
  invalidFiles: InvalidFileReport[];
  duration: number;
}

export interface InvalidFileReport {
  file: string;
  error: string;
}

/**
 * Pre-compilation MDX validator that provides clean error reporting
 */
export class MDXPreValidator {
  private context: LoadContext;
  private contentPaths: string[];
  private invalidFilesCache: Map<string, string> = new Map();
  private hasRun: boolean = false;

  constructor(context: LoadContext, contentPaths: string[]) {
    this.context = context;
    this.contentPaths = contentPaths.map(p => 
      path.isAbsolute(p) ? p : path.join(context.siteDir, p)
    );
  }

  /**
   * Clear the cache to force re-validation
   */
  clearCache(): void {
    this.invalidFilesCache.clear();
    this.hasRun = false;
  }

  /**
   * Run validation and return report
   */
  async validate(forceRefresh: boolean = false): Promise<MDXValidationReport> {
    if (this.hasRun && !forceRefresh) {
      return this.getCachedReport();
    }

    const startTime = Date.now();
    const files = await this.findMDXFiles();
    const invalidFiles: InvalidFileReport[] = [];
    let validCount = 0;

    console.log(`[Git Sync] Validating ${files.length} MDX files...`);

    for (const file of files) {
      const error = await this.validateFile(file);
      if (error) {
        const relativePath = path.relative(this.context.siteDir, file);
        invalidFiles.push({
          file: relativePath,
          error: error
        });
        this.invalidFilesCache.set(file, error);
      } else {
        validCount++;
      }
    }

    const duration = Date.now() - startTime;
    this.hasRun = true;

    const report: MDXValidationReport = {
      totalFiles: files.length,
      validFiles: validCount,
      invalidFiles,
      duration
    };

    this.printReport(report);
    return report;
  }

  /**
   * Check if a file is invalid
   */
  isFileInvalid(filePath: string): boolean {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.context.siteDir, filePath);
    return this.invalidFilesCache.has(absolutePath);
  }

  /**
   * Get validation error for a file
   */
  getFileError(filePath: string): string | undefined {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.context.siteDir, filePath);
    return this.invalidFilesCache.get(absolutePath);
  }

  /**
   * Validate a single file
   */
  private async validateFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { content: mdxContent } = matter(content);
      
      // Check for basic MDX syntax issues that Docusaurus commonly encounters
      const errors: string[] = [];
      
      // Check for unclosed HTML tags in MDX
      const lines = mdxContent.split('\n');
      
      // Check for non-self-closing void elements - more accurate detection
      const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
      lines.forEach((line, lineIndex) => {
        const lineNum = lineIndex + 1;
        
        // Check each void element
        voidElements.forEach(tag => {
          // Match opening tags that are not self-closed
          const regex = new RegExp(`<${tag}(\\s+[^>]*)?>(?!.*</${tag}>)`, 'gi');
          let match;
          while ((match = regex.exec(line)) !== null) {
            // Check if it's not self-closed
            if (!match[0].endsWith('/>')) {
              const column = match.index + 1;
              errors.push(`Expected a closing tag for <${tag}> (line ${lineNum}, column ${column})`);
            }
          }
        });
        
        // Special check for <br> tags in table cells
        if (line.includes('|') && line.includes('<br>') && !line.includes('<br />') && !line.includes('<br/>')) {
          const brIndex = line.indexOf('<br>');
          errors.push(`Expected a closing tag for <br> (line ${lineNum}, column ${brIndex + 1})`);
        }
      });
      
      // Check for invalid MDX expressions (like {20x20})
      const invalidExpressionRegex = /\{(\d+)x(\d+)\}/g;
      lines.forEach((line, lineIndex) => {
        if (invalidExpressionRegex.test(line)) {
          errors.push(`Could not parse expression with acorn (line ${lineIndex + 1})`);
        }
      });
      
      // Check for image references
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      lines.forEach((line, _lineIndex) => {
        let match;
        while ((match = imageRegex.exec(line)) !== null) {
          const [, , imagePath] = match;
          
          // Skip external URLs
          if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            continue;
          }
          
          const fileDir = path.dirname(filePath);
          let absoluteImagePath = path.resolve(fileDir, imagePath);
          
          // Check if file exists
          if (!fsSync.existsSync(absoluteImagePath)) {
            // Try decoding URL encoded paths
            if (imagePath.includes('%20')) {
              const decodedPath = decodeURIComponent(imagePath);
              absoluteImagePath = path.resolve(fileDir, decodedPath);
              if (!fsSync.existsSync(absoluteImagePath)) {
                const relativePath = path.relative(this.context.siteDir, filePath);
                const relativeImagePath = path.relative(this.context.siteDir, absoluteImagePath);
                errors.push(`Image ${relativeImagePath} used in ${relativePath} not found`);
              }
            } else {
              const relativePath = path.relative(this.context.siteDir, filePath);
              const relativeImagePath = path.relative(this.context.siteDir, absoluteImagePath);
              errors.push(`Image ${relativeImagePath} used in ${relativePath} not found`);
            }
          }
        }
      });
      
      if (errors.length > 0) {
        return errors[0]; // Return the first error for now
      }
      
      // If no specific errors found, try MDX compilation as fallback
      await compile(mdxContent, {
        format: path.extname(filePath) === '.md' ? 'md' : 'mdx',
        development: false,
        mdxExtensions: ['.md', '.mdx']
      });
      
      return null;
    } catch (error: any) {
      return this.formatError(error);
    }
  }

  /**
   * Format error message for clean output
   */
  private formatError(error: any): string {
    if (!error.message) {
      return 'Unknown compilation error';
    }

    // Extract the main error message
    let message = error.message;
    
    // Handle MDX specific error messages
    if (message.includes('Expected a closing tag')) {
      const match = message.match(/Expected a closing tag for `?([^`]+)`?/);
      if (match) {
        const lineMatch = message.match(/\((\d+):(\d+)-?/);
        if (lineMatch) {
          return `Expected a closing tag for ${match[1]} (line ${lineMatch[1]}, column ${lineMatch[2]})`;
        }
        return `Expected a closing tag for ${match[1]}`;
      }
    }
    
    // Handle acorn parsing errors
    if (message.includes('Could not parse expression with acorn')) {
      const lineMatch = message.match(/(\d+):(\d+)/);
      if (lineMatch) {
        return `Could not parse expression with acorn (line ${lineMatch[1]}, column ${lineMatch[2]})`;
      }
    }
    
    // Remove file paths and stack traces
    const cleanMessage = message
      .split('\n')[0]
      .replace(/\s+at\s+.*$/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();

    // Add position if available
    if (error.line && error.column) {
      return `${cleanMessage} (line ${error.line}, column ${error.column})`;
    }

    return cleanMessage;
  }

  /**
   * Find all MDX files in content paths
   */
  private async findMDXFiles(): Promise<string[]> {
    const allFiles: string[] = [];
    
    for (const contentPath of this.contentPaths) {
      try {
        const files = await this.scanDir(contentPath);
        allFiles.push(...files);
      } catch {
        // Directory doesn't exist
      }
    }
    
    return allFiles;
  }

  /**
   * Recursively scan directory for MDX files
   */
  private async scanDir(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await this.scanDir(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Permission error or other issue
    }
    
    return files;
  }

  /**
   * Print validation report
   */
  private printReport(report: MDXValidationReport): void {
    if (report.invalidFiles.length === 0) {
      console.log(`[Git Sync] All ${report.totalFiles} MDX files validated successfully (${report.duration}ms)`);
      return;
    }

    console.log('\n[Git Sync] MDX Pre-compilation Validation Report');
    console.log('=' .repeat(70));
    console.log(`Total files: ${report.totalFiles}`);
    console.log(`Valid files: ${report.validFiles}`);
    console.log(`Invalid files: ${report.invalidFiles.length}`);
    console.log(`Duration: ${report.duration}ms`);
    console.log('=' .repeat(70));
    
    console.log('\nValidation Errors:');
    console.log('-' .repeat(70));
    
    for (const { file, error } of report.invalidFiles) {
      console.log(`\n${file}`);
      console.log(`  Error: ${error}`);
    }
    
    console.log('\n' + '-' .repeat(70));
    console.log('\nNote: These files contain MDX syntax errors that need to be fixed:');
    console.log('  • Replace <br> with <br />');
    console.log('  • Replace <img src="..."> with <img src="..." />');
    console.log('  • Remove {widthxheight} syntax from images');
    console.log('  • Ensure all referenced images exist\n');
  }

  /**
   * Get cached report
   */
  private getCachedReport(): MDXValidationReport {
    const invalidFiles: InvalidFileReport[] = [];
    
    for (const [file, error] of this.invalidFilesCache) {
      const relativePath = path.relative(this.context.siteDir, file);
      invalidFiles.push({ file: relativePath, error });
    }

    return {
      totalFiles: 0,
      validFiles: 0,
      invalidFiles,
      duration: 0
    };
  }

}