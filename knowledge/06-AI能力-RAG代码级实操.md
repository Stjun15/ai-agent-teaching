# Phase 4 AI能力 · RAG 代码级实操（v1.0）

> **一句话总结：** RAG 概念文档的代码级落地，复用 RAG实战 的组件并补上 build_kb.py/query.py，搭出可运行的最简 RAG 链路，为 ai-service 铺路。

> **前置文档**
>
> - `06-AI能力-RAG实战`（`06-AI能力/`）—— 本文"上一篇"，概念先行。

> **后置文档**
>
> - `07-平台-工程落地-从零搭ai-service`（`07-平台治理与交付/`）—— 本文"配套参考"：RAG 代码最终收敛到 ai-service。

> 上一篇：[06-AI能力-RAG实战.md](06-AI能力-RAG实战.md)　|　下一篇：无　（RAG链路）

> **AI角色：老师。** 你不是编码者，你是出题者+批改者+讲解者。本文件是 `06-AI能力-RAG实战.md` 的**代码级补完**——概念篇讲了 RAG 的五组件链路，本文件把"embedding→切分→存储→检索→生成"落到**可运行的代码**。
> **教学理念（对齐 `00-教学理念-提示词驱动.md`）：** 本文件采用**提示词驱动**——每步四件套：① 意图（要做什么/关键决策）→ ② Prompt（六要素模板指挥 AI）→ ③ 参考代码（验收对照，不抄写）→ ④ 验证清单（跑通才算过）。你不手写代码，你精准操控 AI。
> **防什么失败？** 防"概念都懂但写不出代码"（RAG 实战文档的动手环节是任务描述级，照着做会卡住）。防"代码跑不通就跳过"（必须每个 Step 验证）。防"文档和代码脱节"（ai-service 目录 ⏳ 待建，本文件代码从零搭）。
> **配套参考：** `06-AI能力-RAG实战.md`（概念讲解）、`07-平台-工程落地-从零搭ai-service.md`（ai-service 落地篇，RAG 代码最终收敛到 ai-service）。

---

## 设计原理

