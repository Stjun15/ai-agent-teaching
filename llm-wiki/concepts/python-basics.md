---
type: concept
last_updated: 2026-09-23
id: python-basics
name: Python 基础速通
prerequisites: []
difficulty: 1
estimated_time: 30min
tags: [language, python, beginner, reading]
---

# Python 基础速通

---

## 这是哪一站

后面所有模块里你都会看到代码。这一讲不是要你学会 Python——**认识最基本的几个词、能看懂一段代码在干嘛，就够了。** 看完开场白就可以进 LLM API，后面如果遇到看不懂的代码，随时回来看偷懒版的三招。

---

## 编程这件事

你打开的任何网页、App、AI 助手，背后都是一行行代码。Python 是其中最好读的一种——它长得像英语。

```python
name = "小明"
score = 95
if score >= 90:
    print(f"{name}，优秀！")
```

↑ 这就是 Python。不写代码的人也能一眼猜出它在做什么。

---

## 🤔 你想怎么学？

|        | 📚 完整版                              | 🏃 偷懒版                  |
| ------ | -------------------------------------- | -------------------------- |
| 时长   | 30 分钟                                | 10 分钟                    |
| 方式   | 6 讲系统学习，覆盖所有基础语法         | 3 招直击要害，只看不背     |
| 内容   | 变量、函数、类、异步、数据结构、装饰器 | 认关键词 + 认结构 + 读一段 |
| 你会的 | 能系统解释 Python 语法                 | 能看懂 Python 代码         |

**选哪个都行。随时可以切回去。**

---

<!-- PATH:LAZY START -->

## 🏃 偷懒版：三招看懂 Python

### 招一：认关键词 —— 别背，背不完

Python 代码看起来复杂，但 90% 的行都是这几个关键词在干活：

```python
def         → 定义函数
import      → 借别人的代码来用
return      → "这个函数的结果是……"
if / elif / else  → 条件判断
for / in    → 遍历（对每个元素做同样的事）
try / except → 试一下，错了就兜底
class       → 定义一个类（一种"模板"）
async / await → 异步操作（等一下，做完再继续）
```

> 遇到不认识的词？问 AI，别查字典。查了也记不住。

### 招二：认结构 —— 记住三种括号和缩进

```python
# 花括号 { } → 字典（键值对）
config = {
    "model": "gpt-4o-mini",
    "temperature": 0.7,
}

# 方括号 [ ] → 列表（有序排列）
tools = ["search", "calculate", "read_file"]

# 圆括号 ( ) → 函数参数 或 元组
result = greet("小明")       # 调用函数
point = (10, 20)             # 元组（不可变的列表）
```

```
Python 的一个特殊之处：缩进

在其它语言里，花括号 {} 表示"这些代码是一块的"：
  if (score > 90) {
      grade = "A";    ← 花括号里
  }

在 Python 里，缩进就是花括号：
  if score > 90:
      grade = "A"     ← 缩进的这行，属于上面的 if
  grade = "B"         ← 不缩进的这行，不属于 if
```

### 招三：读一段真的代码

下面是一段真实的 AI Agent 代码。不要慌，用招一和招二的方法逐行看：

```python
import openai

client = openai.OpenAI(api_key="sk-xxx")

SYSTEM_PROMPT = """你是一个编程助教。回答要简洁，用中文。"""

def ask_ai(question: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
        ],
        temperature=0.7,
    )
    return response.choices[0].message.content


if __name__ == "__main__":
    answer = ask_ai("什么是 Agent Loop？")
    print(f"AI 回答：{answer}")
```

```
不要求你解释每一行。只要你能说出：

✅ import 了什么
✅ def 定义了什么函数
✅ 函数里调用了一个 API（client.chat...create）
✅ 返回了什么（response.choices[0].message.content）
✅ if __name__ == ... 这行是程序的入口

如果能说出这五条 → 你已经能看懂 90% 的 AI 相关 Python 代码了。
```

---

<!-- PATH:LAZY END -->

<!-- PATH:FULL START -->

## 📚 完整版

> **AI：** 这一版是给想"系统掌握"的人准备的。6 讲，每讲 5 分钟。语法规则、类继承、装饰器、类型泛型……全部覆盖。准备好了吗？

---

### 第一讲：变量、类型、你不需要记住的类型系统

