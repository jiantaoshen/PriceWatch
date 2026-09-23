# PriceWatch：Auth → Fetch → State 前端数据加载模式

## 1. 概述

PriceWatch 前端目前采用统一的客户端数据加载流程：

```text
Auth
  ↓
确认认证状态
  ↓
获取 Access Token
  ↓
Fetch Function
  ↓
调用 API 并返回数据
  ↓
Promise callback
  ↓
写入 React State
  ↓
React 重新渲染
  ↓
显示 Loading / Error / Data
```

可以简单概括为：

```text
auth → fetch → state
```

它把三个问题分开处理：

```text
Auth
→ 谁可以访问数据？

Fetch
→ 怎么从服务器取得数据？

State
→ 页面当前应该显示什么？
```

当前额外约定是：

```text
fetch 函数
→ 只负责请求和返回数据
→ 不负责修改 React State
```

也就是说：

```text
数据获取
和
UI 状态更新
```

是两个不同职责。

---

## 2. Auth 阶段

页面通过 `useAuth()` 获取认证状态：

```tsx
const { ready, account, getAccessToken } = useAuth();
```

三个值分别表示：

```text
ready
→ Microsoft / MSAL 是否初始化完成

account
→ 当前是否存在已登录账号

getAccessToken
→ 获取调用 ASP.NET Core API 所需的 Access Token
```

认证状态通常可以分为：

```text
ready = false
→ 认证系统还在初始化

ready = true
account = null
→ 已确认没有登录

ready = true
account != null
→ 用户已经登录
```

`ready` 很重要，因为认证系统初始化过程中，`account` 可能暂时还是 `null`。

如果只判断：

```tsx
if (!account)
```

有可能把：

```text
认证还没初始化完
```

误认为：

```text
用户没有登录
```

所以页面通常先判断：

```text
ready
```

再判断：

```text
account
```

---

## 3. 为什么 Fetch 之前需要 Auth

PriceWatch 的 ASP.NET Core API 是受保护的。

因此页面不能只考虑：

```tsx
fetch("/api/items/123");
```

而是需要先获取 token：

```tsx
const token = await getAccessToken();
```

然后再调用：

```tsx
await apiFetch(
  `/api/items/${params.id}`,
  token.accessToken
);
```

流程可以理解为：

```text
React Page
    ↓
AuthProvider
    ↓
Microsoft Account
    ↓
getAccessToken()
    ↓
Bearer Access Token
    ↓
ASP.NET Core API
```

后端再通过认证和授权规则决定是否允许访问数据。

因此：

```text
Auth
→ 确认身份

Fetch
→ 携带身份访问私人数据
```

---

## 4. Fetch Function 的职责

PriceWatch 当前统一约定：

```text
fetch function
→ 负责取得数据
→ 不负责修改 React State
```

例如 Subscription 页面：

```tsx
async function fetchSubscriptionsData(accessToken: string) {
  return apiFetch<ItemListItem[]>(
    "/api/items?includeArchived=true",
    accessToken
  );
}
```

这个函数只做两件事：

```text
调用 API
↓
返回结果
```

它不应该做：

```tsx
setItems(...)
setLoading(...)
setError(...)
setForbidden(...)
```

这样可以把：

```text
数据获取逻辑
```

和：

```text
页面 UI 状态逻辑
```

分开。

---

## 5. 多个 API 请求

一个页面可能需要多个 API。

例如 Product Detail 需要：

```text
Item
Price History
Offers
```

可以写成：

```tsx
async function fetchProductDetailData(
  id: string,
  accessToken: string
) {
  const item = await apiFetch<ItemDetail>(
    `/api/items/${id}`,
    accessToken
  );

  const [historyResult, offersResult] =
    await Promise.allSettled([
      apiFetch<PriceHistoryPoint[]>(
        `/api/items/${id}/history`,
        accessToken
      ),
      apiFetch<SourceOffer[]>(
        `/api/items/${id}/offers`,
        accessToken
      ),
    ]);

  return {
    item,
    history:
      historyResult.status === "fulfilled"
        ? historyResult.value
        : [],
    offers:
      offersResult.status === "fulfilled"
        ? offersResult.value
        : [],
  };
}
```

这里仍然遵守同一个规则：

```text
fetchProductDetailData()
→ 只组合和返回数据
→ 不修改 React State
```

---

## 6. 为什么使用 Promise.allSettled()

Product Detail 中：

```text
Item
History
Offers
```

重要程度并不完全一样。

例如：

```text
Item 成功
History 成功
Offers 失败
```

页面仍然可以显示：

```text
商品信息
价格历史
```

只把 Offers 当成空数据。

如果使用：

```tsx
Promise.all(...)
```

其中一个请求失败时，整个组合请求会直接失败。

而：

```tsx
Promise.allSettled(...)
```

允许分别判断每个请求：

```tsx
if (historyResult.status === "fulfilled") {
  ...
}

if (offersResult.status === "fulfilled") {
  ...
}
```

所以它适合：

```text
部分数据失败
但页面仍然可以继续工作
```

的场景。

---

## 7. State 阶段

API 返回数据以后，由页面负责写入 React State。

