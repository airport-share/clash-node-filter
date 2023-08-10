const fs = require('fs/promises');
const { load, dump } = require('js-yaml');
const axios = require('axios').default;

const {
  formatTime,
  uniquees,
  getTransLink,
  sendMessageToTelegramBot,
} = require('./utils');
const { countryMap, httpsAgent, API_BASE_URL } = require('./constants');

const { auth, telegramBotToken, chatIds, configPath } = require('../config');

// 可以使用的节点
const canUseNodeNames = [];
const config = { proxies: [] };

/** 获取节点延迟 */
async function getDelay(i) {
  const { name } = i;
  const {
    data: { delay },
  } = await axios.get(
    `${API_BASE_URL}/proxies/${encodeURIComponent(
      name
    )}/delay?timeout=2000&url=${encodeURIComponent(
      // 'http://www.gstatic.com/generate_204'
      // 'https://www.google.com/generate_204'
      'http://cp.cloudflare.com/generate_204'
    )}`
  );
  console.log(name, delay);
  return { ...i, delay };
}

/** 运行 */
async function run() {
  // 获取当前配置
  let { proxies: originProxies } = load(await fs.readFile(configPath, 'utf8'));

  // 使用部分节点测试
  originProxies = originProxies.slice(0, 10);

  const proxies = uniquees(originProxies);
  console.log(
    `去重前有 ${originProxies.length} 个节点, 去重后有 ${proxies.length} 个节点`
  );

  const startTime = new Date();
  const countrySet = new Set();
  const proxiesArr = [];

  for (let i = 0; i < proxies.length; i += 30) {
    const p = (
      await Promise.allSettled(proxies.slice(i, i + 30).map((i) => getDelay(i)))
    )
      .filter((i) => i.status === 'fulfilled')
      .map((i) => i.value);
    proxiesArr.push(...p);
    console.log(
      p.length,
      i,
      (((i + 30) / proxies.length) * 100).toFixed(2) + '%'
    );
  }

  for (let proxy of proxiesArr) {
    const { name } = proxy;
    console.log(name);
    try {
      await changeNode(name);
      const { data: res } = await axios.get(
        'http://ip-api.com/json/?lang=zh-CN',
        {
          proxy: {
            host: '127.0.0.1',
            port: 7890,
          },
          timeout: 2000,
        }
      );
      console.log(res);

      res.country = countryMap[res.countryCode] || res.country;
      countrySet.add(res.country);
      canUseNodeNames.push(proxy.name);
      proxy.name =
        res.country + ' - ' + res.city + ' - ' + proxy.delay + ' - ' + res.isp;
      config.proxies.push(proxy);
    } catch (error) {}
  }

  if (!config.proxies.length) {
    return console.log('没有可用节点, 尴尬不?');
  }

  config.proxies.sort((a, b) => a.delay - b.delay);

  const arr = [...countrySet];
  const time = new Date() - startTime;
  const subInfo = `本次耗时${formatTime(time)}, 从${
    proxies.length
  }个节点中筛选出${config.proxies.length}个可用节点${
    arr.length > 0 ? `, ${arr.length}个地区, 包括 ${arr.join('、')}` : ''
  } `;

  console.log(subInfo);

  console.log(canUseNodeNames);
  const flag = await chooseCanuseNode(canUseNodeNames);
  if (flag) {
    const data = {
      port: 7890,
      'socks-port': 7891,
      'allow-lan': true,
      mode: 'Global',
      'log-level': 'info',
      'external-controller': ':9090',
      proxies: config.proxies,
      'proxy-groups': [],
      rules: [],
    };
    fs.writeFile('config.yaml', dump(data), 'utf8');
    if (auth) {
      await publish(dump(data), subInfo);
    } else {
      console.log('未配置github token, 请手动发布');
    }
  }
}

run();

async function changeNode(name) {
  await axios.put(`${API_BASE_URL}/proxies/GLOBAL`, { name });
}

// 自动

async function publish(content, subInfo = '') {
  const {
    data: { files },
  } = await axios.post(
    'https://api.github.com/gists',
    {
      files: { '1.yaml': { content } },
    },
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + auth,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      httpsAgent,
    }
  );
  const rawUrl = files[Object.keys(files)[0]].raw_url;

  const clashUrl = getTransLink(rawUrl, 'clash');
  const v2rayUrl = getTransLink(rawUrl, 'v2ray');
  if (!chatIds?.length || !telegramBotToken) {
    console.log('未配置tg相关信息, 请手动发布');
  }
  const messageText = `#订阅 
${subInfo}

[复制clash订阅](${clashUrl})

[复制v2ray订阅](${v2rayUrl})

点个赞支持一下呗❤️

🥰 借鉴请带出处: @go4sharing

🎁 加群唠嗑还有抽奖: @go2sharing`;

  console.log(messageText);

  chatIds.forEach((chatId) =>
    sendMessageToTelegramBot(telegramBotToken, chatId, messageText)
  );
}

async function chooseCanuseNode(canUseNodeNames) {
  console.log(canUseNodeNames);
  if (!canUseNodeNames?.length) {
    throw '没有可用节点, 尴尬不?';
  }
  try {
    let canUseNodeName = canUseNodeNames.pop();
    if (canUseNodeName) {
      await changeNode(canUseNodeName);
      const { status } = await axios.get('https://api.github.com');
      console.log(status);
      if (status === 200) {
        return true;
      }
    }
  } catch (error) {
    console.log(error);
  }
  return chooseCanuseNode(canUseNodeNames);
}
