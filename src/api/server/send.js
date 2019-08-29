import { getString } from '../../cache'
import { createStamp } from '../../stamp'
import maxSize from './max-size'
import {
  cache,
  isCachedForStamp,
  isCached,
  cacheString,
  isStringCached
} from './cache'

const sendToSocket = (socket, payload, next) => {
  socket.send(payload)
  setImmediate(next)
}

const sendLarge = (socket, raw, size) => {
  const count = size / maxSize
  if ((count | 0) === count) {
    raw += ' '
  }

  if (!socket.blobInProgress) {
    socket.blobInProgress = []
  }

  console.log('📡 exceeds frame limit - split up', (size / (1024 * 1024)) | 0, 'MB')
  const buf = Buffer.from(raw, 'utf8')
  let i = 0

  const drainInProgress = done => {
    if (socket.blobInProgress.length > 0) {
      sendToSocket(socket, socket.blobInProgress.shift(), () => drainInProgress(done))
    } else {
      done()
    }
  }

  const next = () => {
    i++
    if (i * maxSize <= size) {
      sendToSocket(socket, buf.slice(i * maxSize, (i + 1) * maxSize), next)
    } else {
      drainInProgress(() => {
        socket.blobInProgress = null
      })
    }
  }

  sendToSocket(socket, buf.slice(i * maxSize, (i + 1) * maxSize), next)
}

const send = (socket, raw) => {
  const size = Buffer.byteLength(raw, 'utf8')
  if (size > maxSize) {
    sendLarge(socket, raw, size)
  } else if (socket.blobInProgress) {
    socket.blobInProgress.push(raw)
  } else {
    socket.send(raw)
  }
}

const sendData = (socket, branch, data) => {
  if (
    socket.external &&
    (
      Object.keys(data.leaves).length ||
      Object.keys(data.strings).length
    )
  ) {
    const json = { t: createStamp(branch.stamp), l: data.leaves, s: data.strings }
    if (Object.keys(socket.cleanLeaves).length) {
      json.c = socket.cleanLeaves
      socket.cleanLeaves = {}
    }
    if (Object.keys(socket.removeLeaves).length) {
      json.r = socket.removeLeaves
      socket.removeLeaves = {}
    }
    send(socket, JSON.stringify(json))
  }
}

const sendLeaves = (socket, master, leaf, options, dataOverride) => {
  const { branch, id } = leaf
  if (branch.leaves[id] === null) {
    return
  }

  let { keys, excludeKeys, depth, limit } = options

  const depthLimit = depth || Infinity
  const data = dataOverride || { leaves: {}, strings: {} }

  serializeParents(data, socket, master, branch, id)

  keys = keys ? keys.filter(
    key => serializeWithAllChildren(data, socket, master, branch, key, depthLimit, 1)
  ) : serializeAllChildren(data, socket, master, branch, id, depthLimit, 0, excludeKeys, limit)

  serializeLeaf(data, socket, master, branch, id, keys, depthLimit, 0)

  if (!dataOverride) {
    sendData(socket, branch, data)
  }
}

const serializeAllChildren = (
  data, socket, master, branch, id, depthLimit, depth, excludeKeys, limit = Infinity
) => {
  const keys = []

  for (const leafId in branch.leaves[id].keys) {
    if (branch.leaves[leafId] === null) {
      continue
    }

    if (excludeKeys && excludeKeys.includes(Number(leafId))) {
      continue
    }

    keys.push(leafId)
    serializeWithAllChildren(data, socket, master, branch, leafId, depthLimit, depth + 1)

    if (!--limit) {
      break
    }
  }

  return keys
}

const serializeWithAllChildren = (data, socket, master, branch, id, depthLimit, depth) => {
  if (data[id] || branch.leaves[id] === null || depthLimit < depth) {
    return
  }

  const keys = serializeAllChildren(data, socket, master, branch, id, depthLimit, depth)
  return serializeLeaf(data, socket, master, branch, id, keys, depthLimit, depth)
}

const serializeParents = (data, socket, master, branch, id) => {
  let parent = branch.leaves[id].parent
  while (parent) {
    if (!data.leaves[id]) {
      break
    }

    serializeLeaf(data, socket, master, branch, parent, [id], 0, 0)

    id = parent
    parent = branch.leaves[id].parent
  }
}

const serializeLeaf = (data, socket, master, branch, id, keys, depthLimit, sDepth) => {
  const leaf = branch.leaves[id]
  const isMaster = !Object.prototype.hasOwnProperty.call(branch.leaves, id)

  if (leaf !== null && (leaf.val !== undefined || leaf.rT || keys.length)) {
    if (leaf.rT) {
      serializeWithAllChildren(data, socket, master, branch, leaf.rT, depthLimit, sDepth)
      serializeParents(data, socket, master, branch, leaf.rT)
    }

    if (!isCachedForStamp(socket, isMaster, id, leaf.stamp)) {
      data.leaves[id] = [leaf.key, leaf.parent, leaf.stamp, leaf.val, leaf.rT, keys, leaf.depth]
      if (socket.cleanLeaves[id]) {
        delete socket.cleanLeaves[id]
      }
      cache(socket, isMaster, id, leaf.stamp)

      if (!isStringCached(socket, leaf.key)) {
        data.strings[leaf.key] = getString(leaf.key)
        cacheString(socket, leaf.key)
      }
    }

    return true
  }
}

const removeLeaves = (socket, master, type, stamp, leaf) => {
  if (type === 'remove') {
    const { branch, id } = leaf
    if (isCached(socket, !Object.prototype.hasOwnProperty.call(branch.leaves, id), id)) {
      socket.removeLeaves[id] = stamp
    }
  }
}

export { sendData, sendLeaves, removeLeaves }