```python
# Python 里声明变量什么都不需要 —— 直接写
name = "AI助教"          # str（字符串）
age = 2                  # int（整数）
temperature = 0.7        # float（浮点数）
is_streaming = True      # bool（布尔值），注意首字母大写

# 类型注解（: 后面的）—— 写了只是提示，Python 不强制检查
model: str = "gpt-4o-mini"
max_tokens: int = 2000

# 但你有可能会看到这种写法：
from typing import Optional, Union, Literal

def fetch(
    url: str,
    timeout: Optional[int] = None,               # 可以是 int 或 None
    method: Literal["GET", "POST", "PUT"] = "GET" # 只能是这三个之一
) -> Union[dict, list, None]:                     # 返回值可以是 dict、list 或 None
    pass
```

```
TypeScript 有 string/number/boolean/any/unknown/never/void/undefined/null
Python 有 str/int/float/bool/None/Optional/Union/Literal/Any

—— 你不需要背。你只需要知道：
看到冒号后面的词 → 这是类型提示。跳过它，代码照样跑。
```

---

### 第二讲：函数 — def、参数、返回值和泛型

```python
# 基本函数
def greet(name: str) -> str:
    return f"你好，{name}！"

# 默认参数、可变参数
def create_prompt(
    question: str,
    context: str = "",                        # 默认值
    *examples: str                            # 可变参数（可以传任意多个）
) -> str:
    parts = [question]
    if context:
        parts.append(f"上下文：{context}")
    for ex in examples:
        parts.append(f"示例：{ex}")
    return "\n".join(parts)

# 调用示例
prompt = create_prompt(
    "什么是 RAG？",
    "RAG = Retrieval-Augmented Generation",
    "例1：先检索再回答",
    "例2：引用原文再总结"
)
```

---

### 第三讲：类 — 继承、self、super

```python
class Agent:
    """基础 Agent 类"""
    def __init__(self, name: str, model: str):
        self.name = name
        self.model = model
        self.history: list[str] = []

    def add_message(self, content: str) -> None:
        self.history.append(content)

    def think(self, question: str) -> str:
        raise NotImplementedError("子类必须实现 think 方法")


class TeacherAgent(Agent):
    """教师 Agent —— 继承自 Agent"""
    def __init__(self, name: str, model: str, teaching_style: str = "苏格拉底"):
        super().__init__(name, model)          # 调用父类的 __init__
        self.teaching_style = teaching_style

    def think(self, question: str) -> str:
        return f"以{self.teaching_style}方式回答：{question}"


# 使用
teacher = TeacherAgent("teacher", "gpt-4o")
teacher.add_message("第一课开始")
reply = teacher.think("什么是 LLM？")
```

```
self = this（每个方法的第一个参数，代表"自己"）
__init__ = constructor（创建对象时自动调用）
super() = 父类（调用父类的方法）
```

---

### 第四讲：异步 — async/await 和真正的"等一下"

```python
import aiohttp
import asyncio
from typing import Any

async def fetch_json(url: str) -> dict[str, Any]:
    """异步请求一个 API，返回 JSON"""
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status != 200:
                raise RuntimeError(f"请求失败：{response.status}")
            return await response.json()


async def fetch_all(urls: list[str]) -> list[dict[str, Any]]:
    """并发请求多个 URL"""
    tasks = [fetch_json(url) for url in urls]
    return await asyncio.gather(*tasks)     # ← 同时等所有请求


# 运行
# asyncio.run(fetch_all(["https://api1.com", "https://api2.com"]))
```

```
读异步代码的规则：

async def → 此函数内有 await
await     → "停在这里，等对方做完再继续"
gather()  → "同时等好几个，谁先完都不影响别人"

这部分确实复杂。好在——你不需要写异步代码，
你只需要知道：看到 async/await 就是在处理"等待"。
```

---

### 第五讲：数据结构 — list/dict/set/tuple 全上

```python
from typing import TypedDict

# 列表推导式（一行生成列表，看起来很酷）
squares = [x**2 for x in range(10) if x % 2 == 0]
# → [0, 4, 16, 36, 64]

# 字典推导式
word_lengths = {word: len(word) for word in ["AI", "Agent", "Python"]}
# → {"AI": 2, "Agent": 5, "Python": 6}

# 带类型的字典（TypedDict）
class ModelConfig(TypedDict):
    model: str
    temperature: float
    max_tokens: int

config: ModelConfig = {
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 2000,
}

# 集合（不重复的元素）
unique_models = {"gpt-4o", "gpt-4o-mini", "claude-3.5"}
print("gpt-4o" in unique_models)  # → True

# 集合运算
base = {"a", "b", "c"}
extend = {"c", "d"}
print(base | extend)   # 并集 → {"a", "b", "c", "d"}
print(base & extend)   # 交集 → {"c"}
```

---

### 第六讲：装饰器、上下文管理器、f-string、解包

