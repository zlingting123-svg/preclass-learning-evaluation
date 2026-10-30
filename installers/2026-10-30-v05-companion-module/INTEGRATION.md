# 给服务器Codex：只接入伙伴模块，保留已有网页

## 边界与资产

安装器只处理公开静态目录内的ai-companion文件夹；包中没有HTML、整站应用bundle、API实现或配置。旧的整站网页方案已撤回、未发布。请勿用此前首次系统安装器覆盖现有服务器。

module.js为自包含ES模块，内嵌自己的React运行时并在开放Shadow DOM中渲染，自带隔离CSS，不污染宿主网页样式；无CDN、无外部跟踪、无模型请求、无设置面板。pose/walk PNG通过模块自身URL相对加载，勿把module.js单独搬走。

## 在现有网页引入

在宿主入口（或当前构建系统）引入一次：

```html
<script type="module" src="/ai-companion/module.js"></script>
```

这是文档示例，不是随包携带的网页。若宿主有CSP，按现有规则允许同源模块、图片与Shadow DOM内样式；如宿主使用样式nonce，可在标签的style-nonce属性传入本次响应的nonce；不要为接入模块删除整站CSP。页面若部署在子路径，请使用实际资源URL。

主页在现有AI入口处放入有明确尺寸的容器（宽度跟随卡片，高约252px，手机约232px），容器内创建：

```html
<preclass-ai-companion place="home" state="welcome" style="display:block;width:100%;height:100%"></preclass-ai-companion>
```

监听该标签的companion-activate事件，用现有路由系统进入AI问答。不要同时给外层加点击跳转，否则拖动可能误触；模块已区分点击和拖动，并在点击反馈约360ms后发出激活事件。

聊天页用place="chat"，放入当前聊天内容区域的独立覆盖容器，位于标题和输入框之间、默认靠右，不覆盖输入框。宿主容器应position:relative；模块容器absolute inset:0且pointer-events:none，模块内部形象会单独接收指针。给消息留适当右边空位，手机可保留顶部空位；具体DOM由服务器现有布局决定，勿覆盖本机main.tsx到服务器。

## 业务状态绑定

使用属性state（适用于任意框架）或element.setState(value)。支持：idle、welcome、thinking、done、failed、offline。

- 主页使用welcome。place=chat时即使传welcome也会降为idle。
- 读到实际服务未接入/禁用时传offline；不能假装在思考。
- 当前问题发出请求时传thinking，切换历史/新建对话不触发。
- 持久化回答成功终态（包括明确范围/证据不足提示）传done，短暂展示约2.3秒后回idle；这不表示答案正确。
- 请求失败传failed，短暂展示约2.6秒后回idle或实际服务状态。取消回idle。
- 新请求、页面卸载、服务状态变化须清除上个结果的延时器，防止旧回调覆盖新请求状态。

模块不读取或修改问题/回答内容，不拦截fetch，不改变额度/权限/账单逻辑。只有宿主传递状态；请接入服务器既有状态来源，不从任意页面文字猜测。

拖动时模块内部临时显示walk-up/down/left/right，松手恢复宿主当前状态；四向步行每向四帧。位置仅存本机浏览器localStorage，不发往服务器。聊天宽度随可用容器调整为68–120px，支持键盘和减少动态效果。

本机实际接入示例：frontend/src/preview/PackagedCompanion.tsx、companion-layout.css，以及main.tsx的业务状态绑定。这些文件仅供参考，**不要覆盖服务器已修改的网页文件**。

## 验收

确认资源HTTP200、主页跳跃完整、移入/点击反馈、点击进现有AI路由、拖动不误触；聊天实际请求/完成/失败/取消/待接入状态正确；旧页面按钮、历史/删除仍可用；320/375/768/1440宽度及触控；浏览器无新增错误。安装本身不会自动让未接入标签的页面出现伙伴，这是有意保留服务器网页自主改动。
