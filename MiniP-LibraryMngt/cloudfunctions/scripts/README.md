# Cloud Functions Utility Scripts

本目录用于存放 FamilyLibraryRFID 项目的开发辅助脚本。

---

## sync-common.js

用于将 `_shared` 中的公共源码同步到每一个云函数目录下的 `common`。

同步后目录结构如下：

```
_shared/
    permission.js

↓

api_user_login/
    common/
        permission.js

api_family_create/
    common/
        permission.js
```

---

## 为什么需要同步？

微信云函数采用独立部署。

开发者工具上传云函数时：

```
api_user_login
```

只会上传当前目录。

不会上传：

```
../common
```

因此公共代码必须复制到每一个云函数目录中。

本脚本用于自动完成该过程。

---

# 使用方法

进入：

```
cloudfunctions
```

执行：

```
npm run sync-common
```

---

# 查看将同步哪些目录

```
npm run sync-common:dry
```

不会修改任何文件。

仅显示：

- 将同步哪些云函数
- 将处理多少个云函数

---

# 删除所有 common

```
npm run sync-common:clean
```

会删除：

```
api_xxx/common
```

不会删除：

```
_shared
```

---

# 开发流程

修改公共代码：

```
_shared/
```

↓

执行：

```
npm run sync-common
```

↓

上传需要更新的云函数

---

# 注意事项

- `_shared` 为公共源码目录。
- 不要直接修改各云函数中的 `common`。
- `common` 为自动生成目录。
- 修改 `_shared` 后必须重新同步。
- 云函数统一使用：

```js
require('./common/permission')
```

不要使用：

```js
require('../common/permission')
```