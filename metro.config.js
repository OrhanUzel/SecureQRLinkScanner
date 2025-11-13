const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro treats .txt as an asset so we can require blacklist.txt
config.resolver = config.resolver || {};
config.resolver.assetExts = Array.from(new Set([...(config.resolver.assetExts || []), 'txt']));

module.exports = config;