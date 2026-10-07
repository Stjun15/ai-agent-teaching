-- 修正 module_audits 的评分列语义（2026-10-07）
--
-- 问题：004 把第一列命名为 `explain_readability`（讲解可读性），但编排层实际
-- 写进去的是**示范代码可读性**（`deterministic.ts` 的 `demoReadability`）。
-- 名实不符会让读表的人以为那是「讲解稿的可读性分数」—— 而讲解稿好不好，
-- 这一轮根本没判（`cognitive_load` 恒为 null 就是同一个道理）。
--
-- 同时 `reachability`（讲稿有没有任务节，决定任务卡渲不渲染）压根没有列，
-- 而它恰恰是确定性检查判得最准的一项：任务节缺失会让模仿页的整个任务卡
-- 不渲染，学生面对空编辑器（C2）。
--
-- 修法：列名对齐实际写入的语义，四项分数与 `deterministic.ts` 的 scores
-- 逐一同名 —— `reachability` / `demo_readability` / `terminology_gap` /
-- `consistency`。`cognitive_load` 保留（恒为 null），它记录的是「这一维度
-- 存在但本轮没测」，删掉列反而看不出这个边界。

ALTER TABLE module_audits ADD COLUMN reachability REAL;
ALTER TABLE module_audits ADD COLUMN demo_readability REAL;

-- explain_readability 里存的其实是示范可读性，按实际语义搬到新列。
UPDATE module_audits
   SET demo_readability = explain_readability,
       explain_readability = NULL;

-- 旧列已无对应语义（讲解可读性本轮不判）。SQLite 3.35+ 支持 DROP COLUMN。
ALTER TABLE module_audits DROP COLUMN explain_readability;
