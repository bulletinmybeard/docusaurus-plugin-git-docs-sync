import * as fs from 'fs/promises';
import * as path from 'path';
import { compile } from '@mdx-js/mdx';
import matter from 'gray-matter';
import type { LoadContext } from '@docusaurus/types';

export interface PreCompilationResult {
  validFiles: string[];
  invalidFiles: InvalidFile[];
}

export interface InvalidFile {
  filePath: string;
  error: string;
}

export class PreCompilationValidator {
  private siteDir: string;
  private contentPaths: string[];
  private processedFiles: Set<string> = new Set();
  private invalidFiles: Map<string, string> = new Map();

  constructor(context: LoadContext, contentPaths: string[]) {
    this.siteDir = context.siteDir;
    this.contentPaths = contentPaths;
  }

  /**
   * Validates all MDX files in the content directories
   * Returns list of valid files and excluded invalid files
   */
  async validateAllContent(): Promise<PreCompilationResult> {
    const allFiles = await this.findAllMDXFiles();
    const validFiles: string[] = [];
    const invalidFiles: InvalidFile[] = [];

    for (const file of allFiles) {
      const validation = await this.validateFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        invalidFiles.push({
          filePath: file,
          error: validation.error
        });
        this.invalidFiles.set(file, validation.error);
      }
    }

    // Print clean error report
    if (invalidFiles.length > 0) {
      this.printErrorReport(invalidFiles);
    }

    return { validFiles, invalidFiles };
  }

  /**
   * Check if a file should be excluded from Docusaurus processing
   */
  shouldExcludeFile(filePath: string): boolean {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.siteDir, filePath);
    return this.invalidFiles.has(absolutePath);
  }

  /**
   * Validate a single MDX file
   */
  private async validateFile(filePath: string): Promise<{ valid: boolean; error: string }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract frontmatter
      const { content: mdxContent } = matter(content);
      
      // Try to compile MDX
      await compile(mdxContent, {
        format: 'mdx',
        development: false
      });
      
      this.processedFiles.add(filePath);
      return { valid: true, error: '' };
    } catch (error: any) {
      // Extract clean error message
      const errorMessage = this.extractCleanError(error);
      return { valid: false, error: errorMessage };
    }
  }

  /**
   * Find all MDX files in content directories
   */
  private async findAllMDXFiles(): Promise<string[]> {
    const files: string[] = [];
    
    for (const contentPath of this.contentPaths) {
      const absolutePath = path.isAbsolute(contentPath) 
        ? contentPath 
        : path.join(this.siteDir, contentPath);
      
      try {
        await fs.access(absolutePath);
        const foundFiles = await this.scanDirectory(absolutePath);
        files.push(...foundFiles);
      } catch {
        // Directory doesn't exist, skip
      }
    }
    
    return files;
  }

  /**
   * Recursively scan directory for MDX files
   */
  private async scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const subFiles = await this.scanDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Extract clean error message from MDX compilation error
   */
  private extractCleanError(error: any): string {
    if (error.message) {
      // Remove stack traces and keep only the relevant error message
      const lines = error.message.split('\n');
      const cleanLines = lines.filter((line: string) => 
        !line.includes('at ') && 
        !line.includes('node_modules') &&
        line.trim().length > 0
      );
      
      // Take first meaningful line
      const message = cleanLines[0] || error.message.split('\n')[0];
      
      // Add position info if available
      if (error.line && error.column) {
        return `${message} (line ${error.line}, column ${error.column})`;
      }
      
      return message;
    }
    
    return 'Unknown MDX compilation error';
  }

  /**
   * Print clean error report for invalid files
   */
  private printErrorReport(invalidFiles: InvalidFile[]): void {
    console.log('\n[Git Sync] MDX Validation Errors Found:');
    console.log('=' .repeat(60));
    
    for (const { filePath, error } of invalidFiles) {
      const relativePath = path.relative(this.siteDir, filePath);
      console.log(`\nFile: ${relativePath}`);
      console.log(`Error: ${error}`);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log(`Total invalid files: ${invalidFiles.length}`);
    console.log('These files will be excluded from Docusaurus compilation.\n');
  }

  /**
   * Clear cached validation results
   */
  clearCache(): void {
    this.processedFiles.clear();
    this.invalidFiles.clear();
  }
}