```python
import time
from functools import wraps

# 装饰器：给函数"穿衣服"
def log_time(func):
    """记录函数执行时间的装饰器"""
    @wraps(func)
    def wrapper(*args: object, **kwargs: object) -> object:
        start = time.time()
        result = func(*args, **kwargs)
        duration = time.time() - start
        print(f"{func.__name__} 执行耗时：{duration:.2f}秒")
        return result
    return wrapper

@log_time
def ask_ai(question: str) -> str:
    time.sleep(1.5)  # 模拟 AI 思考
    return f"回答：{question}"


# 上下文管理器（with 语句）
class Database:
    """模拟数据库连接"""
    def __enter__(self):
        print("连接数据库……")
        return self
    def __exit__(self, *args):
        print("关闭数据库连接")

with Database() as db:
    print("执行查询")  # 退出 with 块时自动 __exit__


# f-string + 格式化
name, score, rate = "小明", 95, 0.857
print(f"学员：{name:>6}")           # 右对齐，占6位
print(f"分数：{score:03d}")         # 填充到3位：095
print(f"正确率：{rate:.1%}")        # 百分比：85.7%


# 解包（一行拆出多个变量）
config = ("gpt-4o-mini", 0.7, 2000)
model, temp, max_tok = config        # 直接拆

headers = {"Authorization": "Bearer xxx", "Content-Type": "application/json"}
def log(**kwargs: str):              # ** = 收集所有关键字参数
    for key, value in kwargs.items():
        print(f"{key}: {value}")
log(**headers)                       # ** = 把字典拆成关键字参数
```

```
读完第六讲的你不会全部记住。这很正常。
这六讲的存在价值不是让你背——是让你在读到这类代码时，
能说出一句："我见过这个，它的大概作用是……"
```

---

## 示范代码

下面是一段真实的 AI Agent 调用代码 —— 不要求你解释每一行，只要能说出 import 了什么、def 定义了什么、函数调用了什么 API 就行。

```python
# ① 导入 openai 库 —— 这是我们和大模型通话的工具箱
import openai

# ② 创建客户端，api_key 是你的身份令牌（正式项目不要硬编码，放环境变量里）
client = openai.OpenAI(api_key="sk-xxx")

# ③ 系统提示词：告诉模型它是什么角色、有什么规矩
SYSTEM_PROMPT = """你是一个编程助教。回答要简洁，用中文。"""

# ④ 定义一个函数，把「发消息给 AI → 拿到回复」整个流程封装起来
def ask_ai(question: str) -> str:
    # ⑤ 调用 chat.completions.create —— 这就是一次大模型请求
    response = client.chat.completions.create(
        model="gpt-4o-mini",                # 用什么模型（便宜、快）
        messages=[                          # 消息列表：系统 + 用户
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": question},
        ],
        temperature=0.7,                    # 随机度：0=死板，1=天马行空
    )
    # ⑥ 从返回结果里取出 AI 的回复文本
    return response.choices[0].message.content

# ⑦ 程序入口：调用 ask_ai，把回答打印出来
if __name__ == "__main__":
    answer = ask_ai("什么是 Agent Loop？")
    print(f"AI 回答：{answer}")
```

## 实践任务

读下面这段代码。这是真实 AI 项目里会出现的代码——包含类、异步、错误处理、装饰器。

```python
import asyncio
import time
from functools import wraps
from typing import Callable, TypeVar

T = TypeVar("T")

def retry(
    max_attempts: int = 3,
    backoff: float = 2.0,
    exceptions: tuple[type[BaseException], ...] = (Exception,),
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """装饰器：给函数加重试逻辑"""
    def decorator(fn: Callable[..., T]) -> Callable[..., T]:
        @wraps(fn)
        async def wrapper(*args: object, **kwargs: object) -> T:
            last_error: Exception | None = None
            for attempt in range(max_attempts):
                try:
                    return await fn(*args, **kwargs)          # type: ignore[return-value]
                except exceptions as error:
                    last_error = error
                    if attempt < max_attempts - 1:
                        wait = backoff ** attempt
                        print(f"重试 {attempt + 1}/{max_attempts}，等待 {wait}秒……")
                        await asyncio.sleep(wait)
            raise last_error or RuntimeError("重试耗尽")
        return wrapper
    return decorator


@retry(max_attempts=3, backoff=2.0, exceptions=(ConnectionError, TimeoutError))
async def call_llm(prompt: str) -> str:
    """模拟调用 LLM API"""
    attempt_count = call_llm._attempts if hasattr(call_llm, "_attempts") else 0
    call_llm._attempts = attempt_count + 1
    if attempt_count < 2:
        raise ConnectionError("网络不可达")
    return f"LLM 回复：{prompt[:20]}……"


async def main():
    start = time.time()
    result = await call_llm("请详细解释什么是 Transformer 架构中的注意力机制？")
    print(f"结果：{result}")
    print(f"总耗时：{time.time() - start:.1f}秒")

# 如果以上看不懂：
# 你需要会的只有：
#   async def = 异步函数
#   await = 等一下
#   try/except = 试一下，错了兜底
#   @xxx = 装饰器，给函数附加了某些功能
#
# 你敢说你不认得这几行吗？
```