例如：

```tsx
setItem(item);
setHistory(history);
setOffers(offers);
```

页面通常还会有：

```tsx
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

这些 State 决定当前页面显示什么：

```text
ready = false
→ Auth 初始化中

account = null
→ Sign in

loading = true
→ Loading

error != null
→ Error

data != null
→ 显示真实页面
```

可以把 React UI 简单理解成：

```text
UI = function(state)
```

State 改变以后，React 自动重新 render。

---

## 8. useEffect 的真正职责

当前 PriceWatch 中，`useEffect` 的职责是：

```text
观察外部条件变化
↓
启动一次异步数据同步
```

例如：

```tsx
useEffect(() => {
  if (!ready || !account) return;

  // 启动异步 fetch 流程
}, [ready, account, getAccessToken]);
```

对于 Product Detail，还会观察 route：

```tsx
useEffect(() => {
  if (!ready || !account) return;

  // 根据 params.id 重新读取数据
}, [ready, account, getAccessToken, params.id]);
```

例如：

```text
/items/A
→ /items/B
```

`params.id` 改变以后，需要重新读取 B。

又例如：

```text
未登录
→ 登录
```

`account` 改变以后，也需要开始读取私人数据。

所以：

```text
useEffect
→ 负责“什么时候同步”

fetch function
→ 负责“同步什么数据”

React State
→ 负责“页面显示什么”
```

---

## 9. 为什么之前 ESLint 会报错

之前的结构类似：

```tsx
useEffect(() => {
  if (ready && account) void loadData();
}, [ready, account]);
```

而 `loadData()` 里面同时做：

```text
获取 token
请求 API
setLoading
setItems
setError
```

也就是说：

```text
useEffect
   ↓
loadData()
   ↓
setState()
```

ESLint 的：

```text
react-hooks/set-state-in-effect
```

会把这种调用关系视为 effect 直接触发 State 更新的模式。

之前尝试过把：

```tsx
setLoading(true);
```

放到：

```tsx
await getAccessToken();
```

之后。

但实际 lint 仍然可以追踪：

```text
useEffect
→ loadData()
→ setState()
```

所以仅仅调整 `await` 的位置并没有真正解决结构问题。

---

## 10. 当前统一的解决方式

现在把：

```text
Fetch
```

和：

```text
State Update
```

拆开。

### 10.1 Fetch Function

```tsx
async function fetchData(accessToken: string) {
  return apiFetch<Data>("/api/...", accessToken);
}
```

这里只返回数据。

### 10.2 Effect

```tsx
useEffect(() => {
  if (!ready || !account) return;

  let cancelled = false;

  void getAccessToken()
    .then((token) => fetchData(token.accessToken))
    .then((data) => {
      if (!cancelled) setData(data);
    })
    .catch((err) => {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : String(err)
        );
      }
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });

  return () => {
    cancelled = true;
  };
}, [ready, account, getAccessToken]);
```

现在结构变成：

```text
useEffect
   ↓
启动异步 Promise
   ↓
getAccessToken
   ↓
fetchData()
   ↓
API 返回
   ↓
.then(...)
   ↓
setState()
```

这样：

```text
fetch function
```

本身不负责 React State。

---

## 11. cancelled flag 的作用

当前 Effect 中会使用：

```tsx
let cancelled = false;
```

cleanup：

```tsx
return () => {
  cancelled = true;
};
```

然后在 Promise callback 中：

```tsx
if (cancelled) return;
```

它解决的是：

```text
开始请求 A
↓
用户切换页面 / route / account
↓
旧 effect 被 cleanup
↓
A 很晚才返回
↓
发现 cancelled = true
↓
不再写入旧 State
```

这可以避免过期请求结果覆盖新的页面状态。

例如：

```text
/items/A
↓
请求 A

快速进入 /items/B
↓
请求 B

B 先返回
↓
显示 B

A 后返回
↓
A 已 cancelled
↓
不会覆盖 B
```

---

## 12. cancelled 不等于真正取消 HTTP 请求

需要注意：

```text
cancelled flag
```

不会真正停止已经发出的 HTTP 请求。

它做的是：

```text
请求仍然继续
↓
结果返回
↓
前端忽略这个结果
```

所以它更准确地说是：

```text
ignore stale result
```

而不是：

```text
abort request
```

现在已经确认共享 `request()` 会把 `RequestInit` 传给浏览器原生 `fetch()`，因此 `apiFetch()` 可以真正使用：

```text
AbortController / AbortSignal
```

例如：

```tsx
const controller = new AbortController();

apiFetch("/api/items", accessToken, {
  signal: controller.signal,
});

controller.abort();
```

当前页面仍然使用：

```text
cancelled flag
```

因为它更简单，并已经能够解决“旧请求结果回写 State”的主要问题。

如果以后希望连网络请求本身也一起停止，可以直接升级到 AbortController，而不需要重写底层 `apiFetch()` / `request()`。

---

## 13. 完整加载生命周期

当前生命周期可以写成：

```text
进入页面
    │
    ▼
React Mount
    │
    ▼
AuthProvider
    │
    ├── ready = false
    │
    ▼