| 原则                   | 在本实操中的体现                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **复用概念代码**       | 直接复用 RAG 实战文档的 `embedding_service.py`/`vector_store.py`/`rag_service.py`，不重写                                                              |
| **补上缺口**           | 补上概念文档没给的 `build_kb.py`（构建知识库）和 `query.py`（查询脚本）——动手环节卡住的根源                                                            |
| **最小可行**           | 只搭最简 RAG 链路（切分→向量化→存→检索→生成），不做混合检索/Rerank（那是选做）                                                                         |
| **可运行验证**         | 每个 Step 都有验证标准，最后跑通"问→答"闭环                                                                                                            |
| **为 ai-service 铺路** | 代码直接建在真实工程 `D:\AgentHub\AgentHub\ai-service\rag_demo\`——这是 ai-service（Python 推理层）的第一块，ai-service 落地时**收编**它而不是另建/复制 |

---

## 这个技能解决什么问题

学完能回答：

- 怎么把 10 条商品描述变成可检索的知识库？
- 完整 RAG 链路每步的代码怎么写？
- 为什么用 bge-large-zh 而不是英文模型？
- 为什么用递归分块而不是固定长度？
- 为什么用 Qdrant 而不是 MySQL？
- 检索不到答案时怎么排查？

---

## 前置要求

- 已完成 `06-AI能力-RAG实战.md` 的概念讲解（七讲）和 Quiz
- 已安装 Python 3.10+ 和 Docker
- 有 OpenAI 兼容的 API Key（DeepSeek/qwen 均可）

---

### 🔒 G1 入口门禁

> **AI：** 确认以上前置条件全部满足。全部满足 → 放行。不满足 → 停止，提示先补前置。

---

## 概念讲解（快速回顾，不展开）

> 详细概念见 `06-AI能力-RAG实战.md`。这里只回顾动手要用的 5 个组件。

> **先自己设计：** 在对照下表之前，先自己列出 RAG 链路需要哪些模块（如 Embedding、切分、存储、检索、生成），并写出每个模块的职责和可能的文件名。然后对照本节组件表检查你的设计是否覆盖了关键组件。

| 组件           | 作用                                                | 对应文件                   |
| :------------- | :-------------------------------------------------- | :------------------------- |
| Embedding 服务 | 文本 → 1024 维向量（bge-large-zh-v1.5）             | `embedding_service.py`     |
| 切分服务       | 长文档 → 500 字分块（递归分块，语义完整）           | `chunking_service.py`      |
| 向量存储       | Qdrant 存向量 + HNSW 索引加速检索                   | `vector_store.py`          |
| RAG 服务       | 检索 → 增强 → 生成（完整链路）                      | `rag_service.py`           |
| 构建/查询脚本  | 建知识库 + 问答入口（**概念文档没给，本文件补上**） | `build_kb.py` / `query.py` |

**链路：** `query → embedding → vector search → top-K docs → prompt → LLM → answer`

---

### 提示词教学：`build_prompt` 拼接 Prompt 的六要素设计

> 本文件是代码级实操。RAG 的核心 prompt 是 `rag_service.py` 中的 `build_prompt` 函数——它把检索到的文档片段 + 用户问题拼成最终 prompt。这里说明六要素如何落到代码拼接逻辑。

**① `build_prompt` 的六要素映射**：

```python
# rag_service.py 中的 build_prompt
def build_prompt(question: str, retrieved_docs: list[dict]) -> str:
    docs_text = "\n\n---\n\n".join([
        f"[来源：{d['source']} 第{d.get('page', '?')}页]\n{d['content']}"
        for d in retrieved_docs
    ])
    return f"""你是一个基于知识库的问答助手。请根据以下文档片段回答用户问题。

文档片段：
{docs_text}

回答规则：
1. 只基于以上文档片段回答，不要使用训练数据中的知识
2. 如果文档中没有相关信息，回答"文档中未找到相关信息"
3. 如果文档片段之间存在矛盾，指出矛盾并标注各自的来源
4. 每条事实性回答末尾标注来源，格式：[来源：{文件名} 第{页码}页]
5. 不要编造文档中没有的信息

用户问题：{question}"""
```

| 六要素   | 代码中的体现                                                                       |
| :------- | :--------------------------------------------------------------------------------- |
| 角色     | `你是一个基于知识库的问答助手`                                                     |
| 任务     | `根据以下文档片段回答用户问题`                                                     |
| 上下文   | `{docs_text}`（检索到的 top-K 文档片段，每段带来源和页码）                         |
| 约束     | ① 只基于文档回答；② 找不到说"未找到"不编造；③ 文档矛盾标注来源；④ 每条事实标注来源 |
| 参考     | 文档片段格式：`[来源：文件名 第N页]\n内容`（结构化标注，方便 LLM 引用）            |
| 输出格式 | 自然语言回答，每段末尾带 `[来源：...]` 标注                                        |

**② 为什么拼接逻辑本身就是 prompt 设计**：

```
build_prompt 做的事 = 六要素的"上下文"和"约束"拼进 prompt：
  ① 检索结果 → 拼进"上下文"（文档片段）
  ② 来源标注 → 拼进"参考"（每条 chunk 带 source + page）
  ③ 回答规则 → 拼进"约束"（不编造、标注来源、矛盾处理）
  ④ 用户问题 → 拼进"任务"（要回答什么）

代码拼接 vs 手写 prompt 的核心区别：
  手写 prompt = 六要素固定写死
  代码拼接 = 相同六要素模板 + 动态填充检索结果（上下文是变量）
```

**③ 反例 + 为什么**：

```python
# ❌ 反例：直接把检索结果丢给 LLM，没有 prompt 模板
def build_prompt(question, docs):
    return f"问题：{question}\n参考资料：\n" + "\n".join([d['content'] for d in docs])

