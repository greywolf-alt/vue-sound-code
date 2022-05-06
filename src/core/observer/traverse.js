/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
// 深度监听的时候使用到了这个函数
export function traverse(val: any) {
  // 调用下面这个方法
  _traverse(val, seenObjects)
  // 清空 seenObjects set数组
  seenObjects.clear()
}

function _traverse(val: any, seen: SimpleSet) {
  let i, keys
  // 判断是不是一个数组
  const isA = Array.isArray(val)
  // 不是数据 并且不是对象  || 冻结状态 || 这个对象继承自 VNode 直接return
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  // __ob__ 属性是在Obseve的时候添加的
  if (val.__ob__) {
    // 已经有了 depId 表示已经被监听了 
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    // 否则的话就添加这个depId
    seen.add(depId)
  }
  // 是一个数组
  if (isA) {
    i = val.length
    // 递归的添加每一个数组成员
    while (i--) _traverse(val[i], seen)
  } else {
    // 是一个对象
    keys = Object.keys(val)
    i = keys.length
    // 递归的添加每一个对象属性
    while (i--) _traverse(val[keys[i]], seen)
  }
}
