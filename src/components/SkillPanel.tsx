import { useState, useEffect } from "react";
import { BookOpen, Trash2, Play, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { listSkills, deleteSkill, instantiateSkill } from "../services/skillService";
import { parseSkillSteps, parseSkillTags } from "../types/skill";
import type { Skill } from "../types/skill";

export default function SkillPanel({
  onRefresh,
}: {
  onRefresh: () => void;
}) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const data = await listSkills();
      setSkills(data);
    } catch (err) {
      console.error("加载技能失败:", err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`确定删除技能「${name}」？`)) return;
    try {
      await deleteSkill(id);
      setSkills((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("删除失败:", err);
    }
  }

  async function handleInstantiate(skill: Skill) {
    setLoading(true);
    try {
      const result = await instantiateSkill({ skill_id: skill.id });
      alert(
        `已创建任务「${result.parent.title}」，包含 ${result.subtasks.length} 个子步骤`,
      );
      onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`创建失败: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-400">
          {skills.length} 个模板
        </span>
        <button
          onClick={load}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
          title="刷新"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {skills.length === 0 && (
        <div className="text-center text-zinc-400 text-xs py-4">
          <BookOpen size={24} className="mx-auto mb-1 opacity-30" />
          暂无技能模板
          <br />
          <span className="text-zinc-500">
            完成一个任务后，可以对 AI 说「存为模板」
          </span>
        </div>
      )}

      {skills.map((skill) => {
        const steps = parseSkillSteps(skill);
        const tags = parseSkillTags(skill);
        const isExpanded = expanded.has(skill.id);

        return (
          <div
            key={skill.id}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700
                       bg-white dark:bg-zinc-800 overflow-hidden"
          >
            {/* 技能头部 */}
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer
                         hover:bg-zinc-50 dark:hover:bg-zinc-750"
              onClick={() => toggleExpand(skill.id)}
            >
              {isExpanded
                ? <ChevronDown size={14} className="text-zinc-400" />
                : <ChevronRight size={14} className="text-zinc-400" />
              }
              <BookOpen size={14} className="text-indigo-500 shrink-0" />
              <span className="text-sm font-medium truncate flex-1">
                {skill.name}
              </span>
              <span className="text-[10px] text-zinc-400">
                用过 {skill.usage_count} 次
              </span>
            </div>

            {/* 展开内容 */}
            {isExpanded && (
              <div className="px-3 pb-2 space-y-1.5 border-t border-zinc-100 dark:border-zinc-700 pt-2">
                {skill.description && (
                  <p className="text-xs text-zinc-500">{skill.description}</p>
                )}

                {/* 步骤 */}
                {steps.length > 0 && (
                  <div>
                    <span className="text-[10px] text-zinc-400">步骤：</span>
                    <ol className="ml-4 mt-0.5 space-y-0.5 list-decimal">
                      {steps.map((step) => (
                        <li key={step.order} className="text-xs text-zinc-600 dark:text-zinc-300">
                          {step.content}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* 经验 */}
                {skill.tips && (
                  <div>
                    <span className="text-[10px] text-zinc-400">经验：</span>
                    <p className="text-xs text-zinc-500 whitespace-pre-wrap">
                      {skill.tips}
                    </p>
                  </div>
                )}

                {/* 标签 */}
                {tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded
                                   bg-zinc-100 dark:bg-zinc-700 text-zinc-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 操作 */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstantiate(skill);
                    }}
                    disabled={loading}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded
                               bg-indigo-600 hover:bg-indigo-500 text-white
                               disabled:opacity-40 transition-colors"
                  >
                    <Play size={10} />
                    执行
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(skill.id, skill.name);
                    }}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded
                               hover:bg-red-100 dark:hover:bg-red-900/30
                               text-red-500 transition-colors"
                  >
                    <Trash2 size={10} />
                    删除
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