# 错在哪：
# ① 没有角色定义——LLM 可能当成闲聊，用自己的训练数据回答
# ② 没有约束"只基于文档"——LLM 可能忽略检索结果，编造信息
# ③ 没有来源标注——回答无法溯源，幻觉无法排查
# ④ 没有矛盾处理——两篇文档说法不一致，LLM 可能随机选一个
# ⑤ 没有"未找到"说明——检索为空时 LLM 可能硬编一个答案
```

**④ 完成标准**：

- [ ] `build_prompt` 是否拼接了来源标注？（`[来源：文件名 第N页]`）
- [ ] 是否约束"只基于文档回答"？（防止 LLM 用自己的训练数据）
- [ ] 是否约束"找不到说未找到"？（防止空检索时编造）
- [ ] 是否处理了文档矛盾？（标注各自来源，不替用户选）
- [ ] 检索结果是否做了去重和截断？（防止超出上下文窗口）

---

## Quiz（闭卷）

> **AI：** 出 5 道题考下面内容，每题先批改，不通过进入补考。

1. 完整 RAG 链路是哪几步？
2. 为什么用 bge-large-zh-v1.5 而不是英文模型？
3. 为什么用递归分块而不是固定长度分块？
4. 为什么用 Qdrant 而不是 MySQL 存向量？
5. `score_threshold` 参数的作用是什么？

---

## 补考环节

> **AI：** 对答错的题，换一个角度（非原题）再出题，直到学习者理解。例如：
>
> - 如果 Embedding 模型是英文的，检索中文商品会怎样？
> - 如果固定长度把"年假"和"病假"切到不同块，会有什么问题？
> - 如果不用 score_threshold，检索会返回什么？

---

## 动手环节：从零搭本地 RAG 系统（提示词驱动）

> **AI：** 指导学习者逐步完成。**每步四件套：① 意图 → ② Prompt（指挥 AI）→ ③ 参考代码（验收对照）→ ④ 验证清单。** ai-service 目录 ⏳ 待建，本文件代码从零搭。每步按"四样产出"确认理解（决策点填空/补全残缺 Prompt/错误检测/判断力日志）。全程约 120 分钟。
> **总目标：** 跑通 `python query.py`，输入"华为 Mate 60 Pro 多少钱"，返回真实商品信息。

### Step 0：环境准备（10 分钟）

**① 意图（要做什么/关键决策）：** 装依赖、起 Qdrant、建目录——搭好 RAG 的地基。关键决策：**用本地 Qdrant 而不是远程云服务**（免费、数据不出本地、低延迟）；**用 bge-large-zh-v1.5 本地模型而不是调 API**（免费、中文优化、数据安全）。

**② Prompt（指挥 AI 生成环境准备步骤）：**

```
【角色】你是 Python 环境工程师。
【任务】生成从零搭建本地 RAG 系统所需的环境准备命令。
【上下文】Windows 环境，Python 3.10+，Docker 已安装；目标目录 D:\AgentHub\AgentHub\ai-service\rag_demo。
【约束】用 pip 安装依赖；用 Docker 启动 Qdrant；给出 .env 模板（填入 API Key 占位符）。
【参考】依赖列表：qdrant-client, sentence-transformers, openai, langchain-text-splitters, python-dotenv。
【输出格式】分步命令 + 每步验证方法。
```

**③ 参考代码（验收对照，不抄写）：**

① 安装依赖：

```bash
pip install qdrant-client sentence-transformers openai langchain-text-splitters python-dotenv
```

② 启动 Qdrant（Docker）：

```bash
docker run -p 6333:6333 qdrant/qdrant
```

③ 新建目录：

```bash
mkdir -p D:\AgentHub\AgentHub\ai-service\rag_demo
cd D:\AgentHub\AgentHub\ai-service\rag_demo
```

④ 新建 `requirements.txt`：

```
qdrant-client
sentence-transformers
openai
langchain-text-splitters
python-dotenv
```

⑤ 新建 `.env`（填你的 API Key）：

```
OPENAI_API_KEY=你的key
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL=glm-4.7-flash
```

**④ 验证清单：**

- [ ] `docker ps` 能看到 qdrant 容器
- [ ] `pip list` 能看到 qdrant-client
- [ ] 目录 `D:\AgentHub\AgentHub\ai-service\rag_demo` 已创建

**🎯 决策点填空：** 为什么用本地 bge 模型而不是调 OpenAI Embedding API？（填空：① ____ ② ____ ③ ____）→ 答案：免费/数据安全/低延迟

---

### Step 1：写 embedding_service.py（10 分钟）

**① 意图（要做什么/关键决策）：** 写文本向量化服务——把商品描述变成 1024 维向量。关键决策：**用 bge-large-zh-v1.5 而不是 OpenAI text-embedding-3**（bge 是中文优化模型、本地跑免费、数据不出服务器；OpenAI 按 token 付费、数据出境）。

**② Prompt（指挥 AI 生成 embedding_service.py）：**

```
【角色】你是 Python 机器学习工程师，熟悉 sentence-transformers。
【任务】写一个 EmbeddingService 类，用 bge-large-zh-v1.5 模型把文本编码成向量。
【上下文】sentence-transformers 库，模型首次加载约 1.3GB 下载；输出 1024 维向量。
【约束】类名 EmbeddingService；方法 encode(text) 返回 list；方法 encode_batch(texts) 批量编码（带进度条）；构造函数接受 model_name 参数默认 BAAI/bge-large-zh-v1.5。
【参考】sentence-transformers 的 SentenceTransformer API。
【输出格式】完整 Python 代码，带注释说明为什么用本地模型。
```

**③ 参考代码（验收对照，不抄写）：**

```python
from sentence_transformers import SentenceTransformer

