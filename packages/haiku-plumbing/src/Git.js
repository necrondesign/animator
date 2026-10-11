/* tslint:disable:no-shadowed-variable only-arrow-functions ter-prefer-arrow-callback max-line-length no-parameter-reassignment */
// Local git operations for project folders, implemented with isomorphic-git (pure JS, no native build).
// Remote synchronization (clone/fetch/push/merge) belonged to Haiku's cloud and is not supported.
import * as git from 'isomorphic-git';
import * as nodeFs from 'fs';
import * as path from 'path';
import * as fs from 'haiku-fs-extra';
import * as async from 'async';
import * as logger from 'haiku-serialization/src/utils/LoggerInstance';

const DEFAULT_BRANCH_NAME = 'master';
const DEFAULT_COMMITTER_NAME = 'Animator';
const DEFAULT_COMMITTER_EMAIL = 'animator@localhost';
const DEFAULT_GIT_COMMIT_MESSAGE = 'Edited project with Animator';

// Mirrors libgit2's git_delta_t values, which callers and logs historically relied on.
export const DELTA = {
  UNMODIFIED: 0,
  ADDED: 1,
  DELETED: 2,
  MODIFIED: 3,
  RENAMED: 4,
  COPIED: 5,
  IGNORED: 6,
  UNTRACKED: 7,
  TYPECHANGE: 8,
  UNREADABLE: 9,
  CONFLICTED: 10,
};

const remoteUnsupported = (operation) =>
  new Error(`[git] ${operation}: remote synchronization is not supported`);

const callbackify = (promise, cb) => {
  promise.then((out) => cb(null, out), (err) => cb(err));
};

const repoArgs = (pwd) => ({fs: nodeFs, dir: pwd});

const isRepository = (pwd) => fs.existsSync(path.join(pwd, '.git'));

// In-process mutex so concurrent status/add calls don't race on the index
const LOCKED_INDEXES = {};
const INDEX_LOCK_INTERVAL = 0;

function _gimmeIndex (pwd, cb) {
  if (!LOCKED_INDEXES[pwd]) {
    LOCKED_INDEXES[pwd] = true;
    // eslint-disable-next-line
    return cb(() => {
      LOCKED_INDEXES[pwd] = false;
    });
  }
  return setTimeout(() => {
    return _gimmeIndex(pwd, cb);
  }, INDEX_LOCK_INTERVAL);
}

function withIndex (pwd, work, cb) {
  return _gimmeIndex(pwd, (freeIndex) => {
    return callbackify(work(), (err, out) => {
      freeIndex();
      return cb(err, out);
    });
  });
}

/**
 * Returns a lightweight repository handle ({dir}) or an error if pwd is not a git repository.
 */
export function open (pwd, cb) {
  if (!isRepository(pwd)) {
    return cb(new Error(`could not find repository at '${pwd}'`));
  }
  return cb(null, {dir: pwd});
}

export function forceOpen (pwd, cb) {
  return open(pwd, cb);
}

export function init (pwd, cb) {
  return callbackify(
    git.init({...repoArgs(pwd), defaultBranch: DEFAULT_BRANCH_NAME}).then(() => ({dir: pwd})),
    cb,
  );
}

export function maybeInit (pwd, cb) {
  if (isRepository(pwd)) {
    return cb(null, {dir: pwd}, true); // <~ true == wasAlreadyInitialized
  }
  return init(pwd, cb);
}

/**
 * Translates an isomorphic-git status matrix row ([filepath, head, workdir, stage]) into a libgit2-style delta,
 * or null if the file is unchanged relative to both HEAD and the index.
 */
function rowToDelta ([, head, workdir, stage]) {
  if (head === 1 && workdir === 1 && stage === 1) {
    return null;
  }
  if (head === 0) {
    if (workdir === 0) {
      return stage === 0 ? null : DELTA.DELETED;
    }
    return stage === 0 ? DELTA.UNTRACKED : DELTA.ADDED;
  }
  if (workdir === 0) {
    return DELTA.DELETED;
  }
  return DELTA.MODIFIED;
}

