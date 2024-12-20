import { Autowired, Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-browser';
import { ITerminalService } from '@opensumi/ide-terminal-next/lib/common/service';

@Domain()
@Injectable()
export class RunService {
  @Autowired(ITerminalService)
  private readonly terminalService: ITerminalService;

  async executeCommand(command: string): Promise<void> {
    try {
      const terminal = await this.terminalService.createTerminal({
        name: 'AI Compose'
      });
      
      await terminal.sendText(command);
      await terminal.show();
    } catch (error) {
      console.error('Execute command error:', error);
      throw error;
    }
  }

  async runScript(scriptPath: string, args: string[] = []): Promise<void> {
    try {
      const command = `node ${scriptPath} ${args.join(' ')}`;
      await this.executeCommand(command);
    } catch (error) {
      console.error('Run script error:', error);
      throw error;
    }
  }
}
