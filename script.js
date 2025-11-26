/*
 * Client‑side logic for the AI Fair Competition Review prototype.
 *
 * This script persists data in browser localStorage so the example
 * application can demonstrate the full flow without a backend. Real
 * implementations should replace these calls with API requests.
 */

/** Utility: retrieve projects array from localStorage. */
function getProjects() {
  const raw = localStorage.getItem('ai_projects');
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error parsing projects from localStorage', e);
    return [];
  }
}

/** Utility: persist projects array to localStorage. */
function saveProjects(projects) {
  localStorage.setItem('ai_projects', JSON.stringify(projects));
}

/** Generate a unique identifier for new projects or risk items. */
function generateId(prefix = 'P') {
  return (
    prefix +
    Math.random().toString(36).substring(2, 7) +
    Date.now().toString(36)
  );
}

/** Format a Date object into YYYY-MM-DD HH:MM string. */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

/** On dashboard page: populate summary cards and project table. */
function displayDashboard() {
  const projects = getProjects();
  // Summary counts
  const total = projects.length;
  const completed = projects.filter(
    (p) => p.status === 'AI_COMPLETED' || p.status === 'APPROVED'
  ).length;
  const pending = projects.filter((p) => p.status === 'DRAFT').length;
  // Populate counts
  const totalEl = document.getElementById('summary-total');
  const completedEl = document.getElementById('summary-completed');
  const pendingEl = document.getElementById('summary-pending');
  if (totalEl) totalEl.textContent = total;
  if (completedEl) completedEl.textContent = completed;
  if (pendingEl) pendingEl.textContent = pending;
  // Populate table
  const tbody = document.querySelector('#project-table tbody');
  if (tbody) {
    tbody.innerHTML = '';
    projects.forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.projectName || ''}</td>
        <td>${p.org || ''}</td>
        <td>${p.draftType || ''}</td>
        <td>${p.status || ''}</td>
        <td>${p.updatedAt || ''}</td>
        <td>
          <a href="project_detail.html?id=${p.id}" class="btn btn-sm btn-outline-primary">查看</a>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

/** Handle project creation form submission. */
function handleCreateProject(event) {
  event.preventDefault();
  const form = event.target;
  // Gather fields
  const projectName = form.projectName.value.trim();
  const policyTitle = form.policyTitle.value.trim();
  const org = form.org.value.trim();
  const draftType = form.draftType.value;
  const scope = form.scope.value.trim();
  const releaseDate = form.releaseDate.value;
  const isSecret = form.isSecret.checked;
  const applyException = form.applyException.checked;
  // Basic validation
  if (!projectName || !policyTitle) {
    alert('请填写完整的项目名称和文件名称');
    return;
  }
  const projects = getProjects();
  const now = new Date();
  const newProject = {
    id: generateId('P'),
    projectName,
    policyTitle,
    org,
    draftType,
    scope,
    releaseDate,
    isSecret,
    applyException,
    createdAt: formatDate(now),
    updatedAt: formatDate(now),
    status: 'DRAFT',
    aiReview: null,
  };
  projects.push(newProject);
  saveProjects(projects);
  // Redirect to detail page to initiate AI review
  window.location.href = `project_detail.html?id=${newProject.id}`;
}

/** Display project detail and attach event handlers. */
function displayProjectDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) return;
  const projects = getProjects();
  const project = projects.find((p) => p.id === id);
  if (!project) {
    alert('未找到该项目');
    return;
  }
  // Populate basic info
  document.getElementById('detail-projectName').textContent = project.projectName;
  document.getElementById('detail-policyTitle').textContent = project.policyTitle;
  document.getElementById('detail-org').textContent = project.org;
  document.getElementById('detail-draftType').textContent = project.draftType;
  document.getElementById('detail-releaseDate').textContent = project.releaseDate;
  document.getElementById('detail-status').textContent = project.status;
  // AI review section
  const aiSection = document.getElementById('ai-section');
  const startBtn = document.getElementById('btn-start-ai');
  const riskListEl = document.getElementById('risk-items');
  const overallEl = document.getElementById('ai-overall');
  if (!project.aiReview) {
    // No AI review yet
    if (startBtn) {
      startBtn.style.display = 'inline-block';
      startBtn.addEventListener('click', () => startAIReview(id));
    }
    if (aiSection) aiSection.style.display = 'none';
  } else {
    // Display AI results
    if (startBtn) startBtn.style.display = 'none';
    if (aiSection) aiSection.style.display = 'block';
    if (overallEl) {
      const level = project.aiReview.overallRisk;
      let badgeClass;
      if (level === '高') badgeClass = 'bg-danger';
      else if (level === '中') badgeClass = 'bg-warning text-dark';
      else badgeClass = 'bg-success';
      overallEl.innerHTML = `<span class="badge ${badgeClass}">${level}</span>`;
    }
    // Populate risk items table
    if (riskListEl) {
      riskListEl.innerHTML = '';
      project.aiReview.riskItems.forEach((item) => {
        const tr = document.createElement('tr');
        const action = project.aiReview.actions
          ? project.aiReview.actions[item.id]
          : null;
        const actionType = action ? action.type : '';
        const actionDesc = action ? action.desc : '';
        tr.innerHTML = `
          <td>${item.category}</td>
          <td>${item.suspectedText}</td>
          <td>${item.analysis}</td>
          <td>${item.riskLevel}</td>
          <td>${item.suggestedAdjustment}</td>
          <td>${item.lawReference}</td>
          <td>
            <select class="risk-action-select" data-risk-id="${item.id}">
              <option value="" ${!actionType ? 'selected' : ''}>--选择处理--</option>
              <option value="adopt" ${actionType === 'adopt' ? 'selected' : ''}>采纳调整</option>
              <option value="exception" ${actionType === 'exception' ? 'selected' : ''}>适用例外</option>
              <option value="reject" ${actionType === 'reject' ? 'selected' : ''}>不采纳</option>
            </select>
            <textarea style="width: 100%; margin-top: 0.25rem;" rows="2" placeholder="说明（可选）" data-desc-id="${item.id}">${actionDesc || ''}</textarea>
          </td>
        `;
        riskListEl.appendChild(tr);
      });
    }
  }
  // Bind save actions
  const saveBtn = document.getElementById('btn-save-actions');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveRiskActions(id);
    });
  }
  // Bind submit for review
  const submitBtn = document.getElementById('btn-submit-review');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      submitForDepartmentReview(id);
    });
  }
  // Bind generate report
  const reportBtn = document.getElementById('btn-generate-report');
  if (reportBtn) {
    reportBtn.addEventListener('click', () => {
      window.location.href = `report.html?id=${id}`;
    });
  }
}

