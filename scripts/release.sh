#!/bin/bash

# 发布脚本：使用 gh 创建 GitHub release 和 npm publish

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查必要的工具
check_dependencies() {
  if ! command -v gh &> /dev/null; then
    echo -e "${RED}错误: 未安装 GitHub CLI (gh)${NC}"
    echo "请安装: brew install gh"
    exit 1
  fi

  if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: 未安装 npm${NC}"
    exit 1
  fi

  if ! command -v git &> /dev/null; then
    echo -e "${RED}错误: 未安装 git${NC}"
    exit 1
  fi
}

# 检查是否在 git 仓库中
check_git_repo() {
  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${YELLOW}警告: 当前目录不是 git 仓库，正在初始化...${NC}"
    git init
    echo "请先添加远程仓库: git remote add origin <your-repo-url>"
    echo "然后运行: git add . && git commit -m 'Initial commit'"
    exit 1
  fi
}

# 检查是否有未提交的更改
check_uncommitted() {
  if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}警告: 有未提交的更改${NC}"
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
}

# 更新版本号
update_version() {
  local version_type=${1:-patch}
  
  echo -e "${GREEN}更新版本号 (${version_type})...${NC}"
  
  # 获取当前版本
  CURRENT_VERSION=$(node -p "require('./package.json').version")
  echo -e "当前版本: ${CURRENT_VERSION}"
  
  # 更新版本
  npm version ${version_type} --no-git-tag-version
  
  # 获取新版本
  NEW_VERSION=$(node -p "require('./package.json').version")
  echo -e "${GREEN}新版本: ${NEW_VERSION}${NC}"
  
  echo $NEW_VERSION
}

# 创建 git tag 并推送
create_and_push_tag() {
  local version=$1
  
  echo -e "${GREEN}创建 git tag v${version}...${NC}"
  
  # 提交 package.json 更改
  git add package.json
  git commit -m "chore: bump version to ${version}" || true
  
  # 创建 tag
  git tag -a "v${version}" -m "Release v${version}"
  
  # 推送代码和 tag
  echo -e "${GREEN}推送代码和 tag 到 GitHub...${NC}"
  git push origin main || git push origin master || git push
  git push origin "v${version}"
}

# 创建 GitHub release
create_github_release() {
  local version=$1
  
  echo -e "${GREEN}创建 GitHub release v${version}...${NC}"
  
  # 生成 release notes（可以从 CHANGELOG.md 读取，如果有的话）
  local notes="Release v${version}"
  
  if [ -f "CHANGELOG.md" ]; then
    # 尝试从 CHANGELOG.md 提取版本说明
    notes=$(awk "/^## \[${version}\]/,/^## /" CHANGELOG.md | head -n -1 || echo "Release v${version}")
  fi
  
  # 创建 release
  gh release create "v${version}" \
    --title "v${version}" \
    --notes "$notes" \
    --latest
}

# 发布到 npm
publish_npm() {
  local version=$1
  
  echo -e "${GREEN}发布到 npm...${NC}"
  
  # 检查是否已登录
  if ! npm whoami &> /dev/null; then
    echo -e "${YELLOW}警告: 未登录 npm，请先运行: npm login${NC}"
    read -p "是否现在登录？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      npm login
    else
      echo -e "${RED}取消发布${NC}"
      exit 1
    fi
  fi
  
  # 发布
  npm publish --access public
  
  echo -e "${GREEN}✓ 已发布到 npm: @leeguoo/zentao-mcp@${version}${NC}"
}

# 主函数
main() {
  local version_type=${1:-patch}
  
  echo -e "${GREEN}=== 开始发布流程 ===${NC}"
  
  # 检查依赖
  check_dependencies
  
  # 检查 git 仓库
  check_git_repo
  
  # 检查未提交的更改
  check_uncommitted
  
  # 更新版本号
  NEW_VERSION=$(update_version $version_type)
  
  # 创建 tag 并推送
  create_and_push_tag $NEW_VERSION
  
  # 创建 GitHub release
  create_github_release $NEW_VERSION
  
  # 发布到 npm
  publish_npm $NEW_VERSION
  
  echo -e "${GREEN}=== 发布完成 ===${NC}"
  echo -e "${GREEN}版本: ${NEW_VERSION}${NC}"
  echo -e "${GREEN}GitHub: https://github.com/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/releases/tag/v${NEW_VERSION}${NC}"
  echo -e "${GREEN}npm: https://www.npmjs.com/package/@leeguoo/zentao-mcp${NC}"
}

# 显示帮助信息
show_help() {
  echo "用法: ./scripts/release.sh [version_type]"
  echo ""
  echo "version_type:"
  echo "  patch  - 补丁版本 (0.2.1 -> 0.2.2) [默认]"
  echo "  minor  - 次版本 (0.2.1 -> 0.3.0)"
  echo "  major  - 主版本 (0.2.1 -> 1.0.0)"
  echo ""
  echo "示例:"
  echo "  ./scripts/release.sh patch"
  echo "  ./scripts/release.sh minor"
  echo "  ./scripts/release.sh major"
}

# 处理参数
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
  show_help
  exit 0
fi

# 运行主函数
main "$@"
