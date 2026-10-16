import * as tape from 'tape';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {ensureProjectIsTrusted, TRUSTED_PROJECTS_SETTING} from '@creator/react/projectTrust';

const makeUser = (initial) => {
  const config = initial === undefined ? {} : {[TRUSTED_PROJECTS_SETTING]: initial};
  return {
    config,
    getConfig: (key) => Promise.resolve(config[key]),
    setConfig: (key, value) => {
      config[key] = value;
      return Promise.resolve();
    },
  };
};

const makeDialog = (response) => {
  const dialog = (options) => {
    dialog.calls.push(options);
    return Promise.resolve({response});
  };
  dialog.calls = [];
  return dialog;
};

const folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'project-trust-')));

tape('projectTrust: an unknown project asks first and is not opened when cancelled', async (t) => {
  const user = makeUser([]);
  const showMessageBox = makeDialog(1);
  t.equal(await ensureProjectIsTrusted({folder, user, showMessageBox}), false, 'not opened');
  t.equal(showMessageBox.calls.length, 1, 'the user was asked');
  t.equal(showMessageBox.calls[0].type, 'warning', 'as a warning');
  t.deepEqual(user.config[TRUSTED_PROJECTS_SETTING], [], 'nothing is remembered');
  t.end();
});

tape('projectTrust: trusting a project remembers it', async (t) => {
  const user = makeUser([]);
  t.equal(await ensureProjectIsTrusted({folder, user, showMessageBox: makeDialog(0)}), true, 'opened');
  const showMessageBox = makeDialog(1);
  t.equal(await ensureProjectIsTrusted({folder, user, showMessageBox}), true, 'opens again');
  t.equal(showMessageBox.calls.length, 0, 'without asking again');
  t.end();
});

tape('projectTrust: projects created here are trusted without asking', async (t) => {
  const user = makeUser([]);
  const showMessageBox = makeDialog(1);
  t.equal(await ensureProjectIsTrusted({folder, isNew: true, user, showMessageBox}), true, 'opened');
  t.equal(showMessageBox.calls.length, 0, 'not asked');
  t.deepEqual(user.config[TRUSTED_PROJECTS_SETTING], [folder], 'remembered');
  t.end();
});

tape('projectTrust: recent projects become trusted on first use', async (t) => {
  const user = makeUser(undefined);
  const showMessageBox = makeDialog(1);
  t.equal(await ensureProjectIsTrusted({folder, user, recentProjects: [folder], showMessageBox}), true, 'opened');
  t.equal(showMessageBox.calls.length, 0, 'not asked');
  t.end();
});

tape('projectTrust: without a settings store the user is asked every time', async (t) => {
  const showMessageBox = makeDialog(0);
  t.equal(await ensureProjectIsTrusted({folder, showMessageBox}), true, 'opened after confirming');
  t.equal(await ensureProjectIsTrusted({folder, showMessageBox}), true, 'opened after confirming again');
  t.equal(showMessageBox.calls.length, 2, 'asked both times');
  fs.rmdirSync(folder);
  t.end();
});
