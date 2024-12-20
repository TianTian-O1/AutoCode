import { BrowserModule } from '@opensumi/ide-core-browser';
import { Injectable, Provider } from '@opensumi/di';

import { AINativeContribution } from './ai-native.contribution'
import { AIRunContribution } from './ai-run.contribution'
import { AICommandPromptManager } from './command/command-prompt-manager'
import { AICommandService } from './command/command.service'
import { InlineChatOperationModel } from './inline-chat-operation'
import { AIModelContribution } from './ai-model.contribution'
import { AIModelServicePath } from '../common'
import { ComposeModule, ComposeService } from './compose'

export * from './constants'

const providers: Provider[] = [
  AINativeContribution,
  AIRunContribution,
  AICommandPromptManager,
  AICommandService,
  InlineChatOperationModel,
  AIModelContribution,
  ComposeService,
];

@Injectable()
export class AIFeatureModule extends BrowserModule {
  providers = providers;

  backServices = [
    {
      servicePath: AIModelServicePath,
    }
  ];

  contribution = {
    'ai-native': providers
  };

  imports = [
    ComposeModule
  ];
}