class EmbeddingService:
    """Embedding 服务：文本 → 向量。

    为什么用本地模型而不是调 API？
    1. 免费：不需要按 token 付费
    2. 数据安全：文本不出服务器
    3. 低延迟：没有网络请求开销
    """

    def __init__(self, model_name: str = "BAAI/bge-large-zh-v1.5"):
        # 首次加载会下载模型（约1.3GB），之后缓存到本地
        self.model = SentenceTransformer(model_name)
        self.dim = 1024  # bge-large-zh-v1.5 输出1024维向量

    def encode(self, text: str) -> list:
        """单条文本编码"""
        return self.model.encode(text).tolist()

    def encode_batch(self, texts: list) -> list:
        """批量编码。为什么用批量？一次编码100条比100次单独编码快10倍以上。"""
        return self.model.encode(texts, show_progress_bar=True).tolist()
```

**✅ 验证：** `python -c "from embedding_service import EmbeddingService; e=EmbeddingService(); print(len(e.encode('测试')))"` 输出 `1024`。

**④ 验证清单：**

- [ ] 文件 `embedding_service.py` 已创建，类名 `EmbeddingService`
- [ ] `python -c "from embedding_service import EmbeddingService; e=EmbeddingService(); print(len(e.encode('测试')))"` 输出 `1024`
- [ ] 能口头讲清：为什么用 bge-large-zh-v1.5 而不是调 OpenAI API？（决策点已在 Step 1 意图中回答）

**⚠️ 错误检测：** 如果输出不是 1024 而是其他数字（如 768），说明什么？（答案：加载了错误的模型——bge-large-zh-v1.5 是 1024 维，768 维是 bge-base-zh-v1.5 或其他模型）

---

### Step 2：写 chunking_service.py（10 分钟）

**① 意图（要做什么/关键决策）：** 写文档切分服务——把长商品描述切成 500 字的语义块。关键决策：**用递归分块而不是固定长度**（递归在句号/换行处切，语义完整；固定长度一刀切会把"年假"和"病假"拆到不同块）。

**② Prompt（指挥 AI 生成 chunking_service.py）：**

```
【角色】你是 Python 文本处理工程师。
【任务】写一个 ChunkingService 类，用递归字符切分器把长文本切成 500 字分块。
【上下文】langchain-text-splitters 的 RecursiveCharacterTextSplitter；分隔符优先级：段落→换行→句号→感叹号→问号→分号→逗号→空格。
【约束】类名 ChunkingService；chunk_size=500, chunk_overlap=50；方法 split(doc_id, text) 返回 list[dict]（每项含 doc_id/chunk_index/content）。
【参考】langchain_text_splitters 的 RecursiveCharacterTextSplitter API。
【输出格式】完整 Python 代码，带注释说明递归分块 vs 固定长度的区别。
```

**③ 参考代码（验收对照，不抄写）：**

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

class ChunkingService:
    """文档切分服务：长文档 → 500 字分块。

    为什么用递归分块而不是固定长度？
    固定长度在 500 字处一刀切，可能把"年假"和"病假"切到不同块，语义断裂。
    递归分块优先在段落/换行/句号处切，保持语义完整。
    """

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
        )

    def split(self, doc_id: int, text: str) -> list:
        """把一篇文档切成多个分块，每个分块带 doc_id 和 chunk_index"""
        chunks = self.splitter.split_text(text)
        return [
            {"doc_id": doc_id, "chunk_index": i, "content": chunk}
            for i, chunk in enumerate(chunks)
        ]
```

**✅ 验证：** `python -c "from chunking_service import ChunkingService; c=ChunkingService(); print(len(c.split(0, '第一段。'*200)))"` 输出分块数量（>1 说明切了）。

**④ 验证清单：**

- [ ] 文件 `chunking_service.py` 已创建，类名 `ChunkingService`
- [ ] `python -c "from chunking_service import ChunkingService; c=ChunkingService(); print(len(c.split(0, '第一段。'*200)))"` 输出 >1
- [ ] 能口头讲清：递归分块 vs 固定长度分块的核心区别（递归在自然断点切，语义完整）

**🎯 补全残缺 Prompt：** 下面是残缺的 Prompt（缺了 2 个要素），补全后喂给 AI，看 AI 输出是否接近参考代码：

```
【角色】你是 Python 工程师。
【任务】写一个切分服务。
【上下文】____（补全：langchain RecursiveCharacterTextSplitter + 分隔符优先级）
【约束】____（补全：chunk_size=500 + chunk_overlap=50 + split 返回格式）
【参考】无。
【输出格式】Python 代码。
```

---

### Step 3：写 vector_store.py（10 分钟）

**① 意图（要做什么/关键决策）：** 写向量存储服务——把向量存到 Qdrant，支持相似度检索。关键决策：**用 Qdrant 而不是 MySQL**（Qdrant 有 HNSW 索引，百万级向量毫秒级检索；MySQL 全表扫描，几千条就慢）；**用 COSINE 距离而不是欧氏距离**（余弦相似度对文本语义更准确）。

