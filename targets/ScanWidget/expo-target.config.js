const appConfig = require('../../app.config.js');

module.exports = {
  type: "widget",
  deploymentTarget: "18.0",
  icon: "../../assets/icon.png",
  version: appConfig.expo.version,
  buildNumber: appConfig.expo.ios.buildNumber
};