async function _statusMatrix (pwd, relpath) {
  const args = repoArgs(pwd);
  if (relpath) {
    args.filepaths = [relpath];
  }
  return git.statusMatrix(args);
}

/**
 * Returns {[path]: {path, prev, num}} for every changed or untracked (non-ignored) file.
 */
export function status (pwd, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  return withIndex(pwd, async () => {
    const changes = {};
    const matrix = await _statusMatrix(pwd, opts && opts.relpath);
    matrix.forEach((row, index) => {
      const num = rowToDelta(row);
      if (num === null) {
        return;
      }
      const statusPath = row[0];
      changes[statusPath] = {
        delta: index,
        prev: statusPath,
        path: statusPath,
        num,
      };
    });
    return changes;
  }, cb);
}

// Stages working-tree state for the given status matrix rows: deletions are removed from the index, and files whose
// index entry differs from the working tree are added. (workdir: 0 absent, 1 same as HEAD, 2 differs from HEAD;
// stage: 0 absent, 1 same as HEAD, 2 same as workdir, 3 differs from both.)
async function _stageMatrixRows (pwd, rows) {
  for (const [filepath, head, workdir, stage] of rows) {
    if (workdir === 0) {
      if (head !== 0 || stage !== 0) {
        await git.remove({...repoArgs(pwd), filepath});
      }
    } else if (!((workdir === 1 && stage === 1) || (workdir === 2 && stage === 2))) {
      await git.add({...repoArgs(pwd), filepath});
    }
  }
}

export function addPathsToIndex (pwd, relpaths = [], cb) {
  if (relpaths.length < 1) {
    return cb(new Error('Empty paths list given'));
  }
  return withIndex(pwd, async () => {
    const matrix = await git.statusMatrix({...repoArgs(pwd), filepaths: relpaths});
    await _stageMatrixRows(pwd, matrix);
  }, cb);
}

export function addAllPathsToIndex (pwd, cb) {
  return withIndex(pwd, async () => {
    const matrix = await git.statusMatrix(repoArgs(pwd));
    await _stageMatrixRows(pwd, matrix);
  }, cb);
}

// Removes a stale index lock left behind by a crashed process.
export function destroyIndexLockSync (pwd) {
  const lockPath = path.join(pwd, '.git', 'index.lock');
  delete LOCKED_INDEXES[pwd]; // Remove the in-memory mutex too in case one is hanging around
  try {
    if (fs.existsSync(lockPath)) {
      fs.removeSync(lockPath);
    }
  } catch (exception) {
    logger.info('[git]', exception);
  }
}

/**
 * Resolves a ref name (e.g. 'HEAD', 'refs/heads/master', a tag) to a commit SHA string.
 */
export function referenceNameToId (pwd, name, cb) {
  return callbackify(git.resolveRef({...repoArgs(pwd), ref: name}), (err, oid) => {
    if (err) {
      logger.info('[git]', err.message);
      return cb(err);
    }
    return cb(null, oid);
  });
}

export function createSignature (name, email) {
  return {
    name,
    email,
    timestamp: Math.floor(Date.now() / 1000),
    timezoneOffset: 0,
  };
}

/**
 * Creates a commit from the current index. When updateRef is falsy the branch pointer is not moved.
 */
export function buildCommit (pwd, username, email, message, oid, updateRef, parentRef, cb) {
  const author = createSignature(username || DEFAULT_COMMITTER_NAME, email || DEFAULT_COMMITTER_EMAIL);
  const committer = createSignature(DEFAULT_COMMITTER_NAME, DEFAULT_COMMITTER_EMAIL);

  return callbackify((async () => {
    const parent = parentRef ? [await git.resolveRef({...repoArgs(pwd), ref: parentRef})] : [];
    const commitArgs = {...repoArgs(pwd), message, author, committer, parent};
    if (oid) {
      commitArgs.tree = oid;
    }
    if (!updateRef) {
      commitArgs.noUpdateBranch = true;
    }
    return git.commit(commitArgs);
  })(), cb);
}