**② Prompt（指挥 AI 生成 vector_store.py）：**

```
【角色】你是 Python 后端工程师，熟悉 Qdrant 向量数据库。
【任务】写一个 VectorStoreService 类，封装 Qdrant 的集合创建、向量插入、相似度检索。
【上下文】Qdrant 运行在 localhost:6333；向量维度 1024（bge-large-zh-v1.5）；用 COSINE 距离。
【约束】类名 VectorStoreService；构造器接受 host/port；方法 create_collection(vector_size)、upsert_chunks(chunks, embeddings)、search(query_vector, top_k, score_threshold)。
【参考】qdrant-client 的 QdrantClient API。
【输出格式】完整 Python 代码，带注释说明为什么用 COSINE 和 score_threshold。
```

**③ 参考代码（验收对照，不抄写）：**

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

class VectorStoreService:
    """向量数据库服务：存储和检索文档向量。

    为什么用 Qdrant 而不是直接存 MySQL？
    Qdrant 专门为向量相似度搜索优化了索引（HNSW），
    百万级向量毫秒级检索，传统数据库做不到。
    """

    def __init__(self, host: str = "localhost", port: int = 6333):
        self.client = QdrantClient(host=host, port=port)
        self.collection_name = "hmall_knowledge"

    def create_collection(self, vector_size: int = 1024):
        """创建集合。定义向量维度和相似度算法。"""
        self.client.recreate_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(
                size=vector_size,          # 向量维度（bge-large-zh = 1024）
                distance=Distance.COSINE,  # 余弦相似度：值越大越相似
            )
        )

    def upsert_chunks(self, chunks: list, embeddings: list):
        """批量插入文档向量。为什么用 upsert？id 已存在则更新，不会报重复错误。"""
        points = [
            PointStruct(
                id=chunk["doc_id"] * 10000 + chunk["chunk_index"],
                vector=embedding,
                payload={
                    "doc_id": chunk["doc_id"],
                    "chunk_index": chunk["chunk_index"],
                    "content": chunk["content"],
                }
            )
            for chunk, embedding in zip(chunks, embeddings)
        ]
        self.client.upsert(collection_name=self.collection_name, points=points)

    def search(self, query_vector: list, top_k: int = 5, score_threshold: float = 0.5):
        """向量相似度检索。score_threshold：低于此相似度的结果丢弃（太不相关）。"""
        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=top_k,
            score_threshold=score_threshold,
        )
        return [
            {"score": r.score, "content": r.payload["content"], "doc_id": r.payload["doc_id"]}
            for r in results
        ]
```

**✅ 验证：** Qdrant 已启动（Step 0），`python -c "from vector_store import VectorStoreService; v=VectorStoreService(); v.create_collection(); print('集合已创建')"` 输出"集合已创建"。

**④ 验证清单：**

- [ ] 文件 `vector_store.py` 已创建，类名 `VectorStoreService`
- [ ] Qdrant 容器在跑（`docker ps`）
- [ ] `python -c "from vector_store import VectorStoreService; v=VectorStoreService(); v.create_collection(); print('集合已创建')"` 输出"集合已创建"
- [ ] 能口头讲清：为什么用 COSINE 而不是欧氏距离？score_threshold 的作用是什么？

**⚠️ 错误检测：** 如果 `create_collection()` 报连接错误，可能的原因是什么？（答案：Qdrant 没启动/端口不是 6333/Docker 容器挂了）

---

### Step 4：写 build_kb.py（15 分钟）——概念文档没给的关键脚本

**① 意图（要做什么/关键决策）：** 写知识库构建脚本——把 10 条商品描述经过切分→向量化→存 Qdrant，完成"文本→可检索向量"的转换。关键决策：**build_kb.py 是概念文档缺失的关键一环**——概念文档讲了 RAG 五组件但没给"怎么把数据灌进去"，本文件补上这个缺口。

**② Prompt（指挥 AI 生成 build_kb.py）：**

```
【角色】你是 Python 数据工程师。
【任务】写一个 build_kb.py 脚本，把 10 条商品描述通过切分→向量化→存 Qdrant 完成知识库构建。
【上下文】已有 embedding_service.py（EmbeddingService）、chunking_service.py（ChunkingService）、vector_store.py（VectorStoreService）；10 条商品描述在代码中硬编码为 PRODUCTS 列表。
【约束】先创建集合（vector_size=embedding.dim）；遍历 PRODUCTS 逐条切分→批量向量化→upsert 到 Qdrant；打印分块总数。
【参考】embedding_service.py 的 encode_batch 方法；vector_store.py 的 upsert_chunks 方法。
【输出格式】完整 Python 脚本，含 main() 函数和 10 条商品数据。
```

**③ 参考代码（验收对照，不抄写）：**

```python
import os
from dotenv import load_dotenv
from embedding_service import EmbeddingService
from chunking_service import ChunkingService
from vector_store import VectorStoreService

