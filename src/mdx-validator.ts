import * as fs from 'fs/promises';
import * as path from 'path';
import { compile } from '@mdx-js/mdx';
import matter from 'gray-matter';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  file: string;
  error: string;
  line?: number;
  column?: number;
}

export class MDXValidator {
  private contentPath: string;
  private ignorePatterns: string[];

  constructor(contentPath: string, ignorePatterns: string[] = []) {
    this.contentPath = contentPath;
    this.ignorePatterns = ignorePatterns;
  }

  async validateFiles(files: string[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    for (const file of files) {
      if (this.shouldIgnore(file)) continue;
      
      const ext = path.extname(file).toLowerCase();
      if (ext === '.md' || ext === '.mdx') {
        const error = await this.validateMDXFile(file);
        if (error) {
          errors.push(error);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async validateMDXFile(filePath: string): Promise<ValidationError | null> {
    try {
      const fullPath = path.join(this.contentPath, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Extract frontmatter
      const { content: mdxContent } = matter(content);
      
      // Try to compile MDX
      await compile(mdxContent, {
        format: 'mdx',
        development: false
      });
      
      return null;
    } catch (error: any) {
      return {
        file: filePath,
        error: error.message || 'Unknown MDX compilation error',
        line: error.line,
        column: error.column
      };
    }
  }

  private shouldIgnore(file: string): boolean {
    return this.ignorePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(file);
      }
      return file.includes(pattern);
    });
  }
}