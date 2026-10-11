import EnvoyHandler from '@sdk-creator/envoy/EnvoyHandler';

export default class CatHandler extends EnvoyHandler {
  meow (source: string, num: number): number {
    this.server.emit('cat', {
      name: 'meowed',
      payload: {
        source,
        num,
      },
    });
    return num;
  }
}