MSAL 初始化
    │
    ▼
ready = true
    │
    ├── account = null
    │      ↓
    │   显示 Sign in
    │
    └── account != null
           │
           ▼
        useEffect
           │
           ▼
     getAccessToken()
           │
           ▼
       fetchData()
           │
           ▼
        Fetch API
           │
           ▼
      Promise resolved
           │
           ▼
        .then(...)
           │
           ▼
        setState()
           │
           ▼
      React render
           │
           ▼
       显示数据
```

---

## 14. Product Detail 生命周期

Product Detail 的数据流程是：

```text
useEffect
   ↓
getAccessToken
   ↓
fetchProductDetailData()
   ↓
GET Item
   ↓
Promise.allSettled
   ├── GET History
   └── GET Offers
   ↓
return {
  item,
  history,
  offers
}
   ↓
.then(...)
   ↓
setItem()
setHistory()
setOffers()
   ↓
setLoading(false)
   ↓
Render
```

如果：

```text
History 失败
```

或者：

```text
Offers 失败
```

可以返回：

```tsx
[]
```

而不让整个 Product Detail 页面失败。

---

## 15. 首次加载和用户操作要区分

PriceWatch 有两种不同的数据流程。

### 15.1 页面首次加载

由：

```text
useEffect
```

触发。

流程：

```text
useEffect
↓
getAccessToken
↓
fetchData
↓
Promise callback
↓
setState
```

### 15.2 用户主动操作

例如：

```text
Archive
Restore
Delete
Accept
Reject
Manual Override
```

这些是用户事件。

例如：

```tsx
async function restoreItem(id: string) {
  setRestoringId(id);

  try {
    const token = await getAccessToken();

    await apiFetch<void>(
      `/api/items/${id}/restore`,
      token.accessToken,
      { method: "POST" }
    );

    const items = await fetchData(
      token.accessToken
    );

    setItems(items);
  } finally {
    setRestoringId(null);
  }
}
```

这里直接调用：

```tsx
setRestoringId(...)
setItems(...)
```

是正常的，因为它发生在：

```text
用户点击事件
```

而不是：

```text
effect 的同步执行过程
```

所以不要把：

```text
Effect loading
```

和：

```text
User action
```

混成同一种逻辑。

---

## 16. 为什么操作完成后重新 Fetch

例如 Archive：

```text
POST Archive
↓
后端修改数据
↓
重新 fetchData()
↓
拿到服务器最终状态
↓
setState()
```

这种方式比前端自己猜：

```tsx
setItem({
  ...item,
  archivedAt: "...",
  trackingEnabled: false,
});
```

更可靠。

因为真正的业务规则在：

```text
ASP.NET Core API
```

而不是 React 页面。

所以当前原则是：

```text
用户操作
↓
后端完成修改
↓
重新读取服务器真实状态
```

这样前后端更不容易出现状态不一致。

---

## 17. ready、loading、actionBusy 为什么分开

它们看起来都表示“等待”，但职责不同。

### ready

```text
Auth 系统有没有初始化完成
```

### loading

```text
页面数据有没有加载完成
```

### actionBusy

```text
Archive / Restore / Delete
Accept / Reject
等用户操作是否正在进行
```

例如：

```text
ready = false
```

不代表：

```text
用户正在 Delete
```

而：

```text
actionBusy = true
```

也不应该让整个页面进入 Auth loading。

因此不要全部合成：

```tsx
busy
```

分开会更容易理解。

---

## 18. loading 的当前语义

页面通常使用：

```tsx
const [loading, setLoading] = useState(true);
```

首次进入页面时：

```text
loading = true
```

所以即使 Auth / Token 还在准备，UI 也可以保持 Loading 状态。

当异步流程最终完成：

```tsx
.finally(() => {
  if (!cancelled) setLoading(false);
});
```

页面才结束 Loading。

因此当前：

```text
loading
```

更接近：

```text
当前页面数据流程是否完成
```

而不仅仅是：

```text
HTTP 请求是否正在进行
```

---

## 19. 错误状态

页面可以根据不同错误显示不同 UI。

例如：

```text
403
→ No data available

404
→ Product not found

普通网络 / API 错误
→ 显示错误信息
```

例如：

```tsx
if (err instanceof ApiError && err.status === 403) {
  setError("No data available.");
} else if (
  err instanceof ApiError &&
  err.status === 404
) {
  setError("Product not found.");
} else {
  setError(
    err instanceof Error
      ? err.message
      : String(err)
  );
}
```

不同页面可以根据自身需要决定：

```text
403 是单独 forbidden state
```

还是：

```text
直接转成 error message
```

---

## 20. AuthProvider 的价值

如果没有统一的 AuthProvider，每个页面都可能重复：

```text
初始化 MSAL
获取账号
设置 active account
获取 token
处理 interaction
处理 popup
```

现在页面只需要：

```tsx
const {
  ready,
  account,
  getAccessToken,
} = useAuth();
```

认证复杂度被集中管理。

整体结构：

```text
MSAL
  ↓
AuthProvider
  ↓
Page
  ↓
apiFetch
  ↓
