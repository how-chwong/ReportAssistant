import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { XMLParser } from "fast-xml-parser";

const app = express();
const port = process.env.PORT || 8000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const parseYearRange = (year) => ({
  since: `${year}-01-01T00:00:00Z`,
  until: `${year}-12-31T23:59:59Z`,
});

const buildGitLabHeaders = ({ token, username, password }) => {
  if (token) {
    return { "PRIVATE-TOKEN": token };
  }
  if (username && password) {
    const encoded = Buffer.from(`${username}:${password}`).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }
  return {};
};

const fetchGitLabProjects = async ({ serverUrl, token, username, password }) => {
  const projects = [];
  let page = 1;
  let hasMore = true;
  const headers = buildGitLabHeaders({ token, username, password });

  while (hasMore) {
    const response = await fetch(
      `${serverUrl}/api/v4/projects?membership=true&per_page=100&page=${page}`,
      {
        headers,
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitLab 项目获取失败: ${response.status} ${text}`);
    }

    const data = await response.json();
    projects.push(...data);
    hasMore = data.length === 100;
    page += 1;
  }

  return projects;
};

const fetchGitLabCommits = async ({ serverUrl, token, username, password, projectId, since, until }) => {
  const commits = [];
  let page = 1;
  let hasMore = true;
  const headers = buildGitLabHeaders({ token, username, password });

  while (hasMore) {
    const response = await fetch(
      `${serverUrl}/api/v4/projects/${projectId}/repository/commits?since=${encodeURIComponent(
        since,
      )}&until=${encodeURIComponent(until)}&per_page=100&page=${page}&with_stats=true`,
      {
        headers,
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitLab 提交获取失败: ${response.status} ${text}`);
    }

    const data = await response.json();
    commits.push(...data);
    hasMore = data.length === 100;
    page += 1;
  }

  return commits;
};

const normalizeGitLabCommits = (commits, project) =>
  commits.map((commit) => ({
    date: commit.committed_date,
    project: project.name,
    module: project.path,
    message: commit.title,
    additions: commit.stats?.additions ?? 0,
    deletions: commit.stats?.deletions ?? 0,
  }));

const buildBasicAuthHeader = ({ username, password }) => {
  if (!username || !password) {
    return {};
  }
  const encoded = Buffer.from(`${username}:${password}`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
};

const svnReportRequest = async ({ url, body, username, password }) => {
  const response = await fetch(url, {
    method: "REPORT",
    headers: {
      "Content-Type": "text/xml",
      ...buildBasicAuthHeader({ username, password }),
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SVN 日志获取失败: ${response.status} ${text}`);
  }

  return response.text();
};

const fetchSvnRevisionByDate = async ({ vccUrl, date, username, password }) => {
  const body = `<?xml version="1.0" encoding="utf-8"?>\n<S:dated-rev-report xmlns:S="svn:">\n  <S:creationdate>${date}</S:creationdate>\n</S:dated-rev-report>`;
  const xml = await svnReportRequest({ url: vccUrl, body, username, password });
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  const parsed = parser.parse(xml);
  const revision = parsed?.["dated-rev-report"]?.["version-name"];
  if (!revision) {
    throw new Error("SVN 日期转版本号失败，请检查服务器是否支持 WebDAV/REPORT。");
  }
  return revision;
};

const runSvnLog = async ({ serverUrl, username, password, year }) => {
  const vccUrl = serverUrl.endsWith("/")
    ? `${serverUrl}!svn/vcc/default`
    : `${serverUrl}/!svn/vcc/default`;
  const startDate = `${year}-01-01T00:00:00Z`;
  const endDate = `${year}-12-31T23:59:59Z`;
  const startRevision = await fetchSvnRevisionByDate({
    vccUrl,
    date: startDate,
    username,
    password,
  });
  const endRevision = await fetchSvnRevisionByDate({
    vccUrl,
    date: endDate,
    username,
    password,
  });

  const logBody = `<?xml version="1.0" encoding="utf-8"?>\n<S:log-report xmlns:S="svn:">\n  <S:start-revision>${endRevision}</S:start-revision>\n  <S:end-revision>${startRevision}</S:end-revision>\n  <S:discover-changed-paths/>\n  <S:all-revprops/>\n</S:log-report>`;

  return svnReportRequest({
    url: vccUrl,
    body: logBody,
    username,
    password,
  });
};

const parseSvnLog = (xml, serverUrl) => {
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  const parsed = parser.parse(xml);
  const entries = parsed?.["log-report"]?.["log-item"] ?? [];
  const list = Array.isArray(entries) ? entries : [entries];

  return list.map((entry) => {
    const paths = entry.paths?.path;
    const firstPath = Array.isArray(paths) ? paths[0]?.["#text"] : paths?.["#text"];
    return {
      date: entry.date,
      project: serverUrl,
      module: firstPath || "svn",
      message: entry.comment ?? "",
      additions: 0,
      deletions: 0,
    };
  });
};

app.post("/api/gitlab/report", async (req, res) => {
  try {
    const { serverUrl, token, username, password, year } = req.body;
    if (!serverUrl || !year || (!token && !(username && password))) {
      res.status(400).json({ error: "缺少 GitLab 连接信息（需要 Token 或用户名密码）。" });
      return;
    }

    const { since, until } = parseYearRange(year);
    const projects = await fetchGitLabProjects({ serverUrl, token, username, password });
    const commits = [];

    for (const project of projects) {
      const projectCommits = await fetchGitLabCommits({
        serverUrl,
        token,
        username,
        password,
        projectId: project.id,
        since,
        until,
      });
      commits.push(...normalizeGitLabCommits(projectCommits, project));
    }

    res.json({
      commits,
      summary: `GitLab · ${serverUrl} · ${projects.length} 个项目`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/svn/report", async (req, res) => {
  try {
    const { serverUrl, username, password, year } = req.body;
    if (!serverUrl || !year) {
      res.status(400).json({ error: "缺少 SVN 连接信息。" });
      return;
    }

    const xml = await runSvnLog({ serverUrl, username, password, year });
    const commits = parseSvnLog(xml, serverUrl);

    res.json({
      commits,
      summary: `SVN · ${serverUrl} · ${commits.length} 条日志`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`ReportAssistant server running at http://localhost:${port}`);
});
