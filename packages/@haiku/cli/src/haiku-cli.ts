import {client} from '@haiku/sdk-client';
import {
  DEFAULT_BRANCH_NAME,
  fetchProjectConfigInfo,
  getHaikuComponentInitialVersion,
  storeConfigValues,
} from '@haiku/sdk-client/lib/ProjectDefinitions';

import {bootstrapSceneFilesSync} from '@haiku/sdk-client/lib/bootstrapSceneFilesSync';
import {createProjectFiles} from '@haiku/sdk-client/lib/createProjectFiles';

import * as path from 'path';

import {IContext, Nib} from './nib';

const pkg = require('./../package.json');

const cli = new Nib({
  name: 'motion-side',
  version: pkg.version,
  description: 'The motion-side CLI — create animation component projects without the desktop app.',
  preAction (context: IContext) {
    client.config.getenv();
  },
  commands: [
    {
      name: 'generate',
      aliases: ['g'],
      args: [
        {
          name: 'component-name',
          required: true,
          usage: 'Specifies the name of new component to be generated.  Case-sensitive and must be unique.',
        },
      ],
      action: generateComponent,
      description: 'Generate new component',
    },
  ],
});

export {cli};

function generateComponent (context: IContext) {
  const componentName = context.args['component-name'];

  context.writeLine('Creating component...');

  const projectPath = path.join(process.cwd(), componentName);
  const projectName = componentName;

  const authorName: string = null;
  const organizationName: string = null;

  storeConfigValues(projectPath, {
    username: authorName,
    branch: DEFAULT_BRANCH_NAME,
    version: getHaikuComponentInitialVersion(),
    organization: organizationName,
    project: projectName,
  });

  const projectOptions = {
    organizationName,
    projectName,
    projectPath,
    authorName,
    skipContentCreation: false,
  };

  createProjectFiles(projectOptions, () => {
    context.writeLine('Created initial project files');
    fetchProjectConfigInfo(projectPath, (err: Error|null, userconfig: any) => {
      if (err) {
        throw err;
      }
      bootstrapSceneFilesSync(projectPath, 'main', userconfig);
      context.writeLine('Created main component');
      context.writeLine('Project created');
      process.exit(0);
    });
  });
}