### 标注练习

不要求你写代码。只标注以下要点：

| 检查项                                      | 回答 |
| ------------------------------------------- | ---- |
| `async def` 出现了几次？分布在哪些函数？    |      |
| `try / except` 在做什么？                   |      |
| `@retry(...)` 是装饰器吗？它在修饰谁？      |      |
| `await` 后面跟了什么？                      |      |
| `TypeVar("T")` 你猜是什么？（泛型，不重要） |      |
| 这段代码大致在做什么？（一句话）            |      |

---

<!-- PATH:FULL END -->

<!-- PATH:SHARED START -->

---

# 🧠 顺手扔掉一件事

完整版 30 分钟还是偷懒版 10 分钟——你是不是在纠结这个？

你有没有发现，纠结本身就暴露了一种很旧的习惯：

> **「老师教 → 我听课 → 考试打分 → 过关」**

十六年。从小学一年级起你就被按在这个模型里。坐好，听讲，做题，等分数。语法要全会、概念要背熟、选择题不能错——然后你才有资格往下走。

但现在你要做的这件事，**和考试没有半点关系**。

没有人给你打「Python 语法等级」。没有标准答案。`temperature` 设 0.7 还是 0.8？`TypeVar` 怎么写？Decorator 里要不要加 `functools.wraps`？

**——你交付的那个网页跑不跑得起来，才是唯一算数的东西。**

所以完整版和偷懒版**没有区别**。不是安慰你。这是实话：你学了 30 分钟还是 10 分钟，不重要。语法背了几个，不重要。重要的是你看到代码不害怕了——知道自己看不懂什么，知道怎么去查。

你不需要学到 100 分才能开始。「看得懂」就够了。

从这一讲开始，记住一句话：

> **你不是来考试的。你是来造东西的。**

<br>

# 🎯 结算

你选了完整版，花了 30 分钟，记住了变量、函数、类、异步、装饰器。
你选了偷懒版，花了 10 分钟，学会了认关键词、认结构、读一段。

**猜猜看，后面 9 个模块里谁更有优势？**

答案是：**没有区别。**

因为后面的学习里，你根本不需要「写 Python 代码」——
你需要的是：

```
读得懂 → 知道 AI 在说什么
说得清 → 能告诉 AI 你要什么
做得到 → 把 AI 给的代码跑起来
```

语法真的不重要吗？

重要。`async/await` 搞不懂，你看不懂异步代码。
`类继承` 搞不懂，你看不懂 Agent 框架怎么搭的。

但它们不该成为你的**前置条件**。

如果非要等 Python 语法学精通了再碰 AI——
那你要先学变量→函数→类→异步→装饰器→元类→GIL→GC→C扩展……
等你学完，课已经结束了。

**正确的顺序是反过来：**

```
遇到一段看不懂的 → 问 AI"这行在干什么" → 懂了 → 继续
                                              │
                                              └─ 如果反复遇到同一个语法
                                                 → 花 5 分钟专门学一下
```

语法是**工具**，不是**门槛**。
用到什么学什么。在做的过程中学。
不可能什么都等精通了才去做。

偷该偷的懒——不是不学，是不提前学。
做该做的事——开始了，才知道自己缺什么。

<br>

| 检查项                              | 自己回答 |
| ----------------------------------- | -------- |
| Python 声明变量需要关键字吗？       |          |
| `def` 是什么？                      |          |
| `class` 是什么？                    |          |
| `await` 在做什么？                  |          |
| `try / except` 在做什么？           |          |
| 花括号 `{}` 是什么数据结构？        |          |
| `@xxx` 写在函数上面是什么意思？     |          |
| 能看懂上面那段重试装饰器的 60% 吗？ |          |

---

> **下一步：** 带着"只看不写"的自信，进入 [LLM API 入门](./llm-api.md)。
> 你会发现，代码示例不再可怕——你可以读懂了。

<!-- PATH:SHARED END -->
