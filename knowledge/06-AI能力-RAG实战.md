# Phase 4 AI能力 · RAG 实战（v2.0）

> **一句话总结：** 讲清 RAG"外挂知识库"的本质（检索+增强+生成）及其评估指标（Context Recall 等），并配套代码级实操文档。

> **前置文档**
>
> - `06-AI能力-LLM集成模式`（`06-AI能力/`）—— RAG 依赖 LLM 生成，需先会调 LLM。

> **后置文档**
>
> - `06-AI能力-RAG代码级实操`（`06-AI能力/`）—— 本文"下一篇"，动手搭可运行系统。

> 上一篇：无　|　下一篇：[06-AI能力-RAG代码级实操.md](06-AI能力-RAG代码级实操.md)　（RAG链路）

> **AI角色：老师。** 目标是让学习者在60分钟内从零理解RAG（检索增强生成）的完整架构，包括embedding、向量数据库、文档切分、检索流程。
>
> **防什么失败？** 防"大模型不知道你公司的私有数据，开始编造幻觉"。防"检索出来的文档牛头不对马嘴"。防"文档切分把关键信息砍成两半"。

---

## 为什么需要RAG？

> **真实场景：** 某天 HMall 客服 Agent 上线，用户问"iPhone 16 Pro 现在多少钱？"Agent 回答："抱歉，我的训练数据截止到 2024 年，无法获取最新价格。"用户又问"那你们的退货政策是什么？"Agent 回答："根据一般电商平台规则，通常支持 7 天无理由退货..."——但 HMall 实际支持 15 天无理由！Agent 编造了不存在的政策，导致 3 个用户投诉、1 个退款纠纷。

**这不是大模型不够聪明，是大模型没有你的数据。**

RAG 的本质是：**给大模型配一个"外挂知识库"，每次回答前先去翻书，翻到了再回答。**

---

## 前置要求

- 会用Python（能跑脚本就行）
- 理解什么是大模型（ChatGPT/通义千问等）
- 知道什么是API调用（HTTP请求）

---

### 🔒 G1 入口门禁

> **AI：** 确认以上前置条件全部满足。全部满足 → 放行。不满足 → 停止。

---

## 核心概念

### 第一讲：RAG是什么——为什么要检索增强

#### 类比：学霸答题 vs 开卷考试

```
❌ 纯大模型 = 闭卷考试
   学霸（大模型）凭记忆答题，记不清的就瞎编（幻觉）

✅ RAG = 开卷考试
   先翻书找到答案（检索），然后用自己的话写出来（生成）
   每次回答都有据可查，不凭空编造
```

#### RAG整体流程（ASCII 图）

```
                    ┌─────────────────────────────────────┐
                    │          RAG = 检索 + 增强 + 生成      │
                    └─────────────────────────────────────┘

    ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
    │ 用户问题  │ ───► │ 1.检索   │ ───► │ 2.增强   │ ───► │ 3.生成   │
    │          │      │ 在知识库  │      │ 拼接文档  │      │ LLM基于  │
    │ "iPhone  │      │ 搜索相关  │      │ 到Prompt  │      │ 文档回答  │
    │  16价格?"│      │ 文档      │      │ 中        │      │          │
    └──────────┘      └─────┬────┘      └─────┬────┘      └─────┬────┘
                            │                 │                 │
                            ▼                 ▼                 ▼
                     ┌────────────┐   ┌────────────┐   ┌────────────┐
                     │ 文档1: "   │   │ 请根据以下  │   │ "iPhone 16 │
                     │ iPhone 16  │   │ 信息回答：  │   │ Pro 售价   │
                     │ Pro 256GB  │   │ [文档1]     │   │ ¥8,999，   │
                     │ ¥8,999"    │   │ [文档2]     │   │ 支持15天   │
                     │ 文档2: "   │   │ [文档3]     │   │ 无理由退货" │
                     │ 支持15天   │   │ 用户问题:   │   │            │
                     │ 无理由退货" │   │ ...         │   │            │
                     └────────────┘   └────────────┘   └────────────┘
```

#### RAG系统架构（离线 + 在线）

