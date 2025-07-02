import type { LoadContext } from '@docusaurus/types';
import { PreCompilationValidator } from './pre-compilation-validator';
import * as path from 'path';

/**
 * Content filter that intercepts and validates MDX files before Docusaurus processes them
 */
export class ContentFilter {
  private validator: PreCompilationValidator;
  private validationComplete: boolean = false;
  private validFiles: Set<string> = new Set();

  constructor(context: LoadContext, contentPaths: string[]) {
    this.validator = new PreCompilationValidator(context, contentPaths);
  }

  /**
   * Run pre-compilation validation on all content
   */
  async runValidation(): Promise<void> {
    if (this.validationComplete) {
      return;
    }

    console.log('[Git Sync] Running pre-compilation MDX validation...');
    const startTime = Date.now();
    
    const result = await this.validator.validateAllContent();
    
    // Store valid files for quick lookup
    result.validFiles.forEach(file => this.validFiles.add(file));
    
    const duration = Date.now() - startTime;
    console.log(`[Git Sync] Validation complete in ${duration}ms`);
    console.log(`[Git Sync] Valid files: ${result.validFiles.length}, Invalid files: ${result.invalidFiles.length}`);
    
    this.validationComplete = true;
  }

  /**
   * Check if a file should be included in Docusaurus processing
   */
  shouldIncludeFile(filePath: string): boolean {
    // If validation hasn't run yet, include all files
    if (!this.validationComplete) {
      return true;
    }

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    
    // Check if file is MDX
    if (!filePath.endsWith('.md') && !filePath.endsWith('.mdx')) {
      return true; // Non-MDX files are always included
    }

    // Check if file was validated and is valid
    return this.validFiles.has(absolutePath);
  }

  /**
   * Filter an array of files, excluding invalid ones
   */
  filterFiles(files: string[]): string[] {
    if (!this.validationComplete) {
      return files;
    }

    return files.filter(file => this.shouldIncludeFile(file));
  }

  /**
   * Get error message for an excluded file
   */
  getFileError(filePath: string): string | undefined {
    return this.validator.shouldExcludeFile(filePath) 
      ? `File excluded due to MDX validation error` 
      : undefined;
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validator.clearCache();
    this.validFiles.clear();
    this.validationComplete = false;
  }
}