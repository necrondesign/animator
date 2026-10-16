import * as tape from 'tape';
import * as async from 'async';
import * as fse from 'haiku-fs-extra';
import * as path from 'path';
import TestHelpers from '../TestHelpers';

tape('ProjectFolder: package name, README and LICENSE belong to the project', (test) => {
  test.plan(6);
  TestHelpers.setup(function (folder, creator, glass, timeline, teardown) {
    const project = {
      projectPath: folder,
      authorName: 'test-author',
      projectName: 'My Card',
      projectExistsLocally: true,
      repositoryUrl: '',
      branchName: 'master',
    };

    fse.writeFileSync(path.join(folder, 'Hello.svg'), '<svg><rect x="0" y="0" stroke="1" fill="black"></rect></svg>');
    return async.series([
      function (cb) {
        return creator.request('bootstrapProject', [project], cb);
      },

      function (cb) {
        const pkg = fse.readJsonSync(path.join(folder, 'package.json'));
        test.equal(pkg.name, 'my-card', 'a new project is named after its folder');
        test.ok(
          fse.readFileSync(path.join(folder, 'LICENSE.txt'), 'utf8').includes('the project authors'),
          'the default LICENSE does not name anyone else as copyright holder',
        );

        // The user renames the package and edits README and LICENSE.
        pkg.name = 'my-own-name';
        fse.writeJsonSync(path.join(folder, 'package.json'), pkg, {spaces: 2});
        fse.writeFileSync(path.join(folder, 'README.md'), '# Mine');
        fse.writeFileSync(path.join(folder, 'LICENSE.txt'), 'MIT');
        return cb();
      },

      // Re-run the same initialization step, as when the project is opened again
      function (cb) {
        return creator.request('bootstrapProject', [project], cb);
      },

      function (cb) {
        const pkg = fse.readJsonSync(path.join(folder, 'package.json'));
        test.equal(pkg.name, 'my-own-name', 'an existing package name is kept');
        test.equal(fse.readFileSync(path.join(folder, 'README.md'), 'utf8'), '# Mine', 'README is kept');
        test.equal(fse.readFileSync(path.join(folder, 'LICENSE.txt'), 'utf8'), 'MIT', 'LICENSE is kept');
        return cb();
      },
    ], (err) => {
      test.error(err, 'no error');
      teardown();
    });
  });
});
