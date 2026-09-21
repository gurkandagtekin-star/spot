/** Production AAB: HTTPS only. Local Metro / LAN API still needs HTTP. */
module.exports = ({ config }) => {
  const production = String(process.env.EAS_BUILD_PROFILE || '') === 'production';
  return {
    ...config,
    android: {
      ...(config.android || {}),
      usesCleartextTraffic: production ? false : true,
    },
  };
};
