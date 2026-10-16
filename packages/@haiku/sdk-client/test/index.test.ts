import {client, FILE_PATHS} from '@sdk-client/index';
import {FALLBACK_NPM_PACKAGE_NAME, getNpmPackageName} from '@sdk-client/ProjectDefinitions';
import * as fs from 'fs';
import {stubProperties} from 'haiku-testing/lib/mock';
import * as tape from 'tape';

tape('index', (suite: tape.Test) => {
  suite.test('dotenv.getenv', (test: tape.Test) => {
    const [mockExistsSync, mockReadFileSync, unstubFs] = stubProperties(fs, 'existsSync', 'readFileSync');

    mockExistsSync.returns(false);
    test.deepEqual(client.config.getenv(), {}, 'default is empty object');

    mockExistsSync.reset();
    mockExistsSync.returns(true);
    mockReadFileSync.returns('FOO=bar');
    test.deepEqual(client.config.getenv(), {FOO: 'bar'}, '.env is parsed');
    test.deepEqual(global.process.env.FOO, 'bar', '.env is applied to global.process.env');

    mockExistsSync.reset();
    mockReadFileSync.reset();
    mockExistsSync.returns(true);
    mockReadFileSync.returns('HAIKU_API=https://foo.bar/');
    test.deepEqual(client.config.getenv(), {HAIKU_API: 'https://foo.bar/'}, '.env is parsed');
    test.deepEqual(global.process.env.HAIKU_API, 'https://foo.bar/', '.env is applied to global.process.env');

    delete global.process.env.FOO;
    delete global.process.env.HAIKU_API;
    unstubFs();
    test.end();
  });

  suite.test('dotenv.setenv', (test: tape.Test) => {
    const [mockExistsSync, mockReadFileSync, mockWriteFileSync, unstubFs] = stubProperties(
      fs,
      'existsSync',
      'readFileSync',
      'writeFileSync',
    );

    mockExistsSync.returns(true);
    mockReadFileSync.returns('FOO=bar');
    test.deepEqual(
      client.config.setenv({HAIKU_API: 'https://foo.bar/'}),
      {FOO: 'bar', HAIKU_API: 'https://foo.bar/'},
      'config was merged correctly',
    );
    test.true(
      mockWriteFileSync.calledWith(FILE_PATHS.DOTENV, 'FOO="bar"\nHAIKU_API="https://foo.bar/"\n'),
      'config was written out in wire format',
    );

    delete global.process.env.FOO;
    delete global.process.env.HAIKU_API;
    unstubFs();
    test.end();
  });

  suite.end();
});

tape('getNpmPackageName', (test: tape.Test) => {
  test.equal(getNpmPackageName('My Card'), 'my-card', 'lowercase, spaces become dashes');
  test.equal(getNpmPackageName('Hero_Banner v2'), 'hero_banner-v2', 'keeps underscores inside the name');
  test.equal(getNpmPackageName('_hidden.'), 'hidden', 'no leading underscore or trailing dot');
  test.equal(getNpmPackageName('Анимация'), FALLBACK_NPM_PACKAGE_NAME, 'falls back when nothing is left');
  test.equal(getNpmPackageName(undefined), FALLBACK_NPM_PACKAGE_NAME, 'falls back without a name');
  test.ok(getNpmPackageName('x'.repeat(300)).length <= 214, 'at most 214 characters');
  test.end();
});
