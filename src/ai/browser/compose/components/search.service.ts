import { Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-browser';
import { FileServicePath, IFileService } from '@opensumi/ide-file-service';
import { URI } from '@opensumi/ide-core-common';
import { Injectable } from '@opensumi/di';

@Domain()
@Injectable()
export class SearchService {
  @Autowired(FileServicePath)
  private readonly fileService: IFileService;

  async searchFiles(pattern: string, directory: string): Promise<string[]> {
    try {
      const uri = new URI(directory);
      const files = await this.fileService.find(uri, {
        pattern,
        excludes: ['**/node_modules/**', '**/.git/**']
      });
      return files.map(f => f.uri.toString());
    } catch (error) {
      console.error('Search files error:', error);
      return [];
    }
  }

  async searchContent(pattern: string, directory: string): Promise<Array<{
    file: string;
    matches: Array<{
      line: number;
      content: string;
    }>;
  }>> {
    try {
      const uri = new URI(directory);
      const files = await this.fileService.find(uri, {
        pattern: '*',
        excludes: ['**/node_modules/**', '**/.git/**']
      });

      const results = [];
      for (const file of files) {
        const content = await this.fileService.readFile(file.uri);
        const lines = content.toString().split('\n');
        const matches = [];

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(pattern)) {
            matches.push({
              line: i + 1,
              content: lines[i].trim()
            });
          }
        }

        if (matches.length > 0) {
          results.push({
            file: file.uri.toString(),
            matches
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Search content error:', error);
      return [];
    }
  }
}
