import { getFromLeaves } from './get'
import { Leaf } from '../index'

const getValOrRef = (branch, id) => {
  const oBranch = branch
  while (branch) {
    let leaf = branch.leaves[id]
    if (leaf) {
      if (leaf.val !== void 0) {
        return leaf.val
      } else if (leaf.rT) {
        return getFromLeaves(oBranch, leaf.rT)
      }
    }
    branch = branch.inherits
  }
}

const origin = (branch, leaf) => getFromLeaves(branch, leaf.rT) || leaf

const compute = (branch, id) => {
  const oBranch = branch
  while (branch) {
    const leaf = branch.leaves[id]
    if (leaf) {
      if (leaf.val !== void 0) {
        return leaf.val
      } else if (leaf.rT) {
        const val = compute(oBranch, leaf.rT)
        if (val !== void 0) {
          return val
        }
      }
    }
    branch = branch.inherits
  }
}

export { getValOrRef, compute, origin }
