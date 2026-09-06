/**
 * 云开发环境配置
 *
 * 环境 ID 不是密钥 —— 它随小程序包一起下发到每台手机，任何人都能看到，
 * 提交进版本库没有问题。真正要防的是 AppSecret / 商户密钥，那些一律不进代码。
 *
 * 换环境：改 cloudEnv。临时回本地假数据：useMock 改 true（不必清空 cloudEnv）。
 */
module.exports = {
  cloudEnv: '<你的云环境ID>',
  useMock: true,           // 阶段 5–8 搁置期间一律走假数据。
                           // 云函数还没上传，走真链路只会得到一堆 INTERNAL。
                           // 恢复后端工作时改回 false。
};