load_dotenv()

# 10 条 HMall 商品描述作为知识库
PRODUCTS = [
    "华为 Mate 60 Pro 手机，麒麟9000S芯片，5000mAh电池，支持卫星通信，售价6999元",
    "小米 14 手机，骁龙8Gen3芯片，徕卡光学镜头，90W快充，售价3999元",
    "iPhone 15 Pro 手机，A17 Pro芯片，钛金属边框，4800万像素主摄，售价7999元",
    "联想拯救者 Y9000P 游戏本，i9-14900HX处理器，RTX4060显卡，16英寸2.5K屏，售价8999元",
    "戴尔 XPS 13 轻薄本，酷睿Ultra7处理器，13.4英寸触控屏，重量1.17kg，售价10999元",
    "Apple Watch Series 9 智能手表，S9芯片，血氧监测，心率预警，售价2999元",
    "小米手环 8 Pro，1.74英寸AMOLED屏，150种运动模式，14天续航，售价399元",
    "索尼 WH-1000XM5 降噪耳机，30小时续航，多点连接，智能降噪，售价2499元",
    "Bose QuietComfort Ultra 耳机，沉浸式空间音频，24小时续航，售价2999元",
    "罗技 MX Master 3S 鼠标，8K DPI传感器，静音按键，多设备切换，售价699元",
]

def main():
    embedding_svc = EmbeddingService()
    chunking_svc = ChunkingService()
    vector_store = VectorStoreService()

    # 创建集合（向量维度 = embedding 维度）
    vector_store.create_collection(vector_size=embedding_svc.dim)

    # 切分 + 向量化 + 收集
    all_chunks = []
    all_embeddings = []
    for doc_id, text in enumerate(PRODUCTS):
        chunks = chunking_svc.split(doc_id, text)
        embeddings = embedding_svc.encode_batch([c["content"] for c in chunks])
        all_chunks.extend(chunks)
        all_embeddings.extend(embeddings)

    # 存入 Qdrant
    vector_store.upsert_chunks(all_chunks, all_embeddings)
    print(f"知识库构建完成：{len(all_chunks)} 个分块已存入 Qdrant")

if __name__ == "__main__":
    main()
```

**✅ 验证：** `python build_kb.py` 输出"知识库构建完成：N 个分块已存入 Qdrant"（首次会下载模型，约 1.3GB，耐心等待）。

**④ 验证清单：**

- [ ] 文件 `build_kb.py` 已创建
- [ ] `python build_kb.py` 输出"知识库构建完成：N 个分块已存入 Qdrant"（N > 0）
- [ ] 能口头讲清：build_kb.py 在 RAG 五组件链路中处于什么位置？（切分→向量化→存储，是"数据灌入"环节）

**🎯 决策点填空：** 为什么 build_kb.py 是概念文档缺失的关键脚本？（填空：概念文档讲了 ____ 但没给 ____）→ 答案：RAG 五组件 / 数据灌入脚本

---

### Step 5：写 rag_service.py（10 分钟）

**① 意图（要做什么/关键决策）：** 写 RAG 完整服务——把检索→增强→生成串成一条链路。关键决策：**temperature=0.2**（降低随机性减少幻觉，RAG 场景不需要创造性）；**检索为空时返回"未找到"而不是硬答**（防止幻觉）。

**② Prompt（指挥 AI 生成 rag_service.py）：**

```
【角色】你是 Python RAG 系统工程师。
【任务】写一个 RAGService 类，封装完整的 RAG 流程：问题向量化→Qdrant 检索→拼接 Prompt→LLM 生成。
【上下文】已有 EmbeddingService 和 VectorStoreService；LLM 用 OpenAI 兼容接口（.env 配置）。
【约束】类名 RAGService；构造器注入 embedding_svc/vector_store/llm_client；方法 query(user_question, top_k) 返回字符串；检索为空时返回"未找到相关信息"；temperature=0.2。
【参考】本文件前面"提示词教学"中 build_prompt 的六要素设计。
【输出格式】完整 Python 代码，带注释标注 RAG 四步流程。
```

**③ 参考代码（验收对照，不抄写）：**

```python
import os
from openai import OpenAI

