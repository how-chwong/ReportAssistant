const mockCommits = [
  {
    date: "2024-01-05T09:12:00",
    project: "ReportAssistant",
    module: "auth",
    message: "feat: 支持企业 OAuth 登录",
    additions: 230,
    deletions: 40,
  },
  {
    date: "2024-01-05T22:40:00",
    project: "ReportAssistant",
    module: "dashboard",
    message: "fix: 修复指标卡片对齐问题",
    additions: 35,
    deletions: 18,
  },
  {
    date: "2024-02-14T07:50:00",
    project: "InsightHub",
    module: "report",
    message: "feat: 新增年度汇总视图",
    additions: 180,
    deletions: 20,
  },
  {
    date: "2024-02-20T18:30:00",
    project: "InsightHub",
    module: "report",
    message: "refactor: 优化查询性能",
    additions: 60,
    deletions: 30,
  },
  {
    date: "2024-03-03T23:10:00",
    project: "DevPulse",
    module: "api",
    message: "fix: 修复分页接口异常",
    additions: 48,
    deletions: 12,
  },
  {
    date: "2024-03-22T10:05:00",
    project: "DevPulse",
    module: "api",
    message: "feat: 增加提交统计接口",
    additions: 120,
    deletions: 15,
  },
  {
    date: "2024-04-09T21:35:00",
    project: "ReportAssistant",
    module: "metrics",
    message: "fix: 更新活跃时间段算法",
    additions: 40,
    deletions: 5,
  },
  {
    date: "2024-05-18T06:45:00",
    project: "ReportAssistant",
    module: "metrics",
    message: "feat: 新增关键词提取",
    additions: 95,
    deletions: 10,
  },
  {
    date: "2024-06-30T23:55:00",
    project: "InsightHub",
    module: "ui",
    message: "chore: 更新可视化主题色",
    additions: 25,
    deletions: 8,
  },
  {
    date: "2024-07-07T08:20:00",
    project: "DevPulse",
    module: "ui",
    message: "feat: 新增夜猫子标签",
    additions: 70,
    deletions: 9,
  },
  {
    date: "2024-08-15T19:00:00",
    project: "ReportAssistant",
    module: "dashboard",
    message: "fix: 修复统计卡片加载",
    additions: 55,
    deletions: 22,
  },
  {
    date: "2024-09-02T11:40:00",
    project: "InsightHub",
    module: "security",
    message: "feat: 增强 Token 权限校验",
    additions: 140,
    deletions: 35,
  },
  {
    date: "2024-10-12T23:20:00",
    project: "ReportAssistant",
    module: "report",
    message: "fix: 修复导出格式",
    additions: 42,
    deletions: 12,
  },
  {
    date: "2024-11-05T09:05:00",
    project: "DevPulse",
    module: "metrics",
    message: "feat: 添加活跃天数统计",
    additions: 110,
    deletions: 17,
  },
  {
    date: "2024-12-20T22:15:00",
    project: "InsightHub",
    module: "report",
    message: "fix: 修复年终汇总遗漏",
    additions: 60,
    deletions: 18,
  },
];

const metricConfig = [
  { key: "commitCount", label: "提交次数" },
  { key: "activeDays", label: "活跃天数" },
  { key: "projectCount", label: "涉及项目数" },
  { key: "maxDailyCommits", label: "最大单日提交数" },
];

const form = document.getElementById("report-form");
const metricGrid = document.getElementById("metric-grid");
const keywordList = document.getElementById("keyword-list");
const projectTableBody = document.querySelector("#project-table tbody");
const heroYear = document.getElementById("hero-year");
const heroProjects = document.getElementById("hero-projects");
const activityHint = document.getElementById("activity-hint");
const statusText = document.getElementById("status-text");
const submitButton = document.querySelector("button.primary");

const lineAdd = document.getElementById("line-add");
const lineDel = document.getElementById("line-del");
const barAdd = document.getElementById("bar-add");
const barDel = document.getElementById("bar-del");

const fixRate = document.getElementById("fix-rate");
const featureRate = document.getElementById("feature-rate");
const fixRateText = document.getElementById("fix-rate-text");
const featureRateText = document.getElementById("feature-rate-text");
const maxDay = document.getElementById("max-day");

const stopWords = ["fix", "feat", "chore", "refactor", "修复", "新增", "更新", "优化", "支持", "添加", "增强"];

const getHour = (dateString) => new Date(dateString).getHours();

const simulateFetchCommits = ({ serverType, serverUrl, username, year }) =>
  new Promise((resolve) => {
    const delay = serverType === "svn" ? 1200 : 800;
    setTimeout(() => {
      resolve({
        data: mockCommits,
        summary: `${serverType.toUpperCase()} · ${serverUrl} · ${username} · ${year}`,
      });
    }, delay);
  });

