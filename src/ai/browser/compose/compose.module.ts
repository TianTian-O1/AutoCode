import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { IFileServiceClient, FileServiceClient } from '@opensumi/ide-file-service/lib/browser';
import { IFileServiceClient as FileServiceToken } from '@opensumi/ide-core-common';
import { SCMService } from '@opensumi/ide-scm/lib/common/scm.service';

import { ComposeService } from './compose.service';
import { CreateService } from './components/create.service';
import { EditService } from './components/edit.service';
import { AnalysisService } from './components/analysis.service';
import { SearchService } from './components/search.service';
import { RunService } from './components/run.service';
import { ResetService } from './components/reset.service';

export * from './compose.service';
export * from './components/create.service';
export * from './components/edit.service';
export * from './components/analysis.service';
export * from './components/search.service';
export * from './components/run.service';
export * from './components/reset.service';

const providers = [
  ComposeService,
  CreateService,
  EditService,
  AnalysisService,
  SearchService,
  RunService,
  ResetService,
  {
    token: FileServiceToken,
    useClass: FileServiceClient
  },
  {
    token: SCMService,
    useClass: SCMService
  }
];

@Injectable()
export class ComposeModule extends BrowserModule {
  providers = providers;

  contribution = {
    'ai-native': providers
  };
}