```
┌──────────────────────────────────────────────────────────────────┐
│                        离线处理（索引构建）                        │
│                                                                  │
│   PDF/文档/数据库                                                 │
│       │                                                          │
│       ▼ 文档切分（Chunking）                                      │
│   ┌────┬────┬────┬────┐                                          │
│   │Chunk│Chunk│Chunk│Chunk│   ← 每块500-1000字                    │
│   └──┬─┴──┬─┴──┬─┴──┬─┘                                          │
│      │    │    │    │                                             │
│      ▼    ▼    ▼    ▼  Embedding模型（文本→向量）                 │
│   [0.2, -0.1, 0.8, ...]  ← 1024维向量                            │
│      │    │    │    │                                             │
│      ▼    ▼    ▼    ▼                                             │
│   ┌──────────────────────┐                                        │
│   │   向量数据库 (Qdrant) │  ← 存储所有向量 + 原始文档              │
│   └──────────────────────┘                                        │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ 检索
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                        在线处理（查询回答）                        │
│                                                                  │
│   用户问题 ──► Embedding ──► 问题向量                             │
│                                  │                               │
│                                  ▼ 向量相似度搜索                 │
│                             Top-K 相关文档                        │
│                                  │                               │
│                                  ▼ 拼接 Prompt                   │
│                             LLM 生成回答 ──► 返回用户              │
└──────────────────────────────────────────────────────────────────┘
```

---

### 第二讲：Embedding——文本怎么变成向量

#### 类比：给书贴标签

```
每本书 → 贴一个标签（向量）
"苹果" → [0.23, -0.15, 0.78, ...]  ← 1024维的"语义指纹"

语义相近的书 → 标签也相近：
  "苹果" 和 "水果" → 向量距离近（同一个书架）
  "苹果" 和 "汽车" → 向量距离远（不同楼层）

这就是向量检索的核心：找"距离最近"的向量 = 找"语义最相关"的文档
```

#### Embedding 模型选择（2026年）

| 模型                          | 维度 | 中文效果 | 速度 | 成本     | 推荐场景           |
| ----------------------------- | :--: | :------: | :--: | -------- | ------------------ |
| OpenAI text-embedding-3-large | 3072 |    好    |  快  | $0.13/1M | 英文/多语言        |
| OpenAI text-embedding-3-small | 1536 |    好    | 最快 | $0.02/1M | 原型验证           |
| bge-large-zh-v1.5             | 1024 |   最好   |  中  | 免费     | 生产环境           |
| bge-m3                        | 1024 |   最好   |  中  | 免费     | 多语言（中英日韩） |
| m3e-base                      | 768  |    好    |  中  | 免费     | 通用场景           |

```python
# src/ai-service/embedding_service.py — Embedding 服务
from sentence_transformers import SentenceTransformer

class EmbeddingService:
    """
    Embedding 服务：文本 → 向量。

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
        """
        批量编码。
        为什么用批量？一次编码100条比100次单独编码快10倍以上。
        GPU 可以并行处理多个文本。
        """
        return self.model.encode(texts, show_progress_bar=True).tolist()
```

#### 对比：差做法 vs 好做法

| 维度           | ❌ 差做法              | ✅ 好做法                 |
| -------------- | ---------------------- | ------------------------- |
| Embedding 模型 | 英文模型做中文检索     | bge-large-zh 专为中文优化 |
| 调用方式       | 每条单独调 API         | 批量编码，本地部署        |
| 向量存储       | 存 MySQL，每次全表扫描 | 向量数据库，索引加速      |
| 数据安全       | 文本发到 OpenAI        | 本地处理，数据不出域      |

---

### 第三讲：文档切分——怎么切才不丢信息

#### 类比：切蛋糕

```
一整块蛋糕 → 没法一口吃（文档太长，Embedding 模型有长度限制）
切太小块 → 每块只有蛋糕屑，吃不出味道（语义碎片化）
切太大块 → 塞不进嘴（超过模型最大输入）

理想大小：一口能咬下，又能尝出味道
  = chunk_size 500-1000字
```

#### 切分策略对比

```
固定长度分块（最差）：
  "...满三年享有15天。|← 一刀切在第500字
  病假需要提供医院证明..."  ← 年假和病假被切到不同块，语义断裂

递归分块（推荐）：
  优先在段落/换行/句号处切，保持语义完整
  "。满三年享有15天。" ← 在句号处切，前后语义完整

语义分块（高级，成本高）：
  句1: 年假政策是这样的 ┐ 相似度高 → 不切
  句2: 满一年有10天     ┘
  ───────────────────── ← 相似度骤降 → 切
  句3: 报销流程需要...  ┐ 新的一块
```

