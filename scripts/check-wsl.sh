#!/usr/bin/env bash
# Read-only BusNext WSL2 environment check.
# This script never installs packages, changes configuration, starts services,
# edits project files, or removes data.

set -u

usage() {
  cat <<'EOF'
Usage: bash scripts/check-wsl.sh [--help]

Read-only checks for the BusNext development environment under WSL2.
Exit status is non-zero when a required check fails. Warnings alone do not
fail the check.
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

if [ "$#" -gt 0 ]; then
  printf 'ERROR: unknown argument: %s\n' "$1" >&2
  usage >&2
  exit 2
fi

pass_count=0
warn_count=0
fail_count=0

pass_check() {
  pass_count=$((pass_count + 1))
  printf '[OK]   %s\n' "$1"
}

warn_check() {
  warn_count=$((warn_count + 1))
  printf '[WARN] %s\n' "$1"
}

fail_check() {
  fail_count=$((fail_count + 1))
  printf '[FAIL] %s\n' "$1"
}

check_command_version() {
  local command_name="$1"
  local version_command="$2"
  local required="$3"
  local version

  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail_check "$command_name is not installed (required: $required)"
    return
  fi

  version=$(eval "$version_command" 2>/dev/null | head -n 1 || true)
  if [ -n "$version" ]; then
    pass_check "$command_name available: $version"
  else
    warn_check "$command_name is available, but its version could not be read"
  fi
}

printf 'BusNext WSL2 environment check\n'
printf '%s\n' '==============================='

# WSL_INTEROP is set by WSL for normal Linux processes. /proc/version is an
# additional read-only signal and avoids invoking PowerShell or changing state.
if [ -n "${WSL_INTEROP:-}" ] || grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null; then
  pass_check 'running inside WSL'
else
  fail_check 'not running inside WSL2 (run this script from a WSL terminal)'
fi

if command -v systemd-detect-virt >/dev/null 2>&1; then
  virtualization=$(systemd-detect-virt 2>/dev/null || true)
  if [ "$virtualization" = 'wsl' ]; then
    pass_check 'WSL virtualization detected'
  elif [ -n "$virtualization" ]; then
    warn_check "virtualization detected as $virtualization; WSL2 could not be confirmed"
  else
    warn_check 'WSL virtualization check returned no result'
  fi
else
  warn_check 'systemd-detect-virt is unavailable; WSL2 version cannot be confirmed locally'
fi

check_command_version php 'php --version' 'PHP 8.3+'
check_command_version composer 'composer --version' 'Composer 2+'

# Node.js/npm belong to the mobile developer's machine. They are optional here.
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  pass_check "Node.js/npm available (optional on backend-only machine)"
else
  warn_check 'Node.js/npm not installed (not required for backend-only development)'
fi

if command -v docker >/dev/null 2>&1; then
  docker_version=$(docker --version 2>/dev/null | head -n 1 || true)
  pass_check "docker available${docker_version:+: $docker_version}"
  if docker compose version >/dev/null 2>&1; then
    pass_check 'docker compose available'
  else
    warn_check 'docker compose is unavailable (required only when using Compose services)'
  fi
else
  warn_check 'docker is unavailable (required only when using PostgreSQL/Redis via Compose)'
fi

if command -v git >/dev/null 2>&1; then
  pass_check "git available: $(git --version 2>/dev/null || printf 'version unavailable')"
else
  fail_check 'git is not installed'
fi

if [ -d /mnt/c ] && [ "${PWD#/mnt/c/}" != "$PWD" ]; then
  warn_check "repository is under $PWD; Linux filesystem (for example ~/src) usually has better I/O performance"
else
  pass_check "working directory is not under /mnt/c: $PWD"
fi

printf '\nSummary: %d passed, %d warnings, %d failed\n' "$pass_count" "$warn_count" "$fail_count"
if [ "$fail_count" -gt 0 ]; then
  exit 1
fi
exit 0
