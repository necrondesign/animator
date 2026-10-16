/**
 * Copyright (c) Haiku 2016-2018. All rights reserved.
 */

import seedrandom from '../vendor/seedrandom';

export default function PRNG (seed) {
  this._prng = seedrandom(seed, null, null);
}

PRNG.prototype.random = function random () {
  return this._prng();
};