```python
# src/ai-service/chunking_service.py — 文档切分服务
from langchain.text_splitter import RecursiveCharacterTextSplitter

class ChunkingService:
    """
    文档切分服务。

    设计原则：
    1. chunk_size=500（中文，500字语义基本完整）
    2. chunk_overlap=50（10%重叠，防止关键信息被切断）
    3. 分隔符优先级：段落 → 换行 → 句号 → 问号 → 逗号 → 空格 → 字符
    """

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            # 中文分隔符优先级：从大到小，语义损失最小先切
            separators=["\n\n", "\n", "。", "！", "？", "，", " ", ""],
            length_function=len,
        )

    def split(self, text: str) -> list[str]:
        """将长文档切成多个 chunk"""
        return self.splitter.split_text(text)

    def split_documents(self, documents: list[str]) -> list[dict]:
        """
        批量切分文档，返回带元数据的 chunk。
        为什么保留元数据？后续检索时要知道这个 chunk 来自哪个文档、第几页。
        """
        chunks = []
        for doc_id, text in enumerate(documents):
            for i, chunk in enumerate(self.split(text)):
                chunks.append({
                    "doc_id": doc_id,
                    "chunk_index": i,
                    "content": chunk,
                    "char_count": len(chunk),
                })
        return chunks
```

---

### 第四讲：向量数据库——存储和检索向量

#### 类比：图书馆的索书系统

```
传统图书馆：按书名/作者查找（精确匹配）
  → 找"Python编程" → 必须输入完全正确的书名

向量数据库：按"内容相似度"查找
  → 找"适合初学者的编程书" → 自动找到 Python、Java 入门书
  → 找"好看的拍照手机" → 自动找到 iPhone、华为拍照旗舰
```

#### 向量数据库选型

| 向量数据库        |    部署方式     | 性能 | 特点                | 推荐场景             |
| ----------------- | :-------------: | :--: | ------------------- | -------------------- |
| **Qdrant**        |   本地/Docker   |  高  | Rust编写，简单好用  | 首选推荐             |
| **Milvus**        | 本地/Docker/K8s | 最高 | 分布式，支持十亿级  | 百万级以上数据       |
| **Chroma**        |    本地嵌入     |  中  | 零配置，Python原生  | 原型验证             |
| **Elasticsearch** |   本地/Docker   |  中  | 同时支持关键词+向量 | 已有ES，不想加新组件 |

```python
# src/ai-service/vector_store.py — 向量数据库服务
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

class VectorStoreService:
    """
    向量数据库服务：存储和检索文档向量。

    为什么用 Qdrant 而不是直接存 PostgreSQL？
    Qdrant 专门为向量相似度搜索优化了索引（HNSW），
    百万级向量毫秒级检索，传统数据库做不到。
    """

    def __init__(self, host: str = "localhost", port: int = 6333):
        self.client = QdrantClient(host=host, port=port)
        self.collection_name = "hmall_knowledge"

    def create_collection(self, vector_size: int = 1024):
        """创建集合。为什么需要先创建集合？定义向量维度和相似度算法。"""
        self.client.recreate_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(
                size=vector_size,          # 向量维度（bge-large-zh = 1024）
                distance=Distance.COSINE,  # 余弦相似度：值越大越相似
            )
        )

    def upsert_chunks(self, chunks: list[dict], embeddings: list[list]):
        """
        批量插入文档向量。

        为什么用 upsert 而不是 insert？
        upsert = update or insert，如果 id 已存在则更新，不会报重复错误。
        适合增量更新场景。
        """
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
        """
        向量相似度检索。

        参数：
        - query_vector: 问题向量
        - top_k: 返回前 K 个结果
        - score_threshold: 相似度阈值，低于此值的结果丢弃（太不相关）
        """
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

---

### 第五讲：RAG完整流程——从问题到答案

```python
# src/ai-service/rag_service.py — RAG 完整服务
from openai import OpenAI

class RAGService:
    """
    RAG 完整服务：检索 → 增强 → 生成。

    流程图：
    query → embedding → vector search → top-K docs → prompt → LLM → answer
    """

    def __init__(self, embedding_svc, vector_store, llm_client):
        self.embedding_svc = embedding_svc
        self.vector_store = vector_store
        self.llm = llm_client

    def query(self, user_question: str, top_k: int = 5) -> str:
        """
        RAG 查询：完整的检索增强生成流程。
        """
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
            model="glm-4.7-flash",  # 教学示例模型，实际以平台环境变量为准
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,  # 降低随机性，减少幻觉
        )

        return response.choices[0].message.content
