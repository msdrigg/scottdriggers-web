import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import tailwindPlugin from "./plugins/tailwind-config.cjs";
import nodePolyfillPlugin from "./plugins/node-polyfill.cjs";

const config: Config = {
    title: "scottdriggers.com",
    tagline: "Looking into it",
    favicon: "/img/me.png",

    // Set the production url of your site here
    url: "https://scottdriggers.com",
    // Set the /<baseUrl>/ pathname under which your site is served
    // For GitHub pages deployment, it is often '/<projectName>/'
    baseUrl: "/",

    // GitHub pages deployment config.
    // If you aren't using GitHub pages, you don't need these.
    organizationName: "msdrigg", // Usually your GitHub org/user name.
    projectName: "site", // Usually your repo name.

    onBrokenLinks: "throw",

    i18n: {
        defaultLocale: "en",
        locales: ["en"],
    },
    markdown: {
        mermaid: true,
        hooks: {
            onBrokenMarkdownLinks: "warn",
        },
    },

    presets: [
        [
            "classic",
            {
                docs: false,
                blog: {
                    showReadingTime: true,
                    blogSidebarCount: 10,
                    blogTitle: "Scott's Blog",
                    feedOptions: {
                        title: "Scott's Blog",
                        description:
                            "Sporadic writings mostly about software development by Scott Driggers.",
                    },
                },
                theme: {
                    customCss: "./src/css/custom.css",
                },
            } satisfies Preset.Options,
        ],
    ],
    themes: ["@docusaurus/theme-mermaid"],

    themeConfig: {
        navbar: {
            title: "Scott",
            logo: {
                alt: "Scott Driggers Logo",
                src: "https://gravatar.com/avatar/c7abdf73e309877ecf09e03f27d44a4530dbb98035e47bd86b001a396d095a9b?size=512",
            },
            items: [
                { to: "/blog", label: "Blog", position: "left" },
                { to: "/about", label: "About", position: "left" },
            ],
        },
        footer: {
            links: [
                {
                    html: `<a href="https://github.com/msdrigg" class="logo" target="_blank">
            <img src="/img/gh.png" alt="Github Logo">
          </a>`,
                },
                {
                    html: `<a href="https://www.instagram.com/notscottdriggers" class="logo" target="_blank">
            <img src="/img/ig.png" alt="Instagram Logo">
          </a>`,
                },
                {
                    html: `<a href="https://twitter.com/thecasualwaffle" class="logo" target="_blank">
            <img src="/img/x.png" alt="Twitter Logo">
          </a>`,
                },
            ],
            copyright: `Copyright © ${new Date().getFullYear()} Scott Driggers.`,
        },
        colorMode: {
            defaultMode: "dark",
            disableSwitch: false,
            respectPrefersColorScheme: true,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
            additionalLanguages: [
                "bash",
                "swift",
                "json",
                "diff",
                "shell-session",
                "log",
                "systemd",
            ],
        },
    } satisfies Preset.ThemeConfig,
    plugins: [
        [
            "docusaurus-plugin-plausible",
            {
                domain: "site.msd3.io",
                customDomain: "plaus-alytics.msd3.io",
            },
        ],
        tailwindPlugin,
        nodePolyfillPlugin,
    ],
};

export default config;
