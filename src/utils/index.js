const axios = require('axios').default;
const { httpsAgent } = require('../constants');

/** 格式化时间 */
function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes + '分' + seconds + '秒';
}

/** 节点去重, ip端口, uuid, 密码相同视为同一个节点 */
function uniquees(proxies) {
  const proxiesMap = new Map();
  for (let proxy of proxies) {
    proxiesMap.set(
      `${proxy.server}:${proxy.port}:${proxy.uuid || '-'}:${
        proxy.password || '-'
      }`,
      proxy
    );
  }
  return [...proxiesMap.values()];
}

async function sendMessageToTelegramBot(token, chatId, message) {
  try {
    const imageUrl = `https://www.loliapi.com/acg/pe/?_=${new Date().valueOf()}`;
    const response = await axios.post(
      // `https://api.telegram.org/bot${token}/sendMessage`,
      `https://api.telegram.org/bot${token}/sendPhoto`,
      {
        chat_id: chatId,
        caption: message,
        parse_mode: 'Markdown',
        photo: imageUrl,
      },
      {
        httpsAgent,
      }
    );
    if (response.data.ok) {
      console.log('发送成功');
    }
  } catch (error) {
    console.error('Error sending message:', error.message);
  }
}

const getTransLink = (rawUrl, type = 'clash') =>
  `https://sub.789.st/sub?target=${type}&url=${rawUrl}&insert=false&config=https%3A%2F%2Fraw.githubusercontent.com%2FACL4SSR%2FACL4SSR%2Fmaster%2FClash%2Fconfig%2FACL4SSR_Online.ini&exclude=%E6%B5%81%E9%87%8F%7C%E8%BF%87%E6%9C%9F%7C%E5%AE%98%E7%BD%91%7C%E8%90%BD%E5%9C%B0%7C%E5%9B%9E%E5%9B%BD%7C%E6%9C%AC%E7%AB%99%7C%E7%94%A8%E6%88%B7%7C%E8%8B%A5%7C%E7%BB%AD%E8%B4%B9%7C%E9%82%AE%E7%AE%B1%7C%E8%AE%A2%E9%98%85&emoji=true&list=false&tfo=false&scv=false&fdn=false&sort=true&new_name=true`;

module.exports = {
  formatTime,
  uniquees,
  getTransLink,
  sendMessageToTelegramBot,
};