```

> **⚠️ 平台边界说明（重要）：** 上面是**独立 RAG 教学演示**——把"检索→增强→生成"完整链路放在一个 Python 服务里讲透概念。**在真实平台（agent-platform + ai-service）中，LLM 生成环节由 TS 编排层直连 LLM 完成**，ai-service 只提供意图识别 / RAG 检索 / 知识库能力，不参与 LLM 决策。详见 `06-AI能力-双层架构调用链.md`。

### 提示词教学：RAG 回答 Prompt 与查询改写 Prompt

> **AI：** 不重讲六要素模板（真源：`03-AI协作构建\03-AI协作构建技能.md`），只讲 RAG 场景两处关键 prompt——**回答生成**（第五步 `build_prompt`）和**查询改写**（多轮 RAG 把"它多少钱？"补全成独立问题）。

**① 场景**：RAG 的回答质量一半取决于检索、一半取决于回答 prompt——它决定了模型**只依据给定文档回答、不编造、标注不确定**。

**② 六要素对照表**（回答生成 prompt）：

| 要素     | 这个场景填什么                                                     |
| :------- | :----------------------------------------------------------------- |
| 角色     | 基于知识库的问答助手（限定领域，不是通用 AI）                      |
| 任务     | 仅依据检索到的文档片段回答用户问题                                 |
| 上下文   | Top-K 检索片段（带来源标注）、用户问题、（多轮时）改写后的问题     |
| 约束     | 信息不足时明说"不确定"；不编造；引用来源；拒绝回答与文档无关的问题 |
| 参考     | 检索片段本身就是参考——这是 RAG 与普通 prompt 最大的不同            |
| 输出格式 | 结论 + 依据（引用片段编号/来源），不确定时输出固定话术             |

**③ 示例 Prompt**（可直接用，是第五讲代码里 prompt 的六要素完整版）：

```
【角色】你是 HMall 的智能客服，只依据给定的商品资料回答问题。

【任务】根据下面的【参考资料】回答用户问题，并标注依据。

【上下文】
参考资料（编号即引用依据）：
[1] {chunk_1}
[2] {chunk_2}
...
用户问题：{question}

【约束】
1. 答案只能来自参考资料；资料不足以回答时，回答"我不确定，建议咨询人工客服"，禁止编造
2. 回答末尾标注依据，格式：[依据：1, 3]
3. 用户问题与商品资料无关时，说明只回答商品相关问题
4. 资料之间矛盾时，指出矛盾而不是自行取舍

【参考】措辞使用资料中的原始术语。

【输出格式】中文，先一句话结论，再 1-3 句展开，最后标注依据。
```

查询改写 prompt（多轮 RAG 用，把指代补全）：

```
你是查询改写器。根据对话历史，把用户的最新问题改写成一个不含代词、可独立检索的完整问题。
只输出改写后的问题，不要回答它。
对话历史：{history}
最新问题：{question}
例：历史"iPhone 15 多少钱？"，最新"那它的壳呢？" → "iPhone 15 的手机壳多少钱？"
```

**④ 反例 + 为什么**：

```
"以下是一些资料，请回答：{question}"   // ❌
```

错在哪：没有"只依据资料"约束——模型会用自有知识补齐，答案流畅但可能是幻觉；没有"不确定话术"——资料不足时它会硬答；没有依据标注——答错了无法定位是检索没召回还是生成出错，评测（RAGAS 的 faithfulness）也没法做。

**⑤ 完成标准**：能写出"回答 + 改写"两份 prompt，且回答 prompt 包含**只依据资料 / 不编造 / 不确定话术 / 依据标注**四条款。

---

### 第六讲：检索质量优化——混合检索 + Rerank + MMR

#### 6.1 混合检索：向量 + 关键词

**类比：** 图书馆找书，你既可以说"我想要人工智能相关的书"（语义），也可以说"书名叫《Deep Learning》"（精确关键词）。两种方式互补。

```
问题："FastAPI的BackgroundTasks怎么用？"

向量检索：返回"异步任务""后台处理"的语义相关内容
          但可能漏掉标题就叫《BackgroundTasks用法》的文档
          → 语义上和别的文档差不多，向量没有拉开差距

关键词检索（BM25）：精确匹配"BackgroundTasks"这个词
          → 一下就命中那个标题里有这个词的文档

两者互补：向量懂语义，BM25精确匹配词
```

```python
# src/ai-service/hybrid_retriever.py — 混合检索器
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever

class HybridRetriever:
    """
    混合检索器：向量检索 + BM25 关键词检索。

    为什么需要混合？向量检索擅长语义相似，BM25擅长精确匹配。
    两者互补，覆盖更多场景。
    """

    def __init__(self, vector_retriever, documents: list):
        self.bm25 = BM25Retriever.from_documents(documents)
        self.bm25.k = 5
        self.vector_retriever = vector_retriever
        self.ensemble = EnsembleRetriever(
            retrievers=[self.bm25, self.vector_retriever],
            weights=[0.3, 0.7],  # BM25权重0.3，向量权重0.7
        )

    def retrieve(self, query: str, top_k: int = 5):
        return self.ensemble.invoke(query)[:top_k]