/** Trigger an AI review: simulates asynchronous call and fills risk items. */
function startAIReview(projectId) {
  const projects = getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;
  // Set status to reviewing
  project.status = 'AI_REVIEWING';
  project.updatedAt = formatDate(new Date());
  saveProjects(projects);
  // Show loading indicator
  const startBtn = document.getElementById('btn-start-ai');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = 'AI 审查中...';
  }
  // Simulate API delay
  setTimeout(() => {
    // Generate dummy results
    const result = createDummyAIResults(project);
    project.aiReview = result;
    project.status = 'AI_COMPLETED';
    project.updatedAt = formatDate(new Date());
    saveProjects(projects);
    // Reload page to show results
    window.location.reload();
  }, 2000);
}

/** Create dummy AI review results. */
function createDummyAIResults(project) {
  const categories = [
    '市场准入',
    '要素流动',
    '经营成本',
    '经营行为',
  ];
  const riskLevels = ['高', '中', '低'];
  const sampleTexts = [
    '第八条：本地区企业享有优先采购权',
    '第三条：对外地企业收取额外保证金',
    '第五条：设定限制性行业准入条件',
    '第二条：对特定行业实行产量配额',
  ];
  const analysisSamples = [
    '可能构成地方保护或排他性措施，限制市场准入',
    '可能影响要素自由流动，涉嫌差别待遇',
    '可能提高企业经营成本，造成不公平竞争',
    '可能限制经营者的正常经营行为',
  ];
  const adjustmentSamples = [
    '建议删除差别待遇条款，改为统一标准',
    '建议取消额外保证金要求，实行平等准入',
    '建议完善条款表述，避免限制性措施',
    '建议按照国家相关法规调整',
  ];
  const lawRefSamples = [
    '《反不正当竞争法》第八条',
    '《行政许可法》第十五条',
    '《公平竞争审查办法》第二条',
    '《市场主体登记管理条例》第十条',
  ];
  const numItems = Math.floor(Math.random() * 3) + 2; // 2-4 items
  const items = [];
  for (let i = 0; i < numItems; i++) {
    const idx = Math.floor(Math.random() * categories.length);
    const id = generateId('R');
    items.push({
      id,
      category: categories[idx],
      suspectedText: sampleTexts[i % sampleTexts.length],
      analysis: analysisSamples[idx],
      riskLevel: riskLevels[i % riskLevels.length],
      suggestedAdjustment: adjustmentSamples[idx],
      lawReference: lawRefSamples[idx],
    });
  }
  // Determine overall risk as max risk level
  const order = { 高: 3, 中: 2, 低: 1 };
  let highest = '低';
  items.forEach((item) => {
    if (order[item.riskLevel] > order[highest]) highest = item.riskLevel;
  });
  return {
    overallRisk: highest,
    riskItems: items,
    actions: {}, // to store user actions keyed by risk id
  };
}