const computeMetrics = (data) => {
  const commitCount = data.length;
  const activeDays = new Set(data.map((item) => item.date.split("T")[0])).size;
  const projectCount = new Set(data.map((item) => item.project)).size;

  const additions = data.reduce((sum, item) => sum + item.additions, 0);
  const deletions = data.reduce((sum, item) => sum + item.deletions, 0);

  const dailyCommits = data.reduce((acc, item) => {
    const day = item.date.split("T")[0];
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  const maxDailyCommits = Math.max(...Object.values(dailyCommits));
  const maxDayLabel = Object.keys(dailyCommits).find(
    (day) => dailyCommits[day] === maxDailyCommits,
  );

  const keywords = data.flatMap((item) =>
    item.message
      .replace(/[,:]/g, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word && !stopWords.includes(word.toLowerCase())),
  );

  const keywordCount = keywords.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});

  const topKeywords = Object.entries(keywordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);

  const projectStats = data.reduce((acc, item) => {
    acc[item.project] = (acc[item.project] || 0) + 1;
    return acc;
  }, {});

  const preferredProject = Object.entries(projectStats).sort((a, b) => b[1] - a[1])[0][0];

  const fixCommits = data.filter((item) => item.message.toLowerCase().includes("fix")).length;
  const featureCommits = data.filter((item) => item.message.toLowerCase().includes("feat")).length;

  const hours = data.map((item) => getHour(item.date));
  const nightOwls = hours.filter((hour) => hour >= 22 || hour <= 6).length;
  const earlyBirds = hours.filter((hour) => hour >= 6 && hour <= 10).length;
  const activityPeriod = nightOwls >= earlyBirds ? "夜猫子" : "早鸟";

  return {
    commitCount,
    activeDays,
    projectCount,
    additions,
    deletions,
    maxDailyCommits,
    maxDayLabel,
    topKeywords,
    projectStats,
    preferredProject,
    fixCommits,
    featureCommits,
    activityPeriod,
  };
};

const renderMetrics = (metrics) => {
  metricGrid.innerHTML = "";
  metricConfig.forEach((item) => {
    const card = document.createElement("div");
    card.className = "metric-card";
    const value = metrics[item.key];
    card.innerHTML = `<span>${item.label}</span><strong>${value}</strong>`;
    metricGrid.appendChild(card);
  });

  lineAdd.textContent = metrics.additions.toLocaleString();
  lineDel.textContent = metrics.deletions.toLocaleString();

  const totalLines = metrics.additions + metrics.deletions || 1;
  barAdd.style.width = `${(metrics.additions / totalLines) * 100}%`;
  barDel.style.width = `${(metrics.deletions / totalLines) * 100}%`;

  activityHint.textContent = `活跃时间段：${metrics.activityPeriod}（偏好 ${metrics.preferredProject}）`;

  keywordList.innerHTML = "";
  metrics.topKeywords.forEach((word) => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = word;
    keywordList.appendChild(tag);
  });

  projectTableBody.innerHTML = "";
  Object.entries(metrics.projectStats).forEach(([project, count]) => {
    const row = document.createElement("tr");
    const percent = ((count / metrics.commitCount) * 100).toFixed(0);
    row.innerHTML = `<td>${project}</td><td>${count}</td><td>${percent}%</td>`;
    projectTableBody.appendChild(row);
  });

  const fixRateValue = metrics.commitCount ? (metrics.fixCommits / metrics.commitCount) * 100 : 0;
  const featureRateValue = metrics.commitCount ? (metrics.featureCommits / metrics.commitCount) * 100 : 0;

  fixRate.style.width = `${fixRateValue}%`;
  featureRate.style.width = `${featureRateValue}%`;
  fixRateText.textContent = `${fixRateValue.toFixed(0)}%`;
  featureRateText.textContent = `${featureRateValue.toFixed(0)}%`;

  maxDay.textContent = `${metrics.maxDayLabel} · ${metrics.maxDailyCommits} 次`;
};

const applyReport = (commits, summary) => {
  const year = document.getElementById("year-select").value;
  heroYear.textContent = year;
  const metrics = computeMetrics(commits);
  heroProjects.textContent = metrics.projectCount;
  renderMetrics(metrics);
  statusText.textContent = `已生成报告：${summary}`;
  statusText.classList.remove("loading");
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const serverType = document.getElementById("server-select").value;
  const serverUrl = document.getElementById("server-url").value;
  const username = document.getElementById("username").value;
  const year = document.getElementById("year-select").value;

  submitButton.disabled = true;
  statusText.textContent = "正在连接服务器并拉取提交数据…";
  statusText.classList.add("loading");

  const result = await simulateFetchCommits({ serverType, serverUrl, username, year });
  applyReport(result.data, result.summary);

  submitButton.disabled = false;
});

applyReport(mockCommits, "本地演示数据");