```

#### 6.2 Rerank：从粗筛到精排

**类比：** 海选（初筛）→ 复赛（精排）。向量检索是海选，从百万文档中粗筛 top-20；Rerank 是复赛，从 top-20 中精排 top-3。

```
双编码器（Bi-Encoder）= 海选评委
   问题 → 编码器 → 向量A  ┐
   文档 → 编码器 → 向量B  ┤ 分开打分，快但糙
   余弦相似度 ←─────────┘

交叉编码器（Cross-Encoder）= 复赛评委
   [问题 + 文档] 一起 → 编码器 → 精细分数
   拼在一起打分，准但慢（每个 pair 都要重新算）
```

```python
# src/ai-service/rerank_service.py — Rerank 重排序服务
from sentence_transformers import CrossEncoder

class RerankService:
    """
    Rerank 重排序服务。

    原理：先召回 top-20（粗筛），再用交叉编码器精排取 top-3。
    加一层 Rerank 往往能让 RAG 准确率提升 10-20%，性价比最高。
    """

    def __init__(self, model_name: str = "BAAI/bge-reranker-base"):
        self.model = CrossEncoder(model_name)

    def rerank(self, query: str, candidates: list[str], top_k: int = 3) -> list[str]:
        """对候选文档精排，返回 top-K"""
        pairs = [[query, doc] for doc in candidates]
        scores = self.model.predict(pairs)
        ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)
        return [doc for doc, score in ranked[:top_k]]
```

#### 6.3 MMR：解决结果重复

**类比：** 你搜"公司制度"，top-5 全是年假政策，没有病假、产假、调休。MMR 保证返回结果多样化。

```
MMR = 相关性 + 多样性
选下一个文档 = λ × (和问题的相关性) − (1−λ) × (和已选文档的相似度)
              ↑ 要相关              ↑ 要和已选的不一样
```

---

### 第七讲：多轮对话 RAG

#### 问题："那病假呢？"单独检索

```
用户：公司年假有多少天？
AI  ：满一年10天，满三年15天。

用户：那病假呢？  ← 单独检索"那病假呢？"语义模糊，检出内容不相关
```

**解决方案：问题重写（Query Rewriting）**

```python
# src/ai-service/query_rewriter.py — 问题重写服务
class QueryRewriter:
    """
    问题重写器：把追问补全成独立问题。

    为什么需要？
    "那它呢？"、"还有吗？" 这类指代模糊的问题，
    单独检索几乎不可能命中，必须先补全上下文。
    """

    def rewrite(self, history: list, current_query: str) -> str:
        """将追问补全为独立问题"""
        prompt = f"""请将用户的追问补全为独立完整的问题。

历史对话：
{self._format_history(history)}

当前追问：{current_query}

请输出补全后的独立问题："""

        response = self.llm.chat.completions.create(
            model="gpt-5.6-luna",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
        )
        return response.choices[0].message.content.strip()

    def _format_history(self, history: list) -> str:
        return "\n".join([f"{'用户' if h['role']=='user' else 'AI'}：{h['content']}" for h in history[-5:]])
```

---

## 对比讲解：差做法 vs 好做法

### 对比一：RAG 整体方案

| 维度       | ❌ 差做法              | ✅ 好做法              |
| ---------- | ---------------------- | ---------------------- |
| 知识来源   | LLM 记忆（闭卷）       | RAG 检索（开卷）       |
| 回答准确性 | 幻觉严重，编造信息     | 基于真实文档，有据可查 |
| 更新成本   | 需要重新训练/微调      | 更新知识库即可         |
| 数据安全   | 知识可能泄露到训练数据 | 知识库本地存储         |

### 对比二：文档切分

| 维度          | ❌ 差做法               | ✅ 好做法                |
| ------------- | ----------------------- | ------------------------ |
| 切分方式      | 固定500字，不管句子边界 | 递归分块，优先在句号处切 |
| chunk_overlap | 0（无重叠）             | 50字（10%重叠）          |
| 结果          | 一句话被切成两半        | 语义完整保留             |

### 对比三：检索优化

| 维度       | ❌ 差做法              | ✅ 好做法                      |
| ---------- | ---------------------- | ------------------------------ |
| 检索方式   | 纯向量检索             | 向量 + BM25 混合检索           |
| 排序       | 向量相似度直接取 top-3 | 先召回 top-20，Rerank 取 top-3 |
| 结果多样性 | 5条全一样              | MMR 保证多样性                 |
| 准确率     | 60-70%                 | 85-95%                         |

---

## RAG 常见坑与解法

| 坑             | 症状                       | 根因                   | 解法                            |
| -------------- | -------------------------- | ---------------------- | ------------------------------- |
| 检索不相关     | 返回的文档和问题无关       | Embedding 模型选错     | 换 bge-large-zh                 |
| 大模型幻觉     | 答案里有编造的信息         | 检索文档不含答案       | 降低 temperature + 提高检索质量 |
| 文档切太碎     | 每个 chunk 只有50字        | chunk_size 太小        | 增大到 500-1000 字              |
| Top-K 太大     | Token 消耗巨大             | 喂了50条文档给 LLM     | 限制 Top-5 + 过滤低分           |
| 追问失败       | "那它呢？"检索不到         | 指代模糊               | 问题重写                        |
| 结果重复       | top-5 全是同一段话         | 相似度过高             | MMR 增加多样性                  |
| 关键词漏检     | 专有名词检索不到           | 向量检索不擅长精确匹配 | 混合检索（BM25）                |
| 正确答案排后面 | 对的内容在 top-10 但被截断 | 向量检索排序不够精准   | Rerank 精排                     |

---

## RAG 评估体系

```
RAG 答错，先定位是哪个环节：

