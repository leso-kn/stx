import { addAfterEmitEvent, addDataEvent } from '../listeners/emit'

const respectNullOverrides = (branch, id, parent) => {
  if (branch.leaves[parent] === null) {
    branch.leaves[id] = null
    if (branch.persist) {
      branch.persist.store(String(id), null)
    }
    return true
  }
}

const overrideBranches = (branches, id, parent, overrideLeaf = true, overrideKeys = true) => {
  branches.forEach(branch => {
    const leaf = branch.leaves[id]
    let overrideLeafNext = overrideLeaf
    let overrideKeysNext = overrideKeys

    if (leaf === null || respectNullOverrides(branch, id, parent)) {
      return
    }

    if (Object.prototype.hasOwnProperty.call(branch.leaves, id)) {
      if (overrideLeaf) {
        Object.setPrototypeOf(leaf, branch.inherits.leaves[id])
        overrideLeafNext = false
      }

      if (overrideKeys && Object.prototype.hasOwnProperty.call(leaf, 'keys')) {
        Object.setPrototypeOf(leaf.keys, branch.inherits.leaves[id].keys)
        overrideKeysNext = false
      }
    }

    if (branch.branches.length) {
      overrideBranches(branch.branches, id, parent, overrideLeafNext, overrideKeysNext)
    }
  })
}

const addOwnLeaf = (branch, id, parent, key, depth, stamp) => {
  branch.leaves[id] = { parent, key, stamp, depth, keys: {} }

  if (branch.branches.length) {
    overrideBranches(branch.branches, id, parent)
  }

  return branch.leaves[id]
}

const addOverrideLeaf = (branch, id) => {
  const leaf = branch.leaves[id] = Object.create(branch.leaves[id])

  if (branch.branches.length) {
    overrideBranches(branch.branches, id, leaf.parent, true, false)
  }

  return leaf
}

const addOverrideLeafForKeys = (branch, id) => {
  let leaf = branch.leaves[id]
  let overrideLeaf = false

  if (!Object.prototype.hasOwnProperty.call(branch.leaves, id)) {
    leaf = branch.leaves[id] = Object.create(leaf)
    leaf.keys = Object.create(branch.inherits.leaves[id].keys)
    overrideLeaf = true
  } else if (!Object.prototype.hasOwnProperty.call(leaf, 'keys')) {
    leaf.keys = Object.create(branch.inherits.leaves[id].keys)
  } else {
    return leaf
  }

  if (branch.branches.length) {
    overrideBranches(branch.branches, id, leaf.parent, overrideLeaf)
  }

  return leaf
}

const addReferenceFrom = (branch, rF, rT) => {
  if (!branch.rF[rT]) {
    branch.rF[rT] = []
  }
  branch.rF[rT].push(rF)
}

const removeReferenceFrom = (branch, rF, rT) =>
  branch.rF[rT].splice(branch.rF[rT].indexOf(rF), 1)

const fixBranchReferences = (branches, rF, rT, rTold) =>
  branches.forEach(branch => {
    const leaf = branch.leaves[rF]
    if (leaf === null) {
      return
    } else if (!Object.prototype.hasOwnProperty.call(branch.leaves, rF)) {
      if (rTold) {
        removeReferenceFrom(branch, rF, rTold)
      }
      addReferenceFrom(branch, rF, rT)
    } else if (leaf.rT && Object.prototype.hasOwnProperty.call(leaf, 'val')) {
      if (leaf.val === rT) {
        addAfterEmitEvent(() => {
          delete leaf.val
          delete leaf.rT
        })
      }
      return
    } else {
      if (rTold) {
        removeReferenceFrom(branch, rF, rTold)
      }
      addReferenceFrom(branch, rF, rT)
    }

    if (branch.branches.length) {
      fixBranchReferences(branch.branches, rF, rT)
    }
  })

const checkReferenceByLeaf = (branch, rTBranch, rT, cb) => {
  if (
    branch.leaves[rT] !== null &&
    (
      rTBranch === branch ||
      Object.prototype.isPrototypeOf.call(rTBranch.leaves, branch.leaves)
    )
  ) {
    return cb()
  } else {
    throw new Error('Reference must be in same branch')
  }
}

const cleanBranchKeys = (branches, id, keys, stamp) =>
  branches.forEach(branch => {
    const keysNext = keys.slice()
    const leaf = branch.leaves[id]
    if (leaf === null) {
      return
    } else if (
      Object.prototype.hasOwnProperty.call(branch.leaves, id) &&
      Object.prototype.hasOwnProperty.call(leaf, 'keys')
    ) {
      Object.keys(leaf.keys).forEach(key => {
        const index = keysNext.indexOf(key)
        if (~index) {
          delete leaf.keys[key]
          keysNext.splice(index, 1)
        }
      })

      if (keysNext.length) {
        addDataEvent(branch, id, 'add-key')
      }
    } else {
      addDataEvent(branch, id, 'add-key')
    }

    if (branch.branches.length && keysNext.length) {
      cleanBranchKeys(branch.branches, id, keysNext, stamp)
    }
  })

export {
  addOwnLeaf,
  addOverrideLeaf,
  addOverrideLeafForKeys,
  addReferenceFrom,
  removeReferenceFrom,
  checkReferenceByLeaf,
  fixBranchReferences,
  cleanBranchKeys
}