/** Save risk actions from detail page to project object. */
function saveRiskActions(projectId) {
  const projects = getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project || !project.aiReview) return;
  const selects = document.querySelectorAll('select[data-risk-id]');
  const actions = project.aiReview.actions || {};
  selects.forEach((sel) => {
    const riskId = sel.getAttribute('data-risk-id');
    const type = sel.value;
    const descEl = document.querySelector(
      `textarea[data-desc-id="${riskId}"]`
    );
    const desc = descEl ? descEl.value.trim() : '';
    if (type) {
      actions[riskId] = { type, desc };
    }
  });
  project.aiReview.actions = actions;
  project.updatedAt = formatDate(new Date());
  saveProjects(projects);
  alert('已保存处理意见');
}

/** Mark project as submitted for department review. */
function submitForDepartmentReview(projectId) {
  const projects = getProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project) return;
  if (!project.aiReview) {
    alert('请先完成 AI 审查');
    return;
  }
  project.status = 'DEPT_REVIEWING';
  project.updatedAt = formatDate(new Date());
  saveProjects(projects);
  alert('已提交至本单位审核人');
  // Redirect back to dashboard
  window.location.href = 'dashboard.html';
}

/** Display knowledge base page. */
function displayKnowledgeBase() {
  const knowledgeItems = [
    {
      title: '地方企业补贴是否允许',
      tags: ['市场准入', '补贴'],
      content:
        '原则上不得给予特定地区的企业差别化补贴，以免形成地方保护。依据《反不正当竞争法》第八条，政府不得对外地企业设置不合理条件。',
    },
    {
      title: '行政许可需要符合哪些程序',
      tags: ['行政许可'],
      content:
        '行政许可应当遵循公开、公平、公正的原则，不得设定不合理的准入条件。《行政许可法》第十五条明确列出了许可事项的设定权限和程序。',
    },
    {
      title: '是否可以设置行业配额',
      tags: ['经营行为'],
      content:
        '设定生产或销售配额可能限制竞争，应谨慎评估。如果确有需要，应当符合《公平竞争审查办法》第二条的相关规定。',
    },
  ];
  const listEl = document.getElementById('knowledge-list');
  const searchInput = document.getElementById('knowledge-search');
  const answerEl = document.getElementById('knowledge-answer');
  function renderList(filter) {
    listEl.innerHTML = '';
    knowledgeItems
      .filter((item) => {
        if (!filter) return true;
        const q = filter.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .forEach((item) => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.innerHTML = `<strong>${item.title}</strong><br /><span class="text-muted">${item.tags.join(', ')}</span>`;
        li.addEventListener('click', () => {
          answerEl.innerHTML = `<h5>${item.title}</h5><p>${item.content}</p>`;
        });
        listEl.appendChild(li);
      });
  }
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderList(e.target.value.trim());
    });
  }
  renderList('');
}