用户问题
   ↓
【检索环节】找文档  ← 错误类型A：没找到对的文档（检索失败）
   ↓                    → 优化分块、混合检索、Rerank
【生成环节】LLM答   ← 错误类型B：找到了但LLM答错了/编造了
   ↓                    → 优化Prompt、换更强的LLM
答案
```

### RAGAS 四大核心指标

| 指标                       | 衡量什么                     | 盯哪个环节 | 怎么算                        |
| -------------------------- | ---------------------------- | ---------- | ----------------------------- |
| **Faithfulness（忠实度）** | 答案是否忠于文档（有无编造） | 生成       | LLM-as-Judge 逐句检查         |
| **Answer Relevancy**       | 答案是否切题                 | 生成       | LLM 判断是否答非所问          |
| **Context Precision**      | 检索文档中有用的占比         | 检索       | 有用文档数 / 检索总数         |
| **Context Recall**         | 该找的文档是否都找到了       | 检索       | 找到的相关文档 / 所有相关文档 |

---

## 2026年 RAG 三大新范式

| 范式                     | 核心思想                                          | 最佳场景          |
| ------------------------ | ------------------------------------------------- | ----------------- |
| **Parent-Child 分块**    | 检索用小 Chunk（200字），生成用大 Chunk（1500字） | 长文档 QA         |
| **Contextual Retrieval** | 每个 Chunk 前追加文档级上下文摘要                 | 多文档知识库      |
| **MDKeyCHUNKER**         | 结构感知分块 + 语义 Key 合并                      | Markdown 技术文档 |

---

### 🔒 G2 讲解门禁

> **AI：** 确认以上讲解的学习者都表示理解。**必须等用户明确回复"没问题"/"理解了"等肯定词，未收到回复前不得出题。** 全部确认 → 放行。有疑问 → 回到对应讲，澄清后再确认。

---

## 阶段一：理解验证（Quiz 闭卷）

### 概念难度与题目配额

| 概念             |  难度  | 最少题数 | 出题说明            |
| ---------------- | :----: | :------: | ------------------- |
| RAG概念          |  ⭐⭐  |    2     | 选择+判断           |
| Embedding        | ⭐⭐⭐ |    3     | 核心难点            |
| 文档切分         |  ⭐⭐  |    2     | 场景分析            |
| 向量数据库       | ⭐⭐⭐ |    2     | 实践题              |
| RAG完整流程      |  ⭐⭐  |    2     | 流程题              |
| 高级分块策略     | ⭐⭐⭐ |    2     | 父子文档检索必考    |
| 检索质量优化     | ⭐⭐⭐ |    3     | 混合检索/Rerank/MMR |
| 多轮对话RAG      |  ⭐⭐  |    2     | 问题重写            |
| RAG评估          | ⭐⭐⭐ |    2     | RAGAS四指标         |
| **合计（最少）** |        |  **20**  |                     |

### 题目池

#### 选择题

**Q-C1.** RAG的核心思想是什么？

- A. 用大模型直接回答问题
- B. 先检索相关文档，再让大模型基于文档回答
- C. 微调大模型让它记住所有知识
- D. 用多个大模型投票

**Q-C2.** Embedding的作用是什么？

- A. 加密文本
- B. 压缩文本
- C. 把文本转换成向量，方便计算语义相似度
- D. 翻译文本

**Q-C3.** 文档切分时，chunk_overlap的作用是什么？

- A. 让每块更大
- B. 让每块更小
- C. 防止关键信息在切分边界被切断
- D. 提高切分速度

**Q-C4.** 父子文档检索的核心思想是什么？

- A. 把父文档和子文档都做向量化
- B. 用小块检索提高精度，返回大块保证上下文完整
- C. 用大块检索，返回小块
- D. 把文档按父子关系分层存储

**Q-C5.** Rerank重排序中，交叉编码器（Cross-Encoder）相比双编码器（Bi-Encoder）的优势是什么？

- A. 速度更快
- B. 可以预存向量
- C. 问题和文档拼在一起编码，理解更精细
- D. 支持更多文档

**Q-C6.** RAGAS的Faithfulness（忠实度）指标衡量什么？

- A. 检索到的文档数量
- B. 答案是否忠于检索到的文档（有没有编造）
- C. 检索速度
- D. 答案的字数是否合适

#### 判断题

**Q-J1.** 向量数据库可以替代传统关系型数据库。

**Q-J2.** RAG方案中，检索到的文档越多越好，应该把Top-100都喂给大模型。

**Q-J3.** 使用本地Embedding模型（如bge-large-zh）的好处是免费且数据不出服务器。

**Q-J4.** 混合检索中，RRF算法通过比较向量检索和BM25的原始分数来融合结果。

**Q-J5.** 多轮对话RAG中，问题重写（Query Rewriting）的目的是让检索更准确，改写后的问题不直接给用户看。

**Q-J6.** MMR（最大边际相关性）的核心思想是既要和问题相关，又要和已选文档不重复。

#### 场景分析题

**Q-S1.** 请画出RAG的完整数据流图，标注每个步骤的输入和输出。

**Q-S2.** HMall有10000个商品，每个商品描述约500字。请设计RAG的索引方案。

**Q-S3.** 用户问"有什么2000元以下的蓝牙耳机？"——检索返回了手机壳、数据线等不相关结果。请分析可能的原因并给出优化方案。

**Q-S4.** 以下RAG实现有什么问题？请修复：

```python
def bad_rag(question):
    docs = search(question, limit=100)  # 检索100条
    prompt = f"文档：{docs}\n问题：{question}"  # 没有指令
    return llm.generate(prompt)