ASP.NET Core
```

页面不需要理解 MSAL 的所有内部细节。

---

## 21. apiFetch 的价值

`AuthProvider` 负责：

```text
身份
Token
```

`apiFetch` 负责：

```text
HTTP request
Authorization header
HTTP error handling
```

页面负责：

```text
什么时候加载
加载什么数据
数据如何显示
```

这样可以避免每个页面重复：

```tsx
fetch(...)
```

以及：

```tsx
headers: {
  Authorization: `Bearer ${token}`
}
```

和：

```tsx
if (!response.ok) {
  ...
}
```

所以职责可以总结为：

```text
AuthProvider
→ Authentication

apiFetch
→ HTTP communication

fetchXxxData
→ 某个页面需要的数据组合

Page
→ UI workflow

React State
→ UI state

ASP.NET Core
→ Business logic
```

---

## 22. 当前统一的命名规则

为了让代码容易理解，建议继续使用：

```text
fetchProductsData
fetchSubscriptionsData
fetchReviewsData
fetchProductDetailData
```

看到：

```text
fetchXxxData
```

就应该默认理解为：

```text
只读取 / 组合数据
不 setState
```

不要再写一个模糊的：

```tsx
load()
```

同时又让它：

```text
fetch
+
setState
+
error handling
+
loading
```

全部负责。

明确命名可以直接表达函数职责。

---

## 23. 当前几个页面的统一模式

### Products

```text
fetchProductsData()
→ Items + Pending Reviews
```

### Subscriptions

```text
fetchSubscriptionsData()
→ Items
→ 页面过滤 Subscription
```

### Reviews

```text
fetchReviewsData()
→ Pending Reviews
```

### Product Detail

```text
fetchProductDetailData()
→ Item
→ History
→ Offers
```

这些页面虽然数据不同，但结构一致：

```text
Auth
↓
Token
↓
fetchXxxData
↓
Promise result
↓
setState
↓
Render
```

这比每个页面使用不同的 loading 写法更容易维护。

---

## 24. 这种模式的主要好处

### 24.1 认证边界清楚

只有：

```text
ready
+
account
+
access token
```

准备好以后，才读取私人数据。

---

### 24.2 Fetch 和 State 职责清楚

现在明确分成：

```text
fetchXxxData
→ 数据获取

Page
→ State 更新
```

不会再出现：

```text
一个 load() 函数什么都负责
```

---

### 24.3 Loading / Error / Data 容易控制

页面可以明确区分：

```text
Auth loading
Not signed in
Data loading
Forbidden
Not found
Server error
Loaded data
```

---

### 24.4 Route 改变可以重新同步

例如：

```text
/items/A
→ /items/B
```

只要：

```tsx
params.id
```

在 dependency array 中，新的 Effect 就会重新获取数据。

---

### 24.5 操作完成后容易重新同步服务器

例如：

```text
Restore
↓
POST /restore
↓
fetchData()
↓
服务器真实数据
↓
setState
```

React 不需要复制后端业务逻辑。

---

### 24.6 可以防止旧请求覆盖新页面

通过：

```tsx
let cancelled = false;
```

和 cleanup，可以忽略已经过期的 Promise 结果。

---

### 24.7 可以处理部分失败

例如：

```text
Item 成功
History 成功
Offers 失败
```

页面仍然可以正常显示大部分内容。

---

## 25. 缺点

### 25.1 Client-side loading 会增加等待

流程仍然是：

```text
页面加载
↓
等待 Auth
↓
等待 Token
↓
等待 API
↓
显示数据
```

所以相比服务器直接拥有数据，首屏会有额外等待。

---

### 25.2 页面仍然会有不少 State

复杂页面可能出现：

```tsx
item
history
offers
loading
error
actionBusy
reviews
alerts
...
```

当页面继续增长时，可能需要重新评估状态管理方式。

未来可以考虑：

```text
useReducer
TanStack Query
SWR
```

但当前规模不一定需要。

---

### 25.3 页面之间仍然有部分重复代码

多个页面都会有：

```text
getAccessToken
.then(...)
.catch(...)
.finally(...)
cancelled flag
```

现在这种重复的好处是：

```text
简单
直接
容易看懂
```

如果以后这种重复明显增多，再考虑抽象。

不建议为了减少几行代码，过早制造一个复杂的通用 Hook。

---

### 25.4 cancelled flag 不会真正终止网络请求

它只阻止：

```text
旧结果写回 State
```

不会阻止：

```text
服务器继续处理请求
```

共享 `request()` 已经支持通过 `RequestInit.signal` 使用：

```text
AbortController
```

所以如果以后希望真正停止网络请求，可以在页面层直接升级，而不需要修改 HTTP core。

---

## 26. dependency array 的注意事项

当前 Effect 可以正常写成：

```tsx
useEffect(() => {
  ...
}, [
  ready,
  account,
  getAccessToken,
  params.id,
]);
```

这里意味着：

```text
这些依赖发生变化
↓
Effect 重新执行
```

现在已经确认 `AuthProvider` 中的 `getAccessToken` 使用了：

```tsx
const getAccessToken = useCallback(async () => {
  ...
}, [account]);
```

因此：

```text
account 不变
→ getAccessToken 的函数引用保持稳定
```

普通组件 render 不会仅仅因为 `getAccessToken` 产生了新的函数引用，就重新触发 Effect。

当：

```text
account 改变
```

时，`getAccessToken` 会随之更新，而 Effect 重新执行也是合理的。

所以当前不需要通过：

```tsx
// eslint-disable-next-line react-hooks/exhaustive-deps
```

把 `getAccessToken` 从 dependency array 中排除。

对于 Product Detail：

```tsx
useEffect(() => {
  ...
}, [ready, account, getAccessToken, params.id]);
```

`params.id` 改变时重新读取数据也是正确行为。

---

## 27. API 与认证基础设施的已确认行为

目前已经检查了：

```text
web/lib/api.ts
auth-provider.tsx
web/lib/msal.ts
web/next.config.ts
packages/api/package.json
packages/api/src/core.ts
```

因此 PriceWatch 当前前端的认证层和 HTTP 请求层已经基本明确，不再有之前那些关于 `request()`、MSAL cache 和 AbortSignal 的主要技术问号。

### 27.1 `@pricewatch/api/core` 实际指向哪里

`packages/api/package.json` 中：

```json
{
  "name": "@pricewatch/api",
  "type": "module",
  "exports": {
    "./core": "./src/core.ts"
  }
}
```

所以：

```tsx
import {
  ApiError,
  request,
} from "@pricewatch/api/core";
```

实际指向：

```text
packages/api/src/core.ts
```

因此请求链可以准确写成：

```text
web/lib/api.ts
↓
@pricewatch/api/core
↓
packages/api/src/core.ts
↓
request()
```

---

### 27.2 `apiFetch` 是一个很薄的 Web wrapper

当前 `web/lib/api.ts`：

```tsx
import {
  ApiError,
  request,
} from "@pricewatch/api/core";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "";

