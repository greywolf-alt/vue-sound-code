/* @flow */

import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
}
// 这是一个循环调用的场景
export function validateProp(
  key: string, // props 接受的每一个成员 [ item ] 
  propOptions: Object, // 子组件定义 props 的配置 经过normal转换的 { item:{type} } 的形式
  propsData: Object, // 传递过来的值 { key:value } 的形式 
  vm?: Component // VueComponent 组件实例
): any {
  /**
   * Example  
   * key: message
   * propOptions: { message: { type:null } }
   * propsData : { message:'hellow Vue'  }
   */
  const prop = propOptions[key]  // { type: null } 
  const absent = !hasOwn(propsData, key)  // hasOwn 包含某个属性 notice: 有个取反的操作
  let value = propsData[key] //  从propsData获取值
  // boolean casting 
  // 就是判断两个类型是否相等  相等就返回0 否则的话就返回-1 
  //  prop.type 支持 传递一个数组 如果是数组就会遍历里面的类型
  const booleanIndex = getTypeIndex(Boolean, prop.type)
  // 如果 类型匹配
  if (booleanIndex > -1) {
    // 如果不包含某个属性 并且 没有设置默认值
    if (absent && !hasOwn(prop, 'default')) {
      // 那么value === false
      value = false
      // key === message
      // 如果 value === ''
    } else if (value === '' || value === hyphenate(key)) {
      // only cast empty string / same name to boolean if
      // boolean has higher priority
      const stringIndex = getTypeIndex(String, prop.type)
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        value = true
      }
    }
  }
  // check default value
  // 如果value ==== undefined
  if (value === undefined) {
    // { type: null } 的格式
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    const prevShouldObserve = shouldObserve
    toggleObserving(true)
    observe(value)
    toggleObserving(prevShouldObserve)
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    // skip validation for weex recycle-list child component props
    !(__WEEX__ && isObject(value) && ('@binding' in value))
  ) {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * Get the default value of a prop.
 */
// 在validateProps 的时候 如果 获取到的值=== undefined  就会子组件props定义的default 的值 
function getPropDefaultValue(vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  // 没有提供default 就 === undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  // 拿到提供的dafault 函数
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
function assertProp(
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type
  let valid = !type || type === true
  const expectedTypes = []
  if (type) {
    if (!Array.isArray(type)) {
      type = [type]
    }
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i])
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }
  if (!valid) {
    warn(
      `Invalid prop: type check failed for prop "${name}".` +
      ` Expected ${expectedTypes.map(capitalize).join(', ')}` +
      `, got ${toRawType(value)}.`,
      vm
    )
    return
  }
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

function assertType(value: any, type: Function): {
  valid: boolean
  expectedType: string
} {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
// 获取参数的 类型
function getType(fn) {
  // 转换为false的 都会返回 空字符串  其他的都会调用tostring().match(..) 变成 [ function Boolean ] 的形式
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}

function isSameType(a, b) {
  // 就是判断两个参数是否全等  使用 toString 方法
  return getType(a) === getType(b)
}
// 获取类型索引?
// 
function getTypeIndex(type, expectedTypes): number {
  // 首先判断传递过来的参数是不是一个数组
  /**
   * Example
   *  在validateProps 中传递过来的是Boolean,null
   */
  // 如果不是数组就执行下面的操作
  if (!Array.isArray(expectedTypes)) {
    // ( null,Boolean) 
    // 相等就返回 0 否则的就返回 -1
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  // 如果传递过来的是数组<prop.type = []> 就会遍历这个数组 如果 类型相等 就返回对应的类型索引
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  return -1
}
