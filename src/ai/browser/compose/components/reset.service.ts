import { Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-browser';
import { Injectable } from '@opensumi/di';
import { SCMService } from '@opensumi/ide-scm/lib/common/scm.service';

@Domain()
@Injectable()
export class ResetService {
  @Autowired(SCMService)
  private readonly scmService: SCMService;

  async resetFile(path: string): Promise<void> {
    try {
      const repository = await this.scmService.getDefaultRepository();
      if (repository) {
        await repository.provider.revertFiles([path]);
      }
    } catch (error) {
      console.error('Reset file error:', error);
      throw error;
    }
  }

  async resetChanges(paths: string[]): Promise<void> {
    try {
      const repository = await this.scmService.getDefaultRepository();
      if (repository) {
        await repository.provider.revertFiles(paths);
      }
    } catch (error) {
      console.error('Reset changes error:', error);
      throw error;
    }
  }

  async resetAll(): Promise<void> {
    try {
      const repository = await this.scmService.getDefaultRepository();
      if (repository) {
        const resources = repository.provider.groups
          .flatMap(group => group.resources)
          .map(resource => resource.sourceUri.path.toString());
        await repository.provider.revertFiles(resources);
      }
    } catch (error) {
      console.error('Reset all error:', error);
      throw error;
    }
  }

  async resetBranch(commit: string = 'HEAD'): Promise<void> {
    try {
      const repository = await this.scmService.getDefaultRepository();
      if (repository) {
        await repository.provider.reset(commit);
      }
    } catch (error) {
      console.error('Reset branch error:', error);
      throw error;
    }
  }
}