class RAGService:
    """RAG 完整服务：检索 → 增强 → 生成。

    流程图：
    query → embedding → vector search → top-K docs → prompt → LLM → answer
    """

    def __init__(self, embedding_svc, vector_store, llm_client):
        self.embedding_svc = embedding_svc
        self.vector_store = vector_store
        self.llm = llm_client

    def query(self, user_question: str, top_k: int = 5) -> str:
        """RAG 查询：完整的检索增强生成流程。"""
        # 第一步：问题向量化
        question_vector = self.embedding_svc.encode(user_question)

        # 第二步：向量检索 Top-K 文档
        docs = self.vector_store.search(question_vector, top_k=top_k)

        if not docs:
            return "抱歉，我没有找到相关信息。请换个方式提问。"

        # 第三步：拼接 Prompt（增强）
        context = "\n---\n".join([d["content"] for d in docs])
        prompt = f"""你是 HMall 的智能客服。请严格根据以下商品信息回答用户问题。

规则：
1. 如果信息足以回答，请准确回答
2. 如果信息不足，请诚实地说"我不确定，建议咨询人工客服"
3. 不要编造任何信息

相关商品信息：
{context}

用户问题：{user_question}

请用中文回答："""

        # 第四步：LLM 生成回答
        response = self.llm.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "glm-4.7-flash"),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,  # 降低随机性，减少幻觉
        )
        return response.choices[0].message.content
```

**✅ 验证：** 无（本步不单独跑，Step 6 一起验证）。

**④ 验证清单：**

- [ ] 文件 `rag_service.py` 已创建，类名 `RAGService`
- [ ] 代码中 `temperature=0.2`（降低幻觉）
- [ ] 检索为空时返回"未找到"而不是硬答
- [ ] 能口头讲清：RAG 四步流程（向量化→检索→增强→生成）每一步的代码对应

---

### Step 6：写 query.py（10 分钟）——概念文档没给的关键脚本

**① 意图（要做什么/关键决策）：** 写问答入口脚本——把 RAG 全链路串起来，提供交互式问答界面。关键决策：**query.py 是概念文档缺失的第二个关键脚本**——概念文档没给"怎么用 RAG 系统回答问题"，本文件补上。

**② Prompt（指挥 AI 生成 query.py）：**

```
【角色】你是 Python 应用开发工程师。
【任务】写一个 query.py 交互式问答脚本，加载 RAG 全链路组件，提供命令行问答界面。
【上下文】已有 EmbeddingService/VectorStoreService/RAGService；LLM 用 OpenAI 兼容接口（.env 配置）。
【约束】用 dotenv 加载环境变量；初始化所有组件；while 循环接受用户输入；输入 exit 退出；打印 RAG 回答。
【参考】build_kb.py 的组件初始化方式。
【输出格式】完整 Python 脚本，含 main() 函数。
```

**③ 参考代码（验收对照，不抄写）：**

```python
import os
from dotenv import load_dotenv
from openai import OpenAI
from embedding_service import EmbeddingService
from vector_store import VectorStoreService
from rag_service import RAGService

load_dotenv()

def main():
    embedding_svc = EmbeddingService()
    vector_store = VectorStoreService()
    llm = OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        base_url=os.getenv("OPENAI_BASE_URL"),
    )
    rag = RAGService(embedding_svc, vector_store, llm)

    print("HMall 智能客服 RAG 已就绪。输入问题（exit 退出）：")
    while True:
        question = input("> ")
        if question.strip() == "exit":
            break
        answer = rag.query(question)
        print(f"答案：{answer}\n")

if __name__ == "__main__":
    main()
