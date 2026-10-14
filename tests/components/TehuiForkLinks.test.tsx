import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IconPicker } from "@/components/IconPicker";
import { AboutSection } from "@/components/settings/AboutSection";
import { ApiKeySection } from "@/components/providers/forms/shared/ApiKeySection";
import { iconList } from "@/icons/extracted";
import { changelogUrl } from "@/lib/whatsNew";
import { FORK_RELEASES_URL, TEHUI_SITE, isPickableIcon } from "@/config/tehui";

const mocks = vi.hoisted(() => ({ openExternal: vi.fn() }));

// 测试的 i18n 是空资源，推广语传了 defaultValue: "" 会变成空串；这里让 t() 原样返回 key，
// 推广语如果没被拦下就会以 key 的形式出现（和 ApiKeySection.test.tsx 一样）
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "zh", changeLanguage: async () => {} },
  }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    settingsApi: { ...actual.settingsApi, openExternal: mocks.openExternal },
  };
});
vi.mock("@/contexts/UpdateContext", () => ({
  useUpdate: () => ({
    hasUpdate: false,
    updateInfo: null,
    checkUpdate: vi.fn(),
    resetDismiss: vi.fn(),
    isChecking: false,
  }),
}));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: async () => "4.0.11" }));

function withClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fork：关于页和外部链接", () => {
  it("没有 GitHub 按钮和邀 Star 条，「官方网站」打开特惠 API", async () => {
    render(<AboutSection isPortable={false} />);
    await screen.findByText(/v4\.0\.11/);

    expect(screen.queryByText("settings.github")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.starPrompt")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.starOnGithub")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("settings.officialWebsite"));
    expect(mocks.openExternal).toHaveBeenLastCalledWith(TEHUI_SITE);

    fireEvent.click(screen.getByText("settings.releaseNotes"));
    await waitFor(() =>
      expect(mocks.openExternal).toHaveBeenLastCalledWith(
        `${FORK_RELEASES_URL}/tag/v4.0.11`,
      ),
    );
  });

  it("更新日志不再指向上游官网", () => {
    expect(changelogUrl("zh", "4.0.11")).toBe(
      `${FORK_RELEASES_URL}/tag/v4.0.11`,
    );
    expect(changelogUrl("en")).toBe(FORK_RELEASES_URL);
  });

  it("编辑旧的赞助商供应商时不显示推广语", () => {
    vi.stubEnv("MODE", "production");
    render(
      <ApiKeySection
        value=""
        onChange={() => {}}
        category="third_party"
        shouldShowLink
        websiteUrl="https://example.com/keys"
        partnerPromotionKey="kimi"
      />,
    );
    expect(
      screen.queryByText(/providerForm\.partnerPromotion/),
    ).not.toBeInTheDocument();
  });
});

describe("fork：选择图标", () => {
  it("只列模型厂商、云服务商和常用工具，不列中转站", () => {
    vi.stubEnv("MODE", "production");
    render(withClient(<IconPicker onValueChange={() => {}} />));

    const titles = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("title"))
      .filter(Boolean);
    for (const name of ["Anthropic", "OpenAI", "DeepSeek", "AWS"]) {
      expect(titles, name).toContain(name);
    }
    for (const name of ["88API", "AiHubMix", "OpenRouter", "PackyCode"]) {
      expect(titles, name).not.toContain(name);
    }
  });

  it("搜中转站的名字也搜不到", () => {
    vi.stubEnv("MODE", "production");
    render(withClient(<IconPicker onValueChange={() => {}} />));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "aggregator" },
    });
    expect(screen.queryByTitle("AiHubMix")).not.toBeInTheDocument();
    expect(screen.queryByTitle("88API")).not.toBeInTheDocument();
  });

  it("白名单里的名字都是真实存在的内置图标", () => {
    vi.stubEnv("MODE", "production");
    const pickable = iconList.filter(isPickableIcon);
    expect(pickable.length).toBeGreaterThan(40);
    expect(pickable.length).toBeLessThan(iconList.length);
  });
});
