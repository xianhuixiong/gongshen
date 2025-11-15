/*
 * server.js
 *
 * Node.js + Express 后端，用于接受前端传来的业务文本，通过构建提示词调用 AI 大模型执行公平竞争合规审查，并将模型的结构化结果返回给前端。
 *
 * 当前实现中的 `callLLM` 函数仅返回一个模拟结果。要接入真实的大模型服务，请按照 README 中的说明修改此函数。
 */

const express = require('express');
const path = require('path');

const app = express();

// 解析 JSON 请求体
app.use(express.json());

// 静态文件服务：将 public 目录暴露为静态资源
const staticDir = path.join(__dirname, 'public');
app.use(express.static(staticDir));

/**
 * 调用大模型服务分析公平竞争风险。
 *
 * @param {string} prompt 完整的提示词，包含业务场景、法域与文本内容
 * @returns {Promise<Object|string>} 返回模型输出的 JSON 对象或 JSON 字符串
 */
async function callLLM(prompt) {
  /*
   * TODO: 将此部分替换为真实的大模型 API 调用。
   *
   * 示例：
   * const response = await fetch('https://api.your-llm-provider.com/v1/completions', {
   *   method: 'POST',
   *   headers: {
   *     'Content-Type': 'application/json',
   *     'Authorization': `Bearer ${process.env.LLM_API_KEY}`
   *   },
   *   body: JSON.stringify({
   *     model: 'your-model-id',
   *     prompt: prompt,
   *     max_tokens: 1024,
   *     temperature: 0.5,
   *   })
   * });
   * const text = await response.text();
   * return text;
   */

  // 下面是模拟返回的数据，仅用于演示前后端交互
  return {
    riskScore: 65,
    summary: '文本中包含可能限制交易对手独立自主的条款，存在排他性合作风险，需要调整不合理约束。',
    issues: [
      {
        title: '排他性合作条款',
        level: '高',
        description: '要求合作方在合同期内不得与其他竞争者合作，属于限制交易相对人自由选择合作伙伴的行为。',
        suggestion: '建议删除或修改排他性条款，允许合作方与其他主体合作，或采用非独家的合作方式。',
        lawReference: '《反垄断法》第十五条有关垄断协议的禁止性规定。'
      },
      {
        title: '不合理的违约惩罚',
        level: '中',
        description: '使用提高佣金、降级流量等方式作为违约惩罚，可能被视为利用优势地位实施不公平条款。',
        suggestion: '将违约责任改为以实际损失为基础的违约金或补偿，避免滥用平台优势。',
        lawReference: '《反不正当竞争法》第五条有关利用优势地位排除、限制竞争的规定。'
      }
    ],
    modelNote: '上述分析为模型基于公开法律文本和经验总结的结果，仅供参考，不构成法律意见。'
  };
}

/**
 * 根据前端传来的参数构建 Prompt
 *
 * @param {Object} params 参数对象
 * @param {string} params.businessType 业务场景类型
 * @param {string} params.jurisdiction 主要适用法域
 * @param {string} params.content 需要审查的文本
 * @param {Object} params.options 可选项，包含是否生成评分、风险点、建议等
 * @returns {string} 构建好的提示词
 */
function buildPrompt({ businessType, jurisdiction, content, options }) {
  return `
你是一名熟悉反垄断法和反不正当竞争法的合规顾问，需要对以下商业安排进行公平竞争合规审查。请用中文回答。

【业务场景类型】${businessType}
【主要适用法域】${jurisdiction}
【文本内容】
${content}

请给出结构化输出（JSON），字段包括：
riskScore：0-100 的整数，分数越高表示竞争法风险越大；
summary：对整体风险的简短总结（2-4 句话）；
issues：数组，每个元素包含 title（风险点标题）、level（低/中/高）、description（风险点说明）、suggestion（整改建议）、lawReference（可能涉及的法律条款或监管指引）；
modelNote：对模型分析局限性的简短说明。

只输出 JSON，不要输出其他解释文字。`;
}

// 处理审查请求
app.post('/api/review', async (req, res) => {
  try {
    const { businessType, jurisdiction, content, options } = req.body || {};
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content 不能为空' });
    }
    const prompt = buildPrompt({
      businessType: businessType || 'general',
      jurisdiction: jurisdiction || 'cn',
      content,
      options: options || {},
    });
    // 调用大模型
    const raw = await callLLM(prompt);
    // 如果返回的是字符串，则尝试解析为 JSON
    let parsed;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.error('解析大模型返回值失败', e);
        return res.status(500).json({ error: '解析大模型结果失败' });
      }
    } else {
      parsed = raw;
    }
    // 兜底处理，确保返回结构完整
    const response = {
      riskScore: typeof parsed.riskScore === 'number' ? parsed.riskScore : null,
      summary: parsed.summary || '',
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      modelNote: parsed.modelNote || '',
    };
    res.json(response);
  } catch (err) {
    console.error('处理请求失败', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});