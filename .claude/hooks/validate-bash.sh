#!/usr/bin/env bash
# PreToolUse(Bash) guard for 잇츠미.
# Reads the hook JSON on stdin. Exit 2 blocks the command; stderr is shown to Claude.
# Parses JSON with node (always present in this project) so teammates don't need jq.
set -uo pipefail

cmd="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.command??"")}catch{}})')"
[ -z "$cmd" ] && exit 0

block() {
  echo "차단됨 (validate-bash): $1" >&2
  exit 2
}

matches() { printf '%s' "$cmd" | grep -Eiq -- "$1"; }

# 1. rm on root, home, the whole project, or a bare glob
if matches '(^|[;&|[:space:]])rm[[:space:]]+(-[[:alnum:]-]+[[:space:]]+)*(/|~/?|\$HOME/?|\./?|\*)([[:space:];&|]|$)'; then
  block "루트·홈·프로젝트 전체를 지우는 rm 명령은 실행하지 않아요. 지울 경로를 정확히 지정하세요."
fi

# 2. Reading secret env files through the shell (.env.example is fine)
secret_env='\.env(\.local|\.[a-z]+\.local|\.production|\.development|\.test)?([^.[:alnum:]_-]|$)'
readers='(^|[;&|[:space:]])(cat|less|more|head|tail|bat|grep|rg|sed|awk|strings|xxd|base64|source|printenv)[[:space:]]'
if matches "$readers" && matches "$secret_env"; then
  block "비밀값 파일(.env, .env.local 등)은 읽지 않아요. 필요한 변수 이름은 .env.example을 보세요."
fi

# 3. Remote / destructive database operations
if matches 'supabase[[:space:]]+db[[:space:]]+reset'; then
  block "supabase db reset은 사람이 직접 실행하세요 (로컬 DB도 데이터가 모두 지워져요)."
fi
if matches '(psql|supabase[[:space:]]+db[[:space:]]+execute).*(drop[[:space:]]+(table|schema|database)|truncate)'; then
  block "DROP/TRUNCATE는 실행하지 않아요. 스키마 변경은 새 마이그레이션 파일로 하세요."
fi

# 4. Git history rewrites and wiping ignored files (.env.local lives there)
if matches 'git[[:space:]]+push.*(--force|[[:space:]]-f([[:space:]]|$)|--force-with-lease)'; then
  block "force push는 하지 않아요."
fi
if matches 'git[[:space:]]+clean[[:space:]]+-[[:alnum:]]*x'; then
  block "git clean -x는 .env.local까지 지워요. 사람이 직접 실행하세요."
fi

# 5. Production deploys happen only by merging to main
if matches 'vercel([[:space:]]+deploy)?[[:space:]].*--prod'; then
  block "프로덕션 배포는 main 브랜치 병합으로만 해요 (.claude/skills/deploy 참고)."
fi

exit 0
