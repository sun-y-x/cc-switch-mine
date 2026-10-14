import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ProviderPresetSelector,
  type PresetEntry,
} from "@/components/providers/forms/ProviderPresetSelector";
import { claudeDesktopProviderPresets } from "@/config/claudeDesktopProviderPresets";
import { providerPresets } from "@/config/claudeProviderPresets";
import { codexProviderPresets } from "@/config/codexProviderPresets";
import { geminiProviderPresets } from "@/config/geminiProviderPresets";
import {
  TEHUI_KEYS_URL,
  TEHUI_NAME,
  TEHUI_SITE,
  isPromotedPreset,
  isTehuiPreset,
  withoutPromotedPresets,
} from "@/config/tehui";

vi.mock("@/components/ProviderIcon", () => ({
  ProviderIcon: ({ name }: { name: string }) => (
    <span data-testid="provider-icon" data-name={name} />
  ),
}));

// 和 ProviderForm 里建列表的方式一致：id = 应用名-下标
const claudeEntries: PresetEntry[] = providerPresets
  .filter((preset) => !preset.hidden)
  .map((preset, index) => ({ id: `claude-${index}`, preset }));
const codexEntries: PresetEntry[] = codexProviderPresets.map(
  (preset, index) => ({ id: `codex-${index}`, preset }),
);

const isRelay = (preset: PresetEntry["preset"]) =>
  preset.category === "third_party" || preset.category === "aggregator";

describe("fork：特惠 API 预设", () => {
  it("Claude 和 Codex 各有一个，指向特惠 API 且不带推广标记", () => {
    const claude = providerPresets.filter(isTehuiPreset);
    const codex = codexProviderPresets.filter(isTehuiPreset);
    expect(claude).toHaveLength(1);
    expect(codex).toHaveLength(1);

    for (const preset of [...claude, ...codex]) {
      expect(preset.name).toBe(TEHUI_NAME);
      expect(preset.apiKeyUrl).toBe(TEHUI_KEYS_URL);
      expect(preset.isPartner).toBeUndefined();
      expect(isPromotedPreset(preset)).toBe(false);
    }
    expect(claude[0].settingsConfig).toEqual({
      env: { ANTHROPIC_BASE_URL: TEHUI_SITE, ANTHROPIC_AUTH_TOKEN: "" },
    });
    // Codex 走 /v1，与控制台一键导入写入的地址一致
    expect(codex[0].config).toContain(`base_url = "${TEHUI_SITE}/v1"`);
    expect(codex[0].config).toContain("requires_openai_auth = true");
    expect(codex[0].auth).toEqual({ OPENAI_API_KEY: "" });
  });

  it("Claude 桌面版也有一个：直连、不写模型，让桌面版自己读模型列表", () => {
    const desktop = claudeDesktopProviderPresets.filter(isTehuiPreset);
    expect(desktop).toHaveLength(1);
    expect(desktop[0]).toMatchObject({
      name: TEHUI_NAME,
      apiKeyUrl: TEHUI_KEYS_URL,
      baseUrl: TEHUI_SITE,
      mode: "direct",
      apiFormat: "anthropic",
    });
    expect(desktop[0].modelRoutes).toBeUndefined();
    expect(isPromotedPreset(desktop[0])).toBe(false);
  });

  it("追加在上游预设末尾，不改变上游预设的下标", () => {
    expect(isTehuiPreset(providerPresets.at(-1)!)).toBe(true);
    expect(isTehuiPreset(codexProviderPresets.at(-1)!)).toBe(true);
    expect(isTehuiPreset(claudeDesktopProviderPresets.at(-1)!)).toBe(true);
  });
});