export { ApiError };

export async function apiFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  return request<T>({
    baseUrl: apiUrl,
    path,
    accessToken,
    init,
  });
}
```

它主要负责：

```text
读取 NEXT_PUBLIC_API_URL
↓
接收 path
↓
接收 accessToken
↓
接收 RequestInit
↓
转交给共享 request()
```

也就是说：

```text
web/lib/api.ts
→ Web 项目适配层

packages/api/src/core.ts
→ 通用 HTTP 请求实现
```

---

### 27.3 HTTP Client 已确认是浏览器原生 `fetch()`

`request()` 最终执行：

```tsx
const response = await fetch(
  `${baseUrl}${path}`,
  {
    ...init,
    headers,
    cache: "no-store",
  }
);
```

所以 PriceWatch 当前没有使用：

```text
Axios
自定义第三方 HTTP client
```

完整 HTTP 路径是：

```text
Page
↓
fetchXxxData()
↓
apiFetch()
↓
request()
↓
fetch()
↓
ASP.NET Core API
```

---

### 27.4 Authorization Header 自动建立

`request()` 会先创建：

```tsx
const headers =
  new Headers(init?.headers);
```

如果存在 Access Token：

```tsx
if (accessToken) {
  headers.set(
    "Authorization",
    `Bearer ${accessToken}`
  );
}
```

因此页面不需要重复写：

```tsx
headers: {
  Authorization: `Bearer ${token}`
}
```

职责分工是：

```text
AuthProvider
→ 获取 Access Token

request()
→ 把 Access Token 放进 Authorization Header
```

---

### 27.5 JSON Content-Type 自动建立

如果请求有 body：

```tsx
init?.body
```

并且调用方还没有提供：

```text
Content-Type
```

`request()` 会自动执行：

```tsx
headers.set(
  "Content-Type",
  "application/json"
);
```

所以常见写法：

```tsx
apiFetch(
  "/api/items",
  token.accessToken,
  {
    method: "POST",
    body: JSON.stringify(payload),
  }
);
```

不需要每次手动重复：

```tsx
headers: {
  "Content-Type": "application/json"
}
```

如果调用方已经设置 Content-Type，`request()` 不会覆盖它。

---

### 27.6 `RequestInit` 会传给原生 Fetch

`apiFetch()` 接收：

```tsx
init?: RequestInit
```

`request()` 最终：

```tsx
fetch(url, {
  ...init,
  headers,
  cache: "no-store",
});
```

因此标准 `RequestInit` 配置可以继续传递，例如：

```text
method
body
headers
signal
credentials
其他 Fetch API RequestInit 参数
```

需要注意两个字段会由 `request()` 自己处理：

```text
headers
cache
```

其中 headers 会先合并，再加入 Authorization / Content-Type；而 cache 会被统一覆盖成 `no-store`。

---

### 27.7 AbortSignal 已确认真正支持

因为：

```tsx
...init
```

会传入原生：

```tsx
fetch()
```

所以：

```tsx
const controller =
  new AbortController();

await apiFetch(
  "/api/items",
  token.accessToken,
  {
    signal: controller.signal,
  }
);
```

随后：

```tsx
controller.abort();
```

可以真正取消浏览器 Fetch 请求。

这和当前页面使用的：

```text
cancelled flag
```

不同。

```text
cancelled flag
→ HTTP 请求继续执行
→ 只是不允许旧结果写回 State

