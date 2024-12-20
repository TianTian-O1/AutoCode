import { Autowired } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-browser';
import { Injectable } from '@opensumi/di';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/browser';
import { URI } from '@opensumi/ide-core-common';
import { IFileServiceClient as FileServiceToken } from '@opensumi/ide-core-common';

@Domain()
@Injectable()
export class CreateService {
  @Autowired(FileServiceToken)
  private readonly fileService: IFileServiceClient;

  async createFile(path: string, content: string): Promise<boolean> {
    try {
      const uri = new URI(path);
      await this.fileService.createFile(uri, content);
      return true;
    } catch (error) {
      console.error('Create file error:', error);
      return false;
    }
  }

  async createDirectory(path: string): Promise<boolean> {
    try {
      const uri = new URI(path);
      await this.fileService.createFolder(uri);
      return true;
    } catch (error) {
      console.error('Create directory error:', error);
      return false;
    }
  }
}
