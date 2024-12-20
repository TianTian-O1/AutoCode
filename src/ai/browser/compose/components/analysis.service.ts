import { Autowired, Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-browser';
import { FileServicePath, IFileService } from '@opensumi/ide-file-service';
import { URI } from '@opensumi/ide-core-common';

@Domain()
@Injectable()
export class AnalysisService {
  @Autowired(FileServicePath)
  private readonly fileService: IFileService;

  async analyzeFile(path: string): Promise<{
    content: string;
    language: string;
    imports: string[];
    exports: string[];
    functions: string[];
  }> {
    try {
      const uri = new URI(path);
      const content = await this.fileService.readFile(uri);
      const fileContent = content.toString();
      
      // Basic analysis - can be enhanced with proper parsing
      const language = this.detectLanguage(path);
      const imports = this.findImports(fileContent);
      const exports = this.findExports(fileContent);
      const functions = this.findFunctions(fileContent);

      return {
        content: fileContent,
        language,
        imports,
        exports,
        functions
      };
    } catch (error) {
      console.error('Analyze file error:', error);
      throw error;
    }
  }

  private detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx': return 'typescript';
      case 'js':
      case 'jsx': return 'javascript';
      case 'py': return 'python';
      case 'java': return 'java';
      default: return 'unknown';
    }
  }

  private findImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*?from\s+['"].*?['"]/g;
    const matches = content.match(importRegex);
    if (matches) {
      imports.push(...matches);
    }
    return imports;
  }

  private findExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:class|interface|const|function)\s+\w+/g;
    const matches = content.match(exportRegex);
    if (matches) {
      exports.push(...matches);
    }
    return exports;
  }

  private findFunctions(content: string): string[] {
    const functions: string[] = [];
    const functionRegex = /(?:function|const|let|var)\s+(\w+)\s*\([^)]*\)/g;
    const matches = content.match(functionRegex);
    if (matches) {
      functions.push(...matches);
    }
    return functions;
  }
}