```

**Q-S5.** 用户问"那这个呢？"（指代前文提到的商品），直接用这句话去向量检索，结果很差。请分析原因并给出至少两种解决方案。

**Q-S6.** 你的RAG系统检索到了top-20文档，但LLM只接收top-5。你发现正确答案经常排在第6-10位。请设计优化方案。

---

## 批改与补考机制

> **AI：** 题目池中的题目是最低基线。如果池中题目不够配额，必须自行生成新题补足，不得少于配额数。

### 补考规则

| 错误概念     | 补考出题方向                                          |
| ------------ | ----------------------------------------------------- |
| RAG概念      | 给新场景，判断是否适合用RAG                           |
| Embedding    | 给两段文本，判断embedding后距离的远近                 |
| 文档切分     | 给一篇长文档，设计切分方案                            |
| 向量数据库   | 给新检索场景，写Qdrant的查询代码                      |
| 高级分块策略 | 给长文档场景，判断用哪种分块策略并说明理由            |
| 检索质量优化 | 给检索失败案例，诊断原因并给出优化方案                |
| 多轮对话RAG  | 给多轮对话场景，写出问题重写的Prompt                  |
| RAG评估      | 给RAG输出，判断Faithfulness和Answer Relevancy是否合格 |

---

### 🔒 G3 理解门禁

> **AI：** 确认所有概念点全部通过。全部通过 → 放行。有未通过 → 补考。

---

## 阶段二：动手环节

> **配套实操：** 本环节是任务描述级（知道要做什么）。**代码级实操见 `06-AI能力-RAG代码级实操.md`**（从零搭完整可运行的 RAG 系统，含 build_kb.py 和 query.py）。建议先按实操文档搭出系统，再回来做本环节的评估任务。

### 任务1：搭建本地RAG系统

```
1. 安装依赖：pip install qdrant-client sentence-transformers openai
2. 启动Qdrant（Docker）：docker run -p 6333:6333 qdrant/qdrant
3. 准备10条HMall商品描述作为知识库
4. 用bge-large-zh-v1.5做Embedding
5. 存入Qdrant
6. 写一个查询脚本，测试检索效果
```

### 任务2：评估检索效果

```
1. 准备5个测试问题
2. 人工标注每个问题的正确答案
3. 计算命中率（Hit Rate@3）
4. 如果命中率低于60%，分析原因并优化
```

### 任务3：进阶优化（选做）

```
1. 将固定长度分块改为递归分块（RecursiveCharacterTextSplitter）
2. 实现父子文档检索（ParentDocumentRetriever），对比检索效果
3. 加入Rerank重排序，对比top-3准确率变化
4. 实现多轮对话RAG（问题重写 + 对话历史）
```

---

### 🔒 G4 决策门禁

> **AI：** 确认学习者已完成动手环节。已完成 → 继续。未完成 → 回去做。

---

## 判断力日志

```markdown
## 决策：04-AI - RAG实战

