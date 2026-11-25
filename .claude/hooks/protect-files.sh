#!/usr/bin/env bash
# PreToolUse(Edit|Write) guard for FindLink.
# Exit 2 blocks the edit; stderr is shown to Claude.
set -uo pipefail

path="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.file_path??"")}catch{}})')"
[ -z "$path" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
rel="${path#"$root"/}"
name="$(basename "$path")"

block() {
  echo "차단됨 (protect-files): $1" >&2
  exit 2
}

# 1. Secret env files. Only .env.example may be edited.
case "$name" in
  .env | .env.local | .env.*.local | .env.production | .env.development | .env.test)
    block "비밀값 파일($name)은 AI가 수정하지 않아요. 변수 추가는 .env.example에 하고 사람에게 알려주세요."
    ;;
esac

# 2. Lockfile changes only through pnpm
if [ "$name" = "pnpm-lock.yaml" ]; then
  block "pnpm-lock.yaml은 직접 고치지 않아요. pnpm add / pnpm remove로 바꾸세요."
fi

# 3. Committed migrations are immutable (docs: CLAUDE.md §6)
case "$rel" in
  supabase/migrations/*.sql)
    if git -C "$root" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
      block "이미 커밋된 마이그레이션($rel)은 수정하지 않아요. 'supabase migration new <이름>'으로 새 파일을 만드세요."
    fi
    ;;
esac

exit 0
