/**
 * PostCSS 配置。
 *
 * Tailwind CSS v4 起，PostCSS 插件由 `@tailwindcss/postcss` 提供，
 * autoprefixer 已内置，不再需要单独配置。
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
