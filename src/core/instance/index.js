import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// 这里才是镇定定义Vue的地方
function Vue (options) {
  // 判断  如果当前执行环境不是生产环境 并且 this 的构造函数的并不是Vue 则抛出一个一场
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 初始化的 我们传递过来的参数
  /**
   {
    ...
   }
   */
  // Vue.prototype._init 方法是实在 initMixin 的时候添加的
  this._init(options)
}
/**
 * 
 */
initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