AbortController
→ 真正向 Fetch 发出取消信号
```

当前 PriceWatch 仍然使用 `cancelled flag` 作为简单的 stale-result protection，但基础 HTTP 层已经具备以后升级到 AbortController 的能力。

---

### 27.8 Fetch Cache 已明确关闭

`request()` 强制：

```tsx
cache: "no-store"
```

而且它位于：

```tsx
...init
```

之后：

```tsx
{
  ...init,
  headers,
  cache: "no-store",
}
```

所以即使调用方传入其他 cache 策略，最终也会被覆盖为：

```text
no-store
```

因此当前 PriceWatch 的 API 请求策略是：

```text
每次请求
↓
不依赖浏览器 Fetch Cache
↓
直接向 API 获取当前数据
```

这也符合 PriceWatch 当前的设计：

```text
服务器状态
→ 真实来源
```

---

### 27.9 当前没有自动 Retry

`request()` 中只有一次：

```tsx
await fetch(...)
```

没有：

```text
retry loop
retry count
retry delay
exponential backoff
```

所以可以确认：

```text
PriceWatch 当前 HTTP 请求
→ 不自动 retry
```

请求失败以后直接进入调用方的 error handling。

---

### 27.10 当前没有 401 Token Refresh + Request Retry

`request()` 不包含：

```text
收到 401
↓
重新获取 token
↓
重新发送原请求
```

这种逻辑。

当前流程是请求之前先：

```text
getAccessToken()
↓
得到 MSAL 当前可用 Access Token
↓
apiFetch(...)
```

如果 HTTP 请求最终得到：

```text
401
```

它会和其他非成功状态一样转换为：

```text
ApiError
```

因此：

```text
Token acquisition / renewal
→ MSAL + AuthProvider

HTTP request retry
→ 当前没有自动实现
```

---

### 27.11 HTTP Error 处理已经明确

所有：

```tsx
!response.ok
```

都会先读取：

```tsx
const text =
  await response.text();
```

然后抛出：

```tsx
throw new ApiError(
  response.status,
  text ||
    `${response.status} ${response.statusText}`
);
```

`ApiError` 定义为：

```tsx
export class ApiError extends Error {
  status: number;

