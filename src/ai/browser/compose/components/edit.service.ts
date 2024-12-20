import { Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-browser';
import { FileServicePath, IFileService } from '@opensumi/ide-file-service';
import { URI } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { Injectable } from '@opensumi/di';

@Domain()
@Injectable()
export class EditService {
  @Autowired(FileServicePath)
  private readonly fileService: IFileService;

  async editFile(path: string, content: string, editor?: ICodeEditor): Promise<boolean> {
    try {
      const uri = new URI(path);
      const exists = await this.fileService.access(uri);
      
      if (!exists) {
        throw new Error('File does not exist');
      }

      if (editor && editor.getModel()?.uri.toString() === uri.toString()) {
        // If file is open in editor, update through editor
        const model = editor.getModel();
        const fullRange = model!.getFullModelRange();
        editor.executeEdits('ai-compose', [{
          range: fullRange,
          text: content
        }]);
      } else {
        // Otherwise update file directly
        await this.fileService.write(uri, content);
      }
      
      return true;
    } catch (error) {
      console.error('Edit file error:', error);
      return false;
    }
  }

  async applyEdits(path: string, edits: { range: [number, number, number, number], text: string }[]): Promise<boolean> {
    try {
      const uri = new URI(path);
      const content = await this.fileService.readFile(uri);
      const lines = content.toString().split('\n');
      
      // Apply edits in reverse order to maintain line numbers
      edits.sort((a, b) => b.range[0] - a.range[0]);
      
      for (const edit of edits) {
        const [startLine, startCol, endLine, endCol] = edit.range;
        const before = lines.slice(0, startLine).join('\n');
        const after = lines.slice(endLine + 1).join('\n');
        const edited = edit.text;
        
        lines.splice(startLine, endLine - startLine + 1, edited);
      }
      
      await this.fileService.write(uri, lines.join('\n'));
      return true;
    } catch (error) {
      console.error('Apply edits error:', error);
      return false;
    }
  }
}