### 我选的Embedding模型

[哪个模型？为什么？]

### 我选的向量数据库

[Qdrant/Milvus/Chroma？为什么？]

### 我的文档切分方案

[chunk_size=? chunk_overlap=? 用了什么分块策略？]

### 我的检索优化方案

[是否用了混合检索？是否用了Rerank？是否用了MMR？]

### 检索效果

[Hit Rate@3=? 有什么优化空间？]

### 防什么失败

[这个RAG方案防止什么失败？]
```

---

## 检查清单

```
□ 理解RAG的三个步骤（检索→增强→生成）
□ 能画出RAG的完整架构图
□ 理解Embedding的原理（文本→向量）
□ 能选择合适的Embedding模型
□ 理解文档切分的策略（chunk_size, chunk_overlap）
□ 能使用Qdrant存储和检索向量
□ 能写出完整的RAG查询代码
□ 理解RAG的评估指标
□ 理解递归分块 vs 固定长度分块的区别
□ 理解父子文档检索的原理（小块检索，大块返回）
□ 理解混合检索（向量+BM25）的应用场景
□ 理解Rerank重排序的双阶段架构（粗筛→精排）
□ 理解MMR如何解决检索结果重复
□ 理解多轮对话中问题重写的作用
□ 理解RAGAS四个核心指标（Faithfulness/Relevancy/Precision/Recall）
□ Quiz全部概念通过
□ 动手环节全部完成
□ 写了判断力日志
```

---

## 复习节奏

|   时间点    | 做什么                                                  |  时长  |
| :---------: | ------------------------------------------------------- | :----: |
| 完成后第1天 | 闭卷画出RAG架构图 + 检索优化流程图                      | 10分钟 |
| 完成后第3天 | 闭卷写出RAG完整代码流程 + 混合检索代码                  | 15分钟 |
| 完成后第7天 | 给新场景，设计RAG方案（含分块策略、检索优化、评估方案） | 15分钟 |

---

## 不要深追

- 不要深追 Embedding模型的训练原理（Transformer架构、对比学习等）
- 不要深追 向量数据库的索引算法（HNSW、IVF等）
- 不要深追 HyDE、Multi-Query、Self-RAG等更高级技术（这些在AI领域深入时再学）
- 不要深追 微调（Fine-tuning）和RAG的对比
- 不要深追 RAGAS的底层实现（理解四个指标的含义就够）
- 不要深追 语义分块的底层算法（理解原理即可，先用递归分块）

---

## 🔑 技能暗号

```
技能暗号：RAG-04-有据可查
```

**四字短语含义：** 有据可查——大模型说的每一句话，都有检索到的文档作为依据，不凭空编造。

> **防什么失败？** 防"大模型不知道私有数据，开始编造幻觉"。RAG让大模型基于真实文档回答，杜绝幻觉。

---

## 2026年最新动态（截至2026年8月）

### 2026 年 RAG 三大新范式

| 范式                     | 核心思想                                          | 最佳场景          |
| ------------------------ | ------------------------------------------------- | ----------------- |
| **Parent-Child 分块**    | 检索用小 Chunk（200字），生成用大 Chunk（1500字） | 长文档 QA         |
| **Contextual Retrieval** | 每个 Chunk 前追加文档级上下文摘要                 | 多文档知识库      |
| **MDKeyCHUNKER**         | 结构感知分块 + 语义 Key 合并                      | Markdown 技术文档 |

### 2026 年 Embedding 模型推荐

| 场景         | 推荐模型                      | 理由                   |
| ------------ | ----------------------------- | ---------------------- |
| 中文生产环境 | bge-m3 / bge-large-zh-v1.5    | 免费、中文效果最好     |
| 英文/多语言  | OpenAI text-embedding-3-large | 3072维，覆盖多语言     |
| 原型验证     | OpenAI text-embedding-3-small | 最快最便宜（$0.02/1M） |
| 多模态 RAG   | Jina CLIP v2                  | 文本+图片统一向量空间  |
