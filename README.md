# 主题一键换图

这是基于原版“主题一键换图”的二改版，原作者为毛毛雨。原有主题 CSS 图片替换、预设和 IndexedDB 行为保持不变。

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
