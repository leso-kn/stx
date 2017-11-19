import { root } from './id'
import { defineApi, set } from './api/index'

const respectOverrides = (branches, id, parent) => {
  branches.forEach(branch => {
    if (branch.leaves[parent] === null) {
      branch.leaves[id] = null
    }
    if (branch.branches.length) {
      respectOverrides(branch.branches, id, parent)
    }
  })
}

const Leaf = function (branch, id, val, stamp, parent, key, isSubLeaf) {
  this.id = id
  this.struct = branch
  this.branch = branch
  if (parent) {
    this.p = parent
  }
  if (key) {
    this.key = key
  }
  if (val !== void 0) {
    set(branch, this, val, stamp, isSubLeaf)
  }
  if (branch.branches.length) {
    respectOverrides(branch.branches, id, parent)
  }
}

const Struct = function (val, stamp, inherits) {
  this.leaves = {}
  this.branches = []
  if (inherits) {
    this.inherits = inherits
    this.inherits.branches.push(this)
  }
  this.leaves[root] = new Leaf(this, root, val, stamp)
  this.leaves[root].branch = this
}

defineApi(Leaf.prototype, Struct.prototype)

export { Leaf, Struct }
