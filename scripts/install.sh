#!/bin/bash
# 马督工思维操作系统 — 安装脚本
# Usage:
#   npx degit wsssnmsg/madugong-perspective-skill madugong-perspective
#   cd madugong-perspective
#   bash scripts/install.sh

set -e

echo ""
echo "🏭 马督工思维操作系统"
echo "═══════════════════════"
echo ""

# 两种模式：
# 1. 注入 SKILL.md → 编辑 .cursorrules / claude.md / 手动复制
# 2. 复制所有调研资料到本地

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "📄 SKILL.md 位于: $SCRIPT_DIR/SKILL.md"
echo ""
echo "📚 调研资料: $SCRIPT_DIR/references/research/"
echo ""
echo "━━━ 使用方式 ━━━"
echo ""
echo "1) 注入到 Claude Code:"
echo "   cp $SCRIPT_DIR/SKILL.md ./CLAUDE.md"
echo ""
echo "2) 注入到 Cursor:"
echo "   cp $SCRIPT_DIR/SKILL.md ./.cursorrules"
echo ""
echo "3) 注入到 Windsurf:"
echo "   cp $SCRIPT_DIR/SKILL.md ./.windsurfrules"
echo ""
echo "4) 查看完整示例:"
echo "   cat $SCRIPT_DIR/examples/usage-examples.md"
echo ""
echo "✅ 完成！"
