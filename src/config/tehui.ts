/**
 * 特惠 API 定制构建（fork）的业务改动都集中在这个文件里，详见仓库根目录 FORK.md。
 *
 * - 添加供应商时不展示第三方中转 / 聚合平台和赞助商推广预设
 * - 内置「特惠 API」预设，在「全部」列表里固定在「自定义配置」旁边
 *
 * 这里只放常量和纯函数，不引入任何运行时依赖：预设数据文件会反过来引用这里，
 * 保持单向依赖，同步上游时冲突最少。
 */

export const TEHUI_NAME = "特惠 API";
export const TEHUI_SITE = "https://api.tehui.xyz";
/** 控制台「API 密钥」页，用作预设的「获取 API Key」链接 */
export const TEHUI_KEYS_URL = `${TEHUI_SITE}/keys`;

/**
 * 本 fork 安装包的下载页（国内可直接访问）。自动更新清单也在这个目录下，
 * 见 src-tauri/tauri.conf.json 的 updater.endpoints；Rust 侧 check_for_updates 用同一个地址。
 */
export const FORK_DOWNLOAD_PAGE = "https://docs.tehui.xyz/download/cc-switch/";
/** 本 fork 的 GitHub 发布页，更新说明里附有对应的上游版本说明 */
export const FORK_RELEASES_URL =
  "https://github.com/sun-y-x/cc-switch-mine/releases";

/** 识别特惠 API 预设只看官网地址，不给各应用的预设类型加字段 */
export function isTehuiPreset(preset: { websiteUrl?: string }): boolean {
  return preset.websiteUrl === TEHUI_SITE;
}

/** 第三方中转、聚合平台：与特惠 API 直接竞争的服务 */
const RELAY_CATEGORIES = new Set(["third_party", "aggregator"]);

/** 需要从预设列表里隐藏的推广项：中转 / 聚合平台，以及上游标记的赞助商 */
export function isPromotedPreset(preset: {
  websiteUrl?: string;
  category?: string;
  isPartner?: boolean;
  primePartner?: boolean;
}): boolean {
  if (isTehuiPreset(preset)) return false;
  return (
    RELAY_CATEGORIES.has(preset.category ?? "") ||
    preset.isPartner === true ||
    preset.primePartner === true
  );
}

/**
 * 开发和正式构建都隐藏推广预设；只有跑单测（vitest 的 MODE 是 "test"）时保持上游行为，
 * 上游那批按预设名点选第三方平台的测试才不用跟着改，同步上游时少冲突。
 * 本 fork 自己的测试用 vi.stubEnv("MODE", "production") 打开它。
 */
export function promotedPresetsHidden(): boolean {
  return import.meta.env.MODE !== "test";
}

export function withoutPromotedPresets<
  T extends { preset: Parameters<typeof isPromotedPreset>[0] },
>(entries: T[]): T[] {
  if (!promotedPresetsHidden()) return entries;
  return entries.filter((entry) => !isPromotedPreset(entry.preset));
}
