/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

// 再 调用beforeCreate 钩子函数之后 
export function initState(vm: Component) {
  // _Watcheer 初始化为一个空数组
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props) //  其实就是props 验证和设置了默认值 并且对props 上面的属性添加了观察者
   // initmethods 比较简单就是检查重复的key<和props重复> 然后将mehtods.key设置到vm上,并且绑定this===vm
  if (opts.methods) initMethods(vm, opts.methods) //改变this的方法 fn.bind(ctx)
  if (opts.data) {
    initData(vm) // 就是初始化data选项  并且data.key不能以_或者$符号开头,不能和peops 和methods 重名 然后将data列入观察者
  } else {
    // 如果没有给data选项 那么就默认一个 空对象
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}
// initstate的时候调用
function initProps(vm: Component, propsOptions: Object) {
  // vm.$options.propsData 就是 我们传递过来的  { key:value } 的形式
  const propsData = vm.$options.propsData || {}
  //  __props 属性是再这里添加的  初始化是一个空对象
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  // 就是一个数组  ['item'] 的形式
  const keys = vm.$options._propKeys = []
  // 如果有父组件 表示不是一个根组件
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    // 如果不是根实例 那么就不让其监听数据改变?
    toggleObserving(false)
  }
  // propsoptions 我们传递过来的props  但是是经过初始化的的  都会变成 { item:{ type } } 的形式 
  for (const key in propsOptions) {
    keys.push(key) // [ item ]
    // validateprop 函数就是验证prop的类型 和默认值的配置 并且讲prop 设置 在观察者里面
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      // 如果是vue的内置属性 example key,ref,slot,slot-scope,is
      if (isReservedAttribute(hyphenatedKey) ||
        config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      // 定义一个响应式的属性就是设置 getter和setter 属性
      defineReactive(props, key, value, () => {
        if (vm.$parent && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      // 访问vm属性的时候  其实访问的是_props
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}
// 在initstate的时候 初始化  data
function initData(vm: Component) {
  // 获取 data
  let data = vm.$options.data
  data = vm._data = typeof data === 'function'
    ? getData(data, vm) // 就是执行了一个call操作
    : data || {}
    // 获取数据类型.toString === [object object]
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data) // 数组key
  const props = vm.$options.props // 获取props item
  const methods = vm.$options.methods // 获取 methods item
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      // key 在methods 中已经存在了
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    //data.key 已经在props 中存在了
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
      // 判断key 是不是已 $ 或者_ 开头
    } else if (!isReserved(key)) {
      // 代理 key
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  // 观察 data
  observe(data, true /* asRootData */)
}

export function proxy(target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter() {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter(val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
// initdata 函数里面 当 typeof data === 'function' 的时候  会调用getdata
export function getData(data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }
// initstate 的时候初始化 computed
function initComputed(vm: Component, computed: Object) {
  // $flow-disable-line
  // 初始化一个空对象
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering() // 服务端渲染

  for (const key in computed) {
    const userDef = computed[key] // 计算属性的每一个成员
    // 如果计算属性是一个函数的话 那就是 成员本身 如果是一个对象那么就获取他的get属性
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    // 对象情况下  get属性是必须的
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }
    //  不是服务端渲染
    if (!isSSR) {
      // create internal watcher for the computed property.
      // 这个就是监听了 数据的每一个成员 但是并没有计算啊
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // vue实例中没有 这个key
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      // 如果计算属性的key 存在data中
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
        // 如果计算属性的key 存在props属性中
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}
// 定义computed
export function defineComputed(
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering() //  服务端喧染
  //  这个userDef 是被initComputed转换过的 是一个使用get方法定义的 也是一个函数
  if (typeof userDef === 'function') {
    // 设置 getter
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : userDef
    // 计算属性没有set
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : userDef.get
      : noop
    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop
  }
  if (process.env.NODE_ENV !== 'production' &&
    sharedPropertyDefinition.set === noop) {
      // 对计算属性赋值的时候报错
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

function createComputedGetter(key) {
  return function computedGetter() {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}
// initstate 的时候进行了 事件初始化
function initMethods(vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      // 如果methods.key === null
      if (methods[key] == null) {
        warn(
          `Method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      // 如果methods的key已经在props里面存在了
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // 
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 将methods里面的成员设置到vm上面并且绑定this
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
  }
}

function initWatch(vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher(
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin(Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function (newData: Object) {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      cb.call(vm, watcher.value)
    }
    return function unwatchFn() {
      watcher.teardown()
    }
  }
}
