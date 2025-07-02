/**
 * Singleton to track global placeholder state
 */
export class PlaceholderStateManager {
  private static instance: PlaceholderStateManager;
  private hasActivePlaceholders: boolean = false;
  private placeholderFiles: Set<string> = new Set();
  
  private constructor() {}
  
  static getInstance(): PlaceholderStateManager {
    if (!PlaceholderStateManager.instance) {
      PlaceholderStateManager.instance = new PlaceholderStateManager();
    }
    return PlaceholderStateManager.instance;
  }
  
  setPlaceholdersActive(files: string[]): void {
    this.hasActivePlaceholders = true;
    files.forEach(file => this.placeholderFiles.add(file));
    console.log(`[Git Sync] Placeholder state: ${files.length} active placeholders`);
  }
  
  setPlaceholdersInactive(files: string[]): void {
    files.forEach(file => this.placeholderFiles.delete(file));
    if (this.placeholderFiles.size === 0) {
      this.hasActivePlaceholders = false;
      console.log('[Git Sync] Placeholder state: All placeholders restored');
    }
  }
  
  hasPlaceholders(): boolean {
    return this.hasActivePlaceholders;
  }
  
  getPlaceholderFiles(): string[] {
    return Array.from(this.placeholderFiles);
  }
  
  reset(): void {
    this.hasActivePlaceholders = false;
    this.placeholderFiles.clear();
  }
}