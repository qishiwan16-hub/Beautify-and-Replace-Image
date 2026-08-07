# 主题一键换图

这是基于原版“主题一键换图”的二改版，原作者为毛毛雨。原有主题 CSS 图片替换、预设和 IndexedDB 行为保持不变。

预设管理支持通过“切换”按钮应用指定预设，也可使用旁边的“保存”按钮把当前图片替换配置覆盖到该预设。当前使用的预设会显示绿色指示灯；再次点击当前项的“默认”按钮会恢复主题原图并取消预设。保存新预设或覆盖预设后会自动标记为当前；手动换图、重置或清理当前配置后，旧预设的当前标记会自动取消。

创作模式提供批量下载、批量导入本地图片和批量链接导入。批量链接按图片序号逐行映射；某一行填写“空”时会保留对应图片，不执行替换。链接替换只更新当前主题 CSS 编辑内容，仍需在酒馆主题界面手动保存。

## 安装

在 SillyTavern 的扩展管理器中安装：

`https://github.com/qishiwan16-hub/Beautify-and-Replace-Image`

或在 `data/<账户>/extensions/third-party` 目录克隆本仓库。

## 后端存储

后端插件仓库：

`https://github.com/qishiwan16-hub/Backend-for-image-replacement-and-UI-enhancement`

将后端克隆到 `SillyTavern/plugins/image-replacement-ui-enhancement`，启用 `enableServerPlugins` 后重启酒馆。扩展打开时会检测 `/api/plugins/image-replacement-ui-enhancement/status`；检测到后端时，配置和图片保存到酒馆后端，否则自动继续使用浏览器 IndexedDB。

## 更新

扩展工具栏的“检查更新”会调用 SillyTavern 官方扩展更新接口。更新成功后会重新注入模块脚本并尝试热加载；若当前环境不允许热加载，刷新酒馆页面即可完成加载。