export function getCurrentBranchName (pwd, cb) {
  return callbackify(git.currentBranch({...repoArgs(pwd), fullname: true}), (err, full) => {
    if (err) {
      return cb(err);
    }
    if (!full) {
      return cb(new Error('Head reference is not a branch'));
    }
    return cb(null, full.replace('refs/heads/', ''), full);
  });
}

export function createBranch (pwd, branchName, commitId, cb) {
  return callbackify(
    git.branch({...repoArgs(pwd), ref: branchName, object: commitId && commitId.toString(), checkout: false}),
    cb,
  );
}

export function getCurrentCommit (pwd, cb) {
  return referenceNameToId(pwd, 'HEAD', cb);
}

/**
 * Moves the current branch to the given commit and resets the working tree to it.
 */
export function hardResetFromSHA (pwd, sha, cb) {
  return callbackify((async () => {
    const branch = await git.currentBranch({...repoArgs(pwd), fullname: true});
    if (branch) {
      await git.writeRef({...repoArgs(pwd), ref: branch, value: sha.toString(), force: true});
      await git.checkout({...repoArgs(pwd), ref: branch.replace('refs/heads/', ''), force: true});
    } else {
      await git.checkout({...repoArgs(pwd), ref: sha.toString(), force: true});
    }
  })(), cb);
}

export function hardReset (pwd, targetRef, cb) {
  return referenceNameToId(pwd, targetRef, (err, sha) => {
    if (err) {
      return cb(err);
    }
    return hardResetFromSHA(pwd, sha, (err) => {
      if (err) {
        return cb(err);
      }
      return cb(null, {dir: pwd}, sha);
    });
  });
}

export function removeUntrackedFiles (pwd, cb) {
  return status(pwd, {}, (err, statusesDict) => {
    if (err) {
      return cb(err);
    }
    const untracked = Object.values(statusesDict).filter(({num}) => num === DELTA.UNTRACKED);
    return async.each(untracked, (statusItem, next) => {
      return fs.remove(path.join(pwd, statusItem.path), next);
    }, cb);
  });
}

export function cleanAllChanges (pwd, cb) {
  return hardReset(pwd, 'HEAD', (err) => {
    if (err) {
      return cb(err);
    }
    return removeUntrackedFiles(pwd, cb);
  });
}

export function upsertRemoteDirectly (pwd, name, url, cb) {
  return callbackify(git.addRemote({...repoArgs(pwd), remote: name, url, force: true}).then(() => name), cb);
}

export function listRemotes (pwd, cb) {
  if (!isRepository(pwd)) {
    return cb(new Error(`could not find repository at '${pwd}'`));
  }
  return callbackify(git.listRemotes(repoArgs(pwd)).then((remotes) => remotes.map(({remote}) => remote)), cb);
}

export function doesRemoteExist (pwd, remoteName, cb) {
  return listRemotes(pwd, (err, remotes) => {
    if (err) {
      return cb(err);
    }
    return cb(null, remotes.indexOf(remoteName) !== -1);
  });
}

export function lookupRemote (pwd, remoteName, cb) {
  return cb(remoteUnsupported('lookupRemote'));
}

export function cloneRepoDirectly (gitRemoteUrl, abspath, cb) {
  return cb(remoteUnsupported('clone'));
}

export function pushToRemoteDirectly (pwd, remoteName, fullBranchName, doForcePush, cb) {
  return cb(remoteUnsupported('push'));
}

export function fetchFromRemoteDirectly (pwd, remoteName, cb) {
  return cb(remoteUnsupported('fetch'));
}

export function fetchProjectDirectly (folder, projectName, repositoryUrl, cb) {
  return cb(remoteUnsupported('fetch'));
}

