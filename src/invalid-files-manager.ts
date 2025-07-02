/**
 * Singleton manager for tracking invalid MDX files across plugin lifecycle
 */
export class InvalidFilesManager {
  private static instance: InvalidFilesManager;
  private invalidFiles: Set<string> = new Set();

  private constructor() {}

  static getInstance(): InvalidFilesManager {
    if (!InvalidFilesManager.instance) {
      InvalidFilesManager.instance = new InvalidFilesManager();
    }
    return InvalidFilesManager.instance;
  }

  /**
   * Update the list of invalid files
   */
  setInvalidFiles(files: string[]): void {
    this.invalidFiles.clear();
    files.forEach(file => this.invalidFiles.add(file));
    console.log(`[Git Sync] Updated invalid files list: ${files.length} files`);
  }

  /**
   * Check if a file is invalid
   */
  isInvalid(filePath: string): boolean {
    // Check both absolute path and relative path matches
    return Array.from(this.invalidFiles).some(invalidFile => {
      return filePath === invalidFile || 
             filePath.endsWith(invalidFile) ||
             invalidFile.endsWith(filePath.replace(/^.*\/docs\//, 'docs/'));
    });
  }

  /**
   * Get all invalid files
   */
  getInvalidFiles(): string[] {
    return Array.from(this.invalidFiles);
  }

  /**
   * Clear all invalid files
   */
  clear(): void {
    this.invalidFiles.clear();
  }
}