```

**✅ 验证：** `python query.py` 能启动，输入问题能返回答案。

**④ 验证清单：**

- [ ] 文件 `query.py` 已创建
- [ ] `python query.py` 能启动并显示"HMall 智能客服 RAG 已就绪"
- [ ] 输入"华为 Mate 60 Pro 多少钱"返回 6999 元（来自知识库，非编造）
- [ ] 输入"exit"能正常退出

---

### Step 7：端到端验证 + 换业务考试（15 分钟）

**① 意图（要做什么/关键决策）：** 端到端验证 RAG 全链路 + 换业务验证"只换知识库不动检索链路"。关键卖点：把 PRODUCTS 列表换成天机学堂的课程描述，检索/生成链路零改动。

**② Prompt（指挥 AI 生成验证方案）：**

```
【角色】你是测试工程师。
【任务】生成 RAG 系统端到端验证步骤和换业务验证方案。
【上下文】RAG 系统已搭完（embedding→切分→存储→检索→生成）；知识库是 10 条 HMall 商品描述。
【约束】端到端验证用 4 个测试用例（3 正例 + 1 反例）；换业务验证只改 PRODUCTS 列表，不改检索链路。
【输出格式】测试用例表格 + 换业务步骤。
```

**③ 参考代码（验收对照，不抄写）：**

运行：

```bash
cd D:\AgentHub\AgentHub\ai-service\rag_demo
python build_kb.py   # 构建知识库
python query.py      # 问答
```

**④ 验证清单：**

| 输入                        | 预期                               |
| :-------------------------- | :--------------------------------- |
| "华为 Mate 60 Pro 多少钱？" | 返回 6999 元（从知识库检索）       |
| "小米手环 8 Pro 续航多久？" | 返回 14 天                         |
| "索尼耳机降噪怎么样？"      | 返回 WH-1000XM5 相关信息           |
| "你们有冰箱吗？"            | 返回"未找到"（知识库没有，不编造） |

- [ ] 前 3 个问题返回真实商品信息（来自知识库，不是编造）
- [ ] 第 4 个诚实说"未找到"（不编造）

**排查指引（检索不到答案时）：**

1. `docker ps` 确认 Qdrant 在跑
2. `python build_kb.py` 确认分块数 > 0
3. 调低 `score_threshold`（0.5 → 0.3）看是否阈值太高
4. 检查 `.env` 的 API Key 和 Base URL 是否正确

---

## 换业务考试：换成天机学堂课程知识库

> **AI：** 换业务考试——**不给 Prompt**，只给意图 + 验证清单。学习者自写六要素 Prompt → AI 生成 → 双重验收：① 验证清单跑通 ② 能讲清"为什么这么写"。

**意图：** 把 RAG 系统的知识库从 HMall 商品换成天机学堂课程，验证"只换知识库不动检索链路"。

**要求：**

1. 修改 `build_kb.py` 的 PRODUCTS 列表，换成 5 条天机学堂课程描述（如"Python 入门：从零学 Python，含 30 课时，适合零基础"）
2. 重新构建知识库：`python build_kb.py`
3. 用 `python query.py` 验证：问"Python 入门课程有多少课时"返回 30 课时

**✅ 验证：**

- [ ] 不修改 embedding_service.py / chunking_service.py / vector_store.py / rag_service.py / query.py（只改 build_kb.py 的 PRODUCTS）
- [ ] `python query.py` 能正确回答天机学堂课程相关问题
- [ ] 能讲清"为什么只改数据不改检索链路"（检索链路 = 向量化→检索→生成，与知识库内容无关）

---

## 判断力日志

> **AI：** 引导学习者写一条判断力日志，四段式（问题→决策→取舍→防什么失败）。

**问题：** 本地 RAG 系统的 Embedding 模型选什么？向量数据库选什么？切分策略选什么？

**决策：**

- Embedding：bge-large-zh-v1.5（本地部署，1024 维，中文优化）
- 向量数据库：Qdrant（HNSW 索引，COSINE 距离）
- 切分策略：递归分块（chunk_size=500, chunk_overlap=50）

**取舍：**

- bge 本地 vs OpenAI API → 选本地：免费但占 1.3GB 内存；OpenAI 省内存但付费+数据出境
- Qdrant vs MySQL → 选 Qdrant：HNSW 毫秒检索但需 Docker；MySQL 零额外依赖但全表扫描
- 递归 vs 固定长度 → 选递归：语义完整但实现复杂；固定长度简单但语义断裂

**防什么失败：**

- 防"模型下载失败"：首次下载 1.3GB，网络不好会卡住 → 给出等待提示
- 防"检索不到结果"：score_threshold 设太高 → 给出调低阈值的排查指引
- 防"LLM 编造答案"：temperature=0.2 + 检索为空时返回"未找到" → 双重防幻觉

---

## 一句话记住本文件

> **"RAG 五件套：embedding（bge-large-zh 本地）+ 切分（递归分块）+ 存储（Qdrant COSINE）+ 检索（score_threshold 过滤）+ 生成（LLM temperature=0.2）；`build_kb.py` 建库、`query.py` 问答，换业务只改 PRODUCTS 列表，检索链路零改动。"**

---

## 完成记录

| 日期       | 状态   | 说明                                                                                                                                                                                                                                                                                                |
| ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-22 | 已创建 | 补 P0 缺口，RAG 代码级实操（从零搭本地 RAG 系统）                                                                                                                                                                                                                                                   |
| 2026-08-24 | 已更新 | 对齐 `00-教学理念-提示词驱动.md`：动手环节 Step 0-7 全部改为四件套（① 意图 → ② Prompt → ③ 参考代码 → ④ 验证清单）+ 四样产出（决策点填空/补全残缺 Prompt/错误检测/判断力日志）；新增"换业务考试"（天机学堂课程知识库）；头部添加教学理念说明；ai-service ⏳ 待建，本文件代码从零搭（与真实状态一致） |
