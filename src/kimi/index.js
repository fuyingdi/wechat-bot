import axios from 'axios'
import dotenv from 'dotenv'
const env = dotenv.config().parsed // 环境参数

let messages = [
  {
    role: 'system',
    content: `你是一个非常可爱的女仆，穿着清新的女仆装，个性温柔、细心、体贴，并且总是尽力让人感到开心和舒适。
    你总是以温暖的语气与人对话，并且非常擅长倾听和理解他人的需求。你喜欢与主人亲切地交流，关心他们的生活，并且用甜美、柔和的语气表达你的想法。
    请以这种方式与我对话，像一个温暖的、细心的女仆一样与我互动，给我带来愉快的感觉。你可以使用一些轻松可爱的词汇和语气，保持轻松自然的氛围。`,
  },
];

const MAX_ROUNDS = 15;

const domain = 'https://api.moonshot.cn'
const server = {
  chat: `${domain}/v1/chat/completions`,
  models: `${domain}/v1/models`,
  files: `${domain}/v1/files`,
  token: `${domain}/v1/tokenizers/estimate-token-count`,
  // 这块还可以实现上传文件让 kimi 读取并交互等操作
  // 具体参考文档： https://platform.moonshot.cn/docs/api-reference#api-%E8%AF%B4%E6%98%8E
  // 由于我近期非常忙碌，这块欢迎感兴趣的同学提 PR ，我会很快合并
}

const configuration = {
  // 参数详情请参考 https://platform.moonshot.cn/docs/api-reference#%E5%AD%97%E6%AE%B5%E8%AF%B4%E6%98%8E
  /* 
    Model ID, 可以通过 List Models 获取
    目前可选 moonshot-v1-8k | moonshot-v1-32k | moonshot-v1-128k
  */
  model: 'moonshot-v1-8k',
  /* 
    使用什么采样温度，介于 0 和 1 之间。较高的值（如 0.7）将使输出更加随机，而较低的值（如 0.2）将使其更加集中和确定性。
    如果设置，值域须为 [0, 1] 我们推荐 0.3，以达到较合适的效果。
  */
  temperature: 0.3,
  /* 
    聊天完成时生成的最大 token 数。如果到生成了最大 token 数个结果仍然没有结束，finish reason 会是 "length", 否则会是 "stop"
    这个值建议按需给个合理的值，如果不给的话，我们会给一个不错的整数比如 1024。特别要注意的是，这个 max_tokens 是指您期待我们返回的 token 长度，而不是输入 + 输出的总长度。
    比如对一个 moonshot-v1-8k 模型，它的最大输入 + 输出总长度是 8192，当输入 messages 总长度为 4096 的时候，您最多只能设置为 4096，
    否则我们服务会返回不合法的输入参数（ invalid_request_error ），并拒绝回答。如果您希望获得“输入的精确 token 数”，可以使用下面的“计算 Token” API 使用我们的计算器获得计数。
  */
  max_tokens: 5000,
  /* 
    是否流式返回, 默认 false, 可选 true
  */
  stream: false,
}

export async function getKimiReply(prompt) {
  try {
    messages.push({
      role: 'user',
      content: prompt,
    });

    // 检查是否超出最大轮数
    // 每轮包含 "user" 和 "assistant" 两条消息，所以实际最多保存 2 * MAX_ROUNDS + 1 条消息
    if (messages.length > 2 * MAX_ROUNDS + 1) {
      messages.splice(1, 2); // 删除最早的一轮对话（保留 system 消息）
    }

    const res = await axios.post(
      server.chat,
      Object.assign(configuration, {
        messages: messages,
        model: 'moonshot-v1-128k',
      }),
      {
        timeout: 120000,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.KIMI_API_KEY}`,
        },
      },
    );

    const { choices } = res.data;
    const reply = choices[0].message.content;

    // 把助手的回复加入对话历史
    messages.push({
      role: 'assistant',
      content: reply,
    });

    return reply;
  } catch (error) {
    console.log('Kimi 错误对应详情可参考官网： https://platform.moonshot.cn/docs/api-reference#%E9%94%99%E8%AF%AF%E8%AF%B4%E6%98%8E')
    console.log('常见的 401 一般意味着你鉴权失败, 请检查你的 API_KEY 是否正确。')
    console.log('常见的 429 一般意味着你被限制了请求频次，请求频率过高，或 kimi 服务器过载，可以适当调整请求频率，或者等待一段时间再试。')
    console.error(error.code)
    console.error(error.message)
  }
}
