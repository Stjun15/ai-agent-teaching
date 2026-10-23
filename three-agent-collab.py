"""
三 Agent 协作：规划者 → 写手 → 评审

模式来源：
  - llm-wiki/patterns/single-writer.md（生产者/评审者/编排者）
  - src/scenes/scene-orchestration-fixture.ts（三段分工 + 终止条件）

约束：
  - 三个角色各是一个函数、各自独立上下文
  - 交接物是明确的字符串
  - 必须有终止条件（评审通过，或达到最大轮数）
  - 不接任何 API，普通函数模拟
  - 打回超限要打印失败原因，不卡死不无限循环
"""

# ============================================================
# 规划者（Planner）
# 输入：主题（一句话）
# 输出：任务清单（纯文本，每行一条）
# 边界：只拆清单，不写内容，不评价质量
# ============================================================


def planner(topic: str) -> str:
    checklist_map = {
        "保温杯": (
            "1. 写出保温时长\n"
            "2. 写出具体重量\n"
            "3. 写出使用场景\n"
            "4. 写出材质说明\n"
            "5. 写出容量规格"
        ),
    }
    return checklist_map.get(topic, f"1. 介绍{topic}的核心功能\n2. 说明{topic}的适用人群")


# ============================================================
# 写手（Worker）
# 输入：清单（字符串）+ 评审反馈（字符串，首次为空）
# 输出：完整文案（字符串）
# 边界：只按清单逐条写，不自行增删条目，不评价自己的产出
# ============================================================

_WORKER_ATTEMPT = 0


def _reset_worker():
    global _WORKER_ATTEMPT
    _WORKER_ATTEMPT = 0


def _increment_worker():
    global _WORKER_ATTEMPT
    _WORKER_ATTEMPT += 1
    return _WORKER_ATTEMPT


def worker(checklist: str, feedback: str = "") -> str:
    """
    写手：逐项完成清单。为了演示「打回重写」机制，
    第 1 轮故意漏掉一条，收到反馈后补全。
    """
    attempt = _increment_worker()

    items = [line.strip() for line in checklist.strip().split("\n") if line.strip()]
    item_count = len(items)

    if attempt == 1 and not feedback:
        # 首轮：故意漏掉最后一条，制造一个评审可抓的错误
        lines = []
        for i, item in enumerate(items):
            if i < item_count - 1:
                lines.append(_write_item(item))
        return "\n\n".join(lines)

    # 后续轮次（或首轮就有反馈）：逐条完成
    lines = []
    for item in items:
        lines.append(_write_item(item))
    return "\n\n".join(lines)


def _write_item(item: str) -> str:
    """单条清单项的写作（纯模拟，不接 API）。"""
    db = {
        "写出保温时长": "【保温时长】采用双层真空锁温技术，95℃ 热水注入 6 小时后仍保持 58℃ 以上，12 小时后不低于 42℃，全天候守护你的温暖。",
        "写出具体重量": "【具体重量】杯体仅重 210g，比一台手机还轻。随身携带毫无负担，放入通勤包、健身包都不占分量。",
        "写出使用场景": "【使用场景】清晨通勤路上的热咖啡、办公室桌面的全天候补水、健身房后的温水补给、户外徒步的可靠伴侣——一杯覆盖你的全场景生活。",
        "写出材质说明": "【材质说明】内胆采用 316L 医用级不锈钢，耐酸碱、不生锈；外壳为磨砂喷塑工艺，手感细腻、防滑耐磨；杯盖食品级 PP 材质 + 硅胶密封圈，滴水不漏。",
        "写出容量规格": "【容量规格】提供 380ml / 500ml / 650ml 三挡可选。380ml 适合随手杯场景，500ml 满足日常办公，650ml 专为户外与长时间外出设计。",
    }

    key = item.split(". ", 1)[-1] if ". " in item else item
    return db.get(key, f"【{key}】本产品在{key}方面表现出色，详情请联系客服获取完整参数。")


# ============================================================
# 评审（Critic）
# 输入：清单 + 写手产出
# 输出：(通过与否, 评审意见)
# 边界：只对照清单逐条验收，不改内容，不合格必须给出可执行理由
# ============================================================


def critic(checklist: str, output: str) -> tuple:
    """
    评审：逐条对照清单验收。
    返回 (passed: bool, reason: str)
    """
    items = [line.strip() for line in checklist.strip().split("\n") if line.strip()]
    missing = []

    for item in items:
        # 提取关键词：去掉序号 + 去掉动词前缀（"写出" / "说明" / "介绍"）
        raw = item.split(". ", 1)[-1] if ". " in item else item
        keyword = raw.replace("写出", "").replace("说明", "").replace("介绍", "")
        found = False
        for line in output.split("\n"):
            if keyword in line:
                found = True
                break
        if not found:
            missing.append(item)

    if missing:
        reason_lines = ["以下清单项未完成："]
        for m in missing:
            reason_lines.append(f"  - 缺失：{m}")
        reason_lines.append("以上条目必须在下一版中补齐。")
        return False, "\n".join(reason_lines)

    return True, "所有清单项均已覆盖，文案可以交付。"


# ============================================================
# 编排者（Orchestrator）
# 职责：控制协作流程、决定重做还是采纳、保证终止
# ============================================================


def orchestrate(topic: str, max_rounds: int = 3) -> None:
    """
    编排三 Agent 协作流程。

    流程：
      1. 规划者 → 产出任务清单
      2. 写手 → 按清单逐项完成
      3. 评审 → 对照清单逐条验收
      4. 不通过 → 写手带反馈重做（回到步骤 2）
      5. 通过或超过最大轮数 → 终止
    """
    _reset_worker()

    print(f"主题：{topic}")
    print("-" * 60)

    # Step 1: 规划者产出清单
    checklist = planner(topic)
    print("[规划者] 任务清单：")
    print(checklist)
    print("-" * 60)

    output = ""
    feedback = ""

    for round_num in range(1, max_rounds + 1):
        print(f"第 {round_num} 轮")

        # Step 2: 写手产出
        output = worker(checklist, feedback)
        print("[写手] 产出文案：")
        print(output)
        print()

        # Step 3: 评审验收
        passed, reason = critic(checklist, output)
        print("[评审] 验收结论：")
        print(reason)

        if passed:
            print()
            print("=" * 60)
            print("协作完成 + 最终产出")
            print("=" * 60)
            print(output)
            return

        # Step 4: 不通过，准备反馈进入下一轮
        print(f"[编排者] 评审不通过，打回写手重做（剩余轮数：{max_rounds - round_num}）")
        feedback = reason
        print("-" * 60)

    # Step 5: 超过最大轮数
    print()
    print("=" * 60)
    print("协作失败：超过最大重试轮数")
    print(f"失败原因：评审连续 {max_rounds} 轮未通过，打回超限。")
    print(f"最后一轮评审意见：\n{feedback}")
    print("=" * 60)


# ============================================================
# 入口
# ============================================================

if __name__ == "__main__":
    orchestrate("保温杯")