  constructor(
    status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
```

所以页面可以同时得到：

```text
err.message
err.status
```

例如：

```tsx
if (
  err instanceof ApiError &&
  err.status === 403
) {
  ...
}
```

可以区分：

```text
401
403
404
500
...
```

---

### 27.12 Response Parsing 规则已经明确

成功响应有三种情况。

#### 204 No Content

```tsx
if (response.status === 204) {
  return undefined as T;
}
```

这很适合：

```tsx
apiFetch<void>(...)
```

例如：

```text
Archive
Restore
Delete
Update
```

#### 非 204，但 body 为空

```tsx
const text =
  await response.text();

if (!text) {
  return undefined as T;
}
```

所以空 response 不会执行：

```tsx
JSON.parse("")
```

#### 有 response body

```tsx
return JSON.parse(text) as T;
```

因此当前约定是：

```text
成功 response 如果有 body
→ body 应该是合法 JSON
```

`request()` 当前不会根据：

```text
Content-Type
```

选择不同的 parser。

所以如果 API 返回：

```text
200 OK
text/plain
hello
```

那么：

```tsx
JSON.parse("hello")
```

会失败。

对于当前 ASP.NET Core JSON API，这个约定是简单且一致的。

---

### 27.13 `getErrorMessage()` 可以统一普通错误文本

共享 API package 还提供：

```tsx
export function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : String(error);
}
```

它等价于页面中经常重复出现的：

```tsx
err instanceof Error
  ? err.message
  : String(err)
```

所以未来如果希望进一步减少重复代码，可以统一使用：

```tsx
getErrorMessage(err)
```

它只负责把未知错误转换成可显示字符串，不负责 HTTP 状态判断。

例如 `403` 这种特殊处理仍然应该通过：

```tsx
err instanceof ApiError &&
err.status === 403
```

完成。

---

### 27.14 MSAL 配置已经明确

`lib/msal.ts` 中使用：

```tsx
new PublicClientApplication({
  auth: {
    clientId,
    authority:
      `https://login.microsoftonline.com/${tenant}`,
    redirectUri,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
});
```

配置来源：

```text
clientId
→ NEXT_PUBLIC_MICROSOFT_CLIENT_ID

tenant
→ NEXT_PUBLIC_MICROSOFT_TENANT
→ 默认 consumers

apiScope
→ NEXT_PUBLIC_API_SCOPE

redirectUri
→ NEXT_PUBLIC_MICROSOFT_REDIRECT_URI
→ 默认 http://localhost:3000/redirect
```

因此当前认证层配置已经比较清楚。

---

### 27.15 MSAL Cache 使用 `sessionStorage`

现在已经确认：

```tsx
cache: {
  cacheLocation: "sessionStorage",
}
```

也就是说 MSAL 的浏览器缓存位置是：

```text
sessionStorage
```

简单理解：

```text
同一个浏览器会话 / tab 生命周期内
→ 可以继续使用缓存

关闭对应浏览器会话后
→ 不像 localStorage 那样长期持久保存
```

具体 token 是否需要重新向 Microsoft 获取，仍由 MSAL 自身的 silent acquisition 机制决定。

---

### 27.16 MSAL 初始化使用共享 Promise

当前：

```tsx
let initializePromise:
  Promise<void> | null = null;
```

初始化函数：

```tsx
export function initializeMsal() {
  if (!initializePromise) {
    initializePromise =
      msalInstance.initialize();
  }

  return initializePromise;
}
```

所以：

```text
第一次 initializeMsal()
↓
创建 msalInstance.initialize() Promise
↓
保存到 initializePromise

以后再次 initializeMsal()
↓
复用同一个 Promise
```

这意味着：

```text
AuthProvider 初始化
signIn()
getAccessToken()
```

都可以安全调用：

```tsx
await initializeMsal();
```

而不会各自启动一套独立的 MSAL 初始化流程。

---

### 27.17 Token 获取策略已经明确

`AuthProvider` 中：

```tsx
const getAccessToken =
  useCallback(async () => {
    await initializeMsal();

    const current =
      msalInstance.getActiveAccount() ??
      account ??
      msalInstance.getAllAccounts()[0];

    if (!current) {
      throw new Error(
        "No Microsoft account is signed in."
      );
    }

    try {
      return await msalInstance
        .acquireTokenSilent({
          account: current,
          scopes: [apiScope],
          redirectUri,
        });
    } catch (error) {
      if (
        error instanceof
        InteractionRequiredAuthError
      ) {
        return await msalInstance
          .acquireTokenPopup({
            account: current,
            scopes: [apiScope],
            redirectUri,
          });
      }

      throw error;
    }
  }, [account]);
```

因此：

```text
getAccessToken()
↓
initializeMsal()
↓
找到当前 account
↓
acquireTokenSilent()
├── 成功
│   ↓
│   返回 AuthenticationResult
│
└── InteractionRequiredAuthError
    ↓
    acquireTokenPopup()
    ↓
    返回 AuthenticationResult
```

页面不需要知道 Silent / Popup 的具体认证细节。

---

### 27.18 Account 选择方式已经明确

AuthProvider 初始化时：

```tsx
const existing =
  msalInstance.getAllAccounts()[0] ??
  null;
```

如果存在账号：

```tsx
msalInstance.setActiveAccount(
  existing
);
```

登录成功以后：

```tsx
msalInstance.setActiveAccount(
  result.account
);
```

获取 Token 时按以下顺序寻找账号：

```text
1. msalInstance.getActiveAccount()
2. React account state
3. msalInstance.getAllAccounts()[0]
```

所以当前主要是一个明确的单 active-account 使用模式。

---

### 27.19 AuthProvider 的函数引用是稳定的

已经确认：

```text
signIn
→ useCallback(..., [])

signOut
→ useCallback(..., [account])

getAccessToken
→ useCallback(..., [account])
```

所以在相关 dependency 不变时，这些函数引用不会因为普通 render 而重新创建。

Auth Context value 同时使用：

```tsx
useMemo<AuthContextValue>(...)
```

因此：

```text
ready
account
signIn
signOut
getAccessToken
```

没有变化时，Context value 也保持稳定。

这使页面 Effect 可以正常把：

```tsx
getAccessToken
```

放进 dependency array，而不需要关闭 `exhaustive-deps`。

---

### 27.20 AuthProvider 也有异步失效保护

MSAL 初始化 Effect 中使用：

```tsx
let mounted = true;
```

初始化完成前会检查：

```tsx
if (!mounted) {
  return;
}
```

cleanup：

```tsx
return () => {
  mounted = false;
};
```

所以：

```text
AuthProvider 已卸载
↓
MSAL 初始化稍后才完成
↓
不会继续 setAccount / setReady
```

这和页面里的：

```text
cancelled flag
```

属于同一种思想：

```text
失效的异步任务
→ 不再修改 React State
```

---

### 27.21 Next.js 当前没有额外的数据缓存层配置

`next.config.ts` 当前只有：

```tsx
const nextConfig: NextConfig = {
  transpilePackages: [
    "@pricewatch/ui",
    "@pricewatch/shared",
    "@pricewatch/api",
  ],
};
```

所以这里明确配置的是 workspace package transpilation。

没有看到额外配置：

```text
自定义 Next.js data cache
proxy / rewrite 数据层
request retry
TanStack Query
SWR
```

并且共享 `request()` 已经明确使用：

```tsx
cache: "no-store"
```

因此当前前端 API 数据获取是明确的实时请求模式，而不是依赖 Next.js / 浏览器 Fetch cache 的模式。

---

### 27.22 当前完整的数据与认证调用链

现在可以比较完整地画出：

```text
Environment Variables
↓
lib/msal.ts
↓
PublicClientApplication
├── authority
├── redirectUri
└── sessionStorage cache
↓
initializeMsal()
↓
AuthProvider
↓
ready / account / getAccessToken
↓
Page useEffect
↓
getAccessToken()
↓
acquireTokenSilent()
   │
   └── InteractionRequiredAuthError
       ↓
       acquireTokenPopup()
↓
AuthenticationResult
↓
accessToken
↓
fetchXxxData()
↓
web/lib/api.ts
↓
apiFetch()
↓
@pricewatch/api/core
↓
packages/api/src/core.ts
↓
request()
├── 合并 Headers
├── Authorization: Bearer ...
├── JSON Content-Type
├── RequestInit / AbortSignal
└── cache: no-store
↓
原生 fetch()
↓
ASP.NET Core API
↓
HTTP Response
├── !ok → ApiError
├── 204 / empty → undefined
└── JSON body → JSON.parse()
↓
Promise callback
↓
React State
↓
Render
```

现在已经可以很清楚地分出五个层次：

```text
Authentication configuration
→ lib/msal.ts

Authentication workflow
→ AuthProvider / MSAL

HTTP infrastructure
→ apiFetch / request

Page data loading
→ fetchXxxData / useEffect

UI state
→ React State / Render
```

---

### 27.23 现在剩下的是未来设计选择，而不是代码未知

前面文档中很多内容曾经属于：

```text
不知道当前代码有没有实现
```

现在已经基本确认完毕。

当前真正还没有实现、但未来可以根据需要决定的主要是：

```text
是否把 cancelled flag 升级为 AbortController

是否加入自动 retry

是否加入 401 后重新取 token + retry

是否加入更复杂的 cache / deduplication

是否引入 TanStack Query / SWR
```

这些已经不是需要继续调查当前代码才能回答的问题，而是未来的架构选择。

当前 PriceWatch 的原则仍然是：

```text
先保持简单、透明、统一
↓
真的出现复杂需求以后
↓
再增加对应抽象
```

---

## 28. 当前适合 PriceWatch 吗

PriceWatch 当前大致是：

```text
Next.js frontend
ASP.NET Core API
Microsoft authentication
Neon PostgreSQL
多个 dashboard / detail 页面
```

在这个规模下：

```text
AuthProvider
↓
getAccessToken
↓
fetchXxxData
↓
Promise callback
↓
React State
```

是一套：

```text
简单
透明
容易调试
容易理解
```

的方案。

目前没有明显必要仅为了“架构更高级”立刻引入复杂的数据 fetching library。

更重要的是保持所有页面一致。

统一规则：

```text
Auth ready
↓
Account exists
↓
Get token
↓
Fetch function
↓
Return data
↓
Update state
↓
Render
```

等以后明显遇到：

```text
大量重复 loading/error 代码
复杂 cache
自动 retry
后台 refresh
请求 deduplication
真正的 request cancellation
复杂 optimistic update
```

再考虑：

```text
TanStack Query
SWR
```

会更合理。

---

## 29. PriceWatch 当前规则

可以把当前前端数据加载规范浓缩成下面几条。

### Rule 1

```text
fetchXxxData()
只负责读取和组合数据。
```

不要在里面：

```tsx
setState(...)
```

### Rule 2

```text
useEffect
负责决定什么时候开始同步。
```

### Rule 3

```text
Promise callback
负责把异步结果写入 State。
```

### Rule 4

Effect 中使用：

```tsx
cancelled
```

防止旧请求结果覆盖当前页面。

### Rule 5

用户操作函数可以正常：

```tsx
setState(...)
```

例如：

```text
Archive
Restore
Accept
Reject
Delete
```

### Rule 6

用户操作成功后：

```text
重新 fetch
```

优先相信服务器最终状态，而不是前端自己复制后端业务规则。

### Rule 7

保持：

```text
ready
loading
actionBusy
```

职责分离。

---

## 30. 总结

`auth → fetch → state` 的核心作用是：

```text
Auth
→ 决定谁可以访问

Fetch
→ 从服务器读取真实数据

State
→ 决定 React 页面现在显示什么
```

当前 PriceWatch 又进一步把 Fetch 和 State 分开：

```text
Auth
↓
Access Token
↓
fetchXxxData()
↓
return data
↓
Promise callback
↓
setState()
↓
Render
```

最重要的设计原则是：

```text
fetch 函数不修改 React State
```

这样：

```text
数据获取职责
```

和：

```text
UI 状态职责
```

不会混在一起。

主要优点：

```text
认证边界清晰
Fetch 职责清晰
React State 职责清晰
Loading / Error 容易控制
页面之间模式一致
可以避免旧请求覆盖新状态
操作完成后容易重新同步服务器
实现仍然简单直接
```

主要缺点：

```text
客户端首屏仍有额外等待
页面仍会积累多个 State
多个页面还有少量重复代码
cancelled flag 不会真正取消 HTTP
复杂度增长后可能需要专门的数据 fetching 工具
```

对于当前 PriceWatch，这套方案仍然合适。

当前最值得坚持的不是继续增加抽象，而是让：

```text
Products
Subscriptions
Reviews
Product Detail
```

都遵守同一套：

```text
Auth
→ Token
→ Fetch
→ State
→ Render
```

规则。