/** Display statistics charts on stats page using Chart.js. */
function displayStats() {
  const projects = getProjects();
  // Risk level distribution counts
  const riskCounts = { 高: 0, 中: 0, 低: 0, 未审: 0 };
  projects.forEach((p) => {
    if (p.aiReview) {
      riskCounts[p.aiReview.overallRisk] =
        (riskCounts[p.aiReview.overallRisk] || 0) + 1;
    } else {
      riskCounts['未审']++;
    }
  });
  // Render risk bars
  const riskContainer = document.getElementById('risk-bars');
  if (riskContainer) {
    riskContainer.innerHTML = '';
    const totalRisk = Object.values(riskCounts).reduce((a, b) => a + b, 0);
    Object.keys(riskCounts).forEach((label) => {
      const count = riskCounts[label];
      const percent = totalRisk ? Math.round((count / totalRisk) * 100) : 0;
      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '0.5rem';
      wrapper.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.25rem;">
          <span>${label}</span><span>${count}</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar" style="width: ${percent}%"></div>
        </div>
      `;
      riskContainer.appendChild(wrapper);
    });
  }
  // Status distribution counts
  const statusCounts = {};
  projects.forEach((p) => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });
  // Render status bars
  const statusContainer = document.getElementById('status-bars');
  if (statusContainer) {
    statusContainer.innerHTML = '';
    const totalStatus = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    Object.keys(statusCounts).forEach((label) => {
      const count = statusCounts[label];
      const percent = totalStatus ? Math.round((count / totalStatus) * 100) : 0;
      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '0.5rem';
      wrapper.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.25rem;">
          <span>${label}</span><span>${count}</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar" style="width: ${percent}%"></div>
        </div>
      `;
      statusContainer.appendChild(wrapper);
    });
  }
  // Typical issues table
  const typicalEl = document.getElementById('typical-table');
  if (typicalEl) {
    typicalEl.innerHTML = '';
    const issues = {};
    projects.forEach((p) => {
      if (p.aiReview) {
        p.aiReview.riskItems.forEach((item) => {
          const key = item.category;
          issues[key] = (issues[key] || 0) + 1;
        });
      }
    });
    Object.entries(issues).forEach(([category, count]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${category}</td><td>${count}</td>`;
      typicalEl.appendChild(tr);
    });
  }
}

/** Display report page summarising AI review and actions. */
function displayReport() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const projects = getProjects();
  const project = projects.find((p) => p.id === id);
  if (!project || !project.aiReview) {
    document.getElementById('report-content').innerHTML =
      '<p>未找到审查报告。</p>';
    return;
  }
  const reportEl = document.getElementById('report-content');
  let html = '';
  html += `<h4>项目名称：${project.projectName}</h4>`;
  html += `<p>起草单位：${project.org}</p>`;
  html += `<p>审查时间：${project.updatedAt}</p>`;
  html += `<p>总体风险等级：<strong>${project.aiReview.overallRisk}</strong></p>`;
  html += '<h5 class="mt-4">风险项及处理情况</h5>';
  html += '<table class="table table-bordered"><thead><tr><th>类别</th><th>问题摘要</th><th>风险等级</th><th>建议调整</th><th>处理决定</th><th>处理说明</th></tr></thead><tbody>';
  project.aiReview.riskItems.forEach((item) => {
    const action = project.aiReview.actions
      ? project.aiReview.actions[item.id]
      : null;
    const actionDesc = action ? action.desc : '';
    let actionLabel = '';
    if (action) {
      if (action.type === 'adopt') actionLabel = '采纳调整';
      else if (action.type === 'exception') actionLabel = '适用例外';
      else if (action.type === 'reject') actionLabel = '不采纳';
    }
    html += `<tr><td>${item.category}</td><td>${item.analysis}</td><td>${item.riskLevel}</td><td>${item.suggestedAdjustment}</td><td>${actionLabel}</td><td>${actionDesc}</td></tr>`;
  });
  html += '</tbody></table>';
  reportEl.innerHTML = html;
}

// Entry point: call appropriate view initialiser based on page name
document.addEventListener('DOMContentLoaded', () => {
  const pathname = window.location.pathname;
  if (pathname.endsWith('dashboard.html')) {
    displayDashboard();
  } else if (pathname.endsWith('create.html')) {
    const form = document.getElementById('create-form');
    if (form) form.addEventListener('submit', handleCreateProject);
  } else if (pathname.endsWith('project_detail.html')) {
    displayProjectDetail();
  } else if (pathname.endsWith('knowledge.html')) {
    displayKnowledgeBase();
  } else if (pathname.endsWith('stats.html')) {
    displayStats();
  } else if (pathname.endsWith('report.html')) {
    displayReport();
  }
});