export function pushProjectDirectly (folder, projectName, cb) {
  return cb(remoteUnsupported('push'));
}

export function pushTagToRemoteDirectly (pwd, remoteName, tagName, cb) {
  return cb(remoteUnsupported('push tag'));
}

export function mergeProject (folder, projectName, partialBranchName, saveOptions = {}, cb) {
  return cb(remoteUnsupported('merge'));
}

export function createTag (pwd, tagNameProbablySemver, commitId, tagMessage, cb) {
  return callbackify(git.annotatedTag({
    ...repoArgs(pwd),
    ref: tagNameProbablySemver,
    object: commitId.toString(),
    message: tagMessage,
    tagger: createSignature(DEFAULT_COMMITTER_NAME, DEFAULT_COMMITTER_EMAIL),
  }), (err) => {
    if (err) {
      if (err.code === 'AlreadyExistsError') {
        return cb(new Error(`Tag already exists: ${tagNameProbablySemver}`));
      }
      return cb(err);
    }
    return cb(null, tagNameProbablySemver);
  });
}

export function listTags (pwd, cb) {
  return callbackify(git.listTags(repoArgs(pwd)), cb);
}

/**
 * @function commitProject
 * @param folder {String}
 * @param username {String|Null}
 * @param useHeadAsParent {Boolean}
 * @param saveOptions {Object}
 * @param pathsToAdd {String|Array} - '.' to add all paths, [path, path] to add individual paths
 */
export function commitProject (folder, username, useHeadAsParent, saveOptions = {}, pathsToAdd, cb) {
  function pathAdder (done) {
    if (pathsToAdd === '.') {
      logger.info(`[git] adding all paths to index`);
      return addAllPathsToIndex(folder, done);
    }

    if (typeof pathsToAdd === 'string') {
      logger.info(`[git] adding path ${pathsToAdd} to index`);
      return addPathsToIndex(folder, [pathsToAdd], done);
    }

    if (Array.isArray(pathsToAdd) && pathsToAdd.length > 0) {
      logger.info(`[git] adding paths ${pathsToAdd.join(', ')} to index`);
      return addPathsToIndex(folder, pathsToAdd, done);
    }

    logger.info(`[git] no path given`);
    return done();
  }

  return pathAdder((err) => {
    if (err) {
      return cb(err);
    }

    const message = (saveOptions && saveOptions.commitMessage) || DEFAULT_GIT_COMMIT_MESSAGE;
    const parentRef = (useHeadAsParent) ? 'HEAD' : null; // Initial commit has no parent
    const updateRef = 'HEAD';

    logger.info(`[git] committing ${JSON.stringify(message)} in ${folder} [${updateRef} onto ${parentRef}] ...`);

    return buildCommit(folder, username, null, message, null, updateRef, parentRef, (err, commitId) => {
      if (err) {
        return cb(err);
      }

      logger.info(`[git] commit done (${commitId})`);

      return cb(null, commitId);
    });
  });
}

export function getReference (folder, name, cb) {
  return referenceNameToId(folder, name, (err, oid) => {
    if (err) {
      return cb(null, false);
    }
    return cb(null, {name, oid});
  });
}

export function getRemoteBranchRefName (projectName, partialBranchName) {
  return `remotes/${projectName}/${partialBranchName}`;
}

export function logStatuses (statuses) {
  for (const key in statuses) {
    const status = statuses[key];
    logger.info('[git] git status:' + status.path + ' ' + statusToText(status));
  }
}

export function statusToText (status) {
  for (const word in DELTA) {
    if (DELTA[word] === status.num) {
      return word;
    }
  }
  return '';
}

export function saveStrategyToFileFavorName (saveStrategy) {
  if (!saveStrategy || !saveStrategy.strategy || saveStrategy.strategy === 'recursive') {
    return 'normal';
  }
  if (saveStrategy.strategy === 'ours' || saveStrategy.strategy === 'theirs') {
    return saveStrategy.strategy;
  }
  return 'normal';
}