describe("fork：隐藏推广预设", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("单测模式保持上游行为，正式构建才隐藏", () => {
    expect(withoutPromotedPresets(claudeEntries)).toHaveLength(
      claudeEntries.length,
    );
    vi.stubEnv("MODE", "production");
    expect(withoutPromotedPresets(claudeEntries).length).toBeLessThan(
      claudeEntries.length,
    );
  });

  it("去掉所有中转 / 聚合平台和赞助商，保留官方、厂商、云服务商和特惠 API", () => {
    vi.stubEnv("MODE", "production");
    const apps = {
      claude: claudeEntries,
      codex: codexEntries,
      gemini: geminiProviderPresets.map((preset, index) => ({
        id: `gemini-${index}`,
        preset,
      })),
      "claude-desktop": claudeDesktopProviderPresets.map((preset, index) => ({
        id: `claude-desktop-${index}`,
        preset,
      })),
    };
    for (const [app, entries] of Object.entries(apps)) {
      const kept = withoutPromotedPresets(entries).map((entry) => entry.preset);
      const leaked = kept.filter(
        (preset) =>
          !isTehuiPreset(preset) &&
          (isRelay(preset) ||
            ("isPartner" in preset && preset.isPartner) ||
            ("primePartner" in preset && preset.primePartner)),
      );
      expect(
        leaked.map((preset) => preset.name),
        app,
      ).toEqual([]);
      expect(
        kept.some((preset) => preset.category === "official"),
        app,
      ).toBe(true);
    }
    const keptClaude = withoutPromotedPresets(claudeEntries).map(
      (entry) => entry.preset,
    );
    expect(keptClaude.filter(isTehuiPreset)).toHaveLength(1);
    expect(keptClaude.some((p) => p.category === "cn_official")).toBe(true);
    expect(keptClaude.some((p) => p.category === "cloud_provider")).toBe(true);
  });
});

describe("fork：选预设列表", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView ??= vi.fn();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function renderPicker(selectedPresetId: string | null = null) {
    const onPresetChange = vi.fn();
    render(
      <ProviderPresetSelector
        selectedPresetId={selectedPresetId}
        presetEntries={claudeEntries}
        onPresetChange={onPresetChange}
      />,
    );
    return onPresetChange;
  }

  it("特惠 API 固定在自定义配置旁边，列表里看不到中转平台", async () => {
    vi.stubEnv("MODE", "production");
    const user = userEvent.setup();
    const onPresetChange = renderPicker();

    const firstRow = screen
      .getByRole("button", { name: "providerPreset.custom" })
      .closest("div")!;
    expect(
      within(firstRow)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["providerPreset.custom", TEHUI_NAME]);
    // 只出现一次：不会在「第三方平台」分段里再列一遍
    expect(screen.getAllByRole("button", { name: TEHUI_NAME })).toHaveLength(1);

    for (const relay of claudeEntries.filter((e) => isRelay(e.preset))) {
      if (isTehuiPreset(relay.preset)) continue;
      expect(
        screen.queryByRole("button", { name: relay.preset.name }),
        relay.preset.name,
      ).not.toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: "Claude Official" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: TEHUI_NAME }));
    const tehuiId = claudeEntries.find((e) => isTehuiPreset(e.preset))!.id;
    expect(onPresetChange).toHaveBeenCalledWith(tehuiId);
  });

  it("搜索中转平台的名字搜不到，搜「特惠」能找到", async () => {
    vi.stubEnv("MODE", "production");
    const user = userEvent.setup();
    renderPicker();
    const search = screen.getByRole("textbox", {
      name: "providerPreset.searchAriaLabel",
    });

    await user.type(search, "AiHubMix");
    expect(screen.getByText("providerPreset.noResults")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "特惠");
    expect(
      screen.getByRole("button", { name: TEHUI_NAME }),
    ).toBeInTheDocument();
  });

  it("编辑来自赞助商预设的旧供应商时，不提供切回推广版本的入口", () => {
    const sponsored = claudeEntries.find(
      (entry) =>
        "primePartner" in entry.preset &&
        entry.preset.primePartner &&
        entry.preset.family &&
        claudeEntries.filter((e) => e.preset.family === entry.preset.family)
          .length > 1,
    )!;
    expect(sponsored).toBeDefined();

    // 上游行为：同一家的版本切换会出现
    const { unmount } = render(
      <ProviderPresetSelector
        selectedPresetId={sponsored.id}
        presetEntries={claudeEntries}
        onPresetChange={vi.fn()}
      />,
    );
    const versionControls = () =>
      screen.queryAllByLabelText(
        /providerPreset\.(versionLabel|planLabel|regionLabel)/,
      );
    expect(versionControls().length).toBeGreaterThan(0);
    unmount();

    vi.stubEnv("MODE", "production");
    renderPicker(sponsored.id);
    expect(versionControls()).toEqual([]);
  });
});
