// @ts-ignore
import {Figma} from 'haiku-serialization/src/bll/Figma';
import {ImportSpec, MaybeAsync} from '.';

export interface Services {
  figmaImportSVG(importSpec: ImportSpec, authToken: string): MaybeAsync<void>;
}

export class ServicesHandler implements Services {

  figmaImportSVG (importSpec: ImportSpec, authToken: string) {
    const figma = new Figma({token: authToken});
    return figma.importSVG(importSpec);
  }
}
