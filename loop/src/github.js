import { spawnSync } from "node:child_process";
import { ROOT } from "./env.js";

function gitAvailable() {
  const probe = spawnSync("git", ["--version"], { encoding: "utf8" });
  return probe.status === 0;
}

function git(args, opts = {}) {
  if (!gitAvailable()) {
    return { status: 1, stdout: "", stderr: "git is not installed on PATH" };
  }
  return spawnSync("git", args, { cwd: ROOT, encoding: "utf8", ...opts });
}

export function hasGit() {
  return gitAvailable();
}

export function runGit(args) {
  const result = git(args);
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

const GITHUB = "https://api.github.com";

function githubEnabled() {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
}

async function gh(pathname, { method = "GET", body } = {}) {
  if (!githubEnabled()) return null;
  const res = await fetch(`${GITHUB}${pathname}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return {};
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `GitHub ${res.status}`);
  return data;
}

export async function openPullRequest({ title, body, head, base = "main" }) {
  if (!githubEnabled()) {
    return {
      number: 0,
      html_url: "(no GITHUB_TOKEN/GITHUB_REPO — skipped real PR)",
      skipped: true,
    };
  }
  const [owner, repo] = process.env.GITHUB_REPO.split("/");
  return gh(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: { title, body, head, base },
  });
}

export async function postReview({ pullNumber, body, event = "APPROVE" }) {
  if (!githubEnabled() || !pullNumber) {
    return { skipped: true, body, event };
  }
  const [owner, repo] = process.env.GITHUB_REPO.split("/");
  return gh(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
    method: "POST",
    body: { body, event },
  });
}

export async function mergePullRequest(pullNumber, { requireHuman } = {}) {
  if (requireHuman) {
    return { skipped: true, reason: "REQUIRE_HUMAN_MERGE is set" };
  }
  if (!githubEnabled() || !pullNumber) {
    return { skipped: true, reason: "GitHub not configured" };
  }
  const [owner, repo] = process.env.GITHUB_REPO.split("/");
  return gh(`/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, {
    method: "PUT",
    body: { merge_method: "squash" },
  });
}
