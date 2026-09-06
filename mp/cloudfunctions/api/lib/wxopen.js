/**
 * 云调用适配层。目前只有「拿 code 换手机号」这一个能力。
 *
 * getPhoneNumber 从 2023-08-28 起按次收费（每次成功 0.03 元），
 * 且需要企业主体。用 config.json 的 permissions.openapi 声明后，
 * 云调用不用自己管 access_token。
 *
 * 抽成适配层是为了让 handlers 能注入假实现做单测 —— 单测不该联网，
 * 更不该真的产生调用费。
 */
module.exports = function (cloudSdk) {
  return {
    /** code → 11 位手机号；失败返回 null，由调用方决定怎么兜底 */
    async phoneByCode(code) {
      if (!code) return null;
      const r = await cloudSdk.openapi.phonenumber.getPhoneNumber({ code: code });
      const info = r && r.phoneInfo;
      // purePhoneNumber 是不带国家码的号；countryCode 单独给
      return (info && (info.purePhoneNumber || info.phoneNumber)) || null;
    },
  